import { getTelegramConfig, isAuthorized } from "./_lib/config.js";
import { CVFinanceDatabase } from "./_lib/database.js";
import { logEvent } from "./_lib/log.js";
import { processTelegramUpdate } from "./_lib/processor.js";
import { TelegramClient } from "./_lib/telegram.js";

export const maxDuration = 20;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({error:"Method not allowed."});
  }

  let config;
  try {
    config = getTelegramConfig();
  } catch (error) {
    logEvent("error","configuration_error",{errorCode:error.code});
    return response.status(error.status || 503).json({error:"CVFinance Telegram integration is not configured."});
  }

  const suppliedSecret = String(request.headers["x-telegram-bot-api-secret-token"] || "");
  if (suppliedSecret !== config.webhookSecret) {
    logEvent("warn","webhook_secret_rejected",{authorized:false});
    return response.status(401).json({error:"Unauthorized."});
  }

  let update;
  try {
    update = await parseBody(request);
  } catch {
    return response.status(400).json({error:"Invalid JSON body."});
  }

  const message = update.message || update.edited_message || null;
  const callbackQuery = update.callback_query || null;
  const updateKind = callbackQuery ? "callback_query" : message ? "message" : "unsupported";
  const telegramUserId = callbackQuery?.from?.id ?? message?.from?.id;
  const chatId = callbackQuery?.message?.chat?.id ?? message?.chat?.id;
  const updateId = update.update_id;
  const authorized = isAuthorized(config,telegramUserId,chatId);
  if (!authorized) {
    logEvent("warn","request_rejected",{
      updateId,updateKind,authorized:false,
      userMatch:String(telegramUserId)===config.allowedUserId,
      chatMatch:String(chatId)===config.allowedChatId
    });
    return response.status(200).json({ok:true});
  }

  logEvent("info","request_authorized",{updateId,updateKind,authorized:true});
  const telegram = new TelegramClient(config.botToken);
  const db = new CVFinanceDatabase(config.supabaseUrl,config.serviceRoleKey,config.ownerUserId);
  let claimed = false;
  try {
    await db.verifyOwner();
    claimed = await db.claimUpdate(updateId,updateKind);
    if (!claimed) {
      if (callbackQuery?.id) await telegram.answerCallbackQuery(callbackQuery.id).catch(()=>{});
      return response.status(200).json({ok:true,duplicate:true});
    }
    if (!message && !callbackQuery) {
      await db.finishUpdate(updateId,"ignored");
      return response.status(200).json({ok:true,ignored:true});
    }
    const sourceMessage = callbackQuery?.message || message;
    const text = callbackQuery ? "" : String(message?.text || "").trim();
    if (!callbackQuery && !text) {
      await telegram.sendMessage(chatId,"CVFinance accepts text input. Send /help for examples.");
      await db.finishUpdate(updateId,"ignored");
      return response.status(200).json({ok:true,ignored:true});
    }
    const parsedMeta = classifyInput(text,callbackQuery);
    logEvent("info","parser_result",{updateId,updateKind,...parsedMeta});
    await processTelegramUpdate({
      update,updateId,updateKind,message,callbackQuery,text,telegramUserId,chatId,
      messageTimestamp:Number(sourceMessage?.date || Math.floor(Date.now()/1000)),telegram,db
    });
    await db.finishUpdate(updateId,"completed").catch(error=>logEvent("error","update_finish_error",{updateId,errorCode:error.code}));
    db.cleanup().catch(error=>logEvent("warn","cleanup_error",{updateId,errorCode:error.code}));
    logEvent("info","command_completed",{updateId,updateKind,success:true});
    return response.status(200).json({ok:true});
  } catch (error) {
    logEvent("error","command_error",{updateId,updateKind,success:false,errorCode:error.code || "unknown_error",table:error.table || null});
    if (claimed) await db.finishUpdate(updateId,"failed",error.code || "unknown_error").catch(()=>{});
    const userMessage = error.userMessage || (error.database ? "Couldn't save that. Nothing was changed." : "Something went wrong. Please try again or send /help.");
    await telegram.sendMessage(chatId,userMessage).catch(sendError=>logEvent("error","error_reply_failed",{updateId,errorCode:sendError.code}));
    return response.status(200).json({ok:true,error:error.code || "processing_failed"});
  }
}

function classifyInput(text, callbackQuery) {
  if (callbackQuery) return {parserKind:"callback",command:null};
  const command = String(text).match(/^\/([a-z_]+)/i)?.[1]?.toLowerCase() || null;
  if (command) return {parserKind:"command",command};
  if (/^[+-]\s*\d/.test(text)) return {parserKind:"quick_transaction",command:null};
  if (/^(saldo|listrik|electricity)\b/i.test(text) || /\b(bayar|paid)\s+[0-9]/i.test(text)) return {parserKind:"natural_shortcut",command:null};
  return {parserKind:"conversation_or_unknown",command:null};
}

async function parseBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body);
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
