const number = value => Number(value || 0);
const isoDay = value => String(value || "").slice(0, 10);

export function dividendEventYear(event) {
  const date = isoDay(event.paymentDate || event.recordDate || event.exDate || event.announcementDate);
  return Number(date.slice(0, 4)) || 0;
}

export function dividendGross(event, fxRate = 0) {
  const native = Math.max(0, number(event.amountPerShare)) * Math.max(0, number(event.eligibleShares));
  return event.currency === "USD" ? native * Math.max(0, number(event.fxRate || fxRate)) : native;
}

export function dividendNativeGross(event) {
  return Math.max(0, number(event.amountPerShare)) * Math.max(0, number(event.eligibleShares));
}

export function dividendReceivables(events = [], fxRate = 0) {
  return events
    .filter(event => event.status === "receivable" && !event.creditedAt)
    .reduce((sum, event) => sum + dividendGross(event, fxRate), 0);
}

export function projectedDividendForYear(events = [], year, fxRate = 0) {
  return events
    .filter(event => dividendEventYear(event) === Number(year))
    .filter(event => ["confirmed", "announced"].includes(event.status) && !event.creditedAt)
    .reduce((sum, event) => sum + dividendGross(event, fxRate), 0);
}

export function projectedDividendForMonth(events = [], year, month, fxRate = 0) {
  return events
    .filter(event => {
      const date = isoDay(event.paymentDate || event.recordDate || event.exDate);
      const parsed = date ? new Date(`${date}T00:00:00`) : null;
      return parsed && parsed.getFullYear() === Number(year) && parsed.getMonth() === Number(month);
    })
    .filter(event => ["confirmed", "announced"].includes(event.status) && !event.creditedAt)
    .reduce((sum, event) => sum + dividendGross(event, fxRate), 0);
}

export function summarizeDividends(events = [], year, fxRate = 0, today = new Date()) {
  const rows = events.filter(event => dividendEventYear(event) === Number(year) && event.status !== "cancelled");
  const total = rows.reduce((sum, event) => sum + dividendGross(event, fxRate), 0);
  const paid = rows.filter(event => event.status === "paid" || event.creditedAt).reduce((sum, event) => sum + dividendGross(event, fxRate), 0);
  const receivable = rows.filter(event => event.status === "receivable" && !event.creditedAt).reduce((sum, event) => sum + dividendGross(event, fxRate), 0);
  const now = isoDay(today instanceof Date ? today.toISOString() : today);
  const upcomingRows = rows.filter(event => ["confirmed", "announced"].includes(event.status) && isoDay(event.paymentDate || event.recordDate || event.exDate) >= now);
  const remaining = upcomingRows.reduce((sum, event) => sum + dividendGross(event, fxRate), 0) + receivable;
  const next = [...upcomingRows].sort((a,b) => isoDay(a.paymentDate || a.recordDate || a.exDate).localeCompare(isoDay(b.paymentDate || b.recordDate || b.exDate)))[0] || null;
  return { rows, total, paid, receivable, remaining, next };
}

export function mergeDividendEvents(current = [], incoming = [], holdings = [], createId = () => crypto.randomUUID(), today = new Date()) {
  const now = isoDay(today instanceof Date ? today.toISOString() : today);
  const byKey = new Map(current.map(event => [`${event.holdingId}:${event.eventKey}`, event]));
  let changed = false;
  incoming.forEach(raw => {
    const holding = holdings.find(item => item.id === raw.holdingId);
    if (!holding || !raw.eventKey || !(number(raw.amountPerShare) > 0)) return;
    const key = `${raw.holdingId}:${raw.eventKey}`;
    const existing = byKey.get(key);
    if (existing) {
      if (existing.manual) return;
      const preserved = {
        eligibleShares:existing.eligibleShares,
        eligibilityStatus:existing.eligibilityStatus,
        creditedAt:existing.creditedAt,
        status:existing.creditedAt ? "paid" : existing.status
      };
      const next={...existing,...raw,...preserved,id:existing.id,holdingId:raw.holdingId,ticker:holding.ticker};
      const fields=["ticker","type","currency","amountPerShare","announcementDate","exDate","recordDate","paymentDate","status","sourceProvider","sourceUrl"];
      if(fields.some(field=>String(existing[field]??"")!==String(next[field]??""))){Object.assign(existing,next);changed=true;}
      return;
    }
    const recordDate = isoDay(raw.recordDate || raw.exDate);
    const needsReview = Boolean(recordDate && recordDate < now);
    const event = {
      id:createId(), holdingId:raw.holdingId, eventKey:raw.eventKey, ticker:holding.ticker,
      type:raw.type || "regular", currency:raw.currency || holding.currency,
      amountPerShare:number(raw.amountPerShare), eligibleShares:number(holding.quantity),
      announcementDate:isoDay(raw.announcementDate), exDate:isoDay(raw.exDate), recordDate:isoDay(raw.recordDate), paymentDate:isoDay(raw.paymentDate),
      status:raw.status || "confirmed", eligibilityStatus:needsReview ? "review" : "pending",
      sourceProvider:raw.sourceProvider || "provider", sourceUrl:raw.sourceUrl || "", manual:false,
      fxRate:number(raw.fxRate), creditedAt:null
    };
    current.push(event);byKey.set(key,event);changed = true;
  });
  return changed;
}

export function advanceDividendLifecycle(state, today = new Date()) {
  const now = isoDay(today instanceof Date ? today.toISOString() : today);
  let changed = false;
  state.stockExtras ||= {netcashIdr:0,walletUsd:0};
  (state.dividends || []).forEach(event => {
    if (event.status === "cancelled" || event.creditedAt || event.eligibilityStatus === "review") return;
    const holding = (state.stocks || []).find(item => item.id === event.holdingId);
    const entitlementDate = isoDay(event.recordDate || event.exDate);
    if (event.eligibilityStatus === "pending" && entitlementDate && entitlementDate <= now) {
      event.eligibleShares = Math.max(0, number(holding?.quantity));
      event.eligibilityStatus = "locked";
      event.status = "receivable";
      changed = true;
    }
    if (event.eligibilityStatus === "locked" && event.paymentDate && isoDay(event.paymentDate) <= now && number(event.eligibleShares) > 0) {
      const native = dividendNativeGross(event);
      if (event.currency === "USD") state.stockExtras.walletUsd = number(state.stockExtras.walletUsd) + native;
      else state.stockExtras.netcashIdr = number(state.stockExtras.netcashIdr) + native;
      event.creditedAt = new Date().toISOString();event.status = "paid";changed = true;
    }
  });
  return changed;
}

export function creditDividendToWallet(state, event, timestamp = new Date()) {
  if (!event || event.creditedAt || event.status === "cancelled") return false;
  state.stockExtras ||= {netcashIdr:0,walletUsd:0};
  const native = dividendNativeGross(event);
  if (!(native > 0)) return false;
  if (event.currency === "USD") state.stockExtras.walletUsd = number(state.stockExtras.walletUsd) + native;
  else state.stockExtras.netcashIdr = number(state.stockExtras.netcashIdr) + native;
  event.eligibilityStatus = "locked";event.status = "paid";event.creditedAt = timestamp.toISOString();
  return true;
}
