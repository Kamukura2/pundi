const n = value => Number(value || 0);
const isoDay = value => String(value || new Date().toISOString()).slice(0, 10);

export function amountToIdr(amount, currency, fxRate) {
  return n(amount) * (currency === "USD" ? n(fxRate) : 1);
}

export function tradingWallet(ledger = []) {
  return ledger.reduce((wallet, row) => {
    wallet.idr += n(row.cashDeltaIdr);
    wallet.usd += n(row.cashDeltaUsd);
    return wallet;
  }, { idr:0, usd:0 });
}

export function tradingPositionValue(position, fxRate) {
  return amountToIdr(n(position.quantity) * n(position.current), position.currency, fxRate);
}

export function tradingPositionCost(position, fxRate) {
  return amountToIdr(n(position.quantity) * n(position.avg), position.currency, fxRate);
}

export function reconcileTradingPositions(positions = [], ledger = []) {
  let changed = false;
  positions.forEach(position => {
    const rows = ledger
      .filter(row => row.positionId === position.id && ["opening", "buy", "sell"].includes(row.type))
      .sort((a,b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.__createdAt || "").localeCompare(String(b.__createdAt || "")));
    if (!rows.some(row => row.type === "opening")) return;
    let quantity = 0, average = 0;
    rows.forEach(row => {
      const rowQuantity = Math.max(0, n(row.quantity));
      if (row.type === "opening" || row.type === "buy") {
        const nextQuantity = quantity + rowQuantity;
        average = nextQuantity ? (quantity * average + rowQuantity * n(row.price)) / nextQuantity : 0;
        quantity = nextQuantity;
      } else {
        quantity = Math.max(0, quantity - rowQuantity);
        if (!quantity) average = 0;
      }
    });
    if (Math.abs(n(position.quantity) - quantity) > 1e-9) {
      position.quantity = quantity;
      changed = true;
    }
    if (quantity > 0 && Math.abs(n(position.avg) - average) > 1e-9) {
      position.avg = average;
      changed = true;
    }
  });
  return changed;
}

export function archiveClosedTradingPositions({ positions = [], ledger = [] } = {}) {
  const closedPositionIds = new Set(positions
    .filter(position => n(position.quantity) <= 1e-9 && ledger.some(row => row.positionId === position.id && row.type === "sell"))
    .map(position => position.id));
  if (!closedPositionIds.size) return { positions, ledger, closedPositionIds:[] };
  return {
    positions:positions.map(position => closedPositionIds.has(position.id) ? {
      ...position, quantity:0, targetPrice:0, stopLoss:0, priceStatus:"closed"
    } : position),
    ledger:ledger.map(row => closedPositionIds.has(row.positionId) ? { ...row, positionId:null } : row),
    closedPositionIds:[...closedPositionIds]
  };
}

export function tradingMetrics({ positions = [], ledger = [], fxRate = 0 } = {}) {
  const wallet = tradingWallet(ledger);
  const holdingsValue = positions.reduce((sum, row) => sum + tradingPositionValue(row, fxRate), 0);
  const openCost = positions.reduce((sum, row) => sum + tradingPositionCost(row, fxRate), 0);
  const cashValue = wallet.idr + wallet.usd * n(fxRate);
  const realized = ledger.reduce((sum, row) => sum + n(row.realizedPlIdr), 0);
  const realizedCost = ledger.reduce((sum, row) => {
    if (row.type !== "sell") return sum;
    const saleValueIdr = amountToIdr(n(row.quantity) * n(row.price), row.currency, row.fxRate || fxRate);
    return sum + Math.max(0, saleValueIdr - n(row.realizedPlIdr));
  }, 0);
  const realizedReturn = realizedCost ? realized / realizedCost * 100 : 0;
  const externalFlows = ledger.reduce((sum, row) => sum + n(row.externalFlowIdr), 0);
  const unrealized = holdingsValue - openCost;
  const equity = cashValue + holdingsValue;
  const totalPl = equity - externalFlows;
  return { wallet, holdingsValue, openCost, cashValue, equity, realized, realizedCost, realizedReturn, unrealized, totalPl, externalFlows };
}

export function applyOpeningPosition({ position, date, fxRate, id }) {
  const costIdr = tradingPositionCost(position, fxRate);
  return {
    id, type:"opening", positionId:position.id, ticker:position.ticker,
    quantity:n(position.quantity), price:n(position.avg), currency:position.currency,
    fxRate:n(fxRate), cashDeltaIdr:0, cashDeltaUsd:0, externalFlowIdr:costIdr,
    realizedPlIdr:0, date:isoDay(date), note:"Opening position"
  };
}

