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

// src/text.ts
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

// src/client.tsx
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
var EDGE_GAP = 6;
var PANEL_W = 300;
var ROW_H = 34;
var VISIBLE_ROWS = 20;
var LIST_H = ROW_H * VISIBLE_ROWS;
var COLLAPSE_MS = 260;
var READ_LINE = 0.38;
var zh = {
  title: "\u63D0\u95EE\u8BB0\u5F55",
  search: "\u641C\u7D22\u63D0\u95EE\u2026",
  clear: "\u6E05\u7A7A",
  empty: "\u6682\u65E0\u63D0\u95EE",
  noMatch: "\u65E0\u5339\u914D\u7ED3\u679C",
  noSession: "\u8BF7\u5148\u6253\u5F00\u4F1A\u8BDD",
  jumpFail: "\u65E0\u6CD5\u5B9A\u4F4D\u8BE5\u6D88\u606F"
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
function formatTime(ts) {
  try {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  const [mask, setMask] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const [rpcMessages, setRpcMessages] = (0, import_react.useState)([]);
  const [geo, setGeo] = (0, import_react.useState)(null);
  const [open, setOpen] = (0, import_react.useState)(false);
  const [query, setQuery] = (0, import_react.useState)("");
  const [activeIdx, setActiveIdx] = (0, import_react.useState)(-1);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [railScroll, setRailScroll] = (0, import_react.useState)(0);
  const hoverRef = (0, import_react.useRef)(false);
  const collapseTimer = (0, import_react.useRef)(null);
  const listRef = (0, import_react.useRef)(null);
  const searchRef = (0, import_react.useRef)(null);
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
  const filtered = (0, import_react.useMemo)(() => {
    if (!query.trim()) return items;
    return items.filter((it) => fuzzyMatch(it.query, query));
  }, [items, query]);
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
    window.setTimeout(() => searchRef.current?.focus(), 40);
  };
  const onLeave = () => {
    hoverRef.current = false;
    clearCollapse();
    collapseTimer.current = window.setTimeout(() => {
      if (!hoverRef.current) {
        setOpen(false);
        setQuery("");
      }
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
    setActiveIdx(best);
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
    };
  }, [refreshGeo, spyActive]);
  (0, import_react.useEffect)(() => {
    if (!open || activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-qj-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);
  const refreshConfig = (0, import_react.useCallback)(async () => {
    if (!isLoopback) return;
    try {
      const res = await rpc.call(CHANNEL, "getConfig", {});
      if (res?.ok) setEnable(!!res.value.enable);
    } catch {
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
        if (typeof res.value.enable === "boolean") setEnable(res.value.enable);
        setRpcMessages(res.value.messages ?? []);
      }
    } catch {
    }
  }, [rpc, isLoopback, sessionId]);
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
  const onClear = async () => {
    if (!sessionId) return;
    await rpc.call(CHANNEL, "clearMask", { sessionId, msgIds: items.map((i) => i.msgId) });
    await refreshMask();
    await refreshList();
  };
  const onJump = async (msgId, idxInAll) => {
    if (busy || !sessionId) return;
    setBusy(true);
    try {
      if (typeof idxInAll === "number") setActiveIdx(idxInAll);
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
      window.setTimeout(() => spyActive(), 350);
    } finally {
      setBusy(false);
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
        gap: 8,
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
                      title: it.query.slice(0, 80),
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
            style: {
              width: PANEL_W,
              height: Math.min(railH, 56 + LIST_H),
              display: "flex",
              flexDirection: "column",
              background: "var(--dsw-alias-bg-layer-3, #fff)",
              border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.08))",
              borderRadius: 12,
              boxShadow: "0 12px 36px rgba(15,23,42,.14)",
              overflow: "hidden",
              animation: "qjIn .16s ease-out"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 10px 8px",
                    borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.06))"
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, fontWeight: 600, flexShrink: 0 }, children: t("title") }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        ref: searchRef,
                        value: query,
                        onChange: (e) => setQuery(e.target.value),
                        placeholder: t("search"),
                        style: {
                          flex: 1,
                          minWidth: 0,
                          height: 28,
                          borderRadius: 8,
                          border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1))",
                          padding: "0 10px",
                          fontSize: 12,
                          outline: "none",
                          background: "var(--dsw-alias-bg-layer-2, #f5f6f8)",
                          color: "inherit"
                        }
                      }
                    ),
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
                          flexShrink: 0
                        },
                        children: t("clear")
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  ref: listRef,
                  style: {
                    flex: 1,
                    overflow: "auto",
                    maxHeight: LIST_H,
                    padding: "4px 6px 8px"
                  },
                  children: [
                    !sessionId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: emptyStyle, children: t("noSession") }),
                    sessionId && filtered.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: emptyStyle, children: items.length === 0 ? t("empty") : t("noMatch") }),
                    filtered.map((item) => {
                      const idxAll = items.findIndex((x) => x.msgId === item.msgId);
                      const active = idxAll === activeIdx;
                      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                        "button",
                        {
                          type: "button",
                          "data-qj-idx": idxAll,
                          title: item.query,
                          onClick: () => void onJump(item.msgId, idxAll),
                          style: {
                            ...rowStyle,
                            background: active ? "var(--dsw-alias-interactive-bg-hover, rgba(97,92,237,.1))" : "transparent",
                            boxShadow: active ? "inset 2px 0 0 var(--dsw-alias-brand-primary, #615ced)" : "none"
                          },
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                              "span",
                              {
                                style: {
                                  ...idxStyle,
                                  background: active ? "var(--dsw-alias-brand-primary, #615ced)" : "var(--dsw-alias-bg-layer-2, rgba(0,0,0,.05))",
                                  color: active ? "#fff" : "var(--dsw-alias-label-secondary, #8a8f98)"
                                },
                                children: idxAll + 1
                              }
                            ),
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
                                    lineHeight: 1.35,
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
              )
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `
        @keyframes qjIn {
          from { opacity: 0; transform: translateX(10px); }
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
  padding: "20px 8px",
  textAlign: "center"
};
var rowStyle = {
  width: "100%",
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  minHeight: ROW_H,
  padding: "6px 8px",
  marginBottom: 1,
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  color: "inherit"
};
var idxStyle = {
  flexShrink: 0,
  width: 18,
  height: 18,
  marginTop: 1,
  borderRadius: 9,
  fontSize: 10,
  lineHeight: "18px",
  textAlign: "center"
};
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
}

    return module.exports;
  },
});

