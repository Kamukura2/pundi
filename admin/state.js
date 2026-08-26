export function withTimeout(promise, label, ms=10000) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out. Please retry.`)), ms))]);
}

export async function bootstrapAdminState({ getSession, loadDashboard, timeoutMs=10000 }) {
  try {
    const session = await withTimeout(getSession(), "Supabase session lookup", timeoutMs);
    if (!session) return { state:"unauthenticated" };
    try {
      const dashboard = await withTimeout(loadDashboard(session), "Admin dashboard request", timeoutMs);
      if (!dashboard || !dashboard.overview || !Array.isArray(dashboard.users)) throw new Error("Admin API returned an invalid dashboard response.");
      return { state:"dashboard", session, dashboard };
    } catch (error) {
      if (error.status === 401) return { state:"unauthenticated", error };
      if (error.status === 403) return { state:"denied", error };
      return { state:"error", error };
    }
  } catch (error) {
    return { state:"error", error };
  }
}
