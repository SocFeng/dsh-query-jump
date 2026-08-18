import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { sessionIdVariants } from "./persist.js";
const SESSION_ID_RE = /^(session-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class SessionDeleteError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
}
function sessionsRoot() {
  return path.join(dshHome(), "sessions");
}
function findSessionDirs(sessionId) {
  const root = sessionsRoot();
  const variants = sessionIdVariants(sessionId);
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    for (const variant of variants) {
      const candidate = path.join(root, e.name, variant);
      try {
        if (fs.statSync(candidate).isDirectory() && !found.includes(candidate)) {
          found.push(candidate);
        }
      } catch {
      }
    }
  }
  return found;
}
function removeSessionDirs(sessionId) {
  const dirs = findSessionDirs(sessionId);
  for (const dir of dirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return dirs.length > 0;
}
async function stripStorageDomains(ctx, sessionId, { workspace = true } = {}) {
  const sd = ctx.get?.("storageDomain");
  if (!sd) return { projRemoved: false, workspaceRemoved: false };
  const variants = sessionIdVariants(sessionId);
  let projRemoved = false;
  let workspaceRemoved = false;
  const proj = sd.get?.("session_projcache");
  if (proj && typeof proj.table === "function") {
    try {
      const sessions = proj.table("sessions");
      for (const variant of variants) {
        if (sessions.get(variant) !== void 0) {
          await sessions.delete(variant);
          projRemoved = true;
        }
      }
    } catch {
    }
  }
  if (workspace) {
    const ws = sd.get?.("workspace");
    if (ws && typeof ws.table === "function") {
      try {
        const workspaces = ws.table("workspaces");
        for (const [wid, rec] of workspaces.entries()) {
          if (rec && Array.isArray(rec.sessionIds) && variants.some((v) => rec.sessionIds.includes(v))) {
            await workspaces.put(wid, {
              ...rec,
              sessionIds: rec.sessionIds.filter((x) => !variants.includes(x))
            });
            workspaceRemoved = true;
          }
        }
      } catch {
      }
      try {
        const g = ws.global;
        if (g && typeof g.get === "function" && typeof g.set === "function") {
          const state = g.get();
          if (state && Array.isArray(state.archivedSessionIds) && variants.some((v) => state.archivedSessionIds.includes(v))) {
            await g.set({
              ...state,
              archivedSessionIds: state.archivedSessionIds.filter(
                (x) => !variants.includes(x)
              )
            });
            workspaceRemoved = true;
          }
        }
      } catch {
      }
    }
  }
  return { projRemoved, workspaceRemoved };
}
async function stopAgentIfRunning(ctx, sessionId) {
  const agents = ctx.get?.("agents");
  if (!agents || typeof agents.get !== "function") return false;
  const agent = agents.get(sessionId);
  if (!agent) return false;
  if (typeof agent.cancel === "function") {
    try {
      agent.cancel({ kind: "user" });
    } catch {
    }
  }
  if (typeof agent.whenIdle === "function") {
    try {
      await Promise.race([
        agent.whenIdle(),
        new Promise((resolve) => setTimeout(resolve, 15e3))
      ]);
    } catch {
    }
  }
  return true;
}
async function flushSessionIfLive(ctx, sessionId) {
  const sessions = ctx.get?.("sessions");
  if (!sessions || typeof sessions.get !== "function") return false;
  let flushed = false;
  for (const variant of sessionIdVariants(sessionId)) {
    const session = sessions.get(variant);
    if (!session) continue;
    if (typeof sessions.flush === "function") {
      try {
        await sessions.flush(session);
        flushed = true;
      } catch {
      }
    }
  }
  return flushed;
}
function detachLiveSession(ctx, sessionId) {
  const sessions = ctx.get?.("sessions");
  if (!sessions) return false;
  let detached = false;
  try {
    const store = sessions.store;
    for (const variant of sessionIdVariants(sessionId)) {
      const entry = store && typeof store.get === "function" ? store.get(variant) : void 0;
      if (entry === void 0) continue;
      if (typeof sessions.detachEntered === "function") {
        sessions.detachEntered(entry);
        detached = true;
      } else if (store && typeof store.delete === "function") {
        store.delete(variant);
        if (sessions.attachments && entry.session && typeof sessions.attachments.delete === "function") {
          sessions.attachments.delete(entry.session);
        }
        detached = true;
      }
    }
  } catch {
  }
  return detached;
}
async function deleteSessionPermanently(ctx, sessionId) {
  if (!SESSION_ID_RE.test(sessionId)) {
    throw new SessionDeleteError(`invalid session id: ${sessionId}`, 400);
  }
  const stopped = await stopAgentIfRunning(ctx, sessionId);
  await flushSessionIfLive(ctx, sessionId);
  const detached = detachLiveSession(ctx, sessionId);
  const firstDirRemoved = removeSessionDirs(sessionId);
  const projStorage = await stripStorageDomains(ctx, sessionId, { workspace: false });
  const secondDirRemoved = removeSessionDirs(sessionId);
  await new Promise((resolve) => setImmediate(resolve));
  const thirdDirRemoved = removeSessionDirs(sessionId);
  const remainingDirs = findSessionDirs(sessionId);
  if (remainingDirs.length > 0) {
    throw new SessionDeleteError(
      `session files could not be fully removed: ${remainingDirs.join(", ")}`,
      500
    );
  }
  const workspaceStorage = await stripStorageDomains(ctx, sessionId, { workspace: true });
  const dirRemoved = firstDirRemoved || secondDirRemoved || thirdDirRemoved;
  const projRemoved = projStorage.projRemoved || workspaceStorage.projRemoved;
  const workspaceRemoved = workspaceStorage.workspaceRemoved;
  if (!dirRemoved && !projRemoved && !workspaceRemoved) {
    throw new SessionDeleteError(`session not found: ${sessionId}`, 404);
  }
  return { stopped, detached, dirRemoved, projRemoved, workspaceRemoved };
}
async function listSessionsForDelete(ctx) {
  const agents = ctx.get?.("agents");
  const sd = ctx.get?.("storageDomain");
  const out = [];
  if (!sd) return out;
  const proj = sd.get?.("session_projcache");
  if (!proj || typeof proj.table !== "function") return out;
  try {
    const sessions = proj.table("sessions");
    for (const [id, rec] of sessions.entries()) {
      if (!rec || typeof rec !== "object") continue;
      const rows = rec.rows && typeof rec.rows === "object" ? rec.rows : {};
      const titleRow = rows.title && rows.title.val;
      const identity = rec.identity && typeof rec.identity === "object" ? rec.identity : {};
      out.push({
        sessionId: id,
        title: typeof titleRow === "string" ? titleRow : null,
        createdAt: typeof identity.createdAt === "number" ? identity.createdAt : null,
        running: !!(agents && typeof agents.get === "function" && agents.get(id))
      });
    }
  } catch {
  }
  return out;
}
export {
  SessionDeleteError,
  deleteSessionPermanently,
  findSessionDirs,
  listSessionsForDelete
};
