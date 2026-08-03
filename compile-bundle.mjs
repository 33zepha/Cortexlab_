#!/usr/bin/env node
/**
 * compile-bundle.mjs — Cortex bundle compiler (minimal, js-yaml).
 *
 * Lit registry/registry.json + schemas/*.yaml, filtre par domaine/statut,
 * et produit bundles/<mission>-<hash>.json immuable (hash stable, hors date).
 * Aucun agent ne lit le repo : il recoit uniquement ce bundle.
 *
 * Usage:
 *   node compile-bundle.mjs --mission <id> [--domain frontend] [--query "..."] [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import yaml from 'js-yaml'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const REGISTRY = path.join(ROOT, 'registry', 'registry.generated.json')
const COMPILER_VERSION = 2

// --- args (minimal: --cle=val ou --flag) ---
const argv = new Map()
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a.startsWith('--')) argv.set(a, process.argv[++i] ?? '')
}
const mission = argv.get('--mission') || `m-${Date.now()}`
let domain = argv.get('--domain') || null
if (!domain || domain === 'null' || domain === 'undefined') domain = null
const query = argv.get('--query') || ''
const level = argv.get('--level') || 'standard'
const dryRun = argv.has('--dry-run')

export function loadRegistry(regPath = REGISTRY) {
  return JSON.parse(fs.readFileSync(regPath, 'utf8'))
}

function loadSchema(rel) {
  const [file, anchor] = rel.split('#')
  const abs = path.join(ROOT, file)
  if (!fs.existsSync(abs)) return null
  const doc = yaml.load(fs.readFileSync(abs, 'utf8'))
  if (anchor && Array.isArray(doc?.invariants)) {
    return doc.invariants.find((i) => i.id === anchor) || null
  }
  return doc
}

export function compile({ mission, domain, query, level }) {
  const reg = loadRegistry()
  const entries = reg.entries.filter(
    (e) => (!domain || e.domain === domain) && (!e.status || e.status === 'active')
  )
  const rules = entries.map((e) => {
    const doc = e.type === 'control' ? loadSchema(e.source) : null
    return {
      id: e.id,
      type: e.type,
      authority: e.authority,
      domain: e.domain,
      status: e.status,
      version: e.version || 1,
      source: e.source,
      statement: e.statement || doc?.statement || doc?.description || null,
      check: doc?.check ?? null,
      controls: e.controls || doc?.controls || null,
    }
  })
  const sources = [...new Set(rules.map((r) => r.source))]
  const manifest = {
    mission,
    domain,
    query,
    level,
    compiled_at: new Date().toISOString(),
    compiler_version: COMPILER_VERSION,
    schema_version: reg.schema_version,
    authority_classes: reg.authority_classes,
    sources,
    rule_count: rules.length,
  }
  // hash stable = hors compiled_at -> bundle reproductible
  const hashBase = {
    mission,
    domain,
    sources,
    rules: rules.map((r) => ({ id: r.id, authority: r.authority, version: r.version, source: r.source })),
  }
  const hash = crypto.createHash('sha1').update(JSON.stringify(hashBase)).digest('hex').slice(0, 12)
  return { bundle: { manifest, rules }, hash, outPath: path.join(ROOT, 'bundles', `${mission}-${hash}.json`) }
}

// --- CLI (uniquement si lancé directement, pas à l'import) ---
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
const { bundle, hash, outPath } = compile({ mission, domain, query, level })
if (dryRun) {
  console.log(JSON.stringify(bundle, null, 2))
  console.log(`\n[DRY-RUN] aurait ecrit: ${outPath} (${bundle.rules.length} regle(s))`)
} else {
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2))
  console.log(`Bundle: ${outPath}`)
  console.log(`Hash: ${hash} | Rules: ${bundle.rules.length} | Domain: ${domain || 'all'}`)
  for (const r of bundle.rules) console.log(`  - [${r.authority}] ${r.id} (v${r.version}) ${r.type}`)
}
}
