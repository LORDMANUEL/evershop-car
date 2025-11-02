#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

if ! command -v psql >/dev/null 2>&1; then
  echo "Instalando PostgreSQL..."
  sudo apt-get update && sudo apt-get install -y postgresql
fi

if ! id -u postgres >/dev/null 2>&1; then
  echo "El usuario postgres no existe. Verifique la instalación de PostgreSQL." >&2
  exit 1
fi

DB_NAME="tallerdb"
DB_USER="talleruser"
DB_PASSWORD="tallerpass"

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

cd "$BACKEND_DIR"
cp -n .env.example .env || true
sed -i "s|postgresql://talleruser:password@localhost:5432/tallerdb|postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME|" .env

npm install
npx prisma generate
npx prisma db push
npm run seed || true

cd "$FRONTEND_DIR"
npm install
npm run build

echo "Instalación completada. Ejecute 'cd backend && npm run dev' para iniciar la API y 'cd frontend && npm run dev' para la SPA."
