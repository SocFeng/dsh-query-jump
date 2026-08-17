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
var RAIL_W = 22;
var TICK_GAP = 8;
var TICK_H = 2;
var EDGE_GAP = 2;
var PANEL_W = 210;
var ROW_H = 32;
var VISIBLE_ROWS = 20;
var LIST_H = ROW_H * VISIBLE_ROWS;
var COLLAPSE_MS = 260;
var READ_LINE = 0.38;
var JUMP_PIN_MS = 1e3;
var SCROLL_HOLD_MS = 2800;
var DEFAULT_SYMBOL = "\u{1F917}";
var zh = {
  empty: "\u6682\u65E0\u63D0\u95EE",
  noSession: "\u8BF7\u5148\u6253\u5F00\u4F1A\u8BDD",
  jumpFail: "\u65E0\u6CD5\u5B9A\u4F4D\u8BE5\u6D88\u606F",
  settingsTab: "Query \u5B9A\u4F4D",
  settingsTitle: "\u4F1A\u8BDD Query \u5B9A\u4F4D",
  settingsDesc: "\u53F3\u4FA7\u63D0\u95EE\u5BFC\u822A\u7684\u5F00\u5173\u4E0E\u5217\u8868\u524D\u7F00\u3002",
  enable: "\u542F\u7528\u9762\u677F",
  markerMode: "\u5217\u8868\u524D\u7F00",
  markerEmoji: "\u81EA\u5B9A\u4E49\u7B26\u53F7",
  markerNumber: "\u5E8F\u53F7",
  markerSymbol: "\u7B26\u53F7\u5185\u5BB9",
  markerSymbolHint: "\u4EFB\u610F\u6587\u5B57\u6216\u8868\u60C5\uFF0C\u6700\u591A 8 \u4E2A\u5B57\u7B26",
  saved: "\u5DF2\u4FDD\u5B58"
};
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function measureDock() {
  const sc = document.querySelector(SCROLL_SEL);
  if (!sc) return null;
  const rect = sc.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 120) return null;
  const right = Math.max(EDGE_GAP, Math.round(window.innerWidth - rect.right + EDGE_GAP));
  const railH = Math.max(120, Math.min(Math.round(rect.height * 0.72), 520));
  const top = Math.max(48, Math.round(rect.top + (rect.height - railH) / 2));
  return { right, top, railH };
}
function findRowByMsgId(msgId) {
  for (const node of Array.from(document.querySelectorAll(`[${FLOW_KEY}]`))) {
    const kind = node.getAttribute(FLOW_KIND);
    if (kind && kind !== "user") continue;
    const key = node.getAttribute(FLOW_KEY) || "";
    if (key.includes(msgId)) return node;
  }
  return null;
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
    if (!snap || snap.openState === "error") return;
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
function scrollRowIntoConversation(row, holdMs = SCROLL_HOLD_MS) {
  const sc = document.querySelector(SCROLL_SEL);
  if (!sc) {
    try {
      row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    } catch {
      row.scrollIntoView(true);
    }
    return () => {
    };
  }
  const desiredTop = () => {
    const srect = sc.getBoundingClientRect();
    const rrect = row.getBoundingClientRect();
    const pad = Math.min(160, Math.max(72, Math.round(srect.height * READ_LINE)));
    return Math.max(0, sc.scrollTop + (rrect.top - srect.top) - pad);
  };
  try {
    sc.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -1, bubbles: true, cancelable: true })
    );
  } catch {
  }
  const target = desiredTop();
  try {
    sc.scrollTo({ top: target, behavior: "smooth" });
  } catch {
    try {
      row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    } catch {
      sc.scrollTop = target;
    }
  }
  let cancelled = false;
  let tick = 0;
  const animMs = 480;
  const holdDelay = window.setTimeout(() => {
    if (cancelled || !document.contains(row) || !document.contains(sc)) return;
    const until = Date.now() + Math.max(0, holdMs - animMs);
    tick = window.setInterval(() => {
      if (cancelled || Date.now() > until || !document.contains(row) || !document.contains(sc)) {
        window.clearInterval(tick);
        tick = 0;
        return;
      }
      const next = desiredTop();
      if (Math.abs(sc.scrollTop - next) > 90) {
        try {
          sc.scrollTo({ top: next, behavior: "smooth" });
        } catch {
          sc.scrollTop = next;
        }
      }
    }, 160);
  }, animMs);
  return () => {
    cancelled = true;
    window.clearTimeout(holdDelay);
    if (tick) window.clearInterval(tick);
  };
}
function formatTime(ts) {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${mo}-${day} ${h}:${mi}`;
  } catch {
    return "";
  }
}
function QueryJumpPanel({
  ctx,
  useSessions,
  useProjection,
  rpc,
  t,
  isLoopback
}) {
  const sessionId = useSessions((s) => s.current);
  const projected = useProjection?.(PROJECTION_KEY);
  const [enable, setEnable] = (0, import_react.useState)(true);
  const [markerStyle, setMarkerStyle] = (0, import_react.useState)("emoji");
  const [markerSymbol, setMarkerSymbol] = (0, import_react.useState)(DEFAULT_SYMBOL);
  const [mask, setMask] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const [rpcMessages, setRpcMessages] = (0, import_react.useState)([]);
  const [geo, setGeo] = (0, import_react.useState)(null);
  const [open, setOpen] = (0, import_react.useState)(false);
  const [activeIdx, setActiveIdx] = (0, import_react.useState)(-1);
  const [railScroll, setRailScroll] = (0, import_react.useState)(0);
  const hoverRef = (0, import_react.useRef)(false);
  const collapseTimer = (0, import_react.useRef)(null);
  const listRef = (0, import_react.useRef)(null);
  const pinUntilRef = (0, import_react.useRef)(0);
  const jumpGenRef = (0, import_react.useRef)(0);
  const releaseHoldRef = (0, import_react.useRef)(null);
  const items = (0, import_react.useMemo)(() => {
    const fromProj = (projected?.messages ?? []).filter((m) => m.id && !mask.has(String(m.id)));
    const source = fromProj.length > 0 ? fromProj : rpcMessages;
    return source.map(
      (m) => ({
        msgId: String(m.id),
        query: m.text || "(\u7A7A)",
        createAt: m.time,
        seq: m.seq
      })
    );
  }, [projected, mask, rpcMessages]);
  const clearCollapse = () => {
    if (collapseTimer.current != null) {
      window.clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  };
  const onEnter = () => {
    hoverRef.current = true;
    clearCollapse();
    setOpen(true);
  };
  const onLeave = () => {
    hoverRef.current = false;
    clearCollapse();
    collapseTimer.current = window.setTimeout(() => {
      if (!hoverRef.current) setOpen(false);
    }, COLLAPSE_MS);
  };
  const refreshGeo = (0, import_react.useCallback)(() => {
    const next = measureDock();
    setGeo((prev) => {
      if (!next) return prev;
      if (prev && prev.right === next.right && prev.top === next.top && prev.railH === next.railH) {
        return prev;
      }
      return next;
    });
  }, []);
  const spyActive = (0, import_react.useCallback)(() => {
    if (Date.now() < pinUntilRef.current) return;
    const sc = document.querySelector(SCROLL_SEL);
    if (!sc || items.length === 0) {
      setActiveIdx(-1);
      return;
    }
    const srect = sc.getBoundingClientRect();
    const lineY = srect.top + srect.height * READ_LINE;
    let best = -1;
    let bestDist = Infinity;
    items.forEach((it, idx) => {
      const row = findRowByMsgId(it.msgId);
      if (!row) return;
      const r = row.getBoundingClientRect();
      const mid = (r.top + r.bottom) / 2;
      const dist = Math.abs(mid - lineY);
      if (dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
    });
    setActiveIdx((prev) => prev === best ? prev : best);
  }, [items]);
  (0, import_react.useEffect)(() => {
    refreshGeo();
    spyActive();
    const sc = document.querySelector(SCROLL_SEL);
    const onScroll = () => spyActive();
    const onResize = () => {
      refreshGeo();
      spyActive();
    };
    sc?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    let ro = null;
    if (sc && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        refreshGeo();
        spyActive();
      });
      ro.observe(sc);
    }
    const tick = window.setInterval(() => {
      refreshGeo();
      spyActive();
    }, 600);
    return () => {
      sc?.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      window.clearInterval(tick);
      clearCollapse();
      releaseHoldRef.current?.();
      releaseHoldRef.current = null;
    };
  }, [refreshGeo, spyActive]);
  (0, import_react.useEffect)(() => {
    if (!open || activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-qj-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);
  const applyConfigValue = (0, import_react.useCallback)((value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.enable === "boolean") setEnable(value.enable);
    if (value.markerStyle === "number" || value.markerStyle === "emoji") {
      setMarkerStyle(value.markerStyle);
    }
    if (typeof value.markerSymbol === "string" && value.markerSymbol.trim()) {
      const sym = value.markerSymbol.trim().slice(0, 8);
      setMarkerSymbol(sym);
    }
  }, []);
  const refreshConfig = (0, import_react.useCallback)(async () => {
    if (!isLoopback) return;
    try {
      const res = await rpc.call(CHANNEL, "getConfig", {});
      if (res?.ok) applyConfigValue(res.value);
    } catch {
    }
  }, [rpc, isLoopback, applyConfigValue]);
  const refreshMask = (0, import_react.useCallback)(async () => {
    if (!isLoopback || !sessionId) {
      setMask(/* @__PURE__ */ new Set());
      return;
    }
    try {
      const res = await rpc.call(CHANNEL, "getMask", { sessionId });
      if (res?.ok) setMask(new Set((res.value.msgIds ?? []).map(String)));
    } catch {
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
        applyConfigValue(res.value);
        setRpcMessages(res.value.messages ?? []);
      }
    } catch {
    }
  }, [rpc, isLoopback, sessionId, applyConfigValue]);
  (0, import_react.useEffect)(() => {
    void refreshConfig();
    const tmr = window.setInterval(() => void refreshConfig(), 3e3);
    return () => window.clearInterval(tmr);
  }, [refreshConfig]);
  (0, import_react.useEffect)(() => {
    void refreshMask();
  }, [refreshMask]);
  (0, import_react.useEffect)(() => {
    void refreshList();
    if (!sessionId || !isLoopback) return;
    const tmr = window.setInterval(() => void refreshList(), 1500);
    return () => window.clearInterval(tmr);
  }, [refreshList, sessionId, isLoopback]);
  const onJump = async (msgId, idxInAll) => {
    if (!sessionId) return;
    const gen = ++jumpGenRef.current;
    releaseHoldRef.current?.();
    releaseHoldRef.current = null;
    try {
      if (typeof idxInAll === "number") {
        setActiveIdx(idxInAll);
        pinUntilRef.current = Date.now() + Math.max(JUMP_PIN_MS, SCROLL_HOLD_MS);
      }
      hoverRef.current = false;
      clearCollapse();
      setOpen(false);
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
          if (gen !== jumpGenRef.current) return;
          let tries = 0;
          while (tries++ < 20 && !row) {
            row = findRowByMsgId(msgId);
            if (!row) await delay(60);
          }
        }
      }
      if (gen !== jumpGenRef.current) return;
      if (!row) {
        console.warn(`[dsh-query-jump] ${t("jumpFail")}`, msgId);
        return;
      }
      releaseHoldRef.current = scrollRowIntoConversation(row);
    } catch (err) {
      console.warn("[dsh-query-jump] jump error", err);
    }
  };
  if (!enable || !isLoopback || !geo || items.length === 0) return null;
  const { right, top, railH } = geo;
  const contentH = Math.max(railH, (items.length - 1) * TICK_GAP + TICK_H + 8);
  const maxRailScroll = Math.max(0, contentH - railH);
  const offset = Math.min(railScroll, maxRailScroll);
  const onRailWheel = (e) => {
    if (maxRailScroll <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    setRailScroll((v) => Math.min(maxRailScroll, Math.max(0, v + e.deltaY)));
  };
  const markerOf = (idx, active) => {
    if (markerStyle === "number") {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "span",
        {
          style: {
            ...numStyle,
            background: active ? "var(--dsw-alias-label-primary, #3d3d3d)" : "var(--dsw-alias-bg-layer-2, rgba(0,0,0,.05))",
            color: active ? "#fff" : "var(--dsw-alias-label-secondary, #8a8f98)"
          },
          children: idx + 1
        }
      );
    }
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "span",
      {
        "aria-hidden": true,
        style: {
          ...emojiStyle,
          opacity: active ? 1 : 0.55,
          transform: active ? "scale(1.08)" : "scale(1)"
        },
        children: markerSymbol || DEFAULT_SYMBOL
      }
    );
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        position: "fixed",
        zIndex: 45,
        right,
        top,
        height: railH,
        display: "flex",
        flexDirection: "row-reverse",
        alignItems: "stretch",
        gap: 4,
        pointerEvents: "auto"
      },
      onPointerEnter: onEnter,
      onPointerLeave: onLeave,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              width: RAIL_W,
              height: railH,
              position: "relative",
              overflow: "hidden",
              borderRadius: 8,
              background: "transparent"
            },
            onWheel: onRailWheel,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: -offset,
                  height: contentH,
                  paddingTop: 4
                },
                children: items.map((it, idx) => {
                  const active = idx === activeIdx;
                  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    "button",
                    {
                      type: "button",
                      title: it.query.slice(0, 120),
                      onClick: () => void onJump(it.msgId, idx),
                      style: {
                        position: "absolute",
                        left: active ? 4 : 6,
                        right: active ? 4 : 6,
                        top: 4 + idx * TICK_GAP,
                        height: active ? 3 : TICK_H,
                        border: "none",
                        borderRadius: 2,
                        padding: 0,
                        cursor: "pointer",
                        background: active ? "var(--dsw-alias-label-primary, #3d3d3d)" : "var(--dsw-alias-label-dimmed, rgba(0,0,0,.28))",
                        opacity: active ? 1 : 0.72,
                        transition: "background .12s, left .12s, right .12s, height .12s"
                      }
                    },
                    it.msgId
                  );
                })
              }
            )
          }
        ),
        open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            ref: listRef,
            style: {
              width: PANEL_W,
              maxHeight: Math.min(railH, LIST_H),
              overflow: "auto",
              padding: "6px 4px",
              background: "var(--dsw-alias-bg-layer-3, #fff)",
              border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.08))",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(15,23,42,.1)",
              animation: "qjIn .14s ease-out"
            },
            children: [
              !sessionId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: emptyStyle, children: t("noSession") }),
              sessionId && items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: emptyStyle, children: t("empty") }),
              items.map((item, idx) => {
                const active = idx === activeIdx;
                return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "button",
                  {
                    type: "button",
                    "data-qj-idx": idx,
                    title: item.query,
                    onClick: () => void onJump(item.msgId, idx),
                    style: {
                      ...rowStyle,
                      background: active ? "var(--dsw-alias-bg-layer-3, #fff)" : "transparent",
                      boxShadow: active ? "0 4px 14px rgba(15,23,42,.12), 0 1px 3px rgba(15,23,42,.06)" : "none",
                      transform: active ? "translateY(-1px)" : "none",
                      zIndex: active ? 1 : 0,
                      position: "relative"
                    },
                    children: [
                      markerOf(idx, active),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { flex: 1, minWidth: 0, textAlign: "left" }, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "span",
                          {
                            style: {
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 12.5,
                              lineHeight: 1.3,
                              fontWeight: active ? 600 : 400
                            },
                            children: item.query
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          "span",
                          {
                            style: {
                              fontSize: 11,
                              color: "var(--dsw-alias-label-secondary, #8a8f98)"
                            },
                            children: formatTime(item.createAt)
                          }
                        )
                      ] })
                    ]
                  },
                  item.msgId
                );
              })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `
        @keyframes qjIn {
          from { opacity: 0; transform: translateX(8px); }
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
var rowStyle = {
  width: "100%",
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  minHeight: ROW_H,
  padding: "5px 8px",
  marginBottom: 2,
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  color: "inherit",
  transition: "box-shadow .15s ease, transform .15s ease, background .15s ease"
};
var emojiStyle = {
  flexShrink: 0,
  width: 18,
  height: 18,
  marginTop: 1,
  fontSize: 13,
  lineHeight: "18px",
  textAlign: "center",
  transition: "opacity .12s, transform .12s"
};
var numStyle = {
  flexShrink: 0,
  width: 18,
  height: 18,
  marginTop: 1,
  borderRadius: 9,
  fontSize: 10,
  lineHeight: "18px",
  textAlign: "center"
};
function QueryJumpSettingsTab({
  rpc,
  t,
  isLoopback
}) {
  const [enable, setEnable] = (0, import_react.useState)(true);
  const [markerStyle, setMarkerStyle] = (0, import_react.useState)("emoji");
  const [markerSymbol, setMarkerSymbol] = (0, import_react.useState)(DEFAULT_SYMBOL);
  const [hint, setHint] = (0, import_react.useState)("");
  const load = (0, import_react.useCallback)(async () => {
    if (!isLoopback) return;
    try {
      const res = await rpc.call(CHANNEL, "getConfig", {});
      if (!res?.ok) return;
      setEnable(!!res.value.enable);
      if (res.value.markerStyle === "number" || res.value.markerStyle === "emoji") {
        setMarkerStyle(res.value.markerStyle);
      }
      if (typeof res.value.markerSymbol === "string" && res.value.markerSymbol.trim()) {
        setMarkerSymbol(res.value.markerSymbol.trim().slice(0, 8));
      }
    } catch {
    }
  }, [rpc, isLoopback]);
  (0, import_react.useEffect)(() => {
    void load();
  }, [load]);
  const save = (0, import_react.useCallback)(
    async (patch) => {
      if (!isLoopback) return;
      try {
        const res = await rpc.call(CHANNEL, "setConfig", patch);
        if (!res?.ok) return;
        if (typeof res.value.enable === "boolean") setEnable(res.value.enable);
        if (res.value.markerStyle === "number" || res.value.markerStyle === "emoji") {
          setMarkerStyle(res.value.markerStyle);
        }
        if (typeof res.value.markerSymbol === "string" && res.value.markerSymbol.trim()) {
          setMarkerSymbol(res.value.markerSymbol.trim().slice(0, 8));
        }
        setHint(t("saved"));
        window.setTimeout(() => setHint(""), 1200);
      } catch {
      }
    },
    [rpc, isLoopback, t]
  );
  const row = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 16
  };
  const label = {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--dsw-alias-label-primary, inherit)"
  };
  const hintStyle = {
    fontSize: 12,
    color: "var(--dsw-alias-label-secondary, #8a8f98)"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "8px 4px 24px", maxWidth: 420 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginBottom: 18 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 16, fontWeight: 650, marginBottom: 4 }, children: t("settingsTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settingsDesc") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: row, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { ...label, display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          type: "checkbox",
          checked: enable,
          onChange: (e) => void save({ enable: e.target.checked })
        }
      ),
      t("enable")
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: label, children: t("markerMode") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "radio",
            name: "qj-marker",
            checked: markerStyle === "emoji",
            onChange: () => void save({ markerStyle: "emoji" })
          }
        ),
        t("markerEmoji")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "radio",
            name: "qj-marker",
            checked: markerStyle === "number",
            onChange: () => void save({ markerStyle: "number" })
          }
        ),
        t("markerNumber")
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...row, opacity: markerStyle === "emoji" ? 1 : 0.45 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: label, children: t("markerSymbol") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("markerSymbolHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          type: "text",
          value: markerSymbol,
          maxLength: 8,
          disabled: markerStyle !== "emoji",
          onChange: (e) => setMarkerSymbol(e.target.value.slice(0, 8)),
          onBlur: () => {
            const next = markerSymbol.trim().slice(0, 8) || DEFAULT_SYMBOL;
            setMarkerSymbol(next);
            void save({ markerStyle: "emoji", markerSymbol: next });
          },
          style: {
            width: 120,
            height: 32,
            borderRadius: 8,
            border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))",
            padding: "0 10px",
            fontSize: 16,
            textAlign: "center",
            background: "var(--dsw-alias-bg-layer-2, #f5f6f8)",
            color: "inherit"
          }
        }
      )
    ] }),
    hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...hintStyle, color: "var(--dsw-alias-label-primary, #3d3d3d)" }, children: hint }) : null
  ] });
}
function apply(ctx) {
  try {
    ctx.effect(() => ctx.locale.register(NS, "zh", zh), "dsh-query-jump: zh");
  } catch {
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
  try {
    ctx.slots.inject(
      "settings.plugins.tab",
      () => ctx.slots.register(
        {
          name: "settings.plugins.tab",
          id: "query-jump",
          order: 40,
          label: () => t("settingsTab")
        },
        () => import_react.default.createElement(QueryJumpSettingsTab, { rpc, t, isLoopback })
      )
    );
  } catch (err) {
    console.warn("[dsh-query-jump] settings.plugins.tab register skipped", err);
  }
}

    return module.exports;
  },
});

