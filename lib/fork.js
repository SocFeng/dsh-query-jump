import { applyProjectionEvent } from "./text.js";
import { loadSession } from "./persist.js";
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
async function inheritMaskFromParent(parentId, childMsgIds, clearMask) {
  if (childMsgIds.size === 0) return /* @__PURE__ */ new Set();
  let parentMask = clearMask.get(parentId);
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
export {
  createForkCacheSeeder,
  foldSeedQueries,
  resolveSeedLength,
  seedEventsOf
};
