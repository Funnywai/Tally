#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <backup.sql.gz> [--yes]"
  exit 1
fi

script_dir="$(cd "$(dirname "$0")" && pwd)"
file="$1"
shift

if [ "${1:-}" != "--yes" ]; then
  echo "Refusing to restore without --yes."
  echo "This drops and recreates the public schema in the tally database."
  exit 1
fi

case "$file" in
  /*) ;;
  *) file="$PWD/$file" ;;
esac

if [ ! -f "$file" ]; then
  echo "Backup file not found: $file"
  exit 1
fi

cd "$script_dir/.."

echo "Stopping web..."
docker compose stop web

echo "Dropping and recreating the public schema..."
docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "drop schema public cascade; create schema public;"'

echo "Restoring $file ..."
gunzip -c "$file" | docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction'

echo "Starting web..."
docker compose start web

echo "Restore complete."
echo "Next steps:"
echo "  1. docker compose ps"
echo "  2. curl -fsS https://tally.funnywai.tech/api/health"
echo "  3. Check the ledger in the UI."
