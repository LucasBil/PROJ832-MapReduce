@echo off
echo ==============================================
echo MapReduce Visualizer
echo ==============================================

echo [1/2] Starting Node.js Backend Server on port 3001...
start cmd /k "cd web-ui && node backend/server.js"

echo [2/2] Starting Vite React Frontend...
start cmd /k "cd web-ui && npm run dev -- --open"

echo.
echo Both servers are starting in new windows.
echo Please allow a few seconds for the frontend to open in your browser.
echo ==============================================
pause
