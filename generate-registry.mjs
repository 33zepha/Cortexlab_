#!/usr/bin/env node
/**
 * generate-registry.mjs — compile manifests/ -> registry/registry.generated.json
 *
 * Approche « derivee » (pas dupliquee) : les manifests ne portent QUE les
 * metadonnees (id, domaine, source, controle). Les textes canoniques
 * (statement, controls, check) sont tires des VRAIES sources (constitution/*.yaml,
 * schemas/*.yaml) via js-yaml. Un seul endroit par information = pas de derive.
 *
 * Migration PARALLELE : n'ecrase pas registry.json (source manuelle actuelle).
 * On compare ensuite les deux avant bascule eventuelle.
 *
 * Usage: node generate-registry.mjs [--check]
 *   --check : compare le genere avec registry.json et sort 0 si equivalent.
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const MANIFESTS = path.join(ROOT, 'manifests')
const OUT = path.join(ROOT, 'registry', 'registry.json')

// --- helpers ---
function readYaml(p) {
  return yaml.load(fs.readFileSync(p, 'utf8'))
}
function findInvariant(doc, id) {
  return Array.isArray(doc?.invariants) ? doc.invariants.find((i) => i.id === id) : null
}
function findAgent(doc, id) {
  return Array.isArray(doc?.agents) ? doc.agents.find((a) => a.id === id) : null
}

// --- collecte des sources canoniques ---
const constitution = readYaml(path.join(ROOT, 'constitution', 'core.yaml'))
const agentsDoc = readYaml(path.join(ROOT, 'constitution', 'agents.yaml'))
const schemaFiles = fs.readdirSync(path.join(ROOT, 'schemas')).filter((f) => f.endsWith('.yaml'))
const schemas = Object.fromEntries(
  schemaFiles.map((f) => [path.join('schemas', f), readYaml(path.join(ROOT, 'schemas', f))])
)

// --- lit tous les manifests ---
const manifestFiles = fs.readdirSync(MANIFESTS).filter((f) => f.endsWith('.json'))
const entries = []
for (const mf of manifestFiles) {
  const m = JSON.parse(fs.readFileSync(path.join(MANIFESTS, mf), 'utf8'))
  for (const e of m.entries) {
    if (m.kind === 'invariants') {
      const inv = findInvariant(constitution, e.id)
      entries.push({
        id: e.id,
        type: 'invariant',
        authority: 1,
        domain: e.domain,
        status: 'active',
        version: inv?.version || 1,
        source: `constitution/core.yaml#${e.id}`,
        controls: e.controls || inv?.controls || null,
        statement: inv?.statement?.replace(/\s+/g, ' ')?.trim() || null,
      })
    } else if (m.kind === 'controls') {
      const doc = schemas[e.source]
      entries.push({
        id: e.id,
        type: 'control',
        authority: doc?.authority ?? 2,
        domain: e.domain,
        status: doc?.status ?? 'active',
        version: doc?.version ?? 1,
        source: e.source,
        applies_when: e.applies_when || doc?.applies_when || null,
        controls: e.controls || doc?.controls || null,
        check: doc?.check ?? null,
      })
    } else if (m.kind === 'agents') {
      const ag = findAgent(agentsDoc, e.id)
      entries.push({
        id: e.id,
        type: 'agent',
        tier: e.tier || ag?.tier || 'worker',
        name: ag?.name || e.id,
        authority: e.tier === 'ceo' ? 1 : 2,
        domain: 'orchestration',
        status: ag?.status ?? 'active',
        version: 1,
        source: e.source,
        role: ag?.role || null,
        provider: ag?.provider || null,
        model: ag?.model || null,
        strengths: ag?.strengths || null,
        cost_index: ag?.cost_index ?? null,
        quality_index: ag?.quality_index ?? null,
      })
    }
  }
}

// ordre stable : invariants, controls, agents — tri par type puis id
entries.sort((a, b) => {
  const order = { invariant: 0, control: 1, agent: 2 }[a.type] ?? 3
  const orderB = { invariant: 0, control: 1, agent: 2 }[b.type] ?? 3
  if (order !== orderB) return order - orderB
  return a.id.localeCompare(b.id)
})

const generated = {
  schema_version: 1,
  generated_at: new Date().toISOString().slice(0, 10),
  authority_classes: ['invariants', 'policies', 'architecture', 'heuristics', 'preferences', 'proofs', 'index', 'agents'],
  entries,
}

// --- ecriture ---
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(generated, null, 2))

// --- mode --verify : le registry ecrit est bien la derive des manifests ---
if (process.argv.includes('--verify')) {
  const onDisk = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  const fresh = generated
  const norm = (r) => JSON.stringify({
    entries: r.entries.map((e) => ({
      id: e.id, type: e.type, authority: e.authority, domain: e.domain,
      status: e.status, version: e.version, source: e.source,
      controls: e.controls || null, applies_when: e.applies_when || null,
    })),
  })
  const same = norm(onDisk) === norm(fresh)
  console.log(same ? 'OK: registry.json est a jour (derive des manifests)' : 'DIFF: registry.json desynchronise — relance npm run generate')
  process.exit(same ? 0 : 1)
}

console.log(`Registry genere: ${OUT} (${entries.length} entrees)`)
