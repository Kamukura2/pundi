import { cacheGet, cachePut, mutationDelete, mutationList, mutationPut } from "../lib/idb.js";
import { createEmptyState, createId, YEARS } from "./default-data.js";

export const DATA_TABLES = [
  "profiles", "accounts", "transactions", "monthly_budgets", "yearly_expenses",
  "planned_events", "credit_facilities", "credit_items", "clients", "stock_holdings",
  "stock_price_targets", "electricity_readings", "entrusted_funds", "app_settings"
];

const SAVE_TABLES = DATA_TABLES.filter(table => table !== "profiles");
const parentFirst = ["accounts","transactions","monthly_budgets","yearly_expenses","planned_events","credit_facilities","credit_items","clients","stock_holdings","stock_price_targets","electricity_readings","entrusted_funds","app_settings"];
const deleteFirst = [...parentFirst].reverse();
const meta = row => ({ __createdAt: row.created_at, __updatedAt: row.updated_at });
const clean = value => JSON.parse(JSON.stringify(value));
const comparable = row => {
  const copy = { ...row };
  delete copy.created_at;
  delete copy.updated_at;
  delete copy.user_id;
  return JSON.stringify(copy);
};

function rowsToState(rows) {
  const state = createEmptyState();
  state.accounts = rows.accounts.map(row => ({id:row.id,name:row.name,type:row.account_type,balance:Number(row.balance),...meta(row)}));
  state.transactions = rows.transactions.map(row => ({id:row.id,type:row.transaction_type,amount:Number(row.amount),description:row.description,category:row.category,channel:row.channel,date:row.transaction_date,...meta(row)}));
  state.budgets = rows.monthly_budgets.map((row,index) => ({id:row.id,category:row.category,monthly:Number(row.monthly_amount),paymentStatus:row.payment_status||"auto",paidAmount:Number(row.paid_amount||0),trackingMonth:row.tracking_month||null,sortOrder:Number(row.sort_order??index),...meta(row)}));
  state.yearly = rows.yearly_expenses.map((row,index) => ({id:row.id,name:row.name,amount:Number(row.amount),month:row.payment_month,category:row.category,lastPaidYear:row.last_paid_year == null ? null : Number(row.last_paid_year),sortOrder:Number(row.sort_order??index),...meta(row)}));
  state.events = rows.planned_events.map((row,index) => ({id:row.id,name:row.name,amount:Number(row.amount),date:row.event_date,category:row.category,sortOrder:Number(row.sort_order??index),...meta(row)}));
  state.creditFacilities = rows.credit_facilities.map(row => ({id:row.id,source:row.source,limit:Number(row.limit_amount),...meta(row)}));
  state.credit = rows.credit_items.map((row,index) => ({id:row.id,facilityId:row.facility_id,source:row.source,description:row.description,amount:Number(row.amount),due:row.due_date,paid:row.is_paid,sortOrder:Number(row.sort_order??index),...meta(row)}));
  state.entrustedFunds = (rows.entrusted_funds || []).map((row,index) => ({id:row.id,name:row.name,amount:Number(row.amount),source:row.deduction_source,settled:Boolean(row.is_settled),sortOrder:Number(row.sort_order??index),...meta(row)}));
  state.clients = rows.clients.map((row,index) => ({id:row.id,name:row.name,monthly:Number(row.monthly_retainer),paid:Number(row.paid_this_month),carry:Number(row.previous_outstanding),status:row.status==="freeze"?"pending":row.status,clientType:row.client_type || "recurring",endingPaid:Boolean(row.ending_paid),sortOrder:Number(row.sort_order??index),trackingMonth:row.tracking_month||null,...meta(row)}));
  const targetsByHolding = new Map();
  rows.stock_price_targets.forEach(row => {
    if (!targetsByHolding.has(row.holding_id)) targetsByHolding.set(row.holding_id, {base:{},optimistic:{},ids:{base:{},optimistic:{}}});
    const target = targetsByHolding.get(row.holding_id);
    target[row.scenario][row.target_year] = Number(row.target_price);
    target.ids[row.scenario][row.target_year] = {id:row.id,...meta(row)};
  });
  state.stocks = rows.stock_holdings.map(row => {
    const target = targetsByHolding.get(row.id) || {base:{},optimistic:{},ids:{base:{},optimistic:{}}};
    return {
      id:row.id,ticker:row.display_symbol,displaySymbol:row.display_symbol,market:row.market,
      provider:row.provider,providerSymbol:row.provider_symbol,currency:row.currency,
      quantity:Number(row.quantity),avg:Number(row.avg_purchase_price),current:Number(row.current_price),
      manualCurrent:Number(row.manual_current_price ?? row.current_price),priceSource:row.price_source,
      priceStatus:row.price_status,priceAsOf:row.price_as_of,lastPriceFetchAt:row.last_price_fetch_at,
      base:target.base,optimistic:target.optimistic,targetIds:target.ids,...meta(row)
    };
  });
  state.electricity = rows.electricity_readings.map(row => ({id:row.id,date:row.reading_date,time:String(row.reading_time).slice(0,5),remaining:Number(row.remaining_kwh),...meta(row)}));
  const settings = rows.app_settings[0];
  if (settings) {
    state.settingsId = settings.id;
    state.theme = settings.theme;
    state.language = settings.language || "en";
    state.baseMode = settings.base_mode;
    state.optimisticMode = settings.optimistic_mode;
    state.baseGrowth = Number(settings.base_growth);
    state.optimisticGrowth = Number(settings.optimistic_growth);
    state.usdIdr = Number(settings.usd_idr);
    state.rateKwh = Number(settings.rate_kwh);
    state.stockExtras = {netcashIdr:Number(settings.stock_netcash_idr||0),walletUsd:Number(settings.stock_wallet_usd||0)};
    state.settingsUpdatedAt = settings.updated_at;
  }
  return state;
}

