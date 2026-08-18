// src/index.ts
import Schema from "@deepseek-ai/schemastery";

// src/text.ts
var GOAL_TAG = /^\s*<\s*goal_[a-z_]*\s*>\s*/i;
function textOf(content, maxChars = 200) {
  if (!Array.isArray(content)) return "";
  let out = "";
  let hasImage = false;
  for (const block of content) {
    if (block && typeof block === "object" && block.type === "text" && typeof block.text === "string") {
      out += block.text;
    } else if (block && typeof block === "object" && block.type === "image") {
      hasImage = true;
    }
  }
  const trimmed = out.replace(GOAL_TAG, "").trim().slice(0, maxChars);
  if (trimmed) return trimmed;
  return hasImage ? "[\u56FE\u7247\u6D88\u606F]" : "";
}
function isUserQueryEvent(event, includeSteering = false) {
  if (event?.type !== "user/message") return false;
  const kind = event.data?.source?.kind;
  if (kind !== "user") return false;
  return true;
}
function applyProjectionEvent(state, event, opts = {}) {
  const maxQuery = opts.maxQuery ?? 200;
  if (!isUserQueryEvent(event, opts.includeSteering)) return state;
  const data = event.data;
  const id = typeof data?.id === "string" ? data.id : void 0;
  if (id && state.messages.some((m) => m.id === id)) return state;
  const entry = {
    seq: typeof event.seq === "number" ? event.seq : state.messages.length,
    time: typeof event.time === "number" ? event.time : Date.now(),
    text: textOf(data?.content) || "(\u7A7A\u6D88\u606F)",
    ...id ? { id } : {}
  };
  return { messages: [...state.messages, entry].slice(-maxQuery) };
}
function fuzzyMatch(text, query) {
  const t = text.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (t.includes(q)) return true;
  let i = 0;
  for (const ch of t) {
    if (ch === q[i]) i++;
    if (i >= q.length) return true;
  }
  return false;
}

// src/persist.ts
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
function storeRoot() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
  return path.join(home, "storages", "query-jump");
}
function sessionFile(sessionId) {
  const safe = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(storeRoot(), `${safe}.json`);
}
function sessionIdVariants(sessionId) {
  const id = String(sessionId || "").trim();
  if (!id) return [];
  const variants = /* @__PURE__ */ new Set([id]);
  if (id.startsWith("session-")) {
    variants.add(id.slice("session-".length));
  } else if (/^[0-9a-f-]{36}$/i.test(id)) {
    variants.add(`session-${id}`);
  }
  return [...variants];
}
async function deleteSession(sessionId) {
  let removed = false;
  for (const variant of sessionIdVariants(sessionId)) {
    try {
      await unlink(sessionFile(variant));
      removed = true;
    } catch (err) {
      if (err?.code !== "ENOENT") {
        console.warn("[dsh-query-jump] deleteSession failed", variant, err);
      }
    }
  }
  return removed;
}
async function loadSession(sessionId) {
  try {
    const raw = await readFile(sessionFile(sessionId), "utf8");
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.messages)) return null;
    return {
      messages: data.messages,
      mask: Array.isArray(data.mask) ? data.mask.map(String) : [],
      updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now()
    };
  } catch {
    return null;
  }
}
async function saveSession(sessionId, messages, mask) {
  const dir = storeRoot();
  await mkdir(dir, { recursive: true });
  const payload = {
    messages,
    mask: [...mask],
    updatedAt: Date.now()
  };
  await writeFile(sessionFile(sessionId), JSON.stringify(payload), "utf8");
}

// src/cleanup.ts
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

