const API_BASE = "https://api.telegram.org";

export class TelegramClient {
  constructor(token) {
    this.token = token;
  }

  async call(method, payload = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${API_BASE}/bot${this.token}/${method}`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),
        signal:controller.signal
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw Object.assign(new Error(body.description || `Telegram ${method} failed.`), { code:"telegram_api_error", status:502 });
      return body.result;
    } catch (error) {
      if (error.name === "AbortError") throw Object.assign(new Error(`Telegram ${method} timed out.`), { code:"telegram_timeout", status:504 });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  sendMessage(chatId, text, options = {}) {
    return this.call("sendMessage", { chat_id:chatId, text, disable_web_page_preview:true, ...options });
  }

  answerCallbackQuery(callbackQueryId, text) {
    return this.call("answerCallbackQuery", { callback_query_id:callbackQueryId, ...(text ? {text} : {}) });
  }
}

export function inlineButtons(rows) {
  return { inline_keyboard:rows.map(row => row.map(([text, callbackData]) => ({text, callback_data:callbackData}))) };
}
