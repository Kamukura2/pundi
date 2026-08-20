const valueOf = (row, ...keys) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return undefined;
};

export function electricityEventTimestamp(row = {}) {
  const date = String(valueOf(row, "date", "reading_date", "topup_date") || "");
  const rawTime = String(valueOf(row, "time", "reading_time", "topup_time") || "00:00:00");
  const time = rawTime.length === 5 ? `${rawTime}:00` : rawTime.slice(0, 8).padEnd(8, "0");
  return `${date}T${time}`;
}

export function sortElectricityEvents(events = []) {
  return [...events].sort((a, b) => {
    const timestampOrder = electricityEventTimestamp(a).localeCompare(electricityEventTimestamp(b));
    return timestampOrder || String(a?.id || "").localeCompare(String(b?.id || ""));
  });
}

export function parseTopUpAmount(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function topUpAmount(topUp) {
  return Number(valueOf(topUp, "amount", "amountKwh", "amount_kwh") || 0);
}

export function topUpsBetween(previousReading, currentReading, topUps = []) {
  const previousAt = electricityEventTimestamp(previousReading);
  const currentAt = electricityEventTimestamp(currentReading);
  return sortElectricityEvents(topUps).filter(topUp => {
    const topUpAt = electricityEventTimestamp(topUp);
    return topUpAt > previousAt && topUpAt <= currentAt;
  });
}

export function electricityPeriods(readings = [], topUps = []) {
  const sortedReadings = sortElectricityEvents(readings);
  const periods = [];
  for (let index = 1; index < sortedReadings.length; index += 1) {
    const previous = sortedReadings[index - 1];
    const current = sortedReadings[index];
    const previousAt = electricityEventTimestamp(previous);
    const currentAt = electricityEventTimestamp(current);
    const days = (new Date(currentAt) - new Date(previousAt)) / 864e5;
    const periodTopUps = topUpsBetween(previous, current, topUps);
    const topUpKwh = periodTopUps.reduce((sum, topUp) => sum + topUpAmount(topUp), 0);
    const effectiveStart = Number(previous.remaining || 0) + topUpKwh;
    const rawUsed = effectiveStart - Number(current.remaining || 0);
    const anomaly = rawUsed < 0;
    const used = anomaly ? null : rawUsed;
    const daily = anomaly ? null : days > 0 ? used / days : 0;
    periods.push({
      from: previous,
      to: current,
      days,
      topUps: periodTopUps,
      topUpKwh,
      effectiveStart,
      rawUsed,
      status: anomaly ? "anomaly" : "valid",
      used,
      daily,
      cost: used
    });
  }
  return periods;
}

export function latestElectricityBalance(readings = [], topUps = []) {
  const sortedReadings = sortElectricityEvents(readings);
  if (!sortedReadings.length) return topUps.reduce((sum, topUp) => sum + topUpAmount(topUp), 0);
  const latestReading = sortedReadings.at(-1);
  const latestAt = electricityEventTimestamp(latestReading);
  const afterLatest = topUps.filter(topUp => electricityEventTimestamp(topUp) > latestAt);
  return Number(latestReading.remaining || 0) + afterLatest.reduce((sum, topUp) => sum + topUpAmount(topUp), 0);
}

export function electricityHistoryEvents(readings = [], topUps = []) {
  return sortElectricityEvents([
    ...readings.map(reading => ({ ...reading, eventType: "reading" })),
    ...topUps.map(topUp => ({ ...topUp, eventType: "topup" }))
  ]);
}
