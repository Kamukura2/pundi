import { clearUserScopedState } from "../lib/idb.js";
import { getSupabase } from "../lib/supabase.js";
import { FinanceRepository, exportBackup, validateBackup } from "../data/repository.js";

export class SyncManager {
  constructor({ onState, onStatus }) {
    this.onState = onState;
    this.onStatus = onStatus;
    this.repository = null;
    this.user = null;
    this.saveChain = Promise.resolve();
    this.unsubscribe = null;
    this.busy = false;
    this.pendingPersists = 0;
  }

  status(kind, message, extras = {}) {
    this.onStatus?.({ kind, message, ...extras });
  }

  async connect(email, password) {
    const supabase = await getSupabase();
    if (email && password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    const { data:{ session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    this.user = session.user;
    this.repository = new FinanceRepository(supabase, this.user);
    this.status("loading", "Loading cloud data…");
    let state;
    try {
      state = await this.repository.loadCloud();
      this.status("saved", "Synced", { lastSynced:new Date().toISOString(), pending:await this.repository.pendingCount() });
    } catch (error) {
      const cached = await this.repository.loadCache();
      if (!cached) throw error;
      state = cached.state;
      this.status("offline", "Offline cache", { lastSynced:cached.savedAt, pending:await this.repository.pendingCount() });
    }
    try {
      this.onState(state);
    } catch (error) {
      this.status("error", "Dashboard initialization failed", { detail:error.message });
    }
    this.unsubscribe?.();
    this.unsubscribe = this.repository.subscribe(() => this.handleRemoteChange());
    window.addEventListener("online", () => this.flush());
    window.addEventListener("offline", () => this.status("offline", "Offline", { pending:0 }));
    return this.user;
  }

  async signUp(email, password) {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    if (error) throw error;
    return data;
  }

  async handleRemoteChange() {
    if (!this.repository || this.busy || this.pendingPersists || await this.repository.pendingCount()) return;
    try {
      const state = await this.repository.loadCloud();
      this.onState(state);
      this.status("saved", "Synced", { lastSynced:new Date().toISOString(), pending:0 });
    } catch (error) {
      this.status("error", "Sync error", { detail:error.message });
    }
  }

  persist(state, { background = false } = {}) {
    if (!this.repository) return this.saveChain;
    const snapshot = structuredClone(state);
    this.pendingPersists += 1;
    this.saveChain = this.saveChain.then(async () => {
      this.busy = true;
      if (!background) this.status(navigator.onLine ? "saving" : "offline", navigator.onLine ? "Saving…" : "Queued offline");
      try {
        let result;
        try {
          result = await this.repository.save(snapshot);
        } catch (error) {
          if (!/conflict/i.test(error.message || "")) throw error;
          await this.repository.loadCloud();
          result = await this.repository.save(snapshot);
        }
        this.onState(result.state, { preserveUi:true });
        if (!background || result.offline) {
          this.status(result.offline ? "offline" : "saved", result.offline ? `${result.pending} unsynced` : result.warning ? "Saved · setup needed" : "Saved", {
            lastSynced:result.offline ? null : new Date().toISOString(), pending:result.pending, detail:result.warning||""
          });
        }
      } catch (error) {
        this.status("error", "Sync error", { detail:error.message });
        throw error;
      } finally {
        this.busy = false;
        this.pendingPersists = Math.max(0, this.pendingPersists - 1);
      }
    }).catch(() => {});
    return this.saveChain;
  }

  async flush() {
    if (!this.repository || !navigator.onLine) return;
    const pending = await this.repository.pendingCount();
    if (!pending) return this.handleRemoteChange();
    this.busy = true;
    this.status("saving", `Syncing ${pending} change${pending === 1 ? "" : "s"}…`, { pending });
    try {
      const state = await this.repository.flushQueue();
      this.onState(state);
      this.status("saved", "Synced", { lastSynced:new Date().toISOString(), pending:0 });
    } catch (error) {
      this.status("error", "Synchronization error", { detail:error.message, pending:await this.repository.pendingCount() });
    } finally {
      this.busy = false;
    }
  }

  async replaceAll(state) {
    this.status("saving", "Importing…");
    const result = await this.repository.replaceAll(state);
    this.onState(result.state);
    this.status("saved", "Imported and synced", { lastSynced:new Date().toISOString(), pending:0 });
  }

  downloadBackup(state) {
    const backup = exportBackup(state, this.user.id);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type:"application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cvfinance-backup-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async importBackup(file) {
    const parsed = JSON.parse(await file.text());
    return this.replaceAll(validateBackup(parsed));
  }

  async requestPasswordReset(email) {
    const supabase = await getSupabase();
    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async changePassword(password, { recovery = false, expectedUserId = null } = {}) {
    const supabase = await getSupabase();
    const { data:{ session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("Authentication required.");
    if (recovery && !session.user.id) throw new Error("Recovery session is unavailable.");
    if (recovery && expectedUserId && session.user.id !== expectedUserId) throw new Error("Recovery session does not match the reset request.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  async accountMetadata() {
    const supabase = await getSupabase();
    const { data:{ session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Authentication required.");
    const response = await fetch("/api/account", { cache:"no-store", headers:{ Authorization:`Bearer ${session.access_token}`, "Cache-Control":"no-cache" } });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || "Account metadata unavailable.");
    return body;
  }

  async deleteAccount(confirmation) {
    if (confirmation !== "DELETE") throw new Error("Type DELETE to confirm account deletion.");
    const supabase = await getSupabase();
    const userId = this.user?.id;
    if (!userId) throw new Error("Authentication required.");
    const { data:{ session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Authentication required.");
    const response = await fetch("/api/account", { method:"DELETE", cache:"no-store", headers:{ Authorization:`Bearer ${session.access_token}`, "Content-Type":"application/json", "Cache-Control":"no-cache" }, body:JSON.stringify({confirmation}) });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || "Account deletion failed.");
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.repository = null;
    this.user = null;
    await clearUserScopedState(userId);
    await supabase.auth.signOut({ scope:"local" });
    return body;
  }

  async signOut({ reload = true } = {}) {
    const supabase = await getSupabase();
    const previousUserId = this.user?.id;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.repository = null;
    this.user = null;
    await clearUserScopedState(previousUserId);
    await supabase.auth.signOut({ scope:"local" });
    if (reload) location.reload();
  }
}
