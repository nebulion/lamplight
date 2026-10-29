@echo off
rem Opens the job tracker. Starts the local server first if it isn't running.
cd /d "%~dp0"
powershell -NoProfile -Command "try { Invoke-WebRequest http://localhost:8765/api/data -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "" pythonw app\server.py
  ping -n 3 127.0.0.1 >nul
)
start "" http://localhost:8765/#today
