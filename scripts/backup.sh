#!/usr/bin/env bash
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."
mkdir -p backups

timestamp="$(TZ=Asia/Hong_Kong date +%Y%m%d-%H%M%S)"
file="backups/tally-${timestamp}.sql.gz"

docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' \
  | gzip > "$file"

kept=0
while IFS= read -r old; do
  kept=$((kept + 1))
  if [ "$kept" -gt 14 ]; then
    rm -f "$old"
  fi
done < <(ls -1t backups/tally-*.sql.gz)

echo "backup written: $file"
