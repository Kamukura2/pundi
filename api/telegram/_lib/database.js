import { createClient } from "@supabase/supabase-js";
import { jakartaParts, monthBounds, nextDueDate } from "./dates.js";
import { logEvent } from "./log.js";
import { normalizeSearch } from "./parser.js";

const STATE_TTL_MINUTES = 20;
const MONTH_INDEX={january:1,jan:1,januari:1,february:2,feb:2,februari:2,march:3,mar:3,maret:3,april:4,apr:4,may:5,mei:5,june:6,jun:6,juni:6,july:7,jul:7,juli:7,august:8,aug:8,agustus:8,september:9,sep:9,october:10,oct:10,oktober:10,november:11,nov:11,december:12,dec:12,desember:12};
const paymentMonth=value=>MONTH_INDEX[String(value||"").trim().toLowerCase()]||MONTH_INDEX[String(value||"").trim().toLowerCase().slice(0,3)]||1;

function dbError(error, code = "database_error", table = null) {
  return Object.assign(new Error(error?.message || "Database operation failed."), { code, status:500, database:true, table });
}

function isDuplicate(error) {
  return error?.code === "23505";
}

export class CVFinanceDatabase {
  constructor(url, serviceRoleKey, ownerUserId) {
    this.ownerUserId = ownerUserId;
    this.client = createClient(url, serviceRoleKey, {
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      global:{headers:{"X-Client-Info":"cvfinance-telegram/1.0"}}
    });
  }

  async verifyOwner() {
    const { data, error } = await this.client.from("profiles").select("user_id").eq("user_id", this.ownerUserId).maybeSingle();
    if (error) throw dbError(error, "owner_verification_failed");
    if (!data) throw Object.assign(new Error("CVFINANCE_OWNER_USER_ID does not match a CVFinance profile."), { code:"owner_not_found", status:503, database:true });
  }

  async claimUpdate(updateId, updateKind) {
    const { error } = await this.client.from("telegram_cvfinance_updates").insert({
      update_id:String(updateId), owner_user_id:this.ownerUserId, update_kind:updateKind, status:"processing"
    });
    if (!error) return true;
    if (isDuplicate(error)) return false;
    throw dbError(error, "update_claim_failed");
  }

  async finishUpdate(updateId, status, errorCode = null) {
    const { error } = await this.client.from("telegram_cvfinance_updates")
      .update({status,error_code:errorCode}).eq("update_id", String(updateId)).eq("owner_user_id", this.ownerUserId);
    if (error) throw dbError(error, "update_finish_failed");
  }

  async cleanup() {
    const stateCutoff = new Date().toISOString();
    const logCutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    await Promise.all([
      this.client.from("telegram_cvfinance_states").delete().eq("owner_user_id", this.ownerUserId).lt("expires_at", stateCutoff),
      this.client.from("telegram_cvfinance_updates").delete().eq("owner_user_id", this.ownerUserId).lt("created_at", logCutoff)
    ]);
  }

  async getState(telegramUserId, telegramChatId) {
    const { data, error } = await this.client.from("telegram_cvfinance_states").select("state,expires_at")
      .eq("owner_user_id", this.ownerUserId).eq("telegram_user_id", String(telegramUserId))
      .eq("telegram_chat_id", String(telegramChatId)).maybeSingle();
    if (error) throw dbError(error, "state_read_failed");
    if (!data) return null;
    if (Date.parse(data.expires_at) <= Date.now()) {
      await this.clearState(telegramUserId, telegramChatId);
      return null;
    }
    return data.state;
  }

