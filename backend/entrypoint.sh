#!/bin/sh
# Entrypoint for container: write Google service account JSON (if provided)
# and start the Flask server.

set -e

if [ -n "$GOOGLE_SERVICE_ACCOUNT_JSON" ]; then
  echo "Writing Google service account JSON to /app/google_creds.json"
  printf "%s" "$GOOGLE_SERVICE_ACCOUNT_JSON" > /app/google_creds.json
  export GOOGLE_APPLICATION_CREDENTIALS=/app/google_creds.json
fi

# If a local .env exists (for local dev), load it
if [ -f "/app/backend/.env" ]; then
  echo "Loading local .env"
  # shellcheck disable=SC1091
  . /app/backend/.env
fi

# Start the backend server
exec python backend/run_server.py