// src/fork.ts
function resolveSeedLength(session) {
  const headerLen = session.header?.seedLength;
  if (typeof headerLen === "number" && headerLen >= 0) return headerLen;
  const liveSeq = session.firstLiveSeq;
  if (typeof liveSeq === "number" && liveSeq >= 0) return liveSeq;
  return null;
}
function seedEventsOf(session) {
  const events = session.events ?? [];
  const seedLen = resolveSeedLength(session);
  if (seedLen == null) return events;
  return events.slice(0, seedLen);
}
function foldSeedQueries(session, opts) {
  let state = { messages: [] };
  for (const event of seedEventsOf(session) ?? []) {
    state = applyProjectionEvent(state, event, opts);
  }
  return state;
}
async function inheritMaskFromParent(parentId, childMsgIds, clearMask2) {
  if (childMsgIds.size === 0) return /* @__PURE__ */ new Set();
  let parentMask = clearMask2.get(parentId);
  if (!parentMask?.size) {
    const disk = await loadSession(parentId);
    if (disk?.mask.length) parentMask = new Set(disk.mask);
  }
  if (!parentMask?.size) return /* @__PURE__ */ new Set();
  const inherited = /* @__PURE__ */ new Set();
  for (const id of parentMask) {
    if (childMsgIds.has(id)) inherited.add(id);
  }
  return inherited;
}
function createForkCacheSeeder(deps) {
  const onSessionCreated = (session) => {
    const parentId = String(session.header?.parentSession ?? "").trim();
    if (!parentId) return;
    const childId = String(session.id ?? "").trim();
    if (!childId || deps.incremental.has(childId)) return;
    void (async () => {
      const opts = deps.getConfig();
      let state = foldSeedQueries(session, opts);
      if (state.messages.length === 0) {
        const parentDisk = await loadSession(parentId);
        const parentMem = deps.incremental.get(parentId)?.messages;
        const seedIds = new Set(
          (seedEventsOf(session) ?? []).filter((e) => e?.type === "user/message" && e.data?.source?.kind === "user").map((e) => String(e.data?.id ?? "")).filter(Boolean)
        );
        const source = parentMem ?? parentDisk?.messages ?? [];
        const copied = source.filter((m) => m.id && seedIds.has(String(m.id)));
        if (copied.length) state = { messages: copied.slice(-opts.maxQuery) };
      }
      deps.incremental.set(childId, state);
      deps.hydrated.add(childId);
      const childMsgIds = new Set(
        state.messages.map((m) => m.id).filter((id) => Boolean(id))
      );
      const inheritedMask = await inheritMaskFromParent(parentId, childMsgIds, deps.clearMask);
      if (inheritedMask.size) deps.clearMask.set(childId, inheritedMask);
      deps.schedulePersist(childId);
    })().catch((err) => {
      console.warn("[dsh-query-jump] fork cache seed failed", childId, err);
    });
  };
  return { onSessionCreated, foldSeedQueries };
}

// src/session-delete.ts
import fs from "node:fs";
import path2 from "node:path";
import os2 from "node:os";
var SESSION_ID_RE = /^(session-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var SessionDeleteError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
};
function dshHome() {
  return process.env.DSH_HOME || path2.join(os2.homedir(), ".dsh");
}
function sessionsRoot() {
  return path2.join(dshHome(), "sessions");
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
      const candidate = path2.join(root, e.name, variant);
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

// src/backfill.ts
function foldEventsToState(events, opts = {}) {
  let state = { messages: [] };
  for (const event of events) {
    state = applyProjectionEvent(state, event, opts);
  }
  return state;
}
function mergeQueryStates(existing, folded, maxQuery = 200) {
  const byId = /* @__PURE__ */ new Map();
  for (const m of existing.messages) {
    if (m.id) byId.set(String(m.id), m);
  }
  for (const m of folded.messages) {
    if (!m.id) continue;
    const id = String(m.id);
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, m);
      continue;
    }
    byId.set(id, {
      ...prev,
      seq: typeof m.seq === "number" ? m.seq : prev.seq,
      time: typeof m.time === "number" ? m.time : prev.time,
      text: m.text || prev.text,
      id
    });
  }
  const merged = [...byId.values()].sort(compareByTimeline);
  return { messages: merged.slice(-maxQuery) };
}
function compareByTimeline(a, b) {
  const ta = typeof a.time === "number" ? a.time : 0;
  const tb = typeof b.time === "number" ? b.time : 0;
  if (ta !== tb) return ta - tb;
  const sa = typeof a.seq === "number" ? a.seq : 0;
  const sb = typeof b.seq === "number" ? b.seq : 0;
  return sa - sb;
}
function getLiveSessionEvents(ctx, sessionId) {
  const sessions = ctx.get?.("sessions");
  if (!sessions || typeof sessions.get !== "function") return null;
  for (const variant of sessionIdVariants(sessionId)) {
    const session = sessions.get(variant);
    if (session?.events?.length) return session.events;
  }
  return null;
}
function syncSessionQueries(ctx, sessionId, existing, opts) {
  const events = getLiveSessionEvents(ctx, sessionId);
  if (!events?.length) {
    return { state: existing, changed: false, added: 0 };
  }
  const maxQuery = opts.maxQuery ?? 200;
  const folded = foldEventsToState(events, opts);
  const beforeIds = new Set(existing.messages.map((m) => m.id).filter(Boolean));
  const merged = mergeQueryStates(existing, folded, maxQuery);
  const added = merged.messages.filter((m) => m.id && !beforeIds.has(m.id)).length;
  const changed = added > 0 || merged.messages.length !== existing.messages.length || merged.messages.some((m, i) => {
    const prev = existing.messages[i];
    return !prev || prev.id !== m.id || prev.time !== m.time || prev.seq !== m.seq;
  });
  return { state: merged, changed, added };
}