  async setState(telegramUserId, telegramChatId, state) {
    const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60000).toISOString();
    const { error } = await this.client.from("telegram_cvfinance_states").upsert({
      owner_user_id:this.ownerUserId, telegram_user_id:String(telegramUserId), telegram_chat_id:String(telegramChatId),
      state, expires_at:expiresAt
    }, {onConflict:"owner_user_id,telegram_user_id,telegram_chat_id"});
    if (error) throw dbError(error, "state_write_failed");
  }

  async clearState(telegramUserId, telegramChatId) {
    const { error } = await this.client.from("telegram_cvfinance_states").delete()
      .eq("owner_user_id", this.ownerUserId).eq("telegram_user_id", String(telegramUserId)).eq("telegram_chat_id", String(telegramChatId));
    if (error) throw dbError(error, "state_clear_failed");
  }

  async insertTransaction(transaction, updateId, messageTimestamp) {
    const createdAt = new Date(Number(messageTimestamp) * 1000).toISOString();
    const { data, error } = await this.client.from("transactions").insert({
      user_id:this.ownerUserId, transaction_type:transaction.type, amount:transaction.amount,
      description:transaction.description, category:transaction.category, channel:transaction.channel,
      transaction_date:transaction.transactionDate, source:"telegram", telegram_update_id:String(updateId),
      created_at:createdAt, updated_at:createdAt
    }).select("id").single();
    if (error && !isDuplicate(error)) throw dbError(error, "transaction_write_failed", "transactions");
    logEvent("info","supabase_write",{table:"transactions",success:true});
    return data?.id || null;
  }

  async listAccounts() {
    const { data, error } = await this.client.from("accounts").select("id,name,account_type,balance")
      .eq("user_id", this.ownerUserId).order("name");
    if (error) throw dbError(error, "accounts_read_failed");
    return data || [];
  }

  async updateAccount(name, balance) {
    const account = findOne(await this.listAccounts(), name, row => row.name, "account");
    const { data, error } = await this.client.from("accounts").update({balance})
      .eq("id", account.id).eq("user_id", this.ownerUserId).select("id,name,balance").single();
    if (error) throw dbError(error, "account_write_failed", "accounts");
    logEvent("info","supabase_write",{table:"accounts",success:true});
    return data;
  }

  async listClients() {
    const { data, error } = await this.client.from("clients")
      .select("id,name,monthly_retainer,paid_this_month,previous_outstanding,status,client_type,ending_paid")
      .eq("user_id", this.ownerUserId).order("name");
    if (error) throw dbError(error, "clients_read_failed");
    return data || [];
  }

  async getClient(name) {
    return findOne(await this.listClients(), name, row => row.name, "client");
  }

  async updateClient(name, action, amount = null) {
    const client = await this.getClient(name);
    const totalDue = Number(client.monthly_retainer) + Number(client.previous_outstanding);
    let paid = Number(client.paid_this_month);
    let status = client.status;
    let endingPaid = Boolean(client.ending_paid);
    let clientType = client.client_type === "ending" ? "ending" : "recurring";
    if (client.client_type === "ending") {
      if (action === "paid") { paid = totalDue; status = "paid"; endingPaid = true; }
      if (action === "amount") { paid = Number(amount); endingPaid = paid >= totalDue; status = endingPaid ? "paid" : "pending"; }
    }
    if (action === "ending") { clientType = "ending"; endingPaid = paid >= totalDue; status = endingPaid ? "paid" : "pending"; }
    if (action === "recurring") { clientType = "recurring"; endingPaid = false; status = paid >= totalDue ? "paid" : "pending"; }
    if (client.client_type !== "ending" && action === "paid") { paid = totalDue; status = "paid"; }
    if (client.client_type !== "ending" && action === "amount") { paid = Number(amount); status = paid >= totalDue ? "paid" : "pending"; }
    const { data, error } = await this.client.from("clients").update({paid_this_month:paid,status,client_type:clientType,ending_paid:endingPaid})
      .eq("id", client.id).eq("user_id", this.ownerUserId)
      .select("id,name,monthly_retainer,paid_this_month,previous_outstanding,status,client_type,ending_paid").single();
    if (error) throw dbError(error, "client_write_failed", "clients");
    logEvent("info","supabase_write",{table:"clients",success:true});
    return data;
  }

  async listUnpaidCredit() {
    const { data, error } = await this.client.from("credit_items")
      .select("id,source,description,amount,due_date,is_paid")
      .eq("user_id", this.ownerUserId).eq("is_paid", false).order("due_date");
    if (error) throw dbError(error, "credit_read_failed");
    return data || [];
  }

  async addCreditItem(source, description, amount, epochSeconds, updateId) {
    const { data:facilities, error:facilityReadError } = await this.client.from("credit_facilities")
      .select("id,source").eq("user_id", this.ownerUserId).eq("source", source);
    if (facilityReadError) throw dbError(facilityReadError, "credit_facility_read_failed");
    const facilityId = facilities?.[0]?.id || null;
    const dueDate = nextDueDate(source, epochSeconds);
    const { data, error } = await this.client.from("credit_items").insert({
      user_id:this.ownerUserId,facility_id:facilityId,source,description,amount,due_date:dueDate,is_paid:false,
      source_origin:"telegram",telegram_update_id:String(updateId)
    }).select("id,source,description,amount,due_date").single();
    if (error && !isDuplicate(error)) throw dbError(error, "credit_write_failed", "credit_items");
    logEvent("info","supabase_write",{table:"credit_items",success:true});
    return data || {source,description,amount,due_date:dueDate};
  }

  async markCreditPaid(query) {
    const item = findOne(await this.listUnpaidCredit(), query, row => row.description, "credit item");
    const { data, error } = await this.client.from("credit_items").update({is_paid:true})
      .eq("id", item.id).eq("user_id", this.ownerUserId).select("id,description,amount,source").single();
    if (error) throw dbError(error, "credit_write_failed", "credit_items");
    logEvent("info","supabase_write",{table:"credit_items",success:true});
    return data;
  }

  async addElectricityReading(remaining, date, time, updateId, messageTimestamp) {
    const createdAt = new Date(Number(messageTimestamp) * 1000).toISOString();
    const { data, error } = await this.client.from("electricity_readings").insert({
      user_id:this.ownerUserId,reading_date:date,reading_time:time,remaining_kwh:remaining,
      source:"telegram",telegram_update_id:String(updateId),created_at:createdAt,updated_at:createdAt
    }).select("id,reading_date,reading_time,remaining_kwh").single();
    if (error && !isDuplicate(error)) throw dbError(error, "electricity_write_failed", "electricity_readings");
    logEvent("info","supabase_write",{table:"electricity_readings",success:true});
    return data || {reading_date:date,reading_time:time,remaining_kwh:remaining};
  }

  async electricitySnapshot() {
    const [{data:readings,error:readingError},{data:settings,error:settingsError}] = await Promise.all([
      this.client.from("electricity_readings").select("reading_date,reading_time,remaining_kwh")
        .eq("user_id", this.ownerUserId).order("reading_date",{ascending:false}).order("reading_time",{ascending:false}).limit(2),
      this.client.from("app_settings").select("rate_kwh").eq("user_id",this.ownerUserId).maybeSingle()
    ]);
    if (readingError) throw dbError(readingError, "electricity_read_failed");
    if (settingsError) throw dbError(settingsError, "settings_read_failed");
    return { readings:readings || [], rateKwh:Number(settings?.rate_kwh || 1740) };
  }

  async stockSnapshot() {
    const [{data:stocks,error:stockError},{data:settings,error:settingsError}] = await Promise.all([
      this.client.from("stock_holdings").select("id,display_symbol,market,currency,quantity,current_price,manual_current_price,price_status,price_as_of")
        .eq("user_id",this.ownerUserId).order("display_symbol"),
      this.client.from("app_settings").select("usd_idr").eq("user_id",this.ownerUserId).maybeSingle()
    ]);
    if (stockError) throw dbError(stockError, "stocks_read_failed");
    if (settingsError) throw dbError(settingsError, "settings_read_failed");
    return { stocks:stocks || [], usdIdr:Number(settings?.usd_idr || 16250) };
  }

  async updateStockTarget(symbol, scenario, year, targetPrice) {
    const snapshot = await this.stockSnapshot();
    const holding = findOne(snapshot.stocks, symbol, row => row.display_symbol, "stock");
    const { data, error } = await this.client.from("stock_price_targets").upsert({
      user_id:this.ownerUserId,holding_id:holding.id,scenario,target_year:year,target_price:targetPrice
    }, {onConflict:"user_id,holding_id,scenario,target_year"}).select("scenario,target_year,target_price").single();
    if (error) throw dbError(error, "target_write_failed", "stock_price_targets");
    logEvent("info","supabase_write",{table:"stock_price_targets",success:true});
    return {holding,...data};
  }

  async summary(epochSeconds) {
    const {start,next} = monthBounds(epochSeconds);
    const now=jakartaParts(epochSeconds),activeMonth=start.slice(0,7);
    const [accounts,clients,credit,stocksResult,budgetsResult,transactionsResult,yearlyResult,eventsResult] = await Promise.all([
      this.listAccounts(), this.listClients(), this.listUnpaidCredit(), this.stockSnapshot(),
      this.client.from("monthly_budgets").select("category,monthly_amount,payment_status,paid_amount,tracking_month").eq("user_id",this.ownerUserId),
      this.client.from("transactions").select("transaction_type,amount,category,transaction_date").eq("user_id",this.ownerUserId).gte("transaction_date",start).lt("transaction_date",next),
      this.client.from("yearly_expenses").select("amount,payment_month,last_paid_year").eq("user_id",this.ownerUserId),
      this.client.from("planned_events").select("amount,event_date").eq("user_id",this.ownerUserId).gte("event_date",start).lt("event_date",next)
    ]);
    if (budgetsResult.error) throw dbError(budgetsResult.error, "budgets_read_failed");
    if (transactionsResult.error) throw dbError(transactionsResult.error, "transactions_read_failed");
    if (yearlyResult.error) throw dbError(yearlyResult.error, "yearly_read_failed");
    if (eventsResult.error) throw dbError(eventsResult.error, "events_read_failed");
    const liquid = accounts.reduce((sum,row)=>sum+Number(row.balance),0);
    const outstanding = clients.filter(row=>!(row.client_type==="ending"&&row.ending_paid)).reduce((sum,row)=>sum+Math.max(0,Number(row.monthly_retainer)+Number(row.previous_outstanding)-Number(row.paid_this_month)),0);
    const unpaidCredit = credit.filter(row=>String(row.due_date)<next).reduce((sum,row)=>sum+Number(row.amount),0);
    const transactions = transactionsResult.data || [];
    const income = transactions.filter(row=>row.transaction_type==="income").reduce((sum,row)=>sum+Number(row.amount),0);
    const expenses = transactions.filter(row=>row.transaction_type==="expense").reduce((sum,row)=>sum+Number(row.amount),0);
    const remainingBudget=(budgetsResult.data||[]).reduce((sum,row)=>{
      const tracked=row.tracking_month===activeMonth,mode=tracked?(row.payment_status||"auto"):"auto";
      const autoPaid=transactions.filter(tx=>tx.transaction_type==="expense"&&String(tx.category).toLowerCase()===String(row.category).toLowerCase()).reduce((total,tx)=>total+Number(tx.amount),0);
      const paid=mode==="done"?Number(row.monthly_amount):mode==="partial"?Number(row.paid_amount):autoPaid;
      return sum+Math.max(0,Number(row.monthly_amount)-paid);
    },0);
    const yearlyDue=(yearlyResult.data||[]).filter(row=>Number(row.last_paid_year)!==now.year&&paymentMonth(row.payment_month)<=now.month).reduce((sum,row)=>sum+Number(row.amount),0);
    const eventsDue=(eventsResult.data||[]).reduce((sum,row)=>sum+Number(row.amount),0);
    const portfolio = stocksResult.stocks.reduce((sum,row)=>{
      const price = Number(row.current_price || row.manual_current_price || 0);
      const value = Number(row.quantity) * price;
      return sum + (row.currency === "USD" ? value * stocksResult.usdIdr : value);
    },0);
    const projectedCash=liquid+outstanding+income-remainingBudget-yearlyDue-eventsDue-unpaidCredit;
    return {liquid,income,expenses,outstanding,unpaidCredit,remainingBudget,yearlyDue,eventsDue,portfolio,projected:projectedCash+portfolio};
  }
}

function findOne(rows, query, labelAccessor, entityLabel) {
  const needle = normalizeSearch(query);
  if (!needle) throw Object.assign(new Error(`Missing ${entityLabel} name.`), { code:"missing_name", userMessage:`Please specify the ${entityLabel} name.` });
  const scored = rows.map(row => {
    const name = normalizeSearch(labelAccessor(row));
    const score = name === needle ? 3 : name.startsWith(needle) ? 2 : name.includes(needle) || needle.includes(name) ? 1 : 0;
    return {row,score};
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score);
  if (!scored.length) throw Object.assign(new Error(`${entityLabel} not found.`), { code:"not_found", userMessage:`I couldn't find that ${entityLabel}.` });
  const best = scored.filter(item=>item.score===scored[0].score);
  if (best.length > 1) throw Object.assign(new Error(`Ambiguous ${entityLabel}.`), { code:"ambiguous", userMessage:`More than one ${entityLabel} matched: ${best.slice(0,4).map(item=>labelAccessor(item.row)).join(", ")}.` });
  return best[0].row;
}
