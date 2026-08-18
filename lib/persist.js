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
export {
  deleteSession,
  loadSession,
  saveSession,
  sessionIdVariants
};
