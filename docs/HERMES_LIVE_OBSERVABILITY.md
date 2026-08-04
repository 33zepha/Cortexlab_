# Hermes → Cortex Lab : observabilité réelle

Cortex Lab est un cockpit de suivi en lecture seule. Hermes reste l’unique système qui reçoit, lance, découpe et orchestre les missions.

## Sources lues

Le serveur `server/hermes-observability.mjs` interroge uniquement des sources locales en lecture seule :

- `systemctl show hermes-gateway.service`
- `systemctl show hermes-serve.service`
- `journalctl -u hermes-gateway.service`
- `journalctl -u hermes-serve.service`
- `hermes --version`
- `ps` pour les processus Hermes
- `tailscale ip -4` et `tailscale status --json`
- `sqlite3 -readonly ~/.hermes/state.db`
- `ledger/events.ndjson`

Aucune commande reçue depuis le navigateur n’est exécutée. Aucun shell n’est utilisé. `/api/mission` répond volontairement `405`.

## Variables d’environnement

```ini
HERMES_URL=http://100.x.x.x:9119
HERMES_STATE_DB=/root/.hermes/state.db
HERMES_SYSTEMD_SERVICES=hermes-gateway.service,hermes-serve.service
HERMES_JOURNAL_LIMIT=100
CORTEX_SYSTEM_POLL_MS=5000
CORTEX_AGENT_RECENT_MS=900000
```

`HERMES_URL` alimente le bouton **Ouvrir Hermes**. L’adresse Tailscale réelle ne doit pas être commitée dans ce dépôt public.

## Exemple systemd

```ini
[Unit]
Description=Cortex Lab observability cockpit
After=network-online.target hermes-gateway.service hermes-serve.service

[Service]
Type=simple
WorkingDirectory=/opt/cortex-lab
ExecStart=/usr/bin/node server/index.mjs --port 4173
Environment=NODE_ENV=production
Environment=HERMES_URL=http://100.x.x.x:9119
Environment=HERMES_STATE_DB=/root/.hermes/state.db
Environment=HERMES_SYSTEMD_SERVICES=hermes-gateway.service,hermes-serve.service
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

L’utilisateur du service doit pouvoir :

1. lire `~/.hermes/state.db` ;
2. lire les journaux des deux services Hermes ;
3. exécuter `hermes`, `systemctl`, `journalctl`, `sqlite3`, `ps` et `tailscale`.

Pour un utilisateur non-root, l’accès au journal peut nécessiter :

```bash
sudo usermod -aG systemd-journal cortex
```

Puis redémarrer la session ou le service.

## Dépendances à vérifier sur le VPS

```bash
command -v hermes
command -v sqlite3
command -v systemctl
command -v journalctl
command -v tailscale
hermes --version
systemctl show hermes-gateway.service --property=ActiveState,SubState,MainPID,NRestarts
systemctl show hermes-serve.service --property=ActiveState,SubState,MainPID,NRestarts
sqlite3 -readonly ~/.hermes/state.db '.tables'
```

Une source absente ne fait pas tomber le dashboard. Elle apparaît comme indisponible dans `/api/system` et génère un signalement visible.

## Données de `state.db`

Cortex Lab découvre les tables dont le nom évoque des sessions, runs, tâches, missions, événements, messages ou outils. Il ne sélectionne qu’une liste de colonnes non sensibles : identifiants, titres, statuts, agents, modèles, dates, progression, compteurs de tokens, durée et coût.

Les colonnes de contenu, prompts, réponses, secrets, tokens d’authentification et variables d’environnement ne sont jamais lues. Les messages de journaux passent aussi par un masquage de secrets avant d’être envoyés au navigateur.

## API de suivi

- `GET /api/system` : services, CLI, Tailscale, processus, base Hermes, sources et anomalies
- `GET /api/agents` : registre enrichi par la présence runtime réelle
- `GET /api/events` : ledger Cortex + événements opérationnels des journaux Hermes
- `GET /api/missions` : missions du ledger + sessions/runs détectés dans `state.db`
- `GET /api/stream` : flux SSE des changements du ledger et de la santé système
- `POST /api/mission` : désactivé, car les missions sont lancées par Hermes

## Validation

```bash
npm install
npm test

cd web
npm install
npm run build

cd ..
node server/index.mjs --port 4173
```

Ouvrir ensuite Cortex Lab sans `?demo=1`. Le paramètre `?demo=1` reste réservé aux captures reproductibles du workflow GitHub Actions.