// src/index.ts
var name = "dsh-query-jump";
var inject = ["connection"];
var CHANNEL = "/query-jump";
var PROJECTION_KEY = "queryJumpMessages";
var SETTINGS_NS = "dsh-query-jump";
var DEFAULTS = {
  enable: true,
  maxQuery: 200,
  includeSteering: false,
  markerStyle: "emoji",
  markerSymbol: "\u{1F917}",
  syncHistoricalQueries: true,
  showDeleteSession: true
};
var clearMask = /* @__PURE__ */ new Map();
var incremental = /* @__PURE__ */ new Map();
var persistTimers = /* @__PURE__ */ new Map();
var hydrated = /* @__PURE__ */ new Set();
function resolveMarkerStyle(raw) {
  return raw === "number" ? "number" : "emoji";
}
function resolveMarkerSymbol(raw) {
  if (typeof raw !== "string") return DEFAULTS.markerSymbol;
  const s = raw.trim().slice(0, 8);
  return s || DEFAULTS.markerSymbol;
}
function resolveConfig(raw) {
  return {
    enable: typeof raw?.enable === "boolean" ? raw.enable : DEFAULTS.enable,
    maxQuery: typeof raw?.maxQuery === "number" && raw.maxQuery > 0 ? raw.maxQuery : DEFAULTS.maxQuery,
    includeSteering: typeof raw?.includeSteering === "boolean" ? raw.includeSteering : DEFAULTS.includeSteering,
    markerStyle: resolveMarkerStyle(raw?.markerStyle),
    markerSymbol: resolveMarkerSymbol(raw?.markerSymbol),
    syncHistoricalQueries: typeof raw?.syncHistoricalQueries === "boolean" ? raw.syncHistoricalQueries : DEFAULTS.syncHistoricalQueries,
    showDeleteSession: typeof raw?.showDeleteSession === "boolean" ? raw.showDeleteSession : DEFAULTS.showDeleteSession
  };
}
var Config = Schema.object({
  enable: Schema.boolean().default(DEFAULTS.enable).description("\u542F\u7528\u4F1A\u8BDD Query \u5B9A\u4F4D\u9762\u677F"),
  maxQuery: Schema.number().default(DEFAULTS.maxQuery).description("\u5355\u4F1A\u8BDD\u6700\u591A\u4FDD\u7559\u6761\u6570"),
  includeSteering: Schema.boolean().default(DEFAULTS.includeSteering).description("\u662F\u5426\u7EB3\u5165 steering \u6D88\u606F"),
  markerStyle: Schema.string().default(DEFAULTS.markerStyle).description("\u5217\u8868\u524D\u7F00\u6A21\u5F0F\uFF1Aemoji=\u81EA\u5B9A\u4E49\u7B26\u53F7 / number=\u5E8F\u53F7"),
  markerSymbol: Schema.string().default(DEFAULTS.markerSymbol).description("\u81EA\u5B9A\u4E49\u524D\u7F00\u7B26\u53F7\uFF08markerStyle=emoji \u65F6\u751F\u6548\uFF0C\u6700\u591A 8 \u5B57\u7B26\uFF09"),
  syncHistoricalQueries: Schema.boolean().default(DEFAULTS.syncHistoricalQueries).description("\u4ECE\u4F1A\u8BDD\u65E5\u5FD7\u540C\u6B65\u5C1A\u672A\u8BB0\u5F55\u7684 query\uFF0C\u6309\u63D0\u95EE\u65F6\u95F4\u6392\u5E8F"),
  showDeleteSession: Schema.boolean().default(DEFAULTS.showDeleteSession).description("\u663E\u793A\u5220\u9664\u4F1A\u8BDD\u6309\u94AE\uFF08\u4F1A\u8BDD\u6807\u9898\u680F\u4E0E\u4FA7\u680F\u83DC\u5355\uFF09")
});
function ok(value) {
  return { ok: true, value };
}
function badRequest(message) {
  return {
    ok: false,
    error: { code: "bad-request", message, details: { issues: [] } }
  };
}
function internalError(error) {
  return {
    ok: false,
    error: {
      code: "internal",
      message: error instanceof Error ? error.message : String(error),
      details: {}
    }
  };
}
function fromDeleteError(error) {
  if (error instanceof SessionDeleteError) {
    const code = error.status === 400 ? "bad-request" : error.status === 404 ? "not-found" : "internal";
    return {
      ok: false,
      error: { code, message: error.message, details: {} }
    };
  }
  return internalError(error);
}
function readFromScope(scope, fallback) {
  if (!scope?.get) return fallback;
  try {
    return resolveConfig({ ...fallback, ...scope.get() });
  } catch (err) {
    console.warn("[dsh-query-jump] settings read failed", err);
    return fallback;
  }
}
async function writeSettings(scope, patch) {
  if (!scope) return;
  if (typeof scope.update === "function") {
    await scope.update(patch);
    return;
  }
  if (typeof scope.replace === "function") {
    const cur = readFromScope(scope, { ...DEFAULTS, ...patch });
    await scope.replace({ ...cur, ...patch });
  }
}
function buildProjection(includeSteering, maxQuery) {
  return {
    key: PROJECTION_KEY,
    schema: { parse: (val) => val },
    stateVersion: 1,
    init: () => ({ messages: [] }),
    apply: (state, event) => applyProjectionEvent(state, event, { includeSteering, maxQuery }),
    view: (state) => state
  };
}
function schedulePersist(sessionId) {
  const prev = persistTimers.get(sessionId);
  if (prev) clearTimeout(prev);
  persistTimers.set(
    sessionId,
    setTimeout(() => {
      persistTimers.delete(sessionId);
      const messages = incremental.get(sessionId)?.messages ?? [];
      const mask = clearMask.get(sessionId) ?? /* @__PURE__ */ new Set();
      void saveSession(sessionId, messages, mask).catch((err) => {
        console.warn("[dsh-query-jump] persist failed", err);
      });
    }, 400)
  );
}
async function maybeSyncHistorical(ctx, sessionId, settings) {
  if (!settings.syncHistoricalQueries) {
    return incremental.get(sessionId) ?? { messages: [] };
  }
  const prev = incremental.get(sessionId) ?? { messages: [] };
  const { state, changed } = syncSessionQueries(ctx, sessionId, prev, {
    includeSteering: settings.includeSteering,
    maxQuery: settings.maxQuery
  });
  if (changed) {
    incremental.set(sessionId, state);
    schedulePersist(sessionId);
  }
  return state;
}
async function ensureHydrated(sessionId) {
  if (hydrated.has(sessionId)) return;
  hydrated.add(sessionId);
  const disk = await loadSession(sessionId);
  if (!disk) return;
  if (!incremental.has(sessionId) && disk.messages.length) {
    incremental.set(sessionId, { messages: disk.messages });
  }
  if (!clearMask.has(sessionId) && disk.mask.length) {
    clearMask.set(sessionId, new Set(disk.mask));
  }
}
function apply(ctx, config) {
  let live = resolveConfig(config);
  let settingsScope = null;
  if (typeof ctx.inject === "function") {
    try {
      ctx.inject(["settings"], (sctx) => {
        try {
          const registerOpts = {
            base: { ...live },
            applies: "live",
            expose: true
          };
          try {
            settingsScope = sctx.settings.register(SETTINGS_NS, Config, registerOpts);
          } catch {
            settingsScope = sctx.settings.register(SETTINGS_NS, Config, {
              base: { ...live },
              applies: "live"
            });
          }
          live = readFromScope(settingsScope, live);
          settingsScope?.watch?.((value) => {
            live = resolveConfig(value);
          });
        } catch (err) {
          console.warn("[dsh-query-jump] settings.register failed", err);
        }
      });
    } catch (err) {
      console.warn("[dsh-query-jump] settings inject skipped", err);
    }
  }
  if (typeof ctx.inject === "function") {
    try {
      ctx.inject(["sessionProjections"], (pctx) => {
        try {
          const s = readFromScope(settingsScope, live);
          pctx.sessionProjections.register(buildProjection(s.includeSteering, s.maxQuery));
        } catch (err) {
          console.warn("[dsh-query-jump] projection register failed", err);
        }
      });
    } catch (err) {
      console.warn("[dsh-query-jump] sessionProjections inject skipped", err);
    }
  }
  const janitor = createSessionCacheJanitor({
    incremental,
    clearMask,
    persistTimers,
    hydrated
  });
  ctx.on("session/disposed", janitor.onSessionDisposed);
  ctx.on("domain/changed", janitor.onDomainChanged);
  if (typeof ctx.inject === "function") {
    try {
      ctx.inject(["storageDomain"], (sctx) => {
        janitor.hydrateWorkspaces(sctx.storageDomain);
      });
    } catch (err) {
      console.warn("[dsh-query-jump] storageDomain inject skipped", err);
    }
  }
  const forkSeeder = createForkCacheSeeder({
    incremental,
    clearMask,
    hydrated,
    schedulePersist,
    getConfig: () => {
      const s = readFromScope(settingsScope, live);
      return { includeSteering: s.includeSteering, maxQuery: s.maxQuery };
    }
  });
  ctx.on("session/created", forkSeeder.onSessionCreated);
  ctx.on("session/event", (session, event) => {
    const s = readFromScope(settingsScope, live);
    if (!s.enable) return;
    const sessionId = String(session?.id ?? "");
    if (!sessionId) return;
    void (async () => {
      await ensureHydrated(sessionId);
      const prev = incremental.get(sessionId) ?? { messages: [] };
      const next = applyProjectionEvent(prev, event, {
        includeSteering: s.includeSteering,
        maxQuery: s.maxQuery
      });
      if (next !== prev) {
        incremental.set(sessionId, next);
        schedulePersist(sessionId);
      }
    })();
  });
  const handler = async (endpoint, payload, signal) => {
    try {
      switch (endpoint) {
        case "getConfig": {
          const s = readFromScope(settingsScope, live);
          return ok({
            enable: s.enable,
            maxQuery: s.maxQuery,
            includeSteering: s.includeSteering,
            markerStyle: s.markerStyle,
            markerSymbol: s.markerSymbol,
            syncHistoricalQueries: s.syncHistoricalQueries,
            showDeleteSession: s.showDeleteSession,
            projectionKey: PROJECTION_KEY,
            settingsNamespace: SETTINGS_NS
          });
        }
        case "setEnable": {
          if (typeof payload?.enable !== "boolean") return badRequest("enable must be boolean");
          const s = readFromScope(settingsScope, live);
          const next = { ...s, enable: payload.enable };
          live = next;
          await writeSettings(settingsScope, { enable: payload.enable });
          return ok({
            enable: next.enable,
            markerStyle: next.markerStyle,
            markerSymbol: next.markerSymbol
          });
        }
        case "setConfig": {
          const patch = {};
          if (typeof payload?.enable === "boolean") patch.enable = payload.enable;
          if (payload?.markerStyle === "emoji" || payload?.markerStyle === "number") {
            patch.markerStyle = payload.markerStyle;
          }
          if (typeof payload?.markerSymbol === "string") {
            patch.markerSymbol = resolveMarkerSymbol(payload.markerSymbol);
          }
          if (typeof payload?.maxQuery === "number" && payload.maxQuery > 0) {
            patch.maxQuery = payload.maxQuery;
          }
          if (typeof payload?.includeSteering === "boolean") {
            patch.includeSteering = payload.includeSteering;
          }
          if (typeof payload?.syncHistoricalQueries === "boolean") {
            patch.syncHistoricalQueries = payload.syncHistoricalQueries;
          }
          if (typeof payload?.showDeleteSession === "boolean") {
            patch.showDeleteSession = payload.showDeleteSession;
          }
          if (Object.keys(patch).length === 0) {
            return badRequest(
              "setConfig requires enable | markerStyle | markerSymbol | maxQuery | includeSteering | syncHistoricalQueries | showDeleteSession"
            );
          }
          const s = readFromScope(settingsScope, live);
          const next = resolveConfig({ ...s, ...patch });
          live = next;
          await writeSettings(settingsScope, patch);
          return ok({
            enable: next.enable,
            markerStyle: next.markerStyle,
            markerSymbol: next.markerSymbol,
            maxQuery: next.maxQuery,
            includeSteering: next.includeSteering,
            syncHistoricalQueries: next.syncHistoricalQueries,
            showDeleteSession: next.showDeleteSession
          });
        }
        case "list": {
          const sessionId = payload?.sessionId;
          if (typeof sessionId !== "string" || !sessionId) {
            return badRequest("sessionId must be a non-empty string");
          }
          await ensureHydrated(sessionId);
          const s = readFromScope(settingsScope, live);
          const state = await maybeSyncHistorical(ctx, sessionId, s);
          const masked = clearMask.get(sessionId) ?? /* @__PURE__ */ new Set();
          const messages = (state.messages ?? []).filter(
            (m) => m.id && !masked.has(String(m.id))
          );
          return ok({
            sessionId,
            enable: s.enable,
            markerStyle: s.markerStyle,
            markerSymbol: s.markerSymbol,
            syncHistoricalQueries: s.syncHistoricalQueries,
            messages
          });
        }
        case "clearMask": {
          const sessionId = payload?.sessionId;
          if (typeof sessionId !== "string" || !sessionId) {
            return badRequest("sessionId must be a non-empty string");
          }
          await ensureHydrated(sessionId);
          const ids = Array.isArray(payload?.msgIds) ? payload.msgIds.map(String) : [];
          clearMask.set(sessionId, new Set(ids));
          schedulePersist(sessionId);
          return ok({ sessionId, masked: ids.length });
        }
        case "getMask": {
          const sessionId = payload?.sessionId;
          if (typeof sessionId !== "string" || !sessionId) {
            return badRequest("sessionId must be a non-empty string");
          }
          await ensureHydrated(sessionId);
          return ok({ sessionId, msgIds: [...clearMask.get(sessionId) ?? []] });
        }
        case "listSessions": {
          const sessions = await listSessionsForDelete(ctx);
          return ok({ sessions });
        }
        case "deleteSession": {
          const sessionId = payload?.sessionId;
          if (typeof sessionId !== "string" || !sessionId.trim()) {
            return badRequest("sessionId must be a non-empty string");
          }
          const id = sessionId.trim();
          try {
            const result = await deleteSessionPermanently(ctx, id);
            janitor.purgeSession(id);
            return ok({ sessionId: id, ...result });
          } catch (error) {
            return fromDeleteError(error);
          }
        }
        case "ping":
          return ok({ pong: true });
        default:
          return badRequest(`unknown endpoint ${JSON.stringify(endpoint)}`);
      }
    } catch (error) {
      if (signal?.aborted) return internalError(new Error("aborted"));
      return internalError(error);
    }
  };
  ctx.effect(
    () => ctx.connection.rpc.handle(CHANNEL, handler, { authority: "loopback" }),
    "dsh-query-jump: rpc"
  );
}
export {
  CHANNEL,
  Config,
  PROJECTION_KEY,
  apply,
  applyProjectionEvent,
  buildProjection,
  clearMask,
  fuzzyMatch,
  inject,
  isUserQueryEvent,
  name,
  textOf
};
