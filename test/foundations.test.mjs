import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTaskContract, validateTaskContract } from '../runtime/task-contract.mjs'
import { compileContextPack } from '../runtime/context-compiler.mjs'
import { evaluateMission } from '../runtime/eval-harness.mjs'

const bundle = {
  manifest: { mission: 'foundation-test', domain: 'runtime' },
  rules: [
    { id: 'CTRL-ONE', type: 'control', check: { type: 'grep' } },
    { id: 'INV-ONE', type: 'invariant' },
  ],
}

test('task contract normalise et fige la mission', () => {
  const contract = createTaskContract(bundle, {
    target: '/tmp/workspace',
    objective: 'Valider les fondations',
    permissions: ['read', 'read'],
    constraints: ['no-network'],
    budget: { maxCost: 2 },
  })
  assert.equal(validateTaskContract(contract).valid, true)
  assert.equal(contract.mission, 'foundation-test')
  assert.equal(contract.budget.maxCost, 2)
  assert.deepEqual(contract.permissions, ['read'])
  assert.ok(contract.expected_evidence.includes('CTRL-ONE'))
  assert.equal(Object.isFrozen(contract), true)
})

test('context compiler limite les règles au mandat', () => {
  const contract = createTaskContract(bundle)
  const context = compileContextPack({
    contract,
    bundle,
    assignment: { agent: 'reviewer', ruleIds: ['CTRL-ONE'] },
    tokenBudget: 1000,
  })
  assert.equal(context.rules.length, 1)
  assert.equal(context.rules[0].id, 'CTRL-ONE')
  assert.equal(context.assignment.agent, 'reviewer')
  assert.ok(context.meta.estimated_tokens > 0)
})

test('context compiler refuse un pack hors budget', () => {
  const contract = createTaskContract(bundle)
  assert.throws(
    () => compileContextPack({ contract, bundle, summary: 'x'.repeat(1000), tokenBudget: 10 }),
    /budget dépassé/
  )
})

test('eval harness calcule un score factuel', () => {
  const contract = createTaskContract(bundle)
  const evaluation = evaluateMission({
    contract,
    report: {
      closure: 'LIVRAISON_AUTONOME',
      controls: [{ id: 'CTRL-ONE', verifiable: true, violation: false }],
      escalations: [],
      budget: { cost: 0.2, limits: { maxCost: 1 } },
    },
    durationMs: 42,
  })
  assert.equal(evaluation.success, true)
  assert.equal(evaluation.metrics.violations, 0)
  assert.equal(evaluation.metrics.duration_ms, 42)
  assert.ok(evaluation.score >= 80)
})
