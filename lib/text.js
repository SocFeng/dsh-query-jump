const GOAL_TAG = /^\s*<\s*goal_[a-z_]*\s*>\s*/i;
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
export {
  applyProjectionEvent,
  fuzzyMatch,
  isUserQueryEvent,
  textOf
};
