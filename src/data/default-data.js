const ACTIVE_YEAR = new Date().getFullYear();
const ACTIVE_MONTH = `${ACTIVE_YEAR}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
export const YEARS = Array.from({ length: 11 }, (_, index) => ACTIVE_YEAR + index);

export const createId = () => crypto.randomUUID();

export function createEmptyState() {
  return {
    theme: "dark",
    language: "en",
    page: "accumulation",
    privacy: false,
    filter: "all",
    sort: "date",
    expenseView: "monthly",
    txEdit: null,
    prospectMode: "base",
    baseMode: "manual",
    optimisticMode: "manual",
    baseGrowth: 8,
    optimisticGrowth: 14,
    usdIdr: 17810,
    rateKwh: 1740,
    settingsId: null,
    accounts: [],
    clients: [],
    transactions: [],
    budgets: [],
    yearly: [],
    events: [],
    creditFacilities: [],
    credit: [],
    entrustedFunds: [],
    stockExtras: { netcashIdr: 0, walletUsd: 0 },
    stocks: [],
    electricity: []
  };
}

export function createMvpSeed() {
  const stocks = [
    {
      id: createId(), ticker: "BMRI", displaySymbol: "BMRI", market: "IDX", provider: "yahoo",
      providerSymbol: "BMRI", currency: "IDR", quantity: 10000, avg: 4200, current: 6200,
      manualCurrent: 6200, priceSource: "manual", priceStatus: "manual", priceAsOf: null,
      base: {2027:5750,2028:6250,2029:6500,2030:6750,2031:7000,2032:7250,2033:7500,2034:7750,2035:8000,2036:8250},
      optimistic: {2027:6500,2028:7200,2029:8000,2030:8800,2031:9700,2032:10700,2033:11800,2034:13000,2035:14300,2036:15700}
    },
    {
      id: createId(), ticker: "WDC", displaySymbol: "WDC", market: "NASDAQ", provider: "finnhub",
      providerSymbol: "WDC", currency: "USD", quantity: 2.8033875, avg: 358.77, current: 405,
      manualCurrent: 405, priceSource: "manual", priceStatus: "manual", priceAsOf: null,
      base: {2027:458,2028:550,2029:620,2030:700,2031:760,2032:820,2033:880,2034:950,2035:1020,2036:1100},
      optimistic: {2027:500,2028:620,2029:720,2030:820,2031:920,2032:1040,2033:1170,2034:1320,2035:1490,2036:1680}
    }
  ];
  return {
    ...createEmptyState(),
    accounts: [
      {id:createId(),name:"Cash",type:"Cash",balance:3396235},
      {id:createId(),name:"BCA",type:"Bank",balance:10234404},
      {id:createId(),name:"GoPay",type:"Wallet",balance:284382},
      {id:createId(),name:"ShopeePay",type:"Wallet",balance:40932},
      {id:createId(),name:"SeaBank",type:"Bank",balance:52000}
    ],
    clients: [
      {id:createId(),name:"Getlook",monthly:4000000,paid:2000000,status:"pending",carry:0,clientType:"recurring",endingPaid:false,sortOrder:0,trackingMonth:ACTIVE_MONTH},
      {id:createId(),name:"Client B",monthly:2500000,paid:1200000,status:"pending",carry:500000,clientType:"recurring",endingPaid:false,sortOrder:1,trackingMonth:ACTIVE_MONTH},
      {id:createId(),name:"New Client C",monthly:1800000,paid:0,status:"pending",carry:0,clientType:"recurring",endingPaid:false,sortOrder:2,trackingMonth:ACTIVE_MONTH},
      {id:createId(),name:"Paused Client",monthly:2200000,paid:0,status:"pending",carry:0,clientType:"recurring",endingPaid:false,sortOrder:3,trackingMonth:ACTIVE_MONTH}
    ],
    transactions: [
      {id:createId(),type:"expense",amount:240000,description:"Internet bill",category:"Essentials",channel:"Transfer",date:"2026-08-06"},
      {id:createId(),type:"expense",amount:50000,description:"Grocery",category:"Food",channel:"Offline",date:"2026-08-06"},
      {id:createId(),type:"expense",amount:42000,description:"Coffee",category:"Coffee",channel:"Grab",date:"2026-08-05"},
      {id:createId(),type:"income",amount:500000,description:"Bonus sales",category:"Others",channel:"Transfer",date:"2026-08-05"}
    ],
    budgets: [
      {id:createId(),category:"Food",monthly:3000000,paymentStatus:"auto",paidAmount:0,trackingMonth:null,sortOrder:0},
      {id:createId(),category:"Coffee",monthly:800000,paymentStatus:"auto",paidAmount:0,trackingMonth:null,sortOrder:1},
      {id:createId(),category:"Electricity",monthly:2000000,paymentStatus:"auto",paidAmount:0,trackingMonth:null,sortOrder:2},
      {id:createId(),category:"IPL",monthly:227500,paymentStatus:"auto",paidAmount:0,trackingMonth:null,sortOrder:3},
      {id:createId(),category:"Internet",monthly:296667,paymentStatus:"auto",paidAmount:0,trackingMonth:null,sortOrder:4},
      {id:createId(),category:"Needs",monthly:1800000,paymentStatus:"auto",paidAmount:0,trackingMonth:null,sortOrder:5},
      {id:createId(),category:"Subscriptions",monthly:260000,paymentStatus:"auto",paidAmount:0,trackingMonth:null,sortOrder:6},
      {id:createId(),category:"Others",monthly:1000000,paymentStatus:"auto",paidAmount:0,trackingMonth:null,sortOrder:7}
    ],
    yearly: [
      {id:createId(),name:"Annual Insurance",amount:6000000,month:"December",category:"Insurance",lastPaidYear:null,sortOrder:0},
      {id:createId(),name:"Vehicle Tax",amount:2500000,month:"March",category:"Tax",lastPaidYear:null,sortOrder:1}
    ],
    events: [
      {id:createId(),name:"Child Vaccine",amount:1950000,date:"2027-07-01",category:"Health",sortOrder:0},
      {id:createId(),name:"Domestic Holiday",amount:12000000,date:"2027-12-01",category:"Travel",sortOrder:1},
      {id:createId(),name:"Card Installment",amount:1250000,date:"2026-09-10",category:"Installment",sortOrder:2}
    ],
    creditFacilities: [
      {id:createId(),source:"Credit Card",limit:10000000},
      {id:createId(),source:"GoPayLater",limit:3000000},
      {id:createId(),source:"ShopeePayLater",limit:5000000}
    ],
    credit: [
      {id:createId(),source:"Credit Card",description:"Game purchase",amount:750000,due:"2026-08-26",paid:false,sortOrder:0},
      {id:createId(),source:"GoPayLater",description:"Online order",amount:420000,due:"2026-08-31",paid:false,sortOrder:1},
      {id:createId(),source:"ShopeePayLater",description:"Household item",amount:680000,due:"2026-09-25",paid:false,sortOrder:2}
    ],
    entrustedFunds: [],
    stockExtras: { netcashIdr: 0, walletUsd: 0 },
    stocks,
    electricity: [
      {id:createId(),date:"2026-08-06",time:"19:00",remaining:500},
      {id:createId(),date:"2026-08-20",time:"19:00",remaining:25}
    ]
  };
}

const legacyKeys = ["v6-accounts","v6-clients","v6-tx","v6-budgets","v6-yearly","v6-events","v6-credit","v6-stocks","v6-electric"];

export function readLegacyLocalStorage() {
  const exists = legacyKeys.some(key => localStorage.getItem(key));
  if (!exists) return null;
  const read = key => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
  const settings = (() => { try { return JSON.parse(localStorage.getItem("cvfinance-v6-settings")) || {}; } catch { return {}; } })();
  const withIds = rows => rows.map(row => ({ ...row, id: createId() }));
  const stocks = withIds(read("v6-stocks")).map(stock => ({
    ...stock,
    ticker: String(stock.ticker || "").toUpperCase(),
    displaySymbol: String(stock.ticker || "").toUpperCase(),
    provider: stock.market === "IDX" ? "yahoo" : "finnhub",
    providerSymbol: String(stock.ticker || "").toUpperCase(),
    manualCurrent: Number(stock.current || 0),
    priceSource: "manual",
    priceStatus: "manual",
    priceAsOf: null
  }));
  return {
    ...createEmptyState(),
    theme: settings.theme || localStorage.getItem("orbit-v6-theme") || "dark",
    baseMode: settings.baseMode === "auto" ? "auto" : "manual",
    optimisticMode: settings.optimisticMode === "auto" ? "auto" : "manual",
    baseGrowth: Number(settings.baseGrowth ?? 8), optimisticGrowth: Number(settings.optimisticGrowth ?? 14),
    usdIdr: Number(settings.usdIdr ?? 17810), rateKwh: Number(settings.rateKwh ?? 1740),
    accounts: withIds(read("v6-accounts")), clients: withIds(read("v6-clients")).map((client,index)=>({...client,status:client.status==="freeze"?"pending":client.status,clientType:"recurring",endingPaid:false,sortOrder:index,trackingMonth:ACTIVE_MONTH})),
    transactions: withIds(read("v6-tx")), budgets: withIds(read("v6-budgets")).map((item,index)=>({...item,paymentStatus:"auto",paidAmount:0,trackingMonth:null,sortOrder:index})),
    yearly: withIds(read("v6-yearly")).map((item,index)=>({...item,lastPaidYear:null,sortOrder:index})), events: withIds(read("v6-events")).map((item,index)=>({...item,sortOrder:index})),
    creditFacilities: createMvpSeed().creditFacilities,
    credit: withIds(read("v6-credit")).map((item,index)=>({...item,sortOrder:index})), stocks, electricity: withIds(read("v6-electric"))
  };
}
