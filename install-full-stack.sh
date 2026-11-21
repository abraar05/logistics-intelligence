#!/usr/bin/env bash
set -euo pipefail

command -v node >/dev/null || { echo "Node.js 22+ is required."; exit 1; }
command -v pnpm >/dev/null || { echo "pnpm is required."; exit 1; }

node -e 'const major=Number(process.versions.node.split(".")[0]); if (major < 20) { console.error("Node.js 20+ is required; Node 22 is recommended."); process.exit(1); }'

pnpm install
if [[ -n "${DATABASE_URL:-}" ]]; then
  pnpm db:push
else
  echo "DATABASE_URL is empty; skipping database migration. Configure the environment and rerun pnpm db:push before starting production."
fi
pnpm check
pnpm build

echo
echo "Logistics Intelligence is built. Start with: pnpm start"
