@echo off
rem This script starts both the backend and frontend services for development.

rem Get the directory of this script to run commands from the project root
set SCRIPT_DIR=%~dp0

echo --- Setting up Backend Service ---
cd /d "%SCRIPT_DIR%backend"

rem Check if virtual environment exists, if not create it
if not exist ".venv" (
    echo Creating Python virtual environment...
    python -m venv .venv
)

rem Activate Python virtual environment
call .venv\Scripts\activate.bat

rem Check if requirements are installed
if not exist ".venv\installed.flag" (
    echo Installing Python dependencies...
    pip install -r requirements.txt
    echo. > .venv\installed.flag
)

rem Start Uvicorn server in the background
start "Backend Server" cmd /c ".venv\Scripts\activate.bat && uvicorn main:app --reload"
echo Backend started
echo URL: http://127.0.0.1:8000

rem Wait a moment for backend to start
timeout /t 3 /nobreak >nul

echo.
echo --- Setting up Frontend Service ---
cd /d "%SCRIPT_DIR%frontend"

rem Check if node_modules exists, if not install dependencies
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install
)

echo Starting frontend service...
npm run dev

echo --- Frontend service stopped ---
pause