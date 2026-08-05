/**
 * evidence-collector.mjs — preuves indépendantes du texte modèle.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

function run(cmd, args, cwd, timeout = 30000) {
  try {
    const out = execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      timeout,
      maxBuffer: 2 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true, stdout: out, stderr: '', code: 0 }
  } catch (e) {
    return {
      ok: false,
      stdout: e.stdout?.toString?.() || '',
      stderr: e.stderr?.toString?.() || String(e.message || e),
      code: e.status ?? 1,
    }
  }
}

export function redactText(s = '') {
  return String(s)
    .replace(/sk-[a-zA-Z0-9]{10,}/g, 'sk-REDACTED')
    .replace(/ghp_[a-zA-Z0-9]{10,}/g, 'ghp_REDACTED')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer REDACTED')
    .replace(/api[_-]?key["'\s:=]+[A-Za-z0-9._-]+/gi, 'api_key=REDACTED')
}

export function collectGitEvidence(workspace) {
  if (!fs.existsSync(path.join(workspace, '.git'))) {
    return {
      git_status_porcelain: '',
      git_diff_stat: '',
      git_diff: '',
      changed_files: [],
      untracked_files: [],
      file_content_hashes: {},
      git_skipped: 'no_git_in_workspace',
    }
  }
  const status = run('git', ['status', '--porcelain', '-uall'], workspace)
  const diffStat = run('git', ['diff', '--stat'], workspace)
  const diff = run('git', ['diff'], workspace)
  const lines = (status.stdout || '').split('\n').map((l) => l.trimEnd()).filter(Boolean)
  const changed = []
  const untracked = []
  const hashes = {}
  for (const line of lines) {
    let rel = line.slice(3)
    if (rel.includes(' -> ')) rel = rel.split(' -> ').pop()
    rel = rel.replace(/^"|"$/g, '')
    changed.push(rel)
    if (line.startsWith('??')) untracked.push(rel)
    const abs = path.join(workspace, rel)
    try {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        hashes[rel] = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex')
      }
    } catch {
      /* skip */
    }
  }
  // also include untracked file bodies in a bounded dump for evidence
  let untracked_dump = ''
  for (const rel of untracked.slice(0, 20)) {
    const abs = path.join(workspace, rel)
    try {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        const body = fs.readFileSync(abs, 'utf8')
        untracked_dump += `\n===== ${rel} =====\n${body.slice(0, 50000)}\n`
      }
    } catch {
      /* skip */
    }
  }
  return {
    git_status_porcelain: redactText(status.stdout),
    git_diff_stat: redactText(diffStat.stdout),
    git_diff: redactText(diff.stdout).slice(0, 200000),
    changed_files: changed,
    untracked_files: untracked,
    file_content_hashes: hashes,
    untracked_dump: redactText(untracked_dump).slice(0, 100000),
  }
}

export function runTests(workspace, testCommand = null) {
  if (!testCommand) {
    if (fs.existsSync(path.join(workspace, 'package.json'))) {
      const r = run('npm', ['test'], workspace, 120000)
      return {
        command: 'npm test',
        ok: r.ok,
        code: r.code,
        stdout_redacted: redactText(r.stdout).slice(0, 50000),
        stderr_redacted: redactText(r.stderr).slice(0, 20000),
      }
    }
    return { command: null, ok: null, skipped: true }
  }
  const [cmd, ...args] = testCommand
  const r = run(cmd, args, workspace, 120000)
  const out = `${r.stdout || ''}\n${r.stderr || ''}`
  // node --test may be nested under a parent runner; prefer TAP fail markers + exit code
  const tapFailed = /\nnot ok \d+/m.test(out) || /# fail [1-9]/m.test(out)
  const tapPassed = /# fail 0\b/m.test(out) || (/\nok \d+/m.test(out) && !tapFailed)
  const ok = r.ok && !tapFailed && (tapPassed || r.code === 0)
  return {
    command: testCommand.join(' '),
    ok,
    code: r.code,
    stdout_redacted: redactText(r.stdout).slice(0, 50000),
    stderr_redacted: redactText(r.stderr).slice(0, 20000),
  }
}

export function buildEvidenceBundle({
  plan,
  assignment,
  workspace,
  adapterResult,
  testsBefore,
  testsAfter,
  baseSha,
}) {
  const git = collectGitEvidence(workspace)
  return {
    plan_hash: plan.metadata?.plan_hash,
    mission_id: plan.mission?.id,
    session_id: assignment.session_id,
    agent_role_id: assignment.agent_role_id,
    base_sha: baseSha || null,
    model_requested: assignment.model?.variant,
    model_applied: adapterResult?.model_applied ?? null,
    effort_requested: assignment.effort?.requested,
    effort_canonical: assignment.effort?.canonical,
    effort_provider_applied: adapterResult?.effort_applied ?? assignment.effort?.provider,
    adapter_status: adapterResult?.status,
    adapter_exit_code: adapterResult?.exit_code,
    duration_ms: adapterResult?.duration_ms,
    argv: adapterResult?.argv || [],
    stdout_redacted: adapterResult?.stdout_redacted || '',
    stderr_redacted: adapterResult?.stderr_redacted || '',
    ...git,
    tests_before: testsBefore || null,
    tests_after: testsAfter || null,
    model_declared_result: adapterResult?.parsed || null,
    independent: true,
  }
}

export function recommendClosure(evidence) {
  const testsOk = evidence.tests_after?.ok === true
  const adapterOk = evidence.adapter_status === 'completed'
  const hasDiff = (evidence.changed_files || []).length > 0 || !!(evidence.git_diff || '').trim()
  if (adapterOk && testsOk) {
    return {
      recommendation: 'LIVRAISON_AUTONOME_CANDIDATE',
      reasons: ['adapter_completed', 'tests_green_after'],
      note: 'Hermes decides closure — runner never closes',
    }
  }
  if (adapterOk && hasDiff && evidence.tests_after?.skipped) {
    return {
      recommendation: 'AVEC_INFORMATION',
      reasons: ['adapter_completed', 'tests_not_run'],
      note: 'Hermes decides closure',
    }
  }
  return {
    recommendation: 'ESCALADE_HUMAINE',
    reasons: [
      !adapterOk ? 'adapter_not_completed' : null,
      evidence.tests_after && !testsOk ? 'tests_red_after' : null,
    ].filter(Boolean),
    note: 'Hermes decides closure',
  }
}
