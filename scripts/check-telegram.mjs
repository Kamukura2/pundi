import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { extractTransactionDate, jakartaDateTime, nextDueDate } from "../api/telegram/_lib/dates.js";
import { HELP_TEXT, BOTFATHER_COMMANDS } from "../api/telegram/_lib/messages.js";
import { inferCategory, inferChannel, parseMoney, parseNaturalShortcut, parseQuickTransaction } from "../api/telegram/_lib/parser.js";
import { processTelegramUpdate } from "../api/telegram/_lib/processor.js";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root,path),"utf8");
const timestamp = Date.parse("2026-08-07T12:00:00+07:00") / 1000;

for (const [input,expected] of Object.entries({
  "50k":50000,"250k":250000,"1jt":1000000,"1.5jt":1500000,
  "2juta":2000000,"4.25jt":4250000,"1.500.000":1500000
})) assert.equal(parseMoney(input),expected,input);
assert.equal(parseMoney("0",{allowZero:true}),0);

assert.deepEqual(jakartaDateTime(timestamp),{
  date:"2026-08-07",time:"12:00",
  parts:{year:2026,month:8,day:7,hour:12,minute:0,second:0}
});
assert.equal(extractTransactionDate("grocery 22 June",timestamp).date,"2026-06-22");
assert.equal(extractTransactionDate("client payment yesterday",timestamp).date,"2026-08-06");
assert.equal(extractTransactionDate("coffee 22/08/2026",timestamp).date,"2026-08-22");
assert.equal(nextDueDate("Credit Card",timestamp),"2026-08-26");
assert.equal(nextDueDate("ShopeePayLater",timestamp),"2026-08-25");

const coffee = parseQuickTransaction("-85k coffee grab",timestamp);
assert.equal(coffee.type,"expense");
assert.equal(coffee.amount,85000);
assert.equal(coffee.category,"Coffee");
assert.equal(coffee.channel,"Grab");
assert.equal(coffee.transactionDate,"2026-08-07");

const income = parseQuickTransaction("+4jt Getlook yesterday",timestamp);
assert.equal(income.type,"income");
assert.equal(income.amount,4000000);
assert.equal(income.description,"Getlook");
assert.equal(income.channel,"Transfer");
assert.equal(income.transactionDate,"2026-08-06");

const incomplete = parseQuickTransaction("-50000",timestamp);
assert.equal(incomplete.description,"");
assert.equal(incomplete.categoryCertain,false);

assert.deepEqual(inferCategory("household shopee"),{category:"Essentials",certain:true});
assert.equal(inferChannel("household shopee"),"Shopee");
assert.deepEqual(parseNaturalShortcut("saldo BCA 12.5jt"),{kind:"balance",name:"BCA",amount:12500000});
assert.deepEqual(parseNaturalShortcut("Getlook bayar 2jt"),{kind:"client_payment",name:"Getlook",amount:2000000});

class FakeTelegram {
  constructor(){ this.messages=[]; }
  async sendMessage(chatId,text,options={}) { this.messages.push({chatId,text,options}); return {message_id:this.messages.length}; }
  async answerCallbackQuery(){ return true; }
}
class FakeDb {
  constructor(){ this.state=null; this.transactions=[]; this.balanceUpdates=[]; }
  async getState(){ return this.state; }
  async setState(_user,_chat,state){ this.state=state; }
  async clearState(){ this.state=null; }
  async insertTransaction(transaction,updateId){ this.transactions.push({...transaction,updateId}); }
  async updateAccount(name,balance){ this.balanceUpdates.push({name,balance}); return {name,balance}; }
}
const fakeDb = new FakeDb();
const fakeTelegram = new FakeTelegram();
const fakeContext = (text,updateId=1,callbackQuery=null) => ({
  text,updateId,updateKind:callbackQuery?"callback_query":"message",callbackQuery,
  telegramUserId:"100",chatId:"100",messageTimestamp:timestamp,db:fakeDb,telegram:fakeTelegram
});
await processTelegramUpdate(fakeContext("-85k coffee grab",1));
assert.equal(fakeDb.transactions.length,1);
assert.equal(fakeDb.transactions[0].category,"Coffee");
assert.match(fakeTelegram.messages.at(-1).text,/Expense saved/);
await processTelegramUpdate(fakeContext("-50000",2));
assert.equal(fakeDb.state.kind,"transaction_description");
assert.match(fakeTelegram.messages.at(-1).text,/What was this for/);
await processTelegramUpdate(fakeContext("grocery",3));
assert.equal(fakeDb.transactions.length,2);
assert.equal(fakeDb.transactions[1].category,"Food");
assert.equal(fakeDb.transactions[1].channel,"Offline");
assert.equal(fakeDb.state,null);
await processTelegramUpdate(fakeContext("/balance BCA 12.5jt",4));
assert.deepEqual(fakeDb.balanceUpdates.at(-1),{name:"BCA",balance:12500000});
await processTelegramUpdate(fakeContext("-20k something unusual",5));
assert.equal(fakeDb.state.kind,"transaction_category");
assert.ok(fakeTelegram.messages.at(-1).options.reply_markup.inline_keyboard.length >= 2);
await processTelegramUpdate(fakeContext("",6,{id:"callback-1",data:"cvf:category:Others",message:{date:timestamp,chat:{id:100}}}));
assert.equal(fakeDb.transactions.at(-1).category,"Others");
assert.equal(fakeDb.state,null);

