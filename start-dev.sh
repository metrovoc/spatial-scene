#!/bin/bash

# This script starts both the backend and frontend services for development.

# Exit immediately if a command exits with a non-zero status.
set -e

# Get the directory of this script to run commands from the project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "--- Starting Backend Service ---"
cd "$SCRIPT_DIR/backend"

# Activate Python virtual environment
source .venv/bin/activate

# Start Uvicorn server in the background
uvicorn main:app --reload &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"
echo "URL: http://127.0.0.1:8000"


# Add a trap to kill the backend process when the script exits
trap "echo '--- Stopping Backend Service ---'; kill $BACKEND_PID" EXIT


echo ""
echo "--- Starting Frontend Service ---"
cd "$SCRIPT_DIR/frontend"
npm run dev

echo "--- Frontend service stopped ---" 