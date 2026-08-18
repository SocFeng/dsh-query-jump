import { deleteSession, sessionIdVariants } from "./persist.js";
function createSessionCacheJanitor(deps) {
  const workspaceSessions = /* @__PURE__ */ new Map();
  const rememberWorkspace = (workspaceId, rec) => {
    const wid = String(workspaceId || "").trim();
    if (!wid) return;
    const ids = Array.isArray(rec?.sessionIds) ? rec.sessionIds.map(String).filter(Boolean) : [];
    if (ids.length === 0) {
      workspaceSessions.delete(wid);
      return;
    }
    workspaceSessions.set(wid, new Set(ids));
  };
  const hydrateWorkspaces = (storageDomain) => {
    try {
      const ws = storageDomain?.get?.("workspace");
      const table = ws?.table?.("workspaces");
      if (!table || typeof table.entries !== "function") return;
      for (const [wid, rec] of table.entries()) {
        rememberWorkspace(String(wid), rec);
      }
    } catch (err) {
      console.warn("[dsh-query-jump] workspace hydrate skipped", err);
    }
  };
  const purgeMemory = (sessionId) => {
    for (const variant of sessionIdVariants(sessionId)) {
      const t = deps.persistTimers.get(variant);
      if (t != null) {
        clearTimeout(t);
        deps.persistTimers.delete(variant);
      }
      deps.incremental.delete(variant);
      deps.clearMask.delete(variant);
      deps.hydrated.delete(variant);
    }
  };
  const purgeSession = (sessionId) => {
    const variants = sessionIdVariants(sessionId);
    if (variants.length === 0) return;
    for (const variant of variants) purgeMemory(variant);
    void deleteSession(sessionId).catch((err) => {
      console.warn("[dsh-query-jump] purgeSession disk failed", sessionId, err);
    });
  };
  const purgeWorkspace = (workspaceId) => {
    const wid = String(workspaceId || "").trim();
    if (!wid) return;
    const ids = workspaceSessions.get(wid);
    workspaceSessions.delete(wid);
    if (!ids?.size) return;
    for (const sid of ids) purgeSession(sid);
  };
  const onDomainChanged = (change) => {
    if (!change || typeof change !== "object") return;
    if (change.domain === "workspace" && change.table === "workspaces") {
      const wid = String(change.key ?? "");
      if (!wid) return;
      if (change.operation === "put") {
        rememberWorkspace(wid, change.value);
        return;
      }
      if (change.operation === "deleted") {
        purgeWorkspace(wid);
      }
      return;
    }
    if (change.domain === "session_projcache" && change.table === "sessions" && change.operation === "deleted") {
      const sid = String(change.key ?? "");
      if (sid) purgeSession(sid);
    }
  };
  const onSessionDisposed = (session) => {
    const sid = String(session?.id ?? "");
    if (sid) purgeSession(sid);
  };
  return {
    hydrateWorkspaces,
    purgeSession,
    purgeWorkspace,
    onDomainChanged,
    onSessionDisposed
  };
}
export {
  createSessionCacheJanitor
};
