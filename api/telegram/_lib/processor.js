import { daysBetweenReadings, extractTransactionDate, jakartaDateTime } from "./dates.js";
import { compactIdr, formatIdr, formatNumber, formatShortDate, formatUsd } from "./format.js";
import { BOTFATHER_COMMANDS, HELP_TEXT, START_TEXT } from "./messages.js";
import {
  CREDIT_SOURCES, TRANSACTION_CATEGORIES, inferCategory, inferChannel, normalizeSearch,
  parseCommand, parseDecimal, parseMoney, parseNaturalShortcut, parseQuickTransaction
} from "./parser.js";
import { inlineButtons } from "./telegram.js";

const categoryKeyboard = () => inlineButtons([
  [["Food","cvf:category:Food"],["Essentials","cvf:category:Essentials"]],
  [["Coffee","cvf:category:Coffee"],["Others","cvf:category:Others"]]
]);

const creditSourceKeyboard = () => inlineButtons([
  [["Credit Card","cvf:credit-source:Credit Card"]],
  [["GoPayLater","cvf:credit-source:GoPayLater"],["ShopeePayLater","cvf:credit-source:ShopeePayLater"]]
]);

export async function processTelegramUpdate(context) {
  const { callbackQuery, text } = context;
  if (callbackQuery) return processCallback(context);
  const command = parseCommand(text);
  if (command) {
    if (command.name !== "cancel") await clearStateQuietly(context);
    return processCommand(context, command);
  }

  const state = await context.db.getState(context.telegramUserId, context.chatId);
  if (state) return processConversationState(context, state);

  const transaction = parseQuickTransaction(text, context.messageTimestamp);
  if (transaction) return beginOrSaveTransaction(context, transaction);

  const shortcut = parseNaturalShortcut(text);
  if (shortcut?.kind === "balance") return updateBalance(context, shortcut.name, shortcut.amount);
  if (shortcut?.kind === "electricity") return saveElectricity(context, shortcut.remaining);
  if (shortcut?.kind === "client_payment") return updateClient(context, shortcut.name, "amount", shortcut.amount);

  return context.telegram.sendMessage(context.chatId, "I didn't understand that. Try -50k grocery or send /help.");
}

async function processCommand(context, command) {
  switch (command.name) {
    case "start": return context.telegram.sendMessage(context.chatId, START_TEXT);
    case "help": return context.telegram.sendMessage(context.chatId, HELP_TEXT);
    case "cancel":
      await clearStateQuietly(context);
      return context.telegram.sendMessage(context.chatId, "Cancelled. Nothing was changed.");
    case "balance": return handleBalance(context, command.args);
    case "client": return handleClient(context, command.args);
    case "credit": return handleCredit(context, command.args);
    case "electricity": return handleElectricity(context, command.args);
    case "stocks": return showStocks(context);
    case "target": return handleTarget(context, command.args);
    case "summary": return showSummary(context);
    case "commands": return context.telegram.sendMessage(context.chatId, BOTFATHER_COMMANDS);
    default: return context.telegram.sendMessage(context.chatId, "Unknown command. Send /help to see the command list.");
  }
}

async function beginOrSaveTransaction(context, transaction) {
  if (!transaction.description) {
    await context.db.setState(context.telegramUserId, context.chatId, {kind:"transaction_description",draft:transaction});
    const prompt = transaction.type === "income" ? "What should I call this income?" : "What was this for?";
    return context.telegram.sendMessage(context.chatId, prompt);
  }
  if (transaction.type === "expense" && !transaction.categoryCertain) {
    await context.db.setState(context.telegramUserId, context.chatId, {kind:"transaction_category",draft:transaction});
    return context.telegram.sendMessage(context.chatId, "Which category should I use?", {reply_markup:categoryKeyboard()});
  }
  return saveTransaction(context, transaction);
}

async function saveTransaction(context, transaction) {
  await context.db.insertTransaction(transaction, context.updateId, context.messageTimestamp);
  await clearStateQuietly(context);
  const typeLabel = transaction.type === "income" ? "Income" : "Expense";
  const detail = transaction.type === "income"
    ? `${formatIdr(transaction.amount)} · ${transaction.description} · ${formatShortDate(transaction.transactionDate)}`
    : `${formatIdr(transaction.amount)} · ${transaction.category} · ${transaction.channel} · ${formatShortDate(transaction.transactionDate)}`;
  return context.telegram.sendMessage(context.chatId, `✓ ${typeLabel} saved\n${detail}`);
}

