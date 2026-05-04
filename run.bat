@echo off
echo ==============================================
echo MapReduce Visualizer
echo ==============================================

if not exist "target\dependency" (
    echo [0/3] Fetching Maven dependencies...
    call mvnw.cmd dependency:copy-dependencies
)

echo [0/3] Compiling Java MapReduce Engine...
call mvnw.cmd compile

if not exist "web-ui\node_modules" (
    echo [1/3] Installing Web Dependencies...
    cd web-ui
    call npm install
    cd ..
)

echo [2/3] Starting Node.js Backend Server on port 3001...
start cmd /k "cd web-ui && node backend/server.js"

echo [3/3] Starting Vite React Frontend...
start cmd /k "cd web-ui && npm run dev -- --open"

echo.
echo Both servers are starting in new windows.
echo Please allow a few seconds for the frontend to open in your browser.
echo ==============================================
pause
