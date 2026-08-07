export function logEvent(level, event, fields = {}) {
  const safe = {
    timestamp:new Date().toISOString(), service:"cvfinance-telegram", level, event,
    updateId:fields.updateId ?? null,
    updateKind:fields.updateKind ?? null,
    command:fields.command ?? null,
    authorized:fields.authorized ?? null,
    userMatch:fields.userMatch ?? null,
    chatMatch:fields.chatMatch ?? null,
    parserKind:fields.parserKind ?? null,
    table:fields.table ?? null,
    success:fields.success ?? null,
    errorCode:fields.errorCode ?? null
  };
  const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  console[method](JSON.stringify(safe));
}
