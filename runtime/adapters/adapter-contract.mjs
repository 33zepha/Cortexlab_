/**
 * adapter-contract.mjs — interface commune adapters (pas d'exécution ici).
 */
export const ADAPTER_IDS = {
  CLAUDE_CODE: 'claude_code_subscription',
  FAKE: 'fake_test_adapter',
}

/**
 * @typedef {object} AdapterPreflight
 * @property {boolean} ok
 * @property {string} [reason]
 * @property {object} [details]
 */

/**
 * @typedef {object} AdapterResult
 * @property {'completed'|'failed'|'blocked'|'timeout'} status
 * @property {number} exit_code
 * @property {string} stdout_redacted
 * @property {string} stderr_redacted
 * @property {number} duration_ms
 * @property {string} model_requested
 * @property {string|null} model_applied
 * @property {string} effort_requested
 * @property {string|null} effort_applied
 * @property {string[]} argv
 * @property {object|null} parsed
 */
