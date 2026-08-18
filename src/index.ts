/**
 * dsh-query-jump — host half.
 *
 * - settings.register：开关持久化（本机 settings；Web「插件配置」受白名单限制）
 * - sessionProjections：从会话日志折叠全量用户提问（重启后打开会话可重建）
 * - ~/.dsh/storages/query-jump/*.json：增量索引 + mask 落盘（重启/更新插件不丢）
 * - session/created：分叉会话从 seed 折叠 query 列表（seed 不触发 session/event）
 * - loopback RPC `/query-jump`
 */

import Schema from '@deepseek-ai/schemastery'
import { applyProjectionEvent, type QueryJumpState } from './text.js'
import { loadSession, saveSession } from './persist.js'
import { createSessionCacheJanitor } from './cleanup.js'
import { createForkCacheSeeder } from './fork.js'
import {
  SessionDeleteError,
  deleteSessionPermanently,
  listSessionsForDelete,
} from './session-delete.js'
import { syncSessionQueries } from './backfill.js'

export const name = 'dsh-query-jump'
export const inject = ['connection']

export interface Config {
  /** 功能总开关（推荐在 settings / cordis config 配置） */
  enable: boolean
  maxQuery: number
  includeSteering: boolean
  /** 列表前缀：symbol 自定义符号 / number 序号 */
  markerStyle: 'emoji' | 'number'
  /** markerStyle=emoji 时使用的自定义前缀（可任意符号/表情） */
  markerSymbol: string
  /** 从会话日志补全尚未记录的 query，按提问时间排序 */
  syncHistoricalQueries: boolean
  /** 是否在会话头 / 侧栏显示删除会话入口 */
  showDeleteSession: boolean
}

const CHANNEL = '/query-jump'
const PROJECTION_KEY = 'queryJumpMessages'
const SETTINGS_NS = 'dsh-query-jump'

const DEFAULTS: Config = {
  enable: true,
  maxQuery: 200,
  includeSteering: false,
  markerStyle: 'emoji',
  markerSymbol: '🤗',
  syncHistoricalQueries: true,
  showDeleteSession: true,
}

const clearMask = new Map<string, Set<string>>()
const incremental = new Map<string, QueryJumpState>()
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>()
const hydrated = new Set<string>()

function resolveMarkerStyle(raw: unknown): 'emoji' | 'number' {
  return raw === 'number' ? 'number' : 'emoji'
}

function resolveMarkerSymbol(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULTS.markerSymbol
  const s = raw.trim().slice(0, 8)
  return s || DEFAULTS.markerSymbol
}

function resolveConfig(raw: Partial<Config> | undefined): Config {
  return {
    enable: typeof raw?.enable === 'boolean' ? raw.enable : DEFAULTS.enable,
    maxQuery: typeof raw?.maxQuery === 'number' && raw.maxQuery > 0 ? raw.maxQuery : DEFAULTS.maxQuery,
    includeSteering:
      typeof raw?.includeSteering === 'boolean' ? raw.includeSteering : DEFAULTS.includeSteering,
    markerStyle: resolveMarkerStyle(raw?.markerStyle),
    markerSymbol: resolveMarkerSymbol(raw?.markerSymbol),
    syncHistoricalQueries:
      typeof raw?.syncHistoricalQueries === 'boolean'
        ? raw.syncHistoricalQueries
        : DEFAULTS.syncHistoricalQueries,
    showDeleteSession:
      typeof raw?.showDeleteSession === 'boolean'
        ? raw.showDeleteSession
        : DEFAULTS.showDeleteSession,
  }
}

export const Config = Schema.object({
  enable: Schema.boolean().default(DEFAULTS.enable).description('启用会话 Query 定位面板'),
  maxQuery: Schema.number().default(DEFAULTS.maxQuery).description('单会话最多保留条数'),
  includeSteering: Schema.boolean().default(DEFAULTS.includeSteering).description('是否纳入 steering 消息'),
  markerStyle: Schema.string()
    .default(DEFAULTS.markerStyle)
    .description('列表前缀模式：emoji=自定义符号 / number=序号'),
  markerSymbol: Schema.string()
    .default(DEFAULTS.markerSymbol)
    .description('自定义前缀符号（markerStyle=emoji 时生效，最多 8 字符）'),
  syncHistoricalQueries: Schema.boolean()
    .default(DEFAULTS.syncHistoricalQueries)
    .description('从会话日志同步尚未记录的 query，按提问时间排序'),
  showDeleteSession: Schema.boolean()
    .default(DEFAULTS.showDeleteSession)
    .description('显示删除会话按钮（会话标题栏与侧栏菜单）'),
})