function stateToRows(state, userId) {
  const stamp = row => ({ created_at:row.__createdAt, updated_at:row.__updatedAt });
  const owned = row => ({ ...row, user_id:userId });
  const facilityBySource = new Map(state.creditFacilities.map(item => [item.source, item.id]));
  const targets = [];
  state.stocks.forEach(stock => {
    stock.targetIds ||= {base:{},optimistic:{}};
    ["base","optimistic"].forEach(scenario => YEARS.slice(1).forEach(year => {
      stock.targetIds[scenario] ||= {};
      stock.targetIds[scenario][year] ||= { id:createId() };
      const targetMeta = stock.targetIds[scenario][year];
      targets.push(owned({
        id:targetMeta.id,holding_id:stock.id,scenario,target_year:year,
        target_price:Number(stock[scenario]?.[year] ?? stock.current),...stamp({__createdAt:targetMeta.__createdAt,__updatedAt:targetMeta.__updatedAt})
      }));
    }));
  });
  state.settingsId ||= createId();
  return {
    accounts: state.accounts.map(row => owned({id:row.id,name:row.name,account_type:row.type,balance:Number(row.balance),...stamp(row)})),
    transactions: state.transactions.map(row => owned({id:row.id,transaction_type:row.type,amount:Number(row.amount),description:row.description,category:row.category,channel:row.channel,transaction_date:row.date,...stamp(row)})),
    monthly_budgets: state.budgets.map((row,index) => owned({id:row.id,category:row.category,monthly_amount:Number(row.monthly),payment_status:row.paymentStatus||"auto",paid_amount:Number(row.paidAmount||0),tracking_month:row.trackingMonth||null,sort_order:Number(row.sortOrder??index),...stamp(row)})),
    yearly_expenses: state.yearly.map((row,index) => owned({id:row.id,name:row.name,amount:Number(row.amount),payment_month:row.month,category:row.category,last_paid_year:row.lastPaidYear ?? null,sort_order:Number(row.sortOrder??index),...stamp(row)})),
    planned_events: state.events.map((row,index) => owned({id:row.id,name:row.name,amount:Number(row.amount),event_date:row.date,category:row.category,sort_order:Number(row.sortOrder??index),...stamp(row)})),
    credit_facilities: state.creditFacilities.map(row => owned({id:row.id,source:row.source,limit_amount:Number(row.limit),...stamp(row)})),
    credit_items: state.credit.map((row,index) => owned({id:row.id,facility_id:row.facilityId || facilityBySource.get(row.source) || null,source:row.source,description:row.description,amount:Number(row.amount),due_date:row.due,is_paid:Boolean(row.paid),sort_order:Number(row.sortOrder??index),...stamp(row)})),
    entrusted_funds: state.entrustedFunds.map((row,index) => owned({id:row.id,name:row.name,amount:Number(row.amount),deduction_source:row.source,is_settled:Boolean(row.settled),sort_order:Number(row.sortOrder??index),...stamp(row)})),
    clients: state.clients.map((row,index) => owned({id:row.id,name:row.name,monthly_retainer:Number(row.monthly),paid_this_month:Number(row.paid),previous_outstanding:Number(row.carry),status:row.status==="freeze"?"pending":row.status,client_type:row.clientType || "recurring",ending_paid:Boolean(row.endingPaid),sort_order:Number(row.sortOrder??index),tracking_month:row.trackingMonth||null,...stamp(row)})),
    stock_holdings: state.stocks.map(row => owned({
      id:row.id,display_symbol:row.displaySymbol || row.ticker,market:row.market,provider:row.provider,
      provider_symbol:row.providerSymbol || row.ticker,currency:row.currency,quantity:Number(row.quantity),
      avg_purchase_price:Number(row.avg),current_price:Number(row.current),manual_current_price:Number(row.manualCurrent ?? row.current),
      price_source:row.priceSource || "manual",price_status:row.priceStatus || "manual",
      price_as_of:row.priceAsOf || null,last_price_fetch_at:row.lastPriceFetchAt || null,...stamp(row)
    })),
    stock_price_targets: targets,
    electricity_readings: state.electricity.map(row => owned({id:row.id,reading_date:row.date,reading_time:row.time,remaining_kwh:Number(row.remaining),...stamp(row)})),
    app_settings: [owned({
      id:state.settingsId,theme:state.theme,language:state.language||"en",base_mode:state.baseMode,optimistic_mode:state.optimisticMode,
      base_growth:Number(state.baseGrowth),optimistic_growth:Number(state.optimisticGrowth),usd_idr:Number(state.usdIdr),
      rate_kwh:Number(state.rateKwh),stock_netcash_idr:Number(state.stockExtras?.netcashIdr||0),stock_wallet_usd:Number(state.stockExtras?.walletUsd||0),legacy_import_completed:true,updated_at:state.settingsUpdatedAt
    })]
  };
}

