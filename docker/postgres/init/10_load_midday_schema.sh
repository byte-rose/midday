#!/bin/sh
set -e

SOURCE_SQL="/docker-entrypoint-initdb.d/99_schema_source.sql"

if [ ! -f "$SOURCE_SQL" ]; then
  echo "Missing schema source file: $SOURCE_SQL" >&2
  exit 1
fi

# The upstream file is a Drizzle introspection dump wrapped in /* ... */.
# Extract the inner SQL and execute it.
awk '
  BEGIN { in_block = 0 }
  $0 ~ /^\/\*/ { in_block = 1; next }
  $0 ~ /^\*\/$/ { in_block = 0; next }
  in_block { print }
' "$SOURCE_SQL" \
  | sed '/USING btree/ s/"\([^"]\+\)"[[:space:]]\+[A-Za-z0-9_]\+_ops/"\1"/g' \
  | psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"