async function processConversationState(context, state) {
  const text = String(context.text || "").trim();
  if (state.kind === "transaction_description") {
    if (!text) return context.telegram.sendMessage(context.chatId, "Please send a short description.");
    const dated = extractTransactionDate(text, context.messageTimestamp);
    const draft = {...state.draft,description:dated.text,transactionDate:dated.date};
    if (!draft.description) return context.telegram.sendMessage(context.chatId, "Please send a short description.");
    if (draft.type === "income") {
      draft.category = "Others";
      draft.categoryCertain = true;
      draft.channel = inferChannel(draft.description, "income");
    } else {
      const inferred = inferCategory(draft.description);
      draft.category = inferred.category;
      draft.categoryCertain = inferred.certain;
      draft.channel = inferChannel(draft.description, "expense");
    }
    return beginOrSaveTransaction(context, draft);
  }
  if (state.kind === "transaction_category") {
    const category = TRANSACTION_CATEGORIES.find(item => normalizeSearch(item) === normalizeSearch(text));
    if (!category) return context.telegram.sendMessage(context.chatId, "Choose a category below.", {reply_markup:categoryKeyboard()});
    return saveTransaction(context, {...state.draft,category,categoryCertain:true});
  }
  if (state.kind === "credit_source") {
    const source = CREDIT_SOURCES.find(item => normalizeSearch(item) === normalizeSearch(text));
    if (!source) return context.telegram.sendMessage(context.chatId, "Choose the credit source.", {reply_markup:creditSourceKeyboard()});
    await context.db.setState(context.telegramUserId, context.chatId, {kind:"credit_description",source});
    return context.telegram.sendMessage(context.chatId, "What is the item description?");
  }
  if (state.kind === "credit_description") {
    if (!text) return context.telegram.sendMessage(context.chatId, "Please send the item description.");
    await context.db.setState(context.telegramUserId, context.chatId, {kind:"credit_amount",source:state.source,description:text});
    return context.telegram.sendMessage(context.chatId, "What is the amount? Example: 250k");
  }
  if (state.kind === "credit_amount") {
    const amount = parseMoney(text);
    if (!amount) return context.telegram.sendMessage(context.chatId, "I couldn't read that amount. Try 250k or 1.2jt.");
    return addCredit(context, state.source, state.description, amount);
  }
  await clearStateQuietly(context);
  return context.telegram.sendMessage(context.chatId, "That conversation expired. Please send the command again.");
}

async function processCallback(context) {
  const data = String(context.callbackQuery.data || "");
  const state = await context.db.getState(context.telegramUserId, context.chatId);
  await context.telegram.answerCallbackQuery(context.callbackQuery.id).catch(() => {});
  if (!state) return context.telegram.sendMessage(context.chatId, "That choice expired. Please start again.");
  if (data.startsWith("cvf:category:") && state.kind === "transaction_category") {
    const category = data.slice("cvf:category:".length);
    if (!TRANSACTION_CATEGORIES.includes(category)) return;
    return saveTransaction(context, {...state.draft,category,categoryCertain:true});
  }
  if (data.startsWith("cvf:credit-source:") && state.kind === "credit_source") {
    const source = data.slice("cvf:credit-source:".length);
    if (!CREDIT_SOURCES.includes(source)) return;
    await context.db.setState(context.telegramUserId, context.chatId, {kind:"credit_description",source});
    return context.telegram.sendMessage(context.chatId, `Source: ${source}\nWhat is the item description?`);
  }
  return context.telegram.sendMessage(context.chatId, "That choice no longer matches the current step. Send /cancel to reset.");
}

async function handleBalance(context, args) {
  if (!args) {
    const accounts = await context.db.listAccounts();
    const total = accounts.reduce((sum,row)=>sum+Number(row.balance),0);
    const lines = accounts.map(row=>`${row.name} — ${formatIdr(row.balance)}`);
    return context.telegram.sendMessage(context.chatId, `Balances\n${lines.join("\n")}\n\nTotal — ${formatIdr(total)}`);
  }
  const match = args.match(/^(.+?)\s+([0-9][0-9.,]*(?:\s*(?:k|rb|ribu|jt|juta|m))?)$/i);
  if (!match) return context.telegram.sendMessage(context.chatId, "Use /balance BCA 12.5jt");
  return updateBalance(context, match[1], parseMoney(match[2],{allowZero:true}));
}

async function updateBalance(context, name, amount) {
  if (amount === null || amount === undefined) return context.telegram.sendMessage(context.chatId, "I couldn't read that balance. Try /balance BCA 12.5jt");
  const account = await context.db.updateAccount(name, amount);
  return context.telegram.sendMessage(context.chatId, `✓ Balance updated\n${account.name} · ${formatIdr(account.balance)}`);
}

