const number = value => Number(value || 0);
const typeOf = client => client.clientType || "recurring";

export const getRecurringClients = clients => clients.filter(client => typeOf(client) === "recurring" && client.status !== "freeze");
export const getEndingClients = clients => clients.filter(client => typeOf(client) === "ending");
export const getFrozenClients = clients => clients.filter(client => typeOf(client) === "recurring" && client.status === "freeze");

export function getClientOutstanding(client) {
  if (typeOf(client) === "ending" && client.endingPaid) return 0;
  return Math.max(0, number(client.monthly) + number(client.carry) - number(client.paid));
}

export function getReceivableClients(clients) {
  return [
    ...getRecurringClients(clients),
    ...getEndingClients(clients).filter(client => !client.endingPaid)
  ];
}

export const getFixedIncome = clients => getRecurringClients(clients).reduce((sum, client) => sum + number(client.monthly), 0);
export const getTotalOutstanding = clients => getReceivableClients(clients).reduce((sum, client) => sum + getClientOutstanding(client), 0);
export const getTotalPaid = clients => clients.filter(client => client.status !== "freeze").reduce((sum, client) => sum + number(client.paid), 0);

export function getYearlyProjectionTotal(items, year, activeYear) {
  return items
    .filter(item => !(year === activeYear && number(item.lastPaidYear) === year))
    .reduce((sum, item) => sum + number(item.amount), 0);
}

export function buildProjection({years, accountTotal, clients, monthlyBudget, yearly, events, unpaidCredit, portfolioForYear, activeYear}) {
  let cash = number(accountTotal);
  const annualIncome = getFixedIncome(clients) * 12;
  return years.map(year => {
    const eventExpense = events
      .filter(event => new Date(`${event.date}T00:00:00`).getFullYear() === year)
      .reduce((sum, event) => sum + number(event.amount), 0);
    const expense = number(monthlyBudget) * 12
      + getYearlyProjectionTotal(yearly, year, activeYear)
      + eventExpense
      + (year === activeYear ? number(unpaidCredit) : 0);
    const portfolio = number(portfolioForYear(year));
    const closing = cash + annualIncome - expense;
    const netWorth = closing + portfolio;
    cash = closing;
    return {year,income:annualIncome,expense,eventExpense,portfolio,closing,nw:netWorth};
  });
}

export const getCurrentNetWorth = (accountTotal, portfolioTotal) => number(accountTotal) + number(portfolioTotal);

