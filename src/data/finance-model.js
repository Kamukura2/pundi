const number = value => Number(value || 0);
const pad = value => String(value).padStart(2, "0");
const typeOf = client => client.clientType || "recurring";

export const monthKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
export const rowMonthKey = value => String(value || "").slice(0, 7);

const MONTHS = {
  january:0,jan:0,januari:0, february:1,feb:1,februari:1, march:2,mar:2,maret:2,
  april:3,apr:3, may:4,mei:4, june:5,jun:5,juni:5, july:6,jul:6,juli:6,
  august:7,aug:7,agustus:7, september:8,sep:8, october:9,oct:9,oktober:9,
  november:10,nov:10, december:11,dec:11,desember:11
};

export function monthIndex(value) {
  if (Number.isInteger(value)) return Math.max(0, Math.min(11, value));
  const text = String(value || "").trim().toLowerCase();
  if (/^\d{1,2}$/.test(text)) return Math.max(0, Math.min(11, Number(text) - 1));
  return MONTHS[text] ?? MONTHS[text.slice(0, 3)] ?? 0;
}

export const getRecurringClients = clients => clients.filter(client => typeOf(client) === "recurring");
export const getEndingClients = clients => clients.filter(client => typeOf(client) === "ending");

export function getClientPaidThisMonth(client, referenceDate = new Date()) {
  if (typeOf(client) === "ending" && client.endingPaid) return number(client.monthly) + number(client.carry);
  if (client.trackingMonth && client.trackingMonth !== monthKey(referenceDate)) return 0;
  return number(client.paid);
}

export function getClientOutstanding(client, referenceDate = new Date()) {
  if (typeOf(client) === "ending" && client.endingPaid) return 0;
  return Math.max(0, number(client.monthly) + number(client.carry) - getClientPaidThisMonth(client, referenceDate));
}

export function getReceivableClients(clients, referenceDate = new Date()) {
  return clients.filter(client => getClientOutstanding(client, referenceDate) > 0);
}

export const getFixedIncome = clients => getRecurringClients(clients).reduce((sum, client) => sum + number(client.monthly), 0);
export const getTotalOutstanding = (clients, referenceDate = new Date()) => getReceivableClients(clients, referenceDate).reduce((sum, client) => sum + getClientOutstanding(client, referenceDate), 0);
export const getTotalPaid = (clients, referenceDate = new Date()) => clients.reduce((sum, client) => sum + getClientPaidThisMonth(client, referenceDate), 0);

export function getEntrustedDeduction(items = [], source) {
  return items
    .filter(item => !item.settled && (!source || item.source === source))
    .reduce((sum, item) => sum + number(item.amount), 0);
}

export function transactionsForMonth(transactions, year, month, type) {
  const key = `${year}-${pad(month + 1)}`;
  return transactions.filter(row => rowMonthKey(row.date) === key && (!type || row.type === type));
}

export function additionalIncomeForMonth(transactions, year, month) {
  return transactionsForMonth(transactions, year, month, "income").reduce((sum, row) => sum + number(row.amount), 0);
}

export function recordedExpenseForBudget(item, transactions, referenceDate) {
  const exact = transactionsForMonth(transactions, referenceDate.getFullYear(), referenceDate.getMonth(), "expense")
    .filter(row => String(row.category).toLowerCase() === String(item.category).toLowerCase());
  return exact.reduce((sum, row) => sum + number(row.amount), 0);
}

export function getBudgetProgress(item, transactions, referenceDate = new Date()) {
  const activeKey = monthKey(referenceDate);
  const trackingThisMonth = item.trackingMonth === activeKey;
  const status = trackingThisMonth ? (item.paymentStatus || "auto") : "auto";
  const autoPaid = recordedExpenseForBudget(item, transactions, referenceDate);
  const paid = status === "done" ? number(item.monthly)
    : status === "partial" ? number(item.paidAmount)
    : autoPaid;
  const remaining = Math.max(0, number(item.monthly) - paid);
  return {status, paid:Math.min(number(item.monthly), paid), remaining, autoPaid, trackingMonth:activeKey};
}

