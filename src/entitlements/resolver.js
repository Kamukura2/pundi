export const ENTITLEMENT_FEATURES=["core_finance","cloud_sync","advanced_insights","export","premium_features"];
export const ENTITLEMENT_PLANS={free:["core_finance","cloud_sync"],paid:ENTITLEMENT_FEATURES};
export const ENTITLEMENT_STATUSES=new Set(["free","trialing","active","past_due","cancelled","expired"]);

export function resolveEntitlements(subscription=null, overrides={}){
 const plan=typeof subscription?.plan==="string"&&subscription.plan.trim()?subscription.plan.trim():"free";
 const status=ENTITLEMENT_STATUSES.has(subscription?.status)?subscription.status:"free";
 const provider=typeof subscription?.provider==="string"&&subscription.provider.trim()?subscription.provider.trim():"manual";
 const basePlan=ENTITLEMENT_PLANS[plan]?plan:"free";
 const base=new Set(ENTITLEMENT_PLANS[basePlan]);
 const entitlements=Object.fromEntries(ENTITLEMENT_FEATURES.map(feature=>[feature,typeof overrides?.[feature]?.enabled==="boolean"?overrides[feature].enabled:base.has(feature)]));
 return {plan:basePlan,status,provider,entitlements};
}
