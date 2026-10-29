#!/bin/sh
# Opens the job tracker on Linux. Starts the local server first if it isn't running.
cd "$(dirname "$0")"
if ! curl -s -m 1 http://localhost:8765/api/data >/dev/null; then
  nohup python3 app/server.py >/dev/null 2>&1 &
  sleep 2
fi
xdg-open "http://localhost:8765/#today" >/dev/null 2>&1 &
