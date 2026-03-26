#!/bin/bash
echo "Starting Personal Library..."

# Install backend deps
cd backend
if [ ! -d "node_modules" ]; then
  echo "Installing backend dependencies..."
  npm install
fi

# Start backend in background
npm start &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Install frontend deps
cd ../frontend
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

# Start frontend
echo "Starting frontend..."
npm start

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