assert.match(HELP_TEXT,/-50k grocery/);
assert.match(HELP_TEXT,/\/summary/);
for (const command of ["start","help","summary","balance","client","credit","electricity","stocks"]) {
  assert.match(BOTFATHER_COMMANDS,new RegExp(`^${command} -`,"m"));
}

const migration = read("supabase/migrations/005_telegram_cvfinance.sql");
for (const marker of ["telegram_cvfinance_states","telegram_cvfinance_updates","telegram_update_id","force row level security","service_role"]) assert.match(migration,new RegExp(marker));
assert.doesNotMatch(migration,/drop\s+table|truncate\s+/i);

const env = read(".env.example");
for (const key of [
  "TELEGRAM_CVFINANCE_BOT_TOKEN","TELEGRAM_CVFINANCE_ALLOWED_USER_ID",
  "TELEGRAM_CVFINANCE_ALLOWED_CHAT_ID","TELEGRAM_CVFINANCE_WEBHOOK_SECRET",
  "CVFINANCE_OWNER_USER_ID","SUPABASE_SERVICE_ROLE_KEY"
]) assert.match(env,new RegExp(`^${key}=`,"m"));

const webhook = read("api/telegram/cvfinance-webhook.js");
assert.match(webhook,/x-telegram-bot-api-secret-token/);
assert.match(webhook,/isAuthorized/);
assert.doesNotMatch(webhook,/TELEGRAM_BOT_TOKEN/);

const jsFiles = [
  "api/telegram/cvfinance-webhook.js","api/telegram/_lib/config.js","api/telegram/_lib/database.js",
  "api/telegram/_lib/dates.js","api/telegram/_lib/format.js","api/telegram/_lib/log.js",
  "api/telegram/_lib/messages.js","api/telegram/_lib/parser.js","api/telegram/_lib/processor.js",
  "api/telegram/_lib/telegram.js"
];
for (const file of jsFiles) execFileSync(process.execPath,["--check",resolve(root,file)],{stdio:"pipe"});
for (const file of jsFiles.map(read)) {
  assert.ok(!/sb_secret_|service_role\s*[:=]\s*[A-Za-z0-9_-]{20,}|\d{8,}:[A-Za-z0-9_-]{20,}/.test(file),"Possible committed secret detected");
}

Object.assign(process.env,{
  TELEGRAM_CVFINANCE_BOT_TOKEN:"100000:test-only-token",
  TELEGRAM_CVFINANCE_ALLOWED_USER_ID:"111",
  TELEGRAM_CVFINANCE_ALLOWED_CHAT_ID:"111",
  TELEGRAM_CVFINANCE_WEBHOOK_SECRET:"test_webhook_secret",
  CVFINANCE_OWNER_USER_ID:"11111111-1111-4111-8111-111111111111",
  SUPABASE_URL:"https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY:"test-only-key"
});
const {default:webhookHandler} = await import("../api/telegram/cvfinance-webhook.js");
function fakeResponse(){
  return {statusCode:200,headers:{},body:null,setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
}
let response = fakeResponse();
await webhookHandler({method:"POST",headers:{"x-telegram-bot-api-secret-token":"wrong"},body:{update_id:1,message:{date:timestamp,from:{id:111},chat:{id:111},text:"/help"}}},response);
assert.equal(response.statusCode,401);
response = fakeResponse();
await webhookHandler({method:"POST",headers:{"x-telegram-bot-api-secret-token":"test_webhook_secret"},body:{update_id:2,message:{date:timestamp,from:{id:222},chat:{id:222},text:"/help"}}},response);
assert.equal(response.statusCode,200);
assert.deepEqual(response.body,{ok:true});

console.log("CVFinance Telegram checks passed: shorthand amounts, Jakarta dates, categories/channels, shortcuts, commands, migration safety markers, environment isolation, webhook security markers, and JavaScript syntax.");
