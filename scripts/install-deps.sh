#!/bin/bash
echo "📦 Installing ALL dependencies for NeXuS..."
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
for dir in services/*; do
  echo "Installing $dir..."
  cd $dir && npm install && cd ../..
done
echo "✓ All dependencies installed"
