#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
DB_FILE="$BACKEND_DIR/data/database.json"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js 18+ es requerido" >&2
  exit 1
fi

mkdir -p "$(dirname "$DB_FILE")"
if [ ! -f "$DB_FILE" ]; then
  echo "Creando base de datos inicial..."
  (cd "$BACKEND_DIR" && node - <<'NODE'
import { resetDatabase } from './src/lib/db.js';
await resetDatabase();
console.log('Base de datos inicial generada');
NODE
  )
fi

echo "Instalación completada."
echo "Ejecute:"
echo "  cd backend && node src/server.js"
echo "  node backend/src/tests/run-tests.js"