function ok(value: unknown) {
  return { ok: true as const, value }
}
function badRequest(message: string) {
  return {
    ok: false as const,
    error: { code: 'bad-request', message, details: { issues: [] as unknown[] } },
  }
}

function internalError(error: unknown) {
  return {
    ok: false as const,
    error: {
      code: 'internal',
      message: error instanceof Error ? error.message : String(error),
      details: {},
    },
  }
}

function fromDeleteError(error: unknown) {
  if (error instanceof SessionDeleteError) {
    const code =
      error.status === 400 ? 'bad-request' : error.status === 404 ? 'not-found' : 'internal'
    return {
      ok: false as const,
      error: { code, message: error.message, details: {} },
    }
  }
  return internalError(error)
}

type SettingsScope = {
  get?: () => Partial<Config>
  watch?: (cb: (value: Config) => void | Promise<void>) => () => void
  update?: (patch: Partial<Config>) => void | Promise<void>
  replace?: (section: Partial<Config>) => void | Promise<void>
}

function readFromScope(scope: SettingsScope | null, fallback: Config): Config {
  if (!scope?.get) return fallback
  try {
    return resolveConfig({ ...fallback, ...scope.get() })
  } catch (err) {
    console.warn('[dsh-query-jump] settings read failed', err)
    return fallback
  }
}

async function writeSettings(scope: SettingsScope | null, patch: Partial<Config>): Promise<void> {
  if (!scope) return
  if (typeof scope.update === 'function') {
    await scope.update(patch)
    return
  }
  if (typeof scope.replace === 'function') {
    const cur = readFromScope(scope, { ...DEFAULTS, ...patch })
    await scope.replace({ ...cur, ...patch })
  }
}

function buildProjection(includeSteering: boolean, maxQuery: number) {
  return {
    key: PROJECTION_KEY,
    schema: { parse: (val: unknown) => val },
    stateVersion: 1,
    init: (): QueryJumpState => ({ messages: [] }),
    apply: (state: QueryJumpState, event: any) =>
      applyProjectionEvent(state, event, { includeSteering, maxQuery }),
    view: (state: QueryJumpState) => state,
  }
}

function schedulePersist(sessionId: string) {
  const prev = persistTimers.get(sessionId)
  if (prev) clearTimeout(prev)
  persistTimers.set(
    sessionId,
    setTimeout(() => {
      persistTimers.delete(sessionId)
      const messages = incremental.get(sessionId)?.messages ?? []
      const mask = clearMask.get(sessionId) ?? new Set<string>()
      void saveSession(sessionId, messages, mask).catch((err) => {
        console.warn('[dsh-query-jump] persist failed', err)
      })
    }, 400),
  )
}

async function maybeSyncHistorical(
  ctx: any,
  sessionId: string,
  settings: Config,
): Promise<QueryJumpState> {
  if (!settings.syncHistoricalQueries) {
    return incremental.get(sessionId) ?? { messages: [] }
  }
  const prev = incremental.get(sessionId) ?? { messages: [] }
  const { state, changed } = syncSessionQueries(ctx, sessionId, prev, {
    includeSteering: settings.includeSteering,
    maxQuery: settings.maxQuery,
  })
  if (changed) {
    incremental.set(sessionId, state)
    schedulePersist(sessionId)
  }
  return state
}

async function ensureHydrated(sessionId: string) {
  if (hydrated.has(sessionId)) return
  hydrated.add(sessionId)
  const disk = await loadSession(sessionId)
  if (!disk) return
  if (!incremental.has(sessionId) && disk.messages.length) {
    incremental.set(sessionId, { messages: disk.messages })
  }
  if (!clearMask.has(sessionId) && disk.mask.length) {
    clearMask.set(sessionId, new Set(disk.mask))
  }
}