async function handleClient(context, args) {
  if (!args) {
    const clients = await context.db.listClients();
    const lines = clients.map(client=>{
      const due = Math.max(0,Number(client.monthly_retainer)+Number(client.previous_outstanding)-Number(client.paid_this_month));
      return `${client.name} — ${client.status} · due ${formatIdr(due)}`;
    });
    return context.telegram.sendMessage(context.chatId, `Clients\n${lines.join("\n") || "No clients."}`);
  }
  let match = args.match(/^(.+?)\s+(freeze|unfreeze)$/i);
  if (match) return updateClient(context, match[1], match[2].toLowerCase());
  match = args.match(/^(.+?)\s+paid(?:\s+([0-9][0-9.,]*(?:\s*(?:k|rb|ribu|jt|juta|m))?))?$/i);
  if (match) return match[2] ? updateClient(context, match[1], "amount", parseMoney(match[2],{allowZero:true})) : updateClient(context, match[1], "paid");
  match = args.match(/^(.+?)\s+([0-9][0-9.,]*(?:\s*(?:k|rb|ribu|jt|juta|m))?)$/i);
  if (match) return updateClient(context, match[1], "amount", parseMoney(match[2],{allowZero:true}));
  const client = await context.db.getClient(args);
  return showClient(context, client);
}

async function updateClient(context, name, action, amount = null) {
  if (action === "amount" && (amount === null || amount === undefined)) return context.telegram.sendMessage(context.chatId, "I couldn't read that payment amount.");
  const client = await context.db.updateClient(name, action, amount);
  return showClient(context, client, "✓ Client updated\n");
}

async function showClient(context, client, prefix = "") {
  const totalDue = Number(client.monthly_retainer)+Number(client.previous_outstanding);
  const remaining = Math.max(0,totalDue-Number(client.paid_this_month));
  const text = `${prefix}${client.name}\nMonthly retainer: ${formatIdr(client.monthly_retainer)}\nPaid this month: ${formatIdr(client.paid_this_month)}\nPrevious outstanding: ${formatIdr(client.previous_outstanding)}\nRemaining: ${formatIdr(remaining)}\nStatus: ${client.status}`;
  return context.telegram.sendMessage(context.chatId, text);
}

async function handleCredit(context, args) {
  if (!args) return showCredit(context);
  if (normalizeSearch(args) === "add") {
    await context.db.setState(context.telegramUserId, context.chatId, {kind:"credit_source"});
    return context.telegram.sendMessage(context.chatId, "Choose the source.", {reply_markup:creditSourceKeyboard()});
  }
  const paid = args.match(/^paid\s+(.+)$/i);
  if (paid) {
    const item = await context.db.markCreditPaid(paid[1]);
    return context.telegram.sendMessage(context.chatId, `✓ Marked paid\n${item.description} · ${formatIdr(item.amount)} · ${item.source}`);
  }
  return context.telegram.sendMessage(context.chatId, "Use /credit, /credit add, or /credit paid <item>.");
}

async function showCredit(context) {
  const items = await context.db.listUnpaidCredit();
  if (!items.length) return context.telegram.sendMessage(context.chatId, "Credit / PayLater\nNo unpaid items.");
  const groups = CREDIT_SOURCES.map(source => {
    const rows = items.filter(item=>item.source===source);
    if (!rows.length) return null;
    return `${source}\n${rows.map(item=>`- ${item.description} · ${formatIdr(item.amount)} · due ${formatShortDate(item.due_date,true)}`).join("\n")}`;
  }).filter(Boolean);
  const total = items.reduce((sum,row)=>sum+Number(row.amount),0);
  return context.telegram.sendMessage(context.chatId, `Credit / PayLater\n\n${groups.join("\n\n")}\n\nTotal unpaid: ${formatIdr(total)}`);
}

async function addCredit(context, source, description, amount) {
  const item = await context.db.addCreditItem(source, description, amount, context.messageTimestamp, context.updateId);
  await clearStateQuietly(context);
  return context.telegram.sendMessage(context.chatId, `✓ Credit item saved\n${item.description} · ${formatIdr(item.amount)} · ${item.source}\nDue ${formatShortDate(item.due_date,true)}`);
}

async function handleElectricity(context, args) {
  if (!args) return showElectricity(context);
  const remaining = parseDecimal(args);
  if (remaining === null) return context.telegram.sendMessage(context.chatId, "Use /electricity 320.5");
  return saveElectricity(context, remaining);
}

