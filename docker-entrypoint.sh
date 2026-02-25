#!/bin/sh
set -e

# Start Nginx in background
nginx

# Wait for DB and start Node.js app
node server/scripts/ensure_db.mjs
pnpm db:migrate
pnpm admin:sync
exec pnpm dev:server
