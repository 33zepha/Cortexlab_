/**
 * event-store.mjs — ledger append-only du runtime Cortex.
 *
 * Chaque fait important (debut de mission, check applique, closure) devient
 * une ligne NDJSON horodatee. Les lignes sont chainees par hash (chaque
 * event inclut le hash du precedent) -> tampering detectable.
 *
 * C'est le socle d'observabilite : un dashboard pourra lire ce flux en direct
 * pour "voir" les agents/IA travailler, meme si aujourd'hui seul le CoS
 * emet des evenements.
 *
 * Usage:
 *   const store = new EventStore(path)
 *   store.emit('mission.start', { mission, domain })
 *   store.close()
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

function hashOf(payload, prev) {
  return crypto
    .createHash('sha256')
    .update((prev || '') + '|' + JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16)
}

export class EventStore {
  constructor(filePath, { fd = null } = {}) {
    this.filePath = filePath
    this.prevHash = null
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    // si le fichier existe, on repart du dernier hash pour prolonger la chaine
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean)
      if (lines.length) {
        try {
          this.prevHash = JSON.parse(lines[lines.length - 1]).hash
        } catch {
          this.prevHash = null
        }
      }
    }
    this.stream = fd != null ? fd : fs.openSync(filePath, 'a')
  }

  /** Émet un événement. `type` court, `data` libre. */
  emit(type, data = {}) {
    const ts = new Date().toISOString()
    const payload = { ts, type, data }
    const hash = hashOf(payload, this.prevHash)
    const event = { ...payload, prev: this.prevHash, hash }
    const line = JSON.stringify(event) + '\n'
    fs.writeSync(this.stream, line)
    this.prevHash = hash
    return event
  }

  close() {
    if (typeof this.stream === 'number') fs.closeSync(this.stream)
  }
}

/** Lis tous les events (pour dashboard / audit). */
export function readEvents(filePath) {
  if (!fs.existsSync(filePath)) return []
  return fs
    .readFileSync(filePath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

/** Verifie l'intégrité de la chaine (retourne true si aucune ligne n'a ete alteree). */
export function verifyChain(events) {
  let prev = null
  for (const e of events) {
    const payload = { ts: e.ts, type: e.type, data: e.data }
    const expected = hashOf(payload, prev)
    if (expected !== e.hash) return false
    prev = e.hash
  }
  return true
}
