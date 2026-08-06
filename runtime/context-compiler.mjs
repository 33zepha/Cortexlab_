function estimateTokens(value) {
  return Math.ceil(JSON.stringify(value).length / 4)
}

/**
 * Produit un context pack minimal et traçable pour un agent donné.
 * Aucun historique de chat brut: seulement contrat, mandat, règles utiles,
 * artefacts explicitement fournis et résumé borné.
 */
export function compileContextPack({ contract, bundle, assignment = null, artifacts = [], summary = null, tokenBudget = 4000 }) {
  if (!contract?.id) throw new Error('Context compiler: contrat manquant')
  if (!bundle?.manifest || !Array.isArray(bundle.rules)) throw new Error('Context compiler: bundle invalide')

  const relevantRuleIds = new Set(assignment?.ruleIds || (assignment?.rule ? [assignment.rule] : []))
  const relevantRules = relevantRuleIds.size
    ? bundle.rules.filter((rule) => relevantRuleIds.has(rule.id))
    : bundle.rules

  const pack = {
    version: 1,
    task: {
      id: contract.id,
      mission: contract.mission,
      objective: contract.objective,
      domain: contract.domain,
      constraints: contract.constraints,
      permissions: contract.permissions,
      risk: contract.risk,
      expected_evidence: contract.expected_evidence,
    },
    assignment: assignment ? {
      agent: assignment.agent || assignment.id || null,
      mandate: assignment.mandate || null,
      rule_ids: [...relevantRuleIds],
    } : null,
    rules: relevantRules,
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id || artifact.path || null,
      type: artifact.type || 'unknown',
      path: artifact.path || null,
      digest: artifact.digest || null,
    })),
    summary: summary || null,
  }

  const estimatedTokens = estimateTokens(pack)
  if (estimatedTokens > tokenBudget) {
    throw new Error(`Context compiler: budget dépassé (${estimatedTokens} > ${tokenBudget} tokens estimés)`)
  }

  return Object.freeze({
    ...pack,
    meta: Object.freeze({
      estimated_tokens: estimatedTokens,
      token_budget: tokenBudget,
      rule_count: relevantRules.length,
      artifact_count: artifacts.length,
    }),
  })
}