export function applyTrade({ position, type, quantity, price, date, fxRate, id }) {
  const qty = n(quantity), execution = n(price), beforeQty = n(position.quantity), beforeAvg = n(position.avg);
  if (!(qty > 0) || !(execution >= 0)) throw new Error("Enter a valid quantity and execution price.");
  if (type === "sell" && qty > beforeQty + 1e-9) throw new Error("Sell quantity exceeds the open position.");
  const nativeAmount = qty * execution;
  const cashDeltaIdr = position.currency === "IDR" ? (type === "sell" ? nativeAmount : -nativeAmount) : 0;
  const cashDeltaUsd = position.currency === "USD" ? (type === "sell" ? nativeAmount : -nativeAmount) : 0;
  const realizedPlIdr = type === "sell" ? amountToIdr((execution - beforeAvg) * qty, position.currency, fxRate) : 0;
  if (type === "buy") {
    const nextQty = beforeQty + qty;
    position.avg = nextQty ? (beforeQty * beforeAvg + qty * execution) / nextQty : execution;
    position.quantity = nextQty;
  } else {
    position.quantity = Math.max(0, beforeQty - qty);
  }
  return {
    id, type, positionId:position.id, ticker:position.ticker, quantity:qty, price:execution,
    currency:position.currency, fxRate:n(fxRate), cashDeltaIdr, cashDeltaUsd,
    externalFlowIdr:0, realizedPlIdr, date:isoDay(date), note:type === "sell" ? "Position sold" : "Position increased"
  };
}

export function cashEvent({ type, currency, amount, date, fxRate, id, note = "" }) {
  const value = n(amount);
  if (!(value > 0)) throw new Error("Enter an amount greater than zero.");
  const sign = type === "withdraw" ? -1 : 1;
  return {
    id, type, positionId:null, ticker:"", quantity:0, price:0, currency,
    fxRate:n(fxRate), cashDeltaIdr:currency === "IDR" ? sign * value : 0,
    cashDeltaUsd:currency === "USD" ? sign * value : 0,
    externalFlowIdr:sign * amountToIdr(value, currency, fxRate), realizedPlIdr:0,
    date:isoDay(date), note:note || (type === "withdraw" ? "Funds withdrawn" : "Funds deposited")
  };
}

export function setTradingWalletBalance({ ledger = [], currency, target, date, fxRate, id }) {
  const wallet=tradingWallet(ledger),current=currency==="USD"?wallet.usd:wallet.idr;
  const desired=Math.max(0,n(target)),delta=desired-current;
  if(Math.abs(delta)<=1e-9)return null;
  const type=delta>0?"deposit":"withdraw";
  const event=cashEvent({type,currency,amount:Math.abs(delta),date,fxRate,id,note:"Manual wallet balance adjustment"});
  ledger.push(event);
  return event;
}

export function upsertDailySnapshot(snapshots = [], metrics, spyPrice, date = new Date()) {
  const snapshotDate = isoDay(date);
  const row = snapshots.find(item => item.date === snapshotDate);
  const values = {
    date:snapshotDate, equityIdr:n(metrics.equity), netContributionsIdr:n(metrics.externalFlows),
    holdingsValueIdr:n(metrics.holdingsValue), cashValueIdr:n(metrics.cashValue), spyPrice:n(spyPrice)
  };
  if (row) return Object.assign(row, values);
  snapshots.push(values);
  snapshots.sort((a,b) => a.date.localeCompare(b.date));
  return values;
}

function rangeStart(range, now) {
  const start = new Date(now);
  if (range === "1W") start.setDate(start.getDate() - 7);
  else if (range === "1M") start.setMonth(start.getMonth() - 1);
  else if (range === "3M") start.setMonth(start.getMonth() - 3);
  else if (range === "YTD") start.setMonth(0, 1);
  else return null;
  return isoDay(start);
}