async function saveElectricity(context, remaining) {
  if (remaining === null || remaining === undefined) return context.telegram.sendMessage(context.chatId, "I couldn't read that kWh value.");
  const dateTime = jakartaDateTime(context.messageTimestamp);
  await context.db.addElectricityReading(remaining,dateTime.date,dateTime.time,context.updateId,context.messageTimestamp);
  return context.telegram.sendMessage(context.chatId, `⚡ Reading saved\n${formatNumber(remaining)} kWh · ${formatShortDate(dateTime.date,true)} · ${dateTime.time}`);
}

async function showElectricity(context) {
  const snapshot = await context.db.electricitySnapshot();
  if (!snapshot.readings.length) return context.telegram.sendMessage(context.chatId, "Electricity\nNo readings yet. Use /electricity 320.5");
  const latest = snapshot.readings[0];
  let daily = 0;
  if (snapshot.readings.length > 1) {
    const earlier = snapshot.readings[1];
    const days = daysBetweenReadings(earlier,latest);
    const used = Math.max(0,Number(earlier.remaining_kwh)-Number(latest.remaining_kwh));
    daily = days > 0 ? used/days : 0;
  }
  const dailyCost = daily*snapshot.rateKwh;
  return context.telegram.sendMessage(context.chatId,
    `Electricity\nLatest: ${formatNumber(latest.remaining_kwh)} kWh · ${formatShortDate(latest.reading_date,true)}\nAverage: ${daily.toFixed(1)} kWh/day\nDaily cost: ${formatIdr(dailyCost)}\nMonthly estimate: ${formatIdr(dailyCost*30)}`);
}

async function showStocks(context) {
  const snapshot = await context.db.stockSnapshot();
  if (!snapshot.stocks.length) return context.telegram.sendMessage(context.chatId, "Stocks\nNo holdings yet.");
  let total = 0;
  const lines = snapshot.stocks.map(stock=>{
    const price = Number(stock.current_price || stock.manual_current_price || 0);
    const rawValue = Number(stock.quantity)*price;
    const idrValue = stock.currency === "USD" ? rawValue*snapshot.usdIdr : rawValue;
    total += idrValue;
    const quantity = stock.market === "IDX" ? `${formatNumber(Number(stock.quantity)/100)} lot` : `${formatNumber(stock.quantity)} shares`;
    const shownPrice = stock.currency === "USD" ? formatUsd(price) : formatIdr(price);
    return `${stock.display_symbol} — ${quantity}\n${shownPrice} · ${stock.price_status || "latest"} · ${compactIdr(idrValue)}`;
  });
  return context.telegram.sendMessage(context.chatId, `Stocks\n\n${lines.join("\n\n")}\n\nPortfolio: ${formatIdr(total)}`);
}

async function handleTarget(context, args) {
  const match = args.match(/^([A-Z0-9.:-]{1,24})\s+(base|optimistic)\s+(\d{4})\s+([0-9][0-9.,]*(?:\s*(?:k|rb|ribu|jt|juta|m))?)$/i);
  if (!match) return context.telegram.sendMessage(context.chatId, "Use /target BMRI base 2027 6500");
  const year = Number(match[3]);
  const targetPrice = parseMoney(match[4]);
  if (year < 2027 || year > 2100 || !targetPrice) return context.telegram.sendMessage(context.chatId, "Target year must be 2027–2100 and price must be positive.");
  const target = await context.db.updateStockTarget(match[1],match[2].toLowerCase(),year,targetPrice);
  const price = target.holding.currency === "USD" ? formatUsd(target.target_price) : formatIdr(target.target_price);
  return context.telegram.sendMessage(context.chatId, `✓ Target updated\n${target.holding.display_symbol} · ${target.scenario} ${target.target_year} · ${price}`);
}

async function showSummary(context) {
  const summary = await context.db.summary(context.messageTimestamp);
  const text = `CVFinance Summary\nLiquid balance: ${formatIdr(summary.liquid)}\nIncome this month: ${formatIdr(summary.income)}\nExpenses this month: ${formatIdr(summary.expenses)}\nClient outstanding: ${formatIdr(summary.outstanding)}\nUnpaid credit: ${formatIdr(summary.unpaidCredit)}\nStock portfolio: ${formatIdr(summary.portfolio)}\nProjected month-end cash: ${formatIdr(summary.projected)}`;
  return context.telegram.sendMessage(context.chatId, text);
}

async function clearStateQuietly(context) {
  try { await context.db.clearState(context.telegramUserId, context.chatId); } catch { /* state expires automatically */ }
}