export function monthlyBudgetRemaining(items, transactions, referenceDate = new Date()) {
  return items.reduce((sum, item) => sum + getBudgetProgress(item, transactions, referenceDate).remaining, 0);
}

export function getYearlyProjectionTotal(items, year, activeYear) {
  return items.filter(item => !(year === activeYear && number(item.lastPaidYear) === year))
    .reduce((sum, item) => sum + number(item.amount), 0);
}

function dueYearly(items, year, month, activeYear, currentMonth) {
  return items.filter(item => {
    if (year === activeYear && number(item.lastPaidYear) === year) return false;
    const due = monthIndex(item.month);
    return year === activeYear && month === currentMonth ? due <= currentMonth : due === month;
  }).reduce((sum, item) => sum + number(item.amount), 0);
}

function dueEvents(items, year, month) {
  return items.filter(item => {
    const date = new Date(`${item.date}T00:00:00`);
    return date.getFullYear() === year && date.getMonth() === month;
  }).reduce((sum, item) => sum + number(item.amount), 0);
}

function dueCredit(items, year, month, activeYear, currentMonth) {
  return items.filter(item => !item.paid).filter(item => {
    const date = new Date(`${item.due}T00:00:00`);
    if (date.getFullYear() !== year) return false;
    return year === activeYear && month === currentMonth ? date.getMonth() <= currentMonth : date.getMonth() === month;
  }).reduce((sum, item) => sum + number(item.amount), 0);
}

export function annualExpenseBreakdown({year, budgets, yearly, events, credit, activeYear}) {
  const recurring = budgets.reduce((sum, item) => sum + number(item.monthly), 0) * 12;
  const annual = getYearlyProjectionTotal(yearly, year, activeYear);
  const eventOnly = events.filter(item => new Date(`${item.date}T00:00:00`).getFullYear() === year)
    .reduce((sum, item) => sum + number(item.amount), 0);
  const creditDue = credit.filter(item => !item.paid && new Date(`${item.due}T00:00:00`).getFullYear() === year)
    .reduce((sum, item) => sum + number(item.amount), 0);
  return {recurring, yearly:annual, events:eventOnly + creditDue, eventOnly, credit:creditDue, total:recurring + annual + eventOnly + creditDue};
}

export function remainingYearExpenseBreakdown({referenceDate = new Date(), budgets = [], yearly = [], events = [], credit = [], transactions = []}) {
  const year = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const monthlyDefault = budgets.reduce((sum, item) => sum + number(item.monthly), 0);
  const recurring = monthlyBudgetRemaining(budgets, transactions, referenceDate) + monthlyDefault * (11 - currentMonth);
  let annual = 0;
  let eventOnly = 0;
  let creditDue = 0;
  for (let month = currentMonth; month < 12; month += 1) {
    annual += dueYearly(yearly, year, month, year, currentMonth);
    eventOnly += dueEvents(events, year, month);
    creditDue += dueCredit(credit, year, month, year, currentMonth);
  }
  return {recurring, yearly:annual, events:eventOnly + creditDue, eventOnly, credit:creditDue, total:recurring + annual + eventOnly + creditDue};
}

export function remainingYearIncomeBreakdown({referenceDate = new Date(), clients = [], transactions = []}) {
  const year = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const outstanding = getTotalOutstanding(clients, referenceDate);
  const recurring = getFixedIncome(clients) * (11 - currentMonth);
  const additional = Array.from({length:12-currentMonth},(_,index)=>currentMonth+index)
    .reduce((sum, month) => sum + additionalIncomeForMonth(transactions, year, month), 0);
  return {outstanding, recurring, additional, total:outstanding + recurring + additional};
}