export function performanceSeries(snapshots = [], range = "YTD", now = new Date()) {
  const ordered = [...snapshots].filter(row => n(row.equityIdr) >= 0).sort((a,b) => a.date.localeCompare(b.date));
  if (!ordered.length) return { labels:[], portfolio:[], spy:[], portfolioReturn:0, spyReturn:0 };
  const start = rangeStart(range, now);
  let rows = start ? ordered.filter(row => row.date >= start) : ordered;
  const prior = start ? [...ordered].reverse().find(row => row.date < start) : null;
  if (prior) rows = [prior, ...rows];
  if (!rows.length) rows = [ordered.at(-1)];
  const base = rows[0], portfolio = [0], spy = [0], labels = [base.date];
  let factor = 1;
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1], current = rows[index];
    const flow = n(current.netContributionsIdr) - n(previous.netContributionsIdr);
    if (n(previous.equityIdr) > 0) factor *= Math.max(0, (n(current.equityIdr) - flow) / n(previous.equityIdr));
    portfolio.push((factor - 1) * 100);
    spy.push(n(base.spyPrice) > 0 && n(current.spyPrice) > 0 ? (n(current.spyPrice) / n(base.spyPrice) - 1) * 100 : 0);
    labels.push(current.date);
  }
  if (rows.length === 1 && n(base.netContributionsIdr) > 0) portfolio[0] = (n(base.equityIdr) / n(base.netContributionsIdr) - 1) * 100;
  return { labels, portfolio, spy, portfolioReturn:portfolio.at(-1) || 0, spyReturn:spy.at(-1) || 0 };
}

export function performancePreview(snapshots = [], metrics = {}, spyPrice = 0, now = new Date()) {
  const rows = [...snapshots].map(row => ({ ...row })).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  if (!rows.length) return rows;
  if (rows.length === 1 && n(rows[0].netContributionsIdr) > 0) {
    rows[0].equityIdr = n(rows[0].netContributionsIdr);
    rows[0].holdingsValueIdr = n(rows[0].netContributionsIdr);
    rows[0].cashValueIdr = 0;
  }
  const day = isoDay(now);
  rows.push({
    id:"current-preview", date:`${day}T23:59:59`, equityIdr:n(metrics.equity),
    netContributionsIdr:n(metrics.externalFlows), holdingsValueIdr:n(metrics.holdingsValue),
    cashValueIdr:n(metrics.cashValue), spyPrice:n(spyPrice) || n(rows.at(-1)?.spyPrice)
  });
  return rows;
}

export function tradingTargetSimulation(position, targetPrice, fxRate) {
  const target = Math.max(0, n(targetPrice));
  const quantity = n(position?.quantity), average = n(position?.avg);
  const multiplier = position?.currency === "USD" ? n(fxRate) : 1;
  const projectedValueIdr = quantity * target * multiplier;
  const projectedPlIdr = quantity * (target - average) * multiplier;
  const projectedReturn = average > 0 ? (target / average - 1) * 100 : 0;
  return { target, projectedValueIdr, projectedPlIdr, projectedReturn };
}

export function removeTradingPositionData({ positions = [], ledger = [], snapshots = [] } = {}, positionId) {
  const affected = ledger.filter(row => row.positionId === positionId);
  const firstDate = affected.map(row => String(row.date || "")).filter(Boolean).sort()[0] || null;
  return {
    positions:positions.filter(row => row.id !== positionId),
    ledger:ledger.filter(row => row.positionId !== positionId),
    snapshots:firstDate ? snapshots.filter(row => String(row.date) < firstDate) : [...snapshots],
    removedLedgerCount:affected.length
  };
}

export function removeTradingLedgerEntry({ positions = [], ledger = [], snapshots = [] } = {}, ledgerId) {
  const removed = ledger.find(row => row.id === ledgerId);
  if (!removed) return { positions:[...positions], ledger:[...ledger], snapshots:[...snapshots], removed:null };
  const nextLedger = ledger.filter(row => row.id !== ledgerId);
  let nextPositions = positions.map(row => ({ ...row }));
  if (removed.positionId) {
    const linked = nextLedger.filter(row => row.positionId === removed.positionId);
    if (!linked.some(row => row.type === "opening")) {
      nextPositions = nextPositions.filter(row => row.id !== removed.positionId);
    } else {
      reconcileTradingPositions(nextPositions, nextLedger);
      nextPositions = nextPositions.filter(position => {
        if (position.id !== removed.positionId) return true;
        return n(position.quantity) > 1e-9 || !linked.some(row => row.type === "sell");
      });
    }
  }
  const removedDate = String(removed.date || "");
  return {
    positions:nextPositions,
    ledger:nextLedger,
    snapshots:removedDate ? snapshots.filter(row => String(row.date || "") < removedDate) : [...snapshots],
    removed
  };
}
