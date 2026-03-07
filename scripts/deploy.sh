#!/bin/bash
set -e

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm ci

echo "Running migrations..."
npx prisma migrate deploy

echo "Building..."
npm run build

echo "Restarting services..."
pm2 restart ecosystem.config.js

echo "Deployment complete!"
