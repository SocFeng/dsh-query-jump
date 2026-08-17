window.__ModuleLoader__.load({
  id: "dsh-query-jump",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = __toESM(require("react"), 1);
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots", "connection", "locale"];
var NS = "query-jump";
var CHANNEL = "/query-jump";
var PROJECTION_KEY = "queryJumpMessages";
var FLOW_KEY = "data-chat-flow-key";
var FLOW_KIND = "data-chat-flow-kind";
var SCROLL_SEL = "[data-conversation-scroll]";
var FULL_LOAD_PAGES = 120;
var PANEL_W = 280;
var HOT_W = 10;
var EDGE_GAP = 4;
var COLLAPSE_DELAY_MS = 280;
var zh = {
  title: "\u63D0\u95EE\u8BB0\u5F55",
  clear: "\u6E05\u7A7A",
  empty: "\u6682\u65E0\u63D0\u95EE",
  noSession: "\u8BF7\u5148\u6253\u5F00\u4F1A\u8BDD",
  jumpFail: "\u65E0\u6CD5\u5B9A\u4F4D\u8BE5\u6D88\u606F"
};
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function measureDock() {
  const sc = document.querySelector(SCROLL_SEL);
  if (!sc) return null;
  const rect = sc.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 80) return null;
  const right = Math.max(EDGE_GAP, Math.round(window.innerWidth - rect.right + EDGE_GAP));
  const top = Math.max(48, Math.round(rect.top + 24));
  const height = Math.max(180, Math.min(Math.round(rect.height - 40), Math.round(window.innerHeight * 0.78)));
  return { right, top, height };
}
function windowHasId(snap, id) {
  try {
    if (!snap?.chat?.order || !snap?.chat?.nodes) return false;
    for (const k of snap.chat.order) {
      const n = snap.chat.nodes.get(k);
      if (n != null && String(n.id) === String(id)) return true;
    }
  } catch {
  }
  return false;
}
async function loadUntilIdLoaded(face, id) {
  let pages = 0;
  let guard = 0;
  while (guard++ < 300) {
    let snap;
    try {
      snap = face.getSnapshot();
    } catch {
      return;
    }
    if (snap == null || snap.openState === "error") return;
    if (snap.openState !== "open") {
      await delay(120);
      continue;
    }
    if (windowHasId(snap, id)) return;
    if (snap.hasMore !== true) return;
    if (snap.loadingOlder === true) {
      await delay(50);
      continue;
    }
    try {
      await face.loadOlder();
    } catch {
      return;
    }
    if (++pages >= FULL_LOAD_PAGES) return;
  }
}
function findRowByMsgId(msgId) {
  const nodes = document.querySelectorAll(`[${FLOW_KEY}]`);
  for (const node of Array.from(nodes)) {
    const kind = node.getAttribute(FLOW_KIND);
    if (kind && kind !== "user") continue;
    const key = node.getAttribute(FLOW_KEY) || "";
    if (key.includes(msgId)) return node;
  }
  return null;
}
function formatTime(ts) {
  try {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}
function QueryJumpPanel({ ctx, useSessions, useProjection, rpc, t, isLoopback }) {
  const sessionId = useSessions((s) => s.current);
  const projected = useProjection?.(PROJECTION_KEY);
  const [enable, setEnable] = (0, import_react.useState)(true);
  const [mask, setMask] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [open, setOpen] = (0, import_react.useState)(false);
  const [geo, setGeo] = (0, import_react.useState)(null);
  const [rpcMessages, setRpcMessages] = (0, import_react.useState)([]);
  const hoverRef = (0, import_react.useRef)(false);
  const collapseTimer = (0, import_react.useRef)(null);
  const clearCollapseTimer = () => {
    if (collapseTimer.current != null) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  };
  const scheduleCollapse = () => {
    clearCollapseTimer();
    collapseTimer.current = window.setTimeout(() => {
      if (!hoverRef.current) setOpen(false);
    }, COLLAPSE_DELAY_MS);
  };
  const onEnter = () => {
    hoverRef.current = true;
    clearCollapseTimer();
    setOpen(true);
  };
  const onLeave = () => {
    hoverRef.current = false;
    scheduleCollapse();
  };
  const refreshGeo = (0, import_react.useCallback)(() => {
    const next = measureDock();
    setGeo((prev) => {
      if (!next) return prev;
      if (prev && prev.right === next.right && prev.top === next.top && prev.height === next.height) {
        return prev;
      }
      return next;
    });
  }, []);
  (0, import_react.useEffect)(() => {
    refreshGeo();
    const onResize = () => refreshGeo();
    window.addEventListener("resize", onResize);
    const sc = document.querySelector(SCROLL_SEL);
    let ro = null;
    if (sc && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => refreshGeo());
      ro.observe(sc);
      if (sc.parentElement) ro.observe(sc.parentElement);
    }
    const tick = window.setInterval(refreshGeo, 400);
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      window.clearInterval(tick);
      clearCollapseTimer();
    };
  }, [refreshGeo]);
  const refreshConfig = (0, import_react.useCallback)(async () => {
    if (!isLoopback) return;
    try {
      const res = await rpc.call(CHANNEL, "getConfig", {});
      if (res?.ok) setEnable(!!res.value.enable);
    } catch (err) {
      console.warn("[dsh-query-jump] getConfig", err);
    }
  }, [rpc, isLoopback]);
  const refreshMask = (0, import_react.useCallback)(async () => {
    if (!isLoopback || !sessionId) {
      setMask(/* @__PURE__ */ new Set());
      return;
    }
    try {
      const res = await rpc.call(CHANNEL, "getMask", { sessionId });
      if (res?.ok) setMask(new Set((res.value.msgIds ?? []).map(String)));
    } catch (err) {
      console.warn("[dsh-query-jump] getMask", err);
    }
  }, [rpc, isLoopback, sessionId]);
  const refreshList = (0, import_react.useCallback)(async () => {
    if (!isLoopback || !sessionId) {
      setRpcMessages([]);
      return;
    }
    try {
      const res = await rpc.call(CHANNEL, "list", { sessionId });
      if (res?.ok) {
        if (typeof res.value.enable === "boolean") setEnable(res.value.enable);
        setRpcMessages(res.value.messages ?? []);
      }
    } catch (err) {
      console.warn("[dsh-query-jump] list", err);
    }
  }, [rpc, isLoopback, sessionId]);
  (0, import_react.useEffect)(() => {
    void refreshConfig();
    const timer = window.setInterval(() => void refreshConfig(), 3e3);
    return () => window.clearInterval(timer);
  }, [refreshConfig]);
  (0, import_react.useEffect)(() => {
    void refreshMask();
  }, [refreshMask]);
  (0, import_react.useEffect)(() => {
    void refreshList();
    if (!sessionId || !isLoopback) return;
    const timer = window.setInterval(() => void refreshList(), 1500);
    return () => window.clearInterval(timer);
  }, [refreshList, sessionId, isLoopback]);
  const items = (0, import_react.useMemo)(() => {
    const fromProj = (projected?.messages ?? []).filter((m) => m.id && !mask.has(String(m.id)));
    const source = fromProj.length > 0 ? fromProj : rpcMessages;
    return source.map((m) => ({
      msgId: String(m.id),
      query: m.text || "(\u7A7A)",
      createAt: m.time,
      seq: m.seq
    }));
  }, [projected, mask, rpcMessages]);
  const onClear = async () => {
    if (!sessionId) return;
    const ids = items.map((i) => i.msgId);
    try {
      await rpc.call(CHANNEL, "clearMask", { sessionId, msgIds: ids });
      await refreshMask();
      await refreshList();
    } catch (err) {
      console.warn("[dsh-query-jump] clearMask", err);
    }
  };
  const onJump = async (msgId) => {
    if (busy || !sessionId) return;
    setBusy(true);
    try {
      let row = findRowByMsgId(msgId);
      if (!row) {
        let face = null;
        try {
          face = ctx.sessions?.binding?.(sessionId)?.session ?? null;
        } catch {
          face = null;
        }
        if (face) {
          await loadUntilIdLoaded(face, msgId);
          let tries = 0;
          while (tries++ < 20 && !row) {
            row = findRowByMsgId(msgId);
            if (!row) await delay(60);
          }
        }
      }
      if (!row) {
        console.warn(`[dsh-query-jump] ${t("jumpFail")}`, msgId);
        return;
      }
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      const prev = row.style.outline;
      row.style.outline = "2px solid var(--dsw-alias-brand-primary, #615ced)";
      window.setTimeout(() => {
        row.style.outline = prev;
      }, 1200);
    } finally {
      setBusy(false);
    }
  };
  if (!enable || !isLoopback) return null;
  if (!geo) return null;
  if (items.length === 0 && !open) return null;
  const { right, top, height } = geo;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "fixed",
        zIndex: 45,
        right,
        top,
        width: open ? PANEL_W : HOT_W,
        height: open ? height : Math.min(220, height),
        display: "flex",
        justifyContent: "flex-end",
        pointerEvents: "auto",
        transition: "width .2s ease"
      },
      onPointerEnter: onEnter,
      onPointerLeave: onLeave,
      children: [
        !open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: HOT_W,
              height: "100%",
              borderRadius: 6,
              background: "transparent",
              cursor: "ew-resize"
            },
            title: t("title")
          }
        ),
        open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              width: PANEL_W,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: "var(--dsw-alias-bg-layer-3, rgba(255,255,255,.96))",
              border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.06))",
              borderRadius: 12,
              boxShadow: "0 10px 40px rgba(15,23,42,.12)",
              color: "var(--dsw-alias-label-primary, #1f2329)",
              backdropFilter: "blur(8px)",
              overflow: "hidden",
              animation: "qjSlideIn .18s ease-out"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px 8px",
                    flexShrink: 0
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, fontWeight: 600 }, children: t("title") }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        onClick: () => void onClear(),
                        style: {
                          border: "none",
                          background: "transparent",
                          color: "var(--dsw-alias-label-secondary, #8a8f98)",
                          fontSize: 12,
                          cursor: "pointer",
                          padding: "2px 4px"
                        },
                        children: t("clear")
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { overflow: "auto", flex: 1, padding: "0 8px 10px" }, children: [
                !sessionId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: emptyStyle, children: t("noSession") }),
                sessionId && items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: emptyStyle, children: t("empty") }),
                items.map((item, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "button",
                  {
                    type: "button",
                    title: item.query,
                    onClick: () => void onJump(item.msgId),
                    style: itemStyle,
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: idxStyle, children: idx + 1 }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { flex: 1, minWidth: 0 }, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "span",
                          {
                            style: {
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 13,
                              lineHeight: 1.4,
                              textAlign: "left"
                            },
                            children: item.query
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "span",
                          {
                            style: {
                              display: "block",
                              marginTop: 2,
                              fontSize: 11,
                              color: "var(--dsw-alias-label-secondary, #8a8f98)",
                              textAlign: "left"
                            },
                            children: formatTime(item.createAt)
                          }
                        )
                      ] })
                    ]
                  },
                  item.msgId
                ))
              ] })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `
        @keyframes qjSlideIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      ` })
      ]
    }
  );
}
var emptyStyle = {
  color: "var(--dsw-alias-label-secondary, #8a8f98)",
  fontSize: 12,
  padding: "16px 8px",
  textAlign: "center"
};
var itemStyle = {
  width: "100%",
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "10px 8px",
  marginBottom: 2,
  border: "none",
  borderRadius: 8,
  background: "transparent",
  cursor: "pointer",
  color: "inherit"
};
var idxStyle = {
  flexShrink: 0,
  width: 18,
  height: 18,
  marginTop: 1,
  borderRadius: 9,
  fontSize: 11,
  lineHeight: "18px",
  textAlign: "center",
  color: "var(--dsw-alias-label-secondary, #8a8f98)",
  background: "var(--dsw-alias-bg-layer-2, rgba(0,0,0,.04))"
};
function apply(ctx) {
  try {
    ctx.effect(() => ctx.locale.register(NS, "zh", zh), "dsh-query-jump: zh");
  } catch (err) {
    console.warn("[dsh-query-jump] locale.register skipped", err);
  }
  const rpc = ctx.connection.rpc;
  const isLoopback = !!ctx.connection.isLoopback;
  let t = (k) => zh[k] ?? k;
  try {
    t = ctx.locale.bind(NS);
  } catch {
  }
  ctx.slots.inject(
    "shell.overlay",
    () => ctx.slots.register(
      { name: "shell.overlay", id: "query-jump", order: 110 },
      (props) => import_react.default.createElement(QueryJumpPanel, {
        ctx,
        useSessions: props.useSessions,
        useProjection: props.useProjection,
        rpc,
        t,
        isLoopback
      })
    )
  );
}

    return module.exports;
  },
});

