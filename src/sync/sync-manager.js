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
    this.onState(state);
    this.unsubscribe?.();
    this.unsubscribe = this.repository.subscribe(() => this.handleRemoteChange());
    window.addEventListener("online", () => this.flush());
    window.addEventListener("offline", () => this.status("offline", "Offline", { pending:0 }));
    return this.user;
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

  async signOut() {
    const supabase = await getSupabase();
    this.unsubscribe?.();
    await supabase.auth.signOut();
    location.reload();
  }
}
