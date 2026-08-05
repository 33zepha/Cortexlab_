/**
 * worktree-manager.mjs — isolated worktrees under .cortex/worktrees only.
 * Existing path is refused (no silent reuse).
 */
import fs from 'node:fs'
import path from 'node:path'
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