export function apply(ctx: any, config?: Partial<Config>) {
  let live = resolveConfig(config)
  let settingsScope: SettingsScope | null = null

  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['settings'], (sctx: any) => {
        try {
          // expose 若本机 dsh 已支持则尝试挂到「设置→插件配置」；不支持会被忽略或报错后降级
          const registerOpts: Record<string, unknown> = {
            base: { ...live },
            applies: 'live',
            expose: true,
          }
          try {
            settingsScope = sctx.settings.register(SETTINGS_NS, Config, registerOpts)
          } catch {
            settingsScope = sctx.settings.register(SETTINGS_NS, Config, {
              base: { ...live },
              applies: 'live',
            })
          }
          live = readFromScope(settingsScope, live)
          settingsScope?.watch?.((value) => {
            live = resolveConfig(value)
          })
        } catch (err) {
          console.warn('[dsh-query-jump] settings.register failed', err)
        }
      })
    } catch (err) {
      console.warn('[dsh-query-jump] settings inject skipped', err)
    }
  }

  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['sessionProjections'], (pctx: any) => {
        try {
          const s = readFromScope(settingsScope, live)
          pctx.sessionProjections.register(buildProjection(s.includeSteering, s.maxQuery))
        } catch (err) {
          console.warn('[dsh-query-jump] projection register failed', err)
        }
      })
    } catch (err) {
      console.warn('[dsh-query-jump] sessionProjections inject skipped', err)
    }
  }

  const janitor = createSessionCacheJanitor({
    incremental,
    clearMask,
    persistTimers,
    hydrated,
  })

  ctx.on('session/disposed', janitor.onSessionDisposed)
  ctx.on('domain/changed', janitor.onDomainChanged)

  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['storageDomain'], (sctx: any) => {
        janitor.hydrateWorkspaces(sctx.storageDomain)
      })
    } catch (err) {
      console.warn('[dsh-query-jump] storageDomain inject skipped', err)
    }
  }

  const forkSeeder = createForkCacheSeeder({
    incremental,
    clearMask,
    hydrated,
    schedulePersist,
    getConfig: () => {
      const s = readFromScope(settingsScope, live)
      return { includeSteering: s.includeSteering, maxQuery: s.maxQuery }
    },
  })

  ctx.on('session/created', forkSeeder.onSessionCreated)

  ctx.on('session/event', (session: any, event: any) => {
    const s = readFromScope(settingsScope, live)
    if (!s.enable) return
    const sessionId = String(session?.id ?? '')
    if (!sessionId) return

    void (async () => {
      await ensureHydrated(sessionId)
      const prev = incremental.get(sessionId) ?? { messages: [] }
      const next = applyProjectionEvent(prev, event, {
        includeSteering: s.includeSteering,
        maxQuery: s.maxQuery,
      })
      if (next !== prev) {
        incremental.set(sessionId, next)
        schedulePersist(sessionId)
      }
    })()
  })

  const handler = async (endpoint: string, payload: any, signal?: AbortSignal) => {
    try {
      switch (endpoint) {
        case 'getConfig': {
          const s = readFromScope(settingsScope, live)
          return ok({
            enable: s.enable,
            maxQuery: s.maxQuery,
            includeSteering: s.includeSteering,
            markerStyle: s.markerStyle,
            markerSymbol: s.markerSymbol,
            syncHistoricalQueries: s.syncHistoricalQueries,
            showDeleteSession: s.showDeleteSession,
            projectionKey: PROJECTION_KEY,
            settingsNamespace: SETTINGS_NS,
          })
        }
        case 'setEnable': {
          if (typeof payload?.enable !== 'boolean') return badRequest('enable must be boolean')
          const s = readFromScope(settingsScope, live)
          const next = { ...s, enable: payload.enable }
          live = next
          await writeSettings(settingsScope, { enable: payload.enable })
          return ok({
            enable: next.enable,
            markerStyle: next.markerStyle,
            markerSymbol: next.markerSymbol,
          })
        }
        case 'setConfig': {
          const patch: Partial<Config> = {}
          if (typeof payload?.enable === 'boolean') patch.enable = payload.enable
          if (payload?.markerStyle === 'emoji' || payload?.markerStyle === 'number') {
            patch.markerStyle = payload.markerStyle
          }
          if (typeof payload?.markerSymbol === 'string') {
            patch.markerSymbol = resolveMarkerSymbol(payload.markerSymbol)
          }
          if (typeof payload?.maxQuery === 'number' && payload.maxQuery > 0) {
            patch.maxQuery = payload.maxQuery
          }
          if (typeof payload?.includeSteering === 'boolean') {
            patch.includeSteering = payload.includeSteering
          }
          if (typeof payload?.syncHistoricalQueries === 'boolean') {
            patch.syncHistoricalQueries = payload.syncHistoricalQueries
          }
          if (typeof payload?.showDeleteSession === 'boolean') {
            patch.showDeleteSession = payload.showDeleteSession
          }
          if (Object.keys(patch).length === 0) {
            return badRequest(
              'setConfig requires enable | markerStyle | markerSymbol | maxQuery | includeSteering | syncHistoricalQueries | showDeleteSession',
            )
          }
          const s = readFromScope(settingsScope, live)
          const next = resolveConfig({ ...s, ...patch })
          live = next
          await writeSettings(settingsScope, patch)
          return ok({
            enable: next.enable,
            markerStyle: next.markerStyle,
            markerSymbol: next.markerSymbol,
            maxQuery: next.maxQuery,
            includeSteering: next.includeSteering,
            syncHistoricalQueries: next.syncHistoricalQueries,
            showDeleteSession: next.showDeleteSession,
          })
        }
        case 'list': {
          const sessionId = payload?.sessionId
          if (typeof sessionId !== 'string' || !sessionId) {
            return badRequest('sessionId must be a non-empty string')
          }
          await ensureHydrated(sessionId)
          const s = readFromScope(settingsScope, live)
          const state = await maybeSyncHistorical(ctx, sessionId, s)
          const masked = clearMask.get(sessionId) ?? new Set<string>()
          const messages = (state.messages ?? []).filter(
            (m) => m.id && !masked.has(String(m.id)),
          )
          return ok({
            sessionId,
            enable: s.enable,
            markerStyle: s.markerStyle,
            markerSymbol: s.markerSymbol,
            syncHistoricalQueries: s.syncHistoricalQueries,
            messages,
          })
        }
        case 'clearMask': {
          const sessionId = payload?.sessionId
          if (typeof sessionId !== 'string' || !sessionId) {
            return badRequest('sessionId must be a non-empty string')
          }
          await ensureHydrated(sessionId)
          const ids = Array.isArray(payload?.msgIds) ? payload.msgIds.map(String) : []
          clearMask.set(sessionId, new Set(ids))
          schedulePersist(sessionId)
          return ok({ sessionId, masked: ids.length })
        }
        case 'getMask': {
          const sessionId = payload?.sessionId
          if (typeof sessionId !== 'string' || !sessionId) {
            return badRequest('sessionId must be a non-empty string')
          }
          await ensureHydrated(sessionId)
          return ok({ sessionId, msgIds: [...(clearMask.get(sessionId) ?? [])] })
        }
        case 'listSessions': {
          const sessions = await listSessionsForDelete(ctx)
          return ok({ sessions })
        }
        case 'deleteSession': {
          const sessionId = payload?.sessionId
          if (typeof sessionId !== 'string' || !sessionId.trim()) {
            return badRequest('sessionId must be a non-empty string')
          }
          const id = sessionId.trim()
          try {
            const result = await deleteSessionPermanently(ctx, id)
            janitor.purgeSession(id)
            return ok({ sessionId: id, ...result })
          } catch (error) {
            return fromDeleteError(error)
          }
        }
        case 'ping':
          return ok({ pong: true })
        default:
          return badRequest(`unknown endpoint ${JSON.stringify(endpoint)}`)
      }
    } catch (error) {
      if (signal?.aborted) return internalError(new Error('aborted'))
      return internalError(error)
    }
  }

  ctx.effect(
    () => ctx.connection.rpc.handle(CHANNEL, handler, { authority: 'loopback' }),
    'dsh-query-jump: rpc',
  )
}

export { CHANNEL, PROJECTION_KEY, clearMask, buildProjection }
export { applyProjectionEvent, isUserQueryEvent, textOf, fuzzyMatch } from './text.js'
