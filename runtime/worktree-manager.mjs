/**
 * worktree-manager.mjs — isolated worktrees + workspace state hash.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..')
const WT_ROOT = path.join(ROOT, '.cortex', 'worktrees')

export function resolveWorktreePath(missionId, sessionId) {
  const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '_')
  const p = path.resolve(WT_ROOT, safe(missionId), safe(sessionId))
  if (!p.startsWith(WT_ROOT + path.sep)) {
    throw new Error('worktree_path_escape')
  }
  if (p.includes('..')) throw new Error('worktree_dotdot')
  return p
}

export function createWorktree({ missionId, sessionId, baseRef = 'HEAD', repoRoot = ROOT }) {
  const dest = resolveWorktreePath(missionId, sessionId)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  if (fs.existsSync(dest)) {
    const err = new Error('worktree_already_exists')
    err.code = 'WORKTREE_EXISTS'
    err.path = dest
    throw err
  }
  execFileSync('git', ['worktree', 'add', '--detach', dest, baseRef], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assertNoEscapingSymlinks(dest)
  return { path: dest, created: true, baseRef }
}

export function assertNoEscapingSymlinks(root) {
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isSymbolicLink()) {
        const real = fs.realpathSync(full)
        if (!real.startsWith(root)) throw new Error(`symlink_escape:${full}`)
      } else if (ent.isDirectory()) walk(full)
    }
  }
  walk(root)
}

export function removeWorktree(dest, { repoRoot = ROOT, force = false } = {}) {
  const resolved = path.resolve(dest)
  if (!resolved.startsWith(WT_ROOT + path.sep)) throw new Error('refuse_remove_outside')
  if (!force) throw new Error('remove_requires_force')
  try {
    execFileSync('git', ['worktree', 'remove', '--force', resolved], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    fs.rmSync(resolved, { recursive: true, force: true })
  }
}

export function getWorktreeRoot() {
  return WT_ROOT
}

function sh(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (e) {
    return (e.stdout?.toString?.() || '').trim()
  }
}

/**
 * Deterministic workspace state fingerprint for resume gates.
 * Includes HEAD, porcelain status (with untracked), and content hashes of dirty paths.
 */
export function computeWorkspaceStateHash(workspace) {
  if (!workspace || !fs.existsSync(workspace)) {
    throw new Error('workspace_missing')
  }
  const head = sh('git', ['rev-parse', 'HEAD'], workspace)
  const porcelain = sh('git', ['status', '--porcelain', '-uall'], workspace)
  const lines = porcelain.split('\n').filter(Boolean)
  const fileEntries = []
  for (const line of lines) {
    // XY path  or  XY old -> new
    let rel = line.slice(3)
    if (rel.includes(' -> ')) rel = rel.split(' -> ').pop()
    rel = rel.replace(/^"|"$/g, '')
    const abs = path.join(workspace, rel)
    let digest = 'missing'
    try {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        digest = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex')
      } else if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
        digest = 'dir'
      }
    } catch {
      digest = 'error'
    }
    fileEntries.push(`${line}\t${digest}`)
  }
  fileEntries.sort()
  const payload = [`head=${head}`, `status_lines=${lines.length}`, ...fileEntries].join('\n')
  const hash = crypto.createHash('sha256').update(payload).digest('hex')
  return {
    workspace_state_hash: hash,
    head,
    porcelain,
    dirty_paths: lines.map((l) => {
      let rel = l.slice(3)
      if (rel.includes(' -> ')) rel = rel.split(' -> ').pop()
      return rel.replace(/^"|"$/g, '')
    }),
    payload_preview: payload.slice(0, 2000),
  }
}

export function assertWorkspaceState(workspace, expectedHash) {
  const live = computeWorkspaceStateHash(workspace)
  if (live.workspace_state_hash !== expectedHash) {
    const err = new Error('workspace_state_hash_mismatch')
    err.code = 'WORKSPACE_STATE_MISMATCH'
    err.live = live.workspace_state_hash
    err.expected = expectedHash
    err.details = live
    throw err
  }
  return live
}
