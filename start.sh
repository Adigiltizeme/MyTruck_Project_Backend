#!/bin/sh
echo "🔧 Deploying database schema..."
npx prisma db push
echo "🚀 Starting application..."
npm run start:prod