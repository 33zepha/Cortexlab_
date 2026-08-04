#!/usr/bin/env node
import { getHermesObservability } from '../server/hermes-observability.mjs'

const snapshot = await getHermesObservability({ force: true })
const report = {
  generated_at: snapshot.generated_at,
  read_only: snapshot.read_only,
  hermes: snapshot.hermes,
  services: snapshot.services,
  sources: snapshot.sources,
  tailscale: snapshot.tailscale,
  database: snapshot.database,
  process_count: snapshot.processes?.items?.length || 0,
  observed_events: snapshot.events?.length || 0,
  observed_missions: snapshot.missions?.length || 0,
  issues: snapshot.issues,
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

const critical = snapshot.services.some((service) => service.available && !service.active)
const noSources = snapshot.sources.every((source) => !source.available)
if (critical || noSources) process.exitCode = 1
