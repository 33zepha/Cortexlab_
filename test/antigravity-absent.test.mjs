/**
 * Scan structurel : aucune référence opérationnelle à Antigravity
 * hors historique immuable (ledger/, bundles/), archives et tests d'absence.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')

const SCAN_PATHS = [
  'constitution',
  'manifests',
  'registry',
  'runtime',
  'server',
  'web/src',
  'generate-registry.mjs',
  'AGENTS.md',
  'bin',
  'compile-bundle.mjs',
].filter((p) => fs.existsSync(path.join(ROOT, p)))

test('sources actives : zero reference Antigravity / AG-ANTIGRAVITY / agy', () => {
  const hits = []
  for (const rel of SCAN_PATHS) {
    const target = path.join(ROOT, rel)
    let out = ''
    try {
      out = execSync(
        `grep -rniE 'antigravity|AG-ANTIGRAVITY|\\bagy\\b' -- ${JSON.stringify(target)} || true`,
        { cwd: ROOT, encoding: 'utf8', shell: '/bin/bash' },
      )
    } catch {
      out = ''
    }
    for (const raw of out.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      // Mentions de retrait explicites autorisées (AGENTS.md)
      if (/retir|supprim|plus dans|absent|n.est plus/i.test(line)) continue
      hits.push(`${rel}: ${line}`)
    }
  }
  assert.deepEqual(hits, [], `refs operationnelles restantes:\n${hits.join('\n')}`)
})

test('demo.js ne cite aucun agent absent du registre', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'registry/registry.json'), 'utf8'))
  const live = new Set(reg.entries.filter((e) => e.type === 'agent').map((e) => e.id))
  const demo = fs.readFileSync(path.join(ROOT, 'web/src/lib/demo.js'), 'utf8')
  const ids = [...demo.matchAll(/id:\s*'(AG-[A-Z0-9_-]+)'/g)].map((m) => m[1])
  for (const id of ids) {
    assert.ok(live.has(id), `demo cite ${id} absent du registre`)
  }
  assert.equal(ids.includes('AG-ANTIGRAVITY'), false)
})

test('CSS ne definit plus .avatar-antigravity', () => {
  const css = fs.readFileSync(path.join(ROOT, 'web/src/styles/index.css'), 'utf8')
  assert.equal(css.includes('avatar-antigravity'), false)
})

test('manifests/agents.json ne declare plus AG-ANTIGRAVITY', () => {
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifests/agents.json'), 'utf8'))
  assert.equal(mf.entries.some((e) => e.id === 'AG-ANTIGRAVITY'), false)
})
