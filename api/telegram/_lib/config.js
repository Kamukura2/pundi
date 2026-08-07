const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TELEGRAM_ID = /^-?\d{1,20}$/;
const WEBHOOK_SECRET = /^[A-Za-z0-9_-]{1,256}$/;

export function getTelegramConfig() {
  const config = {
    botToken:process.env.TELEGRAM_CVFINANCE_BOT_TOKEN,
    allowedUserId:String(process.env.TELEGRAM_CVFINANCE_ALLOWED_USER_ID || ""),
    allowedChatId:String(process.env.TELEGRAM_CVFINANCE_ALLOWED_CHAT_ID || ""),
    webhookSecret:process.env.TELEGRAM_CVFINANCE_WEBHOOK_SECRET,
    ownerUserId:process.env.CVFINANCE_OWNER_USER_ID,
    supabaseUrl:process.env.SUPABASE_URL,
    serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw Object.assign(new Error(`Missing Telegram CVFinance configuration: ${missing.join(", ")}`), { code:"configuration_missing", status:503 });
  if (!TELEGRAM_ID.test(config.allowedUserId) || !TELEGRAM_ID.test(config.allowedChatId)) throw Object.assign(new Error("Telegram allowlist IDs are invalid."), { code:"configuration_invalid", status:503 });
  if (!WEBHOOK_SECRET.test(config.webhookSecret)) throw Object.assign(new Error("Telegram webhook secret must use only A-Z, a-z, 0-9, underscore, or hyphen."), { code:"configuration_invalid", status:503 });
  if (!UUID.test(config.ownerUserId)) throw Object.assign(new Error("CVFINANCE_OWNER_USER_ID must be a Supabase Auth user UUID."), { code:"configuration_invalid", status:503 });
  return config;
}

export function isAuthorized(config, userId, chatId) {
  return String(userId) === config.allowedUserId && String(chatId) === config.allowedChatId;
}
