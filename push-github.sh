#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

REMOTE_URL="https://github.com/dsicola88/bazardobie.git"
echo "Repo remota: ${REMOTE_URL}"
echo ""
echo "Se ainda não criou o repositório:"
echo "  • Abra: https://github.com/new?name=bazardobie"
echo "  • Nome: bazardobie — deixe vazio (sem README, sem .gitignore do GitHub)"
echo ""

if [[ "$(uname -s)" == "Darwin" ]]; then
  open "https://github.com/new?name=bazardobie" 2>/dev/null || true
fi

exec git push -u origin main
