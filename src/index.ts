/**
 * dsh-query-jump — host half.
 *
 * - settings.register：开关持久化（本机 settings；Web「插件配置」受白名单限制）
 * - sessionProjections：从会话日志折叠全量用户提问（重启后打开会话可重建）
 * - ~/.dsh/storages/query-jump/*.json：增量索引 + mask 落盘（重启/更新插件不丢）
 * - loopback RPC `/query-jump`
 */

import Schema from '@deepseek-ai/schemastery'
import { applyProjectionEvent, type QueryJumpState } from './text.js'
import { loadSession, saveSession } from './persist.js'

export const name = 'dsh-query-jump'
export const inject = ['connection']

export interface Config {
  /** 功能总开关（推荐在 settings / cordis config 配置） */
  enable: boolean
  maxQuery: number
  includeSteering: boolean
  /** 列表前缀：emoji 符号 / number 序号 */
  markerStyle: 'emoji' | 'number'
}

const CHANNEL = '/query-jump'
const PROJECTION_KEY = 'queryJumpMessages'
const SETTINGS_NS = 'dsh-query-jump'

const DEFAULTS: Config = {
  enable: true,
  maxQuery: 200,
  includeSteering: false,
  markerStyle: 'emoji',
}

const clearMask = new Map<string, Set<string>>()
const incremental = new Map<string, QueryJumpState>()
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>()
const hydrated = new Set<string>()

function resolveMarkerStyle(raw: unknown): 'emoji' | 'number' {
  return raw === 'number' ? 'number' : 'emoji'
}

function resolveConfig(raw: Partial<Config> | undefined): Config {
  return {
    enable: typeof raw?.enable === 'boolean' ? raw.enable : DEFAULTS.enable,
    maxQuery: typeof raw?.maxQuery === 'number' && raw.maxQuery > 0 ? raw.maxQuery : DEFAULTS.maxQuery,
    includeSteering:
      typeof raw?.includeSteering === 'boolean' ? raw.includeSteering : DEFAULTS.includeSteering,
    markerStyle: resolveMarkerStyle(raw?.markerStyle),
  }
}

export const Config = Schema.object({
  enable: Schema.boolean().default(DEFAULTS.enable).description('启用会话 Query 定位面板'),
  maxQuery: Schema.number().default(DEFAULTS.maxQuery).description('单会话最多保留条数'),
  includeSteering: Schema.boolean().default(DEFAULTS.includeSteering).description('是否纳入 steering 消息'),
  markerStyle: Schema.string()
    .default(DEFAULTS.markerStyle)
    .description('列表前缀：emoji=🤗 / number=序号'),
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
          return ok({ enable: next.enable, markerStyle: next.markerStyle })
        }
        case 'setConfig': {
          const patch: Partial<Config> = {}
          if (typeof payload?.enable === 'boolean') patch.enable = payload.enable
          if (payload?.markerStyle === 'emoji' || payload?.markerStyle === 'number') {
            patch.markerStyle = payload.markerStyle
          }
          if (typeof payload?.maxQuery === 'number' && payload.maxQuery > 0) {
            patch.maxQuery = payload.maxQuery
          }
          if (typeof payload?.includeSteering === 'boolean') {
            patch.includeSteering = payload.includeSteering
          }
          if (Object.keys(patch).length === 0) {
            return badRequest('setConfig requires enable | markerStyle | maxQuery | includeSteering')
          }
          const s = readFromScope(settingsScope, live)
          const next = resolveConfig({ ...s, ...patch })
          live = next
          await writeSettings(settingsScope, patch)
          return ok({
            enable: next.enable,
            markerStyle: next.markerStyle,
            maxQuery: next.maxQuery,
            includeSteering: next.includeSteering,
          })
        }
        case 'list': {
          const sessionId = payload?.sessionId
          if (typeof sessionId !== 'string' || !sessionId) {
            return badRequest('sessionId must be a non-empty string')
          }
          await ensureHydrated(sessionId)
          const s = readFromScope(settingsScope, live)
          const masked = clearMask.get(sessionId) ?? new Set<string>()
          const messages = (incremental.get(sessionId)?.messages ?? []).filter(
            (m) => m.id && !masked.has(String(m.id)),
          )
          return ok({
            sessionId,
            enable: s.enable,
            markerStyle: s.markerStyle,
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
