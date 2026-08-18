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
var import_react2 = __toESM(require("react"), 1);

// src/session-delete-ui.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var DELETE_EVENT = "query-jump:delete-session";
var CHANNEL = "/query-jump";
function normalizeTitle(t) {
  return String(t || "").trim().replace(/\s+/g, " ");
}
function stripForkSuffix(t) {
  return normalizeTitle(t).replace(/\s*\(\d+\)\s*$/, "");
}
function resolveTargetFromStore(detail, sessionsSvc) {
  let sessionId = detail.sessionId || null;
  const title = detail.title || null;
  let running = detail.running === true;
  if (sessionId) return { sessionId, title, running };
  const want = normalizeTitle(title);
  if (!want) return null;
  const wantBase = stripForkSuffix(want);
  const svc = sessionsSvc;
  if (svc?.list) {
    try {
      const snap = svc.list.getSnapshot();
      const byId = snap?.byId ?? {};
      const ids = Object.keys(byId);
      for (const id of ids) {
        const s = byId[id];
        if (s && normalizeTitle(s.title) === want) {
          return { sessionId: id, title: s.title ?? null, running: s.running === true };
        }
      }
      if (wantBase) {
        for (const id of ids) {
          const s = byId[id];
          if (s && stripForkSuffix(String(s.title ?? "")) === wantBase) {
            return { sessionId: id, title: s.title ?? null, running: s.running === true };
          }
        }
      }
      let best = null;
      for (const id of ids) {
        const s = byId[id];
        if (!s?.title) continue;
        const tt = normalizeTitle(s.title);
        if (tt && (tt.includes(want) || want.includes(tt))) {
          best = { sessionId: id, title: s.title ?? null, running: s.running === true };
        }
      }
      if (best) return best;
    } catch {
    }
  }
  return null;
}
async function resolveTargetFromHost(rpc, isLoopback, want) {
  if (!isLoopback) {
    return { sessionId: null, title: want, running: false, notFound: true };
  }
  try {
    const res = await rpc.call(CHANNEL, "listSessions", {});
    const sessions = res?.ok && Array.isArray(res.value?.sessions) ? res.value.sessions : [];
    const wantBase = stripForkSuffix(want);
    for (const s of sessions) {
      if (!s?.title) continue;
      const tt = normalizeTitle(s.title);
      if (tt === want || wantBase && stripForkSuffix(tt) === wantBase || tt.includes(want) || want.includes(tt)) {
        return {
          sessionId: String(s.sessionId),
          title: s.title,
          running: s.running === true
        };
      }
    }
  } catch {
  }
  return { sessionId: null, title: want, running: false, notFound: true };
}
var btnStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  padding: 0,
  border: "none",
  borderRadius: 6,
  background: "transparent",
  color: "var(--dsw-alias-label-tertiary, #8a8a8e)",
  cursor: "pointer",
  flex: "none"
};
var overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1e4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,.35)"
};
var dialogStyle = {
  width: "min(420px, calc(100vw - 32px))",
  borderRadius: 12,
  padding: "20px 22px 18px",
  background: "var(--dsw-alias-bg-layer-1, #fff)",
  color: "var(--dsw-alias-label-primary, inherit)",
  boxShadow: "0 12px 40px rgba(0,0,0,.18)"
};
var metaStyle = {
  color: "var(--dsw-alias-label-secondary, #8a8a8e)",
  fontSize: 13,
  lineHeight: "20px",
  margin: "0 0 10px",
  overflow: "hidden",
  textOverflow: "ellipsis"
};
var warnStyle = {
  color: "var(--dsw-alias-state-warn-primary, #f5a524)",
  fontSize: 13,
  lineHeight: "20px",
  margin: "0 0 10px"
};
var errStyle = {
  color: "var(--dsw-alias-state-error-primary, #e5484d)",
  fontSize: 12,
  lineHeight: "16px",
  marginTop: 8
};
var optStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  lineHeight: "20px",
  marginTop: 10
};
var cancelBtnStyle = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.4))",
  background: "transparent",
  color: "var(--dsw-alias-label-primary, inherit)",
  fontSize: 13,
  cursor: "pointer",
  marginRight: 8
};
var dangerBtnStyle = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid var(--dsw-alias-state-error-primary, #e5484d)",
  background: "var(--dsw-alias-state-error-primary, #e5484d)",
  color: "#fff",
  fontSize: 13,
  cursor: "pointer"
};
function TrashIcon() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": true, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.5 1.5h3l.5 1.5H13v1.5H3V3h2.5l.5-1.5zm-1 4.5v5.5h1.5V6H5.5zm4 0v5.5H11V6H9.5zM5 3.5h6l-.4 7.2c0 .8-.7 1.3-1.5 1.3H6.9c-.8 0-1.5-.5-1.5-1.3L5 3.5z" }) });
}
function DeleteSessionDialog({
  rpc,
  isLoopback,
  sessionsSvc,
  t
}) {
  const [target, setTarget] = (0, import_react.useState)(null);
  const [acknowledged, setAcknowledged] = (0, import_react.useState)(false);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    const handler = (e) => {
      const d = e.detail ?? {};
      const resolved = resolveTargetFromStore(d, sessionsSvc);
      if (resolved) {
        setTarget(resolved);
        setAcknowledged(false);
        setError(null);
        setBusy(false);
        return;
      }
      const want = normalizeTitle(d.title);
      if (!want) return;
      void resolveTargetFromHost(rpc, isLoopback, want).then((next) => {
        setTarget(next);
        setAcknowledged(false);
        setError(null);
        setBusy(false);
      });
    };
    window.addEventListener(DELETE_EVENT, handler);
    return () => window.removeEventListener(DELETE_EVENT, handler);
  }, [rpc, isLoopback, sessionsSvc]);
  const close = (0, import_react.useCallback)(() => {
    if (busy) return;
    setTarget(null);
    setError(null);
  }, [busy]);
  const confirm = (0, import_react.useCallback)(() => {
    if (busy || !acknowledged || !target?.sessionId) return;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const res = await rpc.call(CHANNEL, "deleteSession", { sessionId: target.sessionId });
        if (!res?.ok) {
          throw new Error(res?.error?.message || "delete failed");
        }
        const deletedId = target.sessionId;
        const svc = sessionsSvc;
        const deletedCurrent = svc?.list && deletedId ? svc.list.getSnapshot()?.current === deletedId : false;
        setTarget(null);
        if (svc && typeof svc.refreshList === "function") {
          const done = svc.refreshList();
          if (deletedCurrent && deletedId) {
            await Promise.resolve(done);
            try {
              const snap = svc.list.getSnapshot();
              const next = (snap?.ids ?? []).find((id) => id !== deletedId);
              if (next && typeof svc.open === "function") svc.open(next);
            } catch {
            }
          }
        }
      } catch (reason) {
        setBusy(false);
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();
  }, [busy, acknowledged, target, rpc, sessionsSvc]);
  if (!target) return null;
  const name = target.notFound ? target.title || t("deleteUntitled") : target.title || t("deleteUntitled");
  const description = target.notFound ? t("deleteNotFoundDesc") : target.running ? t("deleteRunningDesc") : t("deleteDesc");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: overlayStyle, onClick: close, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "qj-delete-title",
      style: dialogStyle,
      onClick: (e) => e.stopPropagation(),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "qj-delete-title", style: { fontSize: 16, fontWeight: 650, marginBottom: 8 }, children: t("deleteTitle") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, lineHeight: "20px", marginBottom: 12 }, children: description }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: metaStyle, children: [
          t("deleteSessionLabel"),
          name,
          target.sessionId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
            t("deleteSessionIdLabel"),
            target.sessionId
          ] }) : null
        ] }),
        target.running ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: warnStyle, children: t("deleteRunningWarn") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: optStyle, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "checkbox",
              checked: acknowledged,
              disabled: busy,
              onChange: (e) => setAcknowledged(e.target.checked)
            }
          ),
          t("deleteAck")
        ] }),
        busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...metaStyle, marginTop: 8 }, children: t("deleteBusy") }) : null,
        error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: errStyle, role: "alert", children: error }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 16 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: busy, onClick: close, style: cancelBtnStyle, children: t("deleteCancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              disabled: busy || !acknowledged || !target.sessionId,
              onClick: confirm,
              style: {
                ...dangerBtnStyle,
                opacity: busy || !acknowledged || !target.sessionId ? 0.5 : 1,
                cursor: busy || !acknowledged || !target.sessionId ? "default" : "pointer"
              },
              children: busy ? t("deleteConfirming") : t("deleteConfirm")
            }
          )
        ] })
      ]
    }
  ) });
}
function DeleteSessionButton({
  sessionId,
  useSessions,
  t
}) {
  const summary = useSessions((s) => s.byId?.[sessionId]);
  const running = summary?.running === true;
  const openDialog = (0, import_react.useCallback)(() => {
    window.dispatchEvent(
      new CustomEvent(DELETE_EVENT, {
        detail: {
          sessionId,
          title: summary?.title ?? null,
          running
        }
      })
    );
  }, [sessionId, summary, running]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      title: running ? t("deleteBtnRunning") : t("deleteBtn"),
      "aria-label": t("deleteBtn"),
      style: btnStyle,
      onClick: openDialog,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrashIcon, {})
    }
  );
}
var TRASH_PATH = "M14.4782 4.84067L14.2138 10.1152C14.1102 12.1872 14.067 13.0115 13.3866 13.9607C13.1044 14.3546 12.7498 14.6912 12.3424 14.9535C11.8239 15.2872 11.2415 15.4316 10.5585 15.4998C9.88727 15.5668 9.04946 15.5656 7.99998 15.5656C6.95051 15.5656 6.1127 15.5668 5.44142 15.4998C4.75851 15.4316 4.17602 15.2872 3.65753 14.9535C3.25012 14.6912 2.89559 14.3546 2.61332 13.9607C1.93296 13.0115 1.88979 12.1872 1.78619 10.1152L1.52179 4.84067L2.89006 4.77277L3.15343 10.0463C3.26221 12.2218 3.32452 12.6015 3.72646 13.1624C3.90825 13.4161 4.13686 13.6334 4.39927 13.8023C4.66204 13.9714 5.00263 14.0792 5.57825 14.1367C6.16562 14.1953 6.92298 14.1963 7.99998 14.1963C9.07699 14.1963 9.83434 14.1953 10.4217 14.1367C10.9973 14.0792 11.3379 13.9714 11.6007 13.8023C11.8631 13.6334 12.0917 13.4161 12.2735 13.1624C12.6755 12.6015 12.7378 12.2218 12.8465 10.0463L13.1099 4.77277L14.4782 4.84067ZM5.43011 6.22849H6.7994V11.3909H5.43011V6.22849ZM9.20056 6.22849H10.5699V11.3909H9.20056V6.22849ZM8.53597 0.434431C9.17976 0.434431 9.6522 0.426926 10.0966 0.571258C10.2357 0.616451 10.3717 0.672554 10.502 0.738948C10.9182 0.951107 11.2464 1.29099 11.7015 1.74612L12.4978 2.54136H15.3742V3.91169H0.625732V2.54136H3.50218L4.29845 1.74612C4.75358 1.29099 5.08174 0.951107 5.49801 0.738948C5.62831 0.672554 5.76425 0.616451 5.90334 0.571258C6.34776 0.426926 6.82021 0.434431 7.46399 0.434431H8.53597ZM7.46399 1.80476C6.73208 1.80476 6.51641 1.81187 6.32617 1.87369C6.25545 1.89667 6.18668 1.92533 6.12041 1.95907C5.96398 2.03878 5.82348 2.16253 5.44142 2.54136H10.5585C10.1765 2.16253 10.036 2.03878 9.87955 1.95907C9.81329 1.92533 9.74452 1.89667 9.6738 1.87369C9.48356 1.81187 9.26789 1.80476 8.53597 1.80476H7.46399Z";
function findOpenSessionRow() {
  const rows = document.querySelectorAll("[class*=sessionRow]");
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].className || "").includes("menuOpen")) return rows[i];
  }
  return null;
}
function openDeleteFlowFromSidebar(row, t) {
  if (!row) return;
  const titleEl = row.querySelector("[class*=title]");
  const title = titleEl ? String(titleEl.innerText || "").trim() : "";
  if (!title) return;
  window.dispatchEvent(new CustomEvent(DELETE_EVENT, { detail: { title } }));
}
function installSidebarDeleteMenu(t) {
  if (window.__queryJumpSidebarDeleteInstalled) return;
  window.__queryJumpSidebarDeleteInstalled = true;
  const ensureItem = () => {
    const menu = document.querySelector("[role=menu]");
    if (!menu || menu.querySelector("[data-query-jump-delete]")) return;
    const row = findOpenSessionRow();
    if (!row) return;
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "menuitem");
    item.setAttribute("data-query-jump-delete", "1");
    item.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:8px",
      "width:100%",
      "padding:6px 12px",
      "border:none",
      "background:transparent",
      "color:var(--dsw-alias-state-error-primary,#e5484d)",
      "font:inherit",
      "font-size:13px",
      "line-height:20px",
      "text-align:left",
      "border-radius:6px",
      "cursor:pointer"
    ].join(";");
    item.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="${TRASH_PATH}"/></svg><span></span>`;
    const span = item.querySelector("span");
    if (span) span.textContent = t("deleteMenu");
    item.addEventListener("mouseenter", () => {
      item.style.background = "var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14))";
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = "transparent";
    });
    item.addEventListener("click", () => openDeleteFlowFromSidebar(row, t));
    const sep = document.createElement("div");
    sep.style.cssText = "height:1px;margin:4px 8px;background:var(--dsw-alias-border-l1,rgba(128,128,128,.2))";
    menu.appendChild(sep);
    menu.appendChild(item);
  };
  try {
    ensureItem();
  } catch {
  }
  const observer = new MutationObserver(() => {
    try {
      ensureItem();
    } catch {
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// src/client.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var inject = ["slots", "connection", "locale"];
var NS = "query-jump";
var CHANNEL2 = "/query-jump";
var PROJECTION_KEY = "queryJumpMessages";
var FLOW_KEY = "data-chat-flow-key";
var FLOW_KIND = "data-chat-flow-kind";
var SCROLL_SEL = "[data-conversation-scroll]";
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
  saved: "\u5DF2\u4FDD\u5B58",
  syncHistorical: "\u540C\u6B65\u5386\u53F2\u63D0\u95EE",
  syncHistoricalHint: "\u4ECE\u4F1A\u8BDD\u65E5\u5FD7\u8865\u5168\u5B89\u88C5\u63D2\u4EF6\u524D\u672A\u8BB0\u5F55\u7684 query\uFF0C\u6309\u5B9E\u9645\u63D0\u95EE\u65F6\u95F4\u6392\u5E8F",
  deleteTitle: "\u5220\u9664\u4F1A\u8BDD",
  deleteCancel: "\u53D6\u6D88",
  deleteConfirm: "\u5220\u9664",
  deleteConfirming: "\u5220\u9664\u4E2D\u2026",
  deleteBusy: "\u6B63\u5728\u5220\u9664\u2026",
  deleteUntitled: "\u672A\u547D\u540D\u4F1A\u8BDD",
  deleteSessionLabel: "\u4F1A\u8BDD\uFF1A",
  deleteSessionIdLabel: "\u5E8F\u5217\u53F7\uFF1A",
  deleteRunningWarn: "\u26A0 \u4F1A\u8BDD\u6B63\u5728\u8FD0\u884C",
  deleteAck: "\u6211\u5DF2\u4E86\u89E3\u540E\u679C\uFF0C\u786E\u8BA4\u5220\u9664",
  deleteNotFoundDesc: "\u672A\u80FD\u5728\u4F1A\u8BDD\u5217\u8868\u4E2D\u627E\u5230\u8BE5\u4F1A\u8BDD\uFF08\u53EF\u80FD\u5DF2\u88AB\u5220\u9664\u6216\u5217\u8868\u5C1A\u672A\u5237\u65B0\uFF09\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002",
  deleteRunningDesc: "\u8BE5\u4F1A\u8BDD\u6B63\u5728\u8FD0\u884C\uFF0C\u5220\u9664\u4F1A\u7ACB\u5373\u505C\u6B62\u5176\u4EFB\u52A1\u5E76\u6C38\u4E45\u5220\u9664\uFF0C\u6B63\u5728\u8FDB\u884C\u7684\u64CD\u4F5C\u5C06\u4E2D\u65AD\u4E14\u65E0\u6CD5\u6062\u590D\u3002",
  deleteDesc: "\u5C06\u6C38\u4E45\u5220\u9664\u8BE5\u4F1A\u8BDD\u53CA\u5176\u5168\u90E8\u5BF9\u8BDD\u8BB0\u5F55\uFF08\u4F1A\u8BDD\u65E5\u5FD7\u3001\u7EDF\u8BA1\u4E0E\u5DE5\u4F5C\u533A\u8BB0\u8D26\uFF09\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002",
  deleteBtn: "\u5220\u9664\u4F1A\u8BDD",
  deleteBtnRunning: "\u5220\u9664\u4F1A\u8BDD\uFF08\u8FD0\u884C\u4E2D\uFF0C\u5220\u9664\u5C06\u505C\u6B62\u4EFB\u52A1\uFF09",
  deleteMenu: "\u5220\u9664\u4F1A\u8BDD"
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
var FULL_LOAD_PAGES = 400;
var LOAD_TIMEOUT_MS = 45e3;
function sessionIdVariants(sessionId) {
  const id = String(sessionId || "").trim();
  if (!id) return [];
  const variants = /* @__PURE__ */ new Set([id]);
  if (id.startsWith("session-")) variants.add(id.slice("session-".length));
  else if (/^[0-9a-f-]{36}$/i.test(id)) variants.add(`session-${id}`);
  return [...variants];
}
function resolveSessionFace(ctx, sessionId) {
  const sessions = ctx.get?.("sessions") ?? ctx.sessions;
  if (!sessions?.binding) return null;
  for (const variant of sessionIdVariants(sessionId)) {
    const face = sessions.binding(variant)?.session;
    if (face) return face;
  }
  return null;
}
function snapshotHasMsgId(snap, id) {
  if (!snap?.chat?.order || !snap?.chat?.nodes) return false;
  const want = String(id);
  for (const k of snap.chat.order) {
    const n = snap.chat.nodes.get(k);
    if (!n) continue;
    if (String(n.id) === want) return true;
    if (String(n.key ?? "").includes(want)) return true;
    const data = n.data;
    if (data && String(data.messageId ?? "") === want) return true;
  }
  return false;
}
function minAnchorSeqInWindow(snap) {
  let min = null;
  for (const k of snap?.chat?.order ?? []) {
    const n = snap.chat.nodes.get(k);
    if (!n) continue;
    const seq = typeof n.anchorSeq === "number" ? n.anchorSeq : typeof n.data?.seq === "number" ? n.data.seq : null;
    if (seq != null) min = min === null ? seq : Math.min(min, seq);
  }
  return min;
}
async function loadUntilIdLoaded(face, id, targetSeq) {
  const deadline = Date.now() + LOAD_TIMEOUT_MS;
  let pages = 0;
  let stallRounds = 0;
  while (Date.now() < deadline) {
    let snap;
    try {
      snap = face.getSnapshot();
    } catch {
      return;
    }
    if (!snap || snap.openState === "error") return;
    if (snap.openState === "cold") {
      try {
        await face.open();
      } catch {
        return;
      }
      await delay(80);
      continue;
    }
    if (snap.openState !== "open") {
      await delay(80);
      continue;
    }
    if (snapshotHasMsgId(snap, id)) return;
    if (typeof targetSeq === "number") {
      const minSeq = minAnchorSeqInWindow(snap);
      if (minSeq != null && minSeq <= targetSeq) return;
    }
    if (snap.hasMore !== true) return;
    if (snap.loadingOlder === true) {
      await delay(60);
      continue;
    }
    const minBefore = minAnchorSeqInWindow(snap);
    try {
      await face.loadOlder();
    } catch {
      return;
    }
    pages++;
    await delay(48);
    let after;
    try {
      after = face.getSnapshot();
    } catch {
      return;
    }
    const minAfter = minAnchorSeqInWindow(after);
    if (minBefore != null && minAfter === minBefore && after?.hasMore === true) {
      stallRounds++;
      if (stallRounds >= 3) return;
    } else {
      stallRounds = 0;
    }
    if (pages >= FULL_LOAD_PAGES) return;
  }
}
async function waitForRow(msgId, attempts = 80) {
  for (let i = 0; i < attempts; i++) {
    const row = findRowByMsgId(msgId);
    if (row) return row;
    await delay(40);
  }
  return findRowByMsgId(msgId);
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
function mergeMessagesByTimeline(...sources) {
  const byId = /* @__PURE__ */ new Map();
  for (const src of sources) {
    for (const m of src) {
      if (!m.id) continue;
      const id = String(m.id);
      const prev = byId.get(id);
      if (!prev || m.time > prev.time || m.time === prev.time && m.seq >= prev.seq) {
        byId.set(id, m);
      }
    }
  }
  return [...byId.values()].sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return a.seq - b.seq;
  });
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
  const [enable, setEnable] = (0, import_react2.useState)(true);
  const [syncHistoricalQueries, setSyncHistoricalQueries] = (0, import_react2.useState)(true);
  const [markerStyle, setMarkerStyle] = (0, import_react2.useState)("emoji");
  const [markerSymbol, setMarkerSymbol] = (0, import_react2.useState)(DEFAULT_SYMBOL);
  const [mask, setMask] = (0, import_react2.useState)(() => /* @__PURE__ */ new Set());
  const [rpcMessages, setRpcMessages] = (0, import_react2.useState)([]);
  const [geo, setGeo] = (0, import_react2.useState)(null);
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [activeIdx, setActiveIdx] = (0, import_react2.useState)(-1);
  const [railScroll, setRailScroll] = (0, import_react2.useState)(0);
  const hoverRef = (0, import_react2.useRef)(false);
  const collapseTimer = (0, import_react2.useRef)(null);
  const listRef = (0, import_react2.useRef)(null);
  const pinUntilRef = (0, import_react2.useRef)(0);
  const jumpGenRef = (0, import_react2.useRef)(0);
  const releaseHoldRef = (0, import_react2.useRef)(null);
  const items = (0, import_react2.useMemo)(() => {
    const fromProj = (projected?.messages ?? []).filter((m) => m.id && !mask.has(String(m.id)));
    const fromRpc = rpcMessages.filter((m) => m.id && !mask.has(String(m.id)));
    const source = syncHistoricalQueries ? mergeMessagesByTimeline(fromProj, fromRpc) : fromProj.length > 0 ? fromProj : fromRpc;
    return source.map(
      (m) => ({
        msgId: String(m.id),
        query: m.text || "(\u7A7A)",
        createAt: m.time,
        seq: m.seq
      })
    );
  }, [projected, mask, rpcMessages, syncHistoricalQueries]);
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
  const refreshGeo = (0, import_react2.useCallback)(() => {
    const next = measureDock();
    setGeo((prev) => {
      if (!next) return prev;
      if (prev && prev.right === next.right && prev.top === next.top && prev.railH === next.railH) {
        return prev;
      }
      return next;
    });
  }, []);
  const spyActive = (0, import_react2.useCallback)(() => {
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
  (0, import_react2.useEffect)(() => {
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
  (0, import_react2.useEffect)(() => {
    if (!open || activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-qj-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);
  const applyConfigValue = (0, import_react2.useCallback)((value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.enable === "boolean") setEnable(value.enable);
    if (typeof value.syncHistoricalQueries === "boolean") {
      setSyncHistoricalQueries(value.syncHistoricalQueries);
    }
    if (value.markerStyle === "number" || value.markerStyle === "emoji") {
      setMarkerStyle(value.markerStyle);
    }
    if (typeof value.markerSymbol === "string" && value.markerSymbol.trim()) {
      const sym = value.markerSymbol.trim().slice(0, 8);
      setMarkerSymbol(sym);
    }
  }, []);
  const refreshConfig = (0, import_react2.useCallback)(async () => {
    if (!isLoopback) return;
    try {
      const res = await rpc.call(CHANNEL2, "getConfig", {});
      if (res?.ok) applyConfigValue(res.value);
    } catch {
    }
  }, [rpc, isLoopback, applyConfigValue]);
  const refreshMask = (0, import_react2.useCallback)(async () => {
    if (!isLoopback || !sessionId) {
      setMask(/* @__PURE__ */ new Set());
      return;
    }
    try {
      const res = await rpc.call(CHANNEL2, "getMask", { sessionId });
      if (res?.ok) setMask(new Set((res.value.msgIds ?? []).map(String)));
    } catch {
    }
  }, [rpc, isLoopback, sessionId]);
  const refreshList = (0, import_react2.useCallback)(async () => {
    if (!isLoopback || !sessionId) {
      setRpcMessages([]);
      return;
    }
    try {
      const res = await rpc.call(CHANNEL2, "list", { sessionId });
      if (res?.ok) {
        applyConfigValue(res.value);
        setRpcMessages(res.value.messages ?? []);
      }
    } catch {
    }
  }, [rpc, isLoopback, sessionId, applyConfigValue]);
  (0, import_react2.useEffect)(() => {
    void refreshConfig();
    const tmr = window.setInterval(() => void refreshConfig(), 3e3);
    return () => window.clearInterval(tmr);
  }, [refreshConfig]);
  (0, import_react2.useEffect)(() => {
    void refreshMask();
  }, [refreshMask]);
  (0, import_react2.useEffect)(() => {
    void refreshList();
    if (!sessionId || !isLoopback) return;
    const tmr = window.setInterval(() => void refreshList(), 1500);
    return () => window.clearInterval(tmr);
  }, [refreshList, sessionId, isLoopback]);
  const onJump = async (msgId, idxInAll, targetSeq) => {
    if (!sessionId) return;
    const gen = ++jumpGenRef.current;
    releaseHoldRef.current?.();
    releaseHoldRef.current = null;
    try {
      if (typeof idxInAll === "number") {
        setActiveIdx(idxInAll);
        pinUntilRef.current = Date.now() + Math.max(JUMP_PIN_MS, SCROLL_HOLD_MS);
      }
      let row = findRowByMsgId(msgId);
      if (!row) {
        const face = resolveSessionFace(ctx, sessionId);
        if (face) {
          await loadUntilIdLoaded(face, msgId, targetSeq);
          if (gen !== jumpGenRef.current) return;
          row = await waitForRow(msgId);
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
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
                  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                    "button",
                    {
                      type: "button",
                      title: it.query.slice(0, 120),
                      onClick: () => void onJump(it.msgId, idx, it.seq),
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
        open && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
              !sessionId && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: emptyStyle, children: t("noSession") }),
              sessionId && items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: emptyStyle, children: t("empty") }),
              items.map((item, idx) => {
                const active = idx === activeIdx;
                return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
                  "button",
                  {
                    type: "button",
                    "data-qj-idx": idx,
                    title: item.query,
                    onClick: () => void onJump(item.msgId, idx, item.seq),
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
                      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { flex: 1, minWidth: 0, textAlign: "left" }, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
                        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("style", { children: `
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
  const [enable, setEnable] = (0, import_react2.useState)(true);
  const [syncHistoricalQueries, setSyncHistoricalQueries] = (0, import_react2.useState)(true);
  const [markerStyle, setMarkerStyle] = (0, import_react2.useState)("emoji");
  const [markerSymbol, setMarkerSymbol] = (0, import_react2.useState)(DEFAULT_SYMBOL);
  const [hint, setHint] = (0, import_react2.useState)("");
  const load = (0, import_react2.useCallback)(async () => {
    if (!isLoopback) return;
    try {
      const res = await rpc.call(CHANNEL2, "getConfig", {});
      if (!res?.ok) return;
      setEnable(!!res.value.enable);
      if (typeof res.value.syncHistoricalQueries === "boolean") {
        setSyncHistoricalQueries(res.value.syncHistoricalQueries);
      }
      if (res.value.markerStyle === "number" || res.value.markerStyle === "emoji") {
        setMarkerStyle(res.value.markerStyle);
      }
      if (typeof res.value.markerSymbol === "string" && res.value.markerSymbol.trim()) {
        setMarkerSymbol(res.value.markerSymbol.trim().slice(0, 8));
      }
    } catch {
    }
  }, [rpc, isLoopback]);
  (0, import_react2.useEffect)(() => {
    void load();
  }, [load]);
  const save = (0, import_react2.useCallback)(
    async (patch) => {
      if (!isLoopback) return;
      try {
        const res = await rpc.call(CHANNEL2, "setConfig", patch);
        if (!res?.ok) return;
        if (typeof res.value.enable === "boolean") setEnable(res.value.enable);
        if (typeof res.value.syncHistoricalQueries === "boolean") {
          setSyncHistoricalQueries(res.value.syncHistoricalQueries);
        }
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { padding: "8px 4px 24px", maxWidth: 420 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginBottom: 18 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 16, fontWeight: 650, marginBottom: 4 }, children: t("settingsTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: hintStyle, children: t("settingsDesc") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: row, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: { ...label, display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          type: "checkbox",
          checked: enable,
          onChange: (e) => void save({ enable: e.target.checked })
        }
      ),
      t("enable")
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: { ...label, display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "input",
          {
            type: "checkbox",
            checked: syncHistoricalQueries,
            onChange: (e) => void save({ syncHistoricalQueries: e.target.checked })
          }
        ),
        t("syncHistorical")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: hintStyle, children: t("syncHistoricalHint") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: row, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: label, children: t("markerMode") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...row, opacity: markerStyle === "emoji" ? 1 : 0.45 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: label, children: t("markerSymbol") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: hintStyle, children: t("markerSymbolHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
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
    hint ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...hintStyle, color: "var(--dsw-alias-label-primary, #3d3d3d)" }, children: hint }) : null
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
  let sessionsSvc = ctx.get?.("sessions") ?? null;
  if (!sessionsSvc && typeof ctx.inject === "function") {
    try {
      ctx.inject(["sessions"], (sub) => {
        sessionsSvc = sub.sessions;
      });
    } catch {
    }
  }
  ctx.slots.inject(
    "shell.overlay",
    () => ctx.slots.register(
      { name: "shell.overlay", id: "query-jump", order: 110 },
      (props) => import_react2.default.createElement(QueryJumpPanel, {
        ctx,
        useSessions: props.useSessions,
        useProjection: props.useProjection,
        rpc,
        t,
        isLoopback
      })
    )
  );
  ctx.slots.inject(
    "shell.overlay",
    () => ctx.slots.register(
      { name: "shell.overlay", id: "query-jump-delete-dialog", order: 120 },
      () => import_react2.default.createElement(DeleteSessionDialog, {
        rpc,
        isLoopback,
        sessionsSvc,
        t
      })
    )
  );
  ctx.slots.inject(
    "conversation.session.header.actions",
    () => ctx.slots.register(
      {
        name: "conversation.session.header.actions",
        id: "query-jump-delete",
        order: 30
      },
      (props) => import_react2.default.createElement(DeleteSessionButton, {
        sessionId: props.sessionId,
        useSessions: props.useSessions,
        t
      })
    )
  );
  try {
    installSidebarDeleteMenu(t);
  } catch {
  }
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
        () => import_react2.default.createElement(QueryJumpSettingsTab, { rpc, t, isLoopback })
      )
    );
  } catch (err) {
    console.warn("[dsh-query-jump] settings.plugins.tab register skipped", err);
  }
}

    return module.exports;
  },
});