function diffRows(nextRows, previousRows) {
  const operations = [];
  parentFirst.forEach(table => {
    const before = new Map((previousRows[table] || []).map(row => [row.id, row]));
    (nextRows[table] || []).forEach(row => {
      const old = before.get(row.id);
      if (!old) operations.push({table,action:"insert",id:row.id,row,previousUpdatedAt:null});
      else if (comparable(row) !== comparable(old)) operations.push({table,action:"update",id:row.id,row,previousUpdatedAt:old.updated_at || null});
      before.delete(row.id);
    });
  });
  deleteFirst.forEach(table => {
    const nextIds = new Set((nextRows[table] || []).map(row => row.id));
    (previousRows[table] || []).forEach(row => {
      if (!nextIds.has(row.id)) operations.push({table,action:"delete",id:row.id,previousUpdatedAt:row.updated_at || null});
    });
  });
  return operations;
}

function stripServerFields(row) {
  const payload = { ...row };
  delete payload.created_at;
  delete payload.updated_at;
  return payload;
}

export class FinanceRepository {
  constructor(supabase, user) {
    this.supabase = supabase;
    this.user = user;
    this.rows = Object.fromEntries(SAVE_TABLES.map(table => [table, []]));
    this.cacheKey = `snapshot:${user.id}`;
  }

  async fetchRows() {
    const results = await Promise.all(SAVE_TABLES.map(async table => {
      const { data, error } = await this.supabase.from(table).select("*").eq("user_id", this.user.id);
      if (error) throw error;
      return [table, data || []];
    }));
    return Object.fromEntries(results);
  }

  async loadCloud() {
    this.rows = await this.fetchRows();
    const state = rowsToState(this.rows);
    await cachePut(this.cacheKey, { rows:this.rows, savedAt:new Date().toISOString() });
    return state;
  }

  async loadCache() {
    const cached = await cacheGet(this.cacheKey);
    if (!cached?.rows) return null;
    this.rows = cached.rows;
    return { state:rowsToState(this.rows), savedAt:cached.savedAt };
  }

  buildOperations(state) {
    const nextRows = stateToRows(state, this.user.id);
    return { nextRows, operations:diffRows(nextRows, this.rows) };
  }

  async applyOperation(operation) {
    const payload = operation.row ? stripServerFields(operation.row) : null;
    if (operation.action === "insert") {
      const { error } = await this.supabase.from(operation.table).insert(payload);
      if (error) throw error;
      return;
    }
    let query = operation.action === "delete"
      ? this.supabase.from(operation.table).delete().eq("id", operation.id).eq("user_id", this.user.id)
      : this.supabase.from(operation.table).update(payload).eq("id", operation.id).eq("user_id", this.user.id);
    if (operation.previousUpdatedAt) query = query.eq("updated_at", operation.previousUpdatedAt);
    const { data, error } = await query.select("id");
    if (error) throw error;
    if (!data?.length) throw new Error(`Synchronization conflict in ${operation.table}. Cloud data was reloaded.`);
  }

