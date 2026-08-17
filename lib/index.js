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

// src/index.ts
var name = "dsh-query-jump";
var inject = ["connection"];
var CHANNEL = "/query-jump";
var PROJECTION_KEY = "queryJumpMessages";
var SETTINGS_NS = "dsh-query-jump";
var DEFAULTS = {
  enable: true,
  maxQuery: 200,
  includeSteering: false
};
var clearMask = /* @__PURE__ */ new Map();
var incremental = /* @__PURE__ */ new Map();
function resolveConfig(raw) {
  return {
    enable: typeof raw?.enable === "boolean" ? raw.enable : DEFAULTS.enable,
    maxQuery: typeof raw?.maxQuery === "number" && raw.maxQuery > 0 ? raw.maxQuery : DEFAULTS.maxQuery,
    includeSteering: typeof raw?.includeSteering === "boolean" ? raw.includeSteering : DEFAULTS.includeSteering
  };
}
var Config = Schema.object({
  enable: Schema.boolean().default(DEFAULTS.enable),
  maxQuery: Schema.number().default(DEFAULTS.maxQuery),
  includeSteering: Schema.boolean().default(DEFAULTS.includeSteering)
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
function readFromScope(scope, fallback) {
  if (!scope) return fallback;
  try {
    if (typeof scope.get === "function") return resolveConfig({ ...fallback, ...scope.get() });
  } catch (err) {
    console.warn("[dsh-query-jump] settings read failed", err);
  }
  return fallback;
}
async function writeEnable(scope, enable) {
  if (!scope) return;
  if (typeof scope.update === "function") {
    await scope.update({ enable });
    return;
  }
  if (typeof scope.replace === "function") {
    const cur = readFromScope(scope, { ...DEFAULTS, enable });
    await scope.replace({ ...cur, enable });
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
function apply(ctx, config) {
  let live = resolveConfig(config);
  let settingsScope = null;
  if (typeof ctx.inject === "function") {
    try {
      ctx.inject(["settings"], (sctx) => {
        try {
          settingsScope = sctx.settings.register(SETTINGS_NS, Config, {
            base: { ...live },
            applies: "live"
          });
          live = readFromScope(settingsScope, live);
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
  ctx.on("session/event", (session, event) => {
    const s = readFromScope(settingsScope, live);
    if (!s.enable) return;
    const sessionId = String(session?.id ?? "");
    if (!sessionId) return;
    const prev = incremental.get(sessionId) ?? { messages: [] };
    const next = applyProjectionEvent(prev, event, {
      includeSteering: s.includeSteering,
      maxQuery: s.maxQuery
    });
    if (next !== prev) incremental.set(sessionId, next);
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
            projectionKey: PROJECTION_KEY
          });
        }
        case "setEnable": {
          if (typeof payload?.enable !== "boolean") return badRequest("enable must be boolean");
          const s = readFromScope(settingsScope, live);
          const next = { ...s, enable: payload.enable };
          live = next;
          await writeEnable(settingsScope, payload.enable);
          return ok({ enable: next.enable });
        }
        case "list": {
          const sessionId = payload?.sessionId;
          if (typeof sessionId !== "string" || !sessionId) {
            return badRequest("sessionId must be a non-empty string");
          }
          const s = readFromScope(settingsScope, live);
          const masked = clearMask.get(sessionId) ?? /* @__PURE__ */ new Set();
          const messages = (incremental.get(sessionId)?.messages ?? []).filter(
            (m) => m.id && !masked.has(String(m.id))
          );
          return ok({
            sessionId,
            enable: s.enable,
            messages
          });
        }
        case "clearMask": {
          const sessionId = payload?.sessionId;
          if (typeof sessionId !== "string" || !sessionId) {
            return badRequest("sessionId must be a non-empty string");
          }
          const ids = Array.isArray(payload?.msgIds) ? payload.msgIds.map(String) : [];
          clearMask.set(sessionId, new Set(ids));
          return ok({ sessionId, masked: ids.length });
        }
        case "getMask": {
          const sessionId = payload?.sessionId;
          if (typeof sessionId !== "string" || !sessionId) {
            return badRequest("sessionId must be a non-empty string");
          }
          return ok({ sessionId, msgIds: [...clearMask.get(sessionId) ?? []] });
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
  inject,
  isUserQueryEvent,
  name,
  textOf
};
