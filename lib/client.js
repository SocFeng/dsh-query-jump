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
var PANEL_W = 300;
var TAB_W = 18;
var EDGE_GAP = 8;
var COLLAPSE_DELAY_MS = 220;
var zh = {
  title: "\u4F1A\u8BDD Query",
  enable: "\u542F\u7528",
  clear: "\u6E05\u7A7A\u5217\u8868",
  empty: "\u6682\u65E0\u7528\u6237\u63D0\u95EE",
  noSession: "\u8BF7\u5148\u6253\u5F00\u4F1A\u8BDD",
  loopback: "\u4EC5\u672C\u673A\u53EF\u7528",
  jumpFail: "\u65E0\u6CD5\u5B9A\u4F4D\u8BE5\u6D88\u606F",
  closed: "\u5DF2\u5173\u95ED",
  tabHint: "Query"
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
  const top = Math.max(56, Math.round(rect.top + 48));
  const height = Math.max(160, Math.min(Math.round(rect.height - 64), Math.round(window.innerHeight * 0.72)));
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
  const rootRef = (0, import_react.useRef)(null);
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
    const tick = window.setInterval(refreshGeo, 500);
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
  const onToggle = async (next) => {
    try {
      const res = await rpc.call(CHANNEL, "setEnable", { enable: next });
      if (res?.ok) setEnable(next);
    } catch (err) {
      console.warn("[dsh-query-jump] setEnable", err);
    }
  };
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
      row.style.outline = "2px solid var(--dsw-alias-brand-primary, #2563eb)";
      window.setTimeout(() => {
        row.style.outline = prev;
      }, 1200);
    } finally {
      setBusy(false);
    }
  };
  const right = geo?.right ?? 16;
  const top = geo?.top ?? 80;
  const height = geo?.height ?? 360;
  if (!geo && !document.querySelector(SCROLL_SEL)) {
    return null;
  }
  if (!isLoopback) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        ref: rootRef,
        style: { ...shellStyle, right, top, width: open ? PANEL_W : TAB_W, height: open ? 80 : 120 },
        onPointerEnter: onEnter,
        onPointerLeave: onLeave,
        children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: tipStyle, children: t("loopback") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabLabel, { text: t("tabHint") })
      }
    );
  }
  if (!enable) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        ref: rootRef,
        style: { ...shellStyle, right, top, width: open ? 200 : TAB_W, height: open ? 56 : 100 },
        onPointerEnter: onEnter,
        onPointerLeave: onLeave,
        children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { ...headerStyle, borderBottom: "none", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: false, onChange: () => void onToggle(true) }),
          t("closed")
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabLabel, { text: "Off" })
      }
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      ref: rootRef,
      style: {
        ...shellStyle,
        right,
        top,
        width: open ? PANEL_W : TAB_W,
        height: open ? height : Math.min(160, height),
        transition: "width .18s ease, height .18s ease, box-shadow .18s ease"
      },
      onPointerEnter: onEnter,
      onPointerLeave: onLeave,
      children: !open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabLabel, { text: t("tabHint"), count: items.length }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: headerStyle, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", gap: 6, alignItems: "center", minWidth: 0 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                type: "checkbox",
                checked: enable,
                onChange: (e) => void onToggle(e.target.checked)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: t("title") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: btnStyle, onClick: () => void onClear(), children: t("clear") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { overflow: "auto", flex: 1, minHeight: 0 }, children: [
          !sessionId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: tipStyle, children: t("noSession") }),
          sessionId && items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: tipStyle, children: t("empty") }),
          items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              role: "button",
              tabIndex: 0,
              title: item.query,
              style: rowStyle,
              onClick: () => void onJump(item.msgId),
              onKeyDown: (e) => {
                if (e.key === "Enter") void onJump(item.msgId);
              },
              children: item.query.length > 60 ? `${item.query.slice(0, 60)}\u2026` : item.query
            },
            item.msgId
          ))
        ] })
      ] })
    }
  );
}
function TabLabel({ text, count }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: tabInnerStyle, title: text, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: tabTextStyle, children: text }),
    typeof count === "number" && count > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: badgeStyle, children: count > 99 ? "99+" : count }) : null
  ] });
}
var shellStyle = {
  position: "fixed",
  zIndex: 45,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "var(--dsw-alias-bg-layer-3, #fff)",
  border: "1px solid var(--dsw-alias-border-l2, #e5e7eb)",
  borderRadius: 10,
  color: "var(--dsw-alias-label-primary, #111)",
  boxShadow: "0 8px 24px rgba(0,0,0,.14)",
  pointerEvents: "auto"
};
var tabInnerStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 2px",
  cursor: "pointer",
  userSelect: "none"
};
var tabTextStyle = {
  writingMode: "vertical-rl",
  textOrientation: "mixed",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "var(--dsw-alias-label-secondary, #666)"
};
var badgeStyle = {
  minWidth: 16,
  height: 16,
  padding: "0 4px",
  borderRadius: 8,
  fontSize: 10,
  lineHeight: "16px",
  textAlign: "center",
  background: "var(--dsw-alias-brand-primary, #2563eb)",
  color: "#fff"
};
var headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 10px",
  borderBottom: "1px solid var(--dsw-alias-border-l2, #e5e7eb)",
  fontSize: 12,
  flexShrink: 0
};
var tipStyle = {
  color: "var(--dsw-alias-label-secondary, #888)",
  fontSize: 12,
  padding: 8
};
var btnStyle = {
  fontSize: 11,
  flexShrink: 0
};
var rowStyle = {
  padding: "6px 8px",
  margin: "4px 8px",
  borderRadius: 6,
  background: "var(--dsw-alias-bg-layer-2, #f5f7fa)",
  cursor: "pointer",
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
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

