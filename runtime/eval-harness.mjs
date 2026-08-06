function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Évalue une mission à partir de faits vérifiables, sans demander au modèle
 * de s'auto-noter. Le score sert au routage futur, pas à masquer les détails.
 */
export function evaluateMission({ contract, report, durationMs = null }) {
  if (!contract?.id) throw new Error('Eval harness: contrat manquant')
  if (!report?.closure || !Array.isArray(report.controls)) throw new Error('Eval harness: rapport invalide')

  const verifiable = report.controls.filter((control) => control.verifiable)
  const passed = verifiable.filter((control) => !control.violation)
  const evidenceCoverage = contract.expected_evidence.length === 0
    ? 1
    : clamp(verifiable.length / contract.expected_evidence.length)
  const controlPassRate = verifiable.length === 0 ? 0 : passed.length / verifiable.length
  const budgetRatio = report.budget?.limits?.maxCost > 0
    ? clamp(1 - (report.budget.cost / report.budget.limits.maxCost))
    : report.budget?.cost === 0 ? 1 : 0
  const closureScore = report.closure === 'LIVRAISON_AUTONOME'
    ? 1
    : report.closure === 'AVEC_INFORMATION' ? 0.7 : 0

  const score = Math.round((
    controlPassRate * 0.4 +
    evidenceCoverage * 0.25 +
    budgetRatio * 0.15 +
    closureScore * 0.2
  ) * 100)

  return Object.freeze({
    version: 1,
    task_id: contract.id,
    mission: contract.mission,
    score,
    success: report.closure !== 'ESCALADE_HUMAINE',
    metrics: Object.freeze({
      control_pass_rate: Number(controlPassRate.toFixed(3)),
      evidence_coverage: Number(evidenceCoverage.toFixed(3)),
      budget_efficiency: Number(budgetRatio.toFixed(3)),
      violations: verifiable.length - passed.length,
      escalations: report.escalations?.length || 0,
      duration_ms: durationMs,
      cost: report.budget?.cost ?? null,
    }),
  })
}
