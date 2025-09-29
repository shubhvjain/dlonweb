#!/bin/bash

set -e  # Stop on error

echo "Installing core package..."
cd core
npm install
cd ..

echo "Installing backend (Node.js)..."
cd backend
npm install

echo "Installing backend (Python - Poetry)..."
if command -v poetry &> /dev/null
then
  poetry install
else
  echo "Poetry not installed. Skipping Python deps."
fi
cd ..

echo "Installing frontend..."
cd frontend
npm install
cd ..

echo "All installations complete!"