export function buildMonthlyTimeline({referenceDate = new Date(), accountTotal, clients, budgets, yearly, events, credit, transactions, portfolioForYear}) {
  const year = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const monthlyBudget = budgets.reduce((sum, item) => sum + number(item.monthly), 0);
  const fixedIncome = getFixedIncome(clients);
  let cash = number(accountTotal);
  const rows = [];
  for (let month = currentMonth; month < 12; month += 1) {
    const isCurrent = month === currentMonth;
    const income = isCurrent ? getTotalOutstanding(clients, referenceDate) : fixedIncome;
    const extraIncome = additionalIncomeForMonth(transactions, year, month);
    const recurringExpense = isCurrent ? monthlyBudgetRemaining(budgets, transactions, referenceDate) : monthlyBudget;
    const yearlyExpense = dueYearly(yearly, year, month, year, currentMonth);
    const eventExpense = dueEvents(events, year, month);
    const creditExpense = dueCredit(credit, year, month, year, currentMonth);
    const expenses = recurringExpense + yearlyExpense + eventExpense + creditExpense;
    cash += income + extraIncome - expenses;
    const portfolio = number(portfolioForYear(year));
    rows.push({year,month,income,extraIncome,recurringExpense,yearlyExpense,eventExpense,creditExpense,expenses,cash,portfolio,nw:cash + portfolio});
  }
  return rows;
}

export function buildProjection({years, referenceDate = new Date(), accountTotal, clients, budgets = [], yearly, events, credit = [], transactions = [], portfolioForYear}) {
  const activeYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const monthly = buildMonthlyTimeline({referenceDate,accountTotal,clients,budgets,yearly,events,credit,transactions,portfolioForYear});
  const currentClosing = monthly.at(-1)?.cash ?? number(accountTotal);
  let cash = currentClosing;
  return years.map(year => {
    const breakdown = annualExpenseBreakdown({year,budgets,yearly,events,credit,activeYear});
    if (year === activeYear) {
      const currentRows = monthly;
      const income = currentRows.reduce((sum, row) => sum + row.income + row.extraIncome, 0);
      const expense = currentRows.reduce((sum, row) => sum + row.expenses, 0);
      const remainingBreakdown = {
        currentMonth:currentRows[0]?.recurringExpense || 0,
        recurring:currentRows.slice(1).reduce((sum,row)=>sum+row.recurringExpense,0),
        yearly:currentRows.reduce((sum,row)=>sum+row.yearlyExpense,0),
        events:currentRows.reduce((sum,row)=>sum+row.eventExpense+row.creditExpense,0)
      };
      remainingBreakdown.total=remainingBreakdown.currentMonth+remainingBreakdown.recurring+remainingBreakdown.yearly+remainingBreakdown.events;
      const portfolio = number(portfolioForYear(year));
      const incomeBreakdown = remainingYearIncomeBreakdown({referenceDate,clients,transactions});
      return {year,income, incomeBreakdown, expense,expenses:remainingBreakdown,eventExpense:remainingBreakdown.events,portfolio,closing:currentClosing,nw:currentClosing + portfolio};
    }
    const annualIncome = getFixedIncome(clients) * 12 + transactions
      .filter(row => row.type === "income" && new Date(`${row.date}T00:00:00`).getFullYear() === year)
      .reduce((sum, row) => sum + number(row.amount), 0);
    cash += annualIncome - breakdown.total;
    const portfolio = number(portfolioForYear(year));
    const incomeBreakdown = {outstanding:0,recurring:getFixedIncome(clients)*12,additional:annualIncome-getFixedIncome(clients)*12,total:annualIncome};
    return {year,income:annualIncome,incomeBreakdown,expense:breakdown.total,expenses:breakdown,eventExpense:breakdown.events,portfolio,closing:cash,nw:cash + portfolio};
  });
}

export const getCurrentNetWorth = (accountTotal, portfolioTotal) => number(accountTotal) + number(portfolioTotal);
