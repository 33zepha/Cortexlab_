import test from 'node:test'
import assert from 'node:assert/strict'
import { add } from './buggy.js'

test('add returns sum', () => {
  assert.equal(add(2, 3), 5)
})
