/**
 * Builds both halves:
 * - lib/index.js  — Node host (ESM)
 * - lib/client.js — browser module wrapped for DSH __ModuleLoader__
 */
import { build } from 'esbuild'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('.', import.meta.url)
const fromRoot = (spec) => fileURLToPath(new URL(spec, root))

const pkg = JSON.parse(readFileSync(fromRoot('package.json'), 'utf8'))
const id = pkg.name

mkdirSync(fromRoot('lib'), { recursive: true })

await build({
  entryPoints: [fromRoot('src/index.ts')],
  outfile: fromRoot('lib/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // Resolves from the DSH profile / host at runtime
  external: ['@deepseek-ai/schemastery'],
  logLevel: 'info',
})

for (const entry of ['cleanup', 'persist', 'text', 'fork', 'session-delete', 'backfill']) {
  await build({
    entryPoints: [fromRoot(`src/${entry}.ts`)],
    outfile: fromRoot(`lib/${entry}.js`),
    bundle: false,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
  })
}
const banner = [
  'window.__ModuleLoader__.load({',
  `  id: ${JSON.stringify(id)},`,
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  '    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
  '',
].join('\n')

const footer = '\n    return module.exports;\n  },\n});\n'

await build({
  entryPoints: [fromRoot('src/client.tsx')],
  outfile: fromRoot('lib/client.js'),
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  jsx: 'automatic',
  target: ['es2020'],
  external: ['react', 'react/jsx-runtime'],
  banner: { js: banner },
  footer: { js: footer },
  logLevel: 'info',
})

console.log(`built lib/index.js and lib/client.js for ${id}`)
