#!/usr/bin/env bash
# cortex-vps-bootstrap.sh — bootstrap idempotent VPS (Ubuntu 24.04)
# Usage: bash cortex-vps-bootstrap.sh   (en root, via SSH clé)
set -euo pipefail

echo "== 1. MAJ base =="
apt-get update -y && apt-get upgrade -y

echo "== 2. Firewall (UFW) =="
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 41641/udp   # Tailscale
ufw --force enable

echo "== 3. Durcissement SSH =="
sed -i 's/^#\?PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
grep -q "AllowUsers root" /etc/ssh/sshd_config || echo "AllowUsers root" >> /etc/ssh/sshd_config
systemctl restart ssh || systemctl restart sshd

echo "== 4. Tailscale =="
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi
# Rejoint la tailnet existante (auth via lien interactif ou tag)
# On lance en arriere-plan car il faut valider dans le navigateur.
tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/run/tailscale/tailscaled.sock &

echo "== 5. Node 24 (pour Hermes) =="
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "== 6. Dossier de la suite =="
mkdir -p /opt/cortex-orchestration
echo "Bootstrap termine. IP locale Tailscale apres 'tailscale up':"
echo "  -> lance 'tailscale up' puis valide le lien dans le navigateur."
