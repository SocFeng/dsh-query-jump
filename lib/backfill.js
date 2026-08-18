import { sessionIdVariants } from "./persist.js";
import {
  applyProjectionEvent
} from "./text.js";
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
export {
  compareByTimeline,
  foldEventsToState,
  getLiveSessionEvents,
  mergeQueryStates,
  syncSessionQueries
};
