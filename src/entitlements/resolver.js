export const ENTITLEMENT_FEATURES=["core_finance","cloud_sync","advanced_insights","export","premium_features"];
export const ENTITLEMENT_PLANS={free:["core_finance","cloud_sync"],paid:ENTITLEMENT_FEATURES};
export const ENTITLEMENT_STATUSES=new Set(["free","trialing","active","past_due","cancelled","expired"]);
const PAID_PLAN_ALIASES=new Set(["paid","premium","pro","lifetime","pundi_pro_lifetime"]);
const ACTIVE_ACCESS_STATUSES=new Set(["active","trialing"]);

function normalized(value){return String(value??"").trim().toLowerCase();}
function notExpired(value){
 if(value===null||value===undefined||value==="")return true;
 const timestamp=Date.parse(value);
 return Number.isFinite(timestamp)&&timestamp>Date.now();
}
function isLifetimeCode(value){return ["lifetime","pundi_pro_lifetime"].includes(normalized(value));}

export function resolveEntitlements(subscription=null, overrides={}){
 const plan=typeof subscription?.plan==="string"&&subscription.plan.trim()?subscription.plan.trim():"free";
 const status=ENTITLEMENT_STATUSES.has(subscription?.status)?subscription.status:"free";
 const provider=typeof subscription?.provider==="string"&&subscription.provider.trim()?subscription.provider.trim():"manual";
 const basePlan=ENTITLEMENT_PLANS[plan]?plan:PAID_PLAN_ALIASES.has(normalized(plan))?"paid":"free";
 const base=new Set(ENTITLEMENT_PLANS[basePlan]);
 const entitlements=Object.fromEntries(ENTITLEMENT_FEATURES.map(feature=>[feature,typeof overrides?.[feature]?.enabled==="boolean"?overrides[feature].enabled:base.has(feature)]));
 return {plan:basePlan,status,provider,entitlements};
}

export function accountPlanPresentation(account={}){
 const subscription=account?.subscription||account;
 const subscriptionPlan=normalized(subscription?.plan);
 const subscriptionActive=PAID_PLAN_ALIASES.has(subscriptionPlan)&&ACTIVE_ACCESS_STATUSES.has(normalized(subscription?.status))&&notExpired(subscription?.current_period_end||subscription?.expires_at||subscription?.entitlement_expires_at);
 const entitlement=(Array.isArray(account?.entitlements)?account.entitlements:[]).find(item=>{
  const code=normalized(item?.plan_code||item?.plan||item?.sku);
  return PAID_PLAN_ALIASES.has(code)&&ACTIVE_ACCESS_STATUSES.has(normalized(item?.status))&&notExpired(item?.expires_at);
 });
 const premium=Boolean(entitlement||subscriptionActive);
 const lifetime=Boolean(entitlement&&isLifetimeCode(entitlement.plan_code||entitlement.plan||entitlement.sku))||Boolean(subscriptionActive&&isLifetimeCode(subscriptionPlan));
 return premium?{label:"Premium",detail:lifetime?"Lifetime Access":"Premium Access",key:lifetime?"lifetime":"premium"}:{label:"Free",detail:"Free",key:"free"};
}