  async queueOperation(operation) {
    const key = `${this.user.id}:${operation.table}:${operation.id}`;
    const existing = (await mutationList()).find(item => item.key === key);
    if (operation.action === "delete" && existing?.action === "insert") {
      await mutationDelete(key);
      return;
    }
    let merged = clean(operation);
    if (existing?.action === "insert" && operation.action === "update") merged = { ...merged, action:"insert", previousUpdatedAt:null };
    if (existing?.action === "update" && ["update","delete"].includes(operation.action)) merged.previousUpdatedAt = existing.previousUpdatedAt;
    await mutationPut({ ...merged, key, userId:this.user.id, queuedAt:existing?.queuedAt || new Date().toISOString() });
  }

  async save(state, forceOffline = false) {
    const { nextRows, operations } = this.buildOperations(state);
    if (!operations.length) return { state, pending:(await mutationList()).filter(item => item.userId === this.user.id).length };
    if (forceOffline || !navigator.onLine) {
      for (const operation of operations) await this.queueOperation(operation);
      this.rows = nextRows;
      await cachePut(this.cacheKey, { rows:this.rows, savedAt:new Date().toISOString() });
      return { state:rowsToState(this.rows), pending:(await mutationList()).filter(item => item.userId === this.user.id).length, offline:true };
    }
    for (let index = 0; index < operations.length; index += 1) {
      try {
        await this.applyOperation(operations[index]);
      } catch (error) {
        const networkFailure = !navigator.onLine || /fetch|network|timeout/i.test(error.message || "");
        if (!networkFailure) throw error;
        for (const pending of operations.slice(index)) await this.queueOperation(pending);
        this.rows = nextRows;
        await cachePut(this.cacheKey, { rows:this.rows, savedAt:new Date().toISOString() });
        return { state:rowsToState(this.rows), pending:(await mutationList()).filter(item => item.userId === this.user.id).length, offline:true };
      }
    }
    const fresh = await this.loadCloud();
    return { state:fresh, pending:0 };
  }

  async flushQueue() {
    const queued = (await mutationList()).filter(item => item.userId === this.user.id);
    const phase = item => item.action === "delete" ? 0 : 1;
    const order = item => (item.action === "delete" ? deleteFirst : parentFirst).indexOf(item.table);
    queued.sort((a,b) => phase(a) - phase(b) || order(a) - order(b));
    for (const item of queued) {
      const operation = { ...item };
      delete operation.key; delete operation.userId; delete operation.queuedAt;
      await this.applyOperation(operation);
      await mutationDelete(item.key);
    }
    return this.loadCloud();
  }

  async pendingCount() {
    return (await mutationList()).filter(item => item.userId === this.user.id).length;
  }

  async replaceAll(state) {
    if (!navigator.onLine) throw new Error("Import requires an internet connection.");
    for (const table of deleteFirst) {
      const { error } = await this.supabase.from(table).delete().eq("user_id", this.user.id);
      if (error) throw error;
    }
    this.rows = Object.fromEntries(SAVE_TABLES.map(table => [table, []]));
    return this.save(state);
  }

  subscribe(onChange) {
    let timer;
    const channel = this.supabase.channel(`cvfinance-${this.user.id}`);
    SAVE_TABLES.forEach(table => channel.on("postgres_changes", {event:"*",schema:"public",table,filter:`user_id=eq.${this.user.id}`}, () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, 350);
    }));
    channel.subscribe();
    return () => this.supabase.removeChannel(channel);
  }
}

export function exportBackup(state, userId) {
  const data = clean(state);
  ["page","privacy","filter","sort","expenseView","txEdit","prospectMode"].forEach(key => delete data[key]);
  return { format:"cvfinance-backup", version:1, exportedAt:new Date().toISOString(), userId, data };
}

export function validateBackup(value) {
  if (value?.format !== "cvfinance-backup" || value?.version !== 1 || !value?.data) throw new Error("Invalid CVFinance backup file.");
  const required = ["accounts","transactions","budgets","yearly","events","creditFacilities","credit","clients","stocks","electricity"];
  required.forEach(key => { if (!Array.isArray(value.data[key])) throw new Error(`Backup is missing ${key}.`); });
  if (!Array.isArray(value.data.entrustedFunds)) value.data.entrustedFunds = [];
  return { ...createEmptyState(), ...value.data, settingsId:createId() };
}
