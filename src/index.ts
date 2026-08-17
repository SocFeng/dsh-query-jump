/**
 * dsh-query-jump — host half.
 *
 * - Optional session projection `queryJumpMessages` (full user-query fold).
 * - Optional settings namespace `dsh-query-jump` (panel toggle persistence).
 * - Loopback RPC `/query-jump` for getConfig / setEnable / mask clear.
 */

import Schema from '@deepseek-ai/schemastery'
import {
  applyProjectionEvent,
  type QueryJumpState,
} from './text.js'

export const name = 'dsh-query-jump'
export const inject = ['connection']

export interface Config {
  enable: boolean
  maxQuery: number
  includeSteering: boolean
}

const CHANNEL = '/query-jump'
const PROJECTION_KEY = 'queryJumpMessages'
const SETTINGS_NS = 'dsh-query-jump'

const DEFAULTS: Config = {
  enable: true,
  maxQuery: 200,
  includeSteering: false,
}

/** sessionId → masked msgIds ("清空本会话列表") */
const clearMask = new Map<string, Set<string>>()

/** Fallback index when sessionProjections is absent (enable 之后增量). */
const incremental = new Map<string, QueryJumpState>()

function resolveConfig(raw: Partial<Config> | undefined): Config {
  return {
    enable: typeof raw?.enable === 'boolean' ? raw.enable : DEFAULTS.enable,
    maxQuery: typeof raw?.maxQuery === 'number' && raw.maxQuery > 0 ? raw.maxQuery : DEFAULTS.maxQuery,
    includeSteering:
      typeof raw?.includeSteering === 'boolean' ? raw.includeSteering : DEFAULTS.includeSteering,
  }
}

/** Cordis / settings 都要求 Schemastery 可调用 schema（不能是普通对象）。 */
export const Config = Schema.object({
  enable: Schema.boolean().default(DEFAULTS.enable),
  maxQuery: Schema.number().default(DEFAULTS.maxQuery),
  includeSteering: Schema.boolean().default(DEFAULTS.includeSteering),
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
  update?: (patch: Partial<Config>) => void | Promise<void>
  replace?: (section: Partial<Config>) => void | Promise<void>
}

function readFromScope(scope: SettingsScope | null, fallback: Config): Config {
  if (!scope) return fallback
  try {
    if (typeof scope.get === 'function') return resolveConfig({ ...fallback, ...scope.get() })
  } catch (err) {
    console.warn('[dsh-query-jump] settings read failed', err)
  }
  return fallback
}

async function writeEnable(scope: SettingsScope | null, enable: boolean): Promise<void> {
  if (!scope) return
  if (typeof scope.update === 'function') {
    await scope.update({ enable })
    return
  }
  if (typeof scope.replace === 'function') {
    const cur = readFromScope(scope, { ...DEFAULTS, enable })
    await scope.replace({ ...cur, enable })
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

export function apply(ctx: any, config?: Partial<Config>) {
  let live = resolveConfig(config)
  let settingsScope: SettingsScope | null = null

  // Optional settings（必须传 Schemastery schema；Web 设置页白名单另论）
  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['settings'], (sctx: any) => {
        try {
          settingsScope = sctx.settings.register(SETTINGS_NS, Config, {
            base: { ...live },
            applies: 'live',
          })
          live = readFromScope(settingsScope, live)
        } catch (err) {
          console.warn('[dsh-query-jump] settings.register failed', err)
        }
      })
    } catch (err) {
      console.warn('[dsh-query-jump] settings inject skipped', err)
    }
  }

  // Optional session projection registry (full history fold).
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

  // Always keep an incremental fallback index for RPC `list`.
  ctx.on('session/event', (session: any, event: any) => {
    const s = readFromScope(settingsScope, live)
    if (!s.enable) return
    const sessionId = String(session?.id ?? '')
    if (!sessionId) return
    const prev = incremental.get(sessionId) ?? { messages: [] }
    const next = applyProjectionEvent(prev, event, {
      includeSteering: s.includeSteering,
      maxQuery: s.maxQuery,
    })
    if (next !== prev) incremental.set(sessionId, next)
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
            projectionKey: PROJECTION_KEY,
          })
        }
        case 'setEnable': {
          if (typeof payload?.enable !== 'boolean') return badRequest('enable must be boolean')
          const s = readFromScope(settingsScope, live)
          const next = { ...s, enable: payload.enable }
          live = next
          await writeEnable(settingsScope, payload.enable)
          return ok({ enable: next.enable })
        }
        case 'list': {
          const sessionId = payload?.sessionId
          if (typeof sessionId !== 'string' || !sessionId) {
            return badRequest('sessionId must be a non-empty string')
          }
          const s = readFromScope(settingsScope, live)
          const masked = clearMask.get(sessionId) ?? new Set<string>()
          const messages = (incremental.get(sessionId)?.messages ?? []).filter(
            (m) => m.id && !masked.has(String(m.id)),
          )
          return ok({
            sessionId,
            enable: s.enable,
            messages,
          })
        }
        case 'clearMask': {
          const sessionId = payload?.sessionId
          if (typeof sessionId !== 'string' || !sessionId) {
            return badRequest('sessionId must be a non-empty string')
          }
          const ids = Array.isArray(payload?.msgIds) ? payload.msgIds.map(String) : []
          clearMask.set(sessionId, new Set(ids))
          return ok({ sessionId, masked: ids.length })
        }
        case 'getMask': {
          const sessionId = payload?.sessionId
          if (typeof sessionId !== 'string' || !sessionId) {
            return badRequest('sessionId must be a non-empty string')
          }
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
export { applyProjectionEvent, isUserQueryEvent, textOf } from './text.js'
