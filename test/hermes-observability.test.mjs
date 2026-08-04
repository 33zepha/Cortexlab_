import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractHermesMissions,
  parseKeyValue,
  redactSecrets,
} from '../server/hermes-observability.mjs'

test('parseKeyValue conserve les valeurs contenant des signes égal', () => {
  assert.deepEqual(
    parseKeyValue('ActiveState=active\nEnvironment=TOKEN=a=b\nMainPID=42\n'),
    {
      ActiveState: 'active',
      Environment: 'TOKEN=a=b',
      MainPID: '42',
    }
  )
})

test('redactSecrets masque les secrets usuels', () => {
  const value = redactSecrets('Authorization: Bearer abc123 api_key=secret-value password=hunter2')
  assert.equal(value.includes('abc123'), false)
  assert.equal(value.includes('secret-value'), false)
  assert.equal(value.includes('hunter2'), false)
  assert.match(value, /\[redacted\]/)
})

test('extractHermesMissions projette une session réelle sans contenu sensible', () => {
  const [mission] = extractHermesMissions({
    sessions: [{
      id: 'session-1',
      title: 'Audit gateway',
      status: 'running',
      model: 'hy3',
      provider: 'nous',
      created_at: '2026-08-04T10:00:00.000Z',
      updated_at: '2026-08-04T10:01:00.000Z',
      progress: 0.4,
      cost: 0.6,
      content: 'ne doit jamais être lu',
    }],
  })

  assert.equal(mission.id, 'hermes_sessions_session-1')
  assert.equal(mission.name, 'Audit gateway')
  assert.equal(mission.status, 'running')
  assert.equal(mission.progress, 40)
  assert.equal(mission.source, 'hermes-state')
  assert.equal(mission.manager.model, 'hy3')
  assert.equal('content' in mission, false)
})

test('extractHermesMissions ignore les tables et lignes sans identité exploitable', () => {
  assert.deepEqual(extractHermesMissions({ messages: [{ id: 1, type: 'assistant' }] }), [])
  assert.deepEqual(extractHermesMissions({ sessions: [{ status: 'running' }] }), [])
})
