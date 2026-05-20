#!/bin/bash
set -e

# Configuration
VPS_HOST="root@31.97.56.148"
VPS_PATH="/opt/stockpulse"
LOCAL_PATH="/Users/sivaprakasam/projects/agents/sharemarket-ai-assistant/"

echo "Deploying StockPulse to VPS..."

# Step 1: Sync files to VPS
echo "Syncing files..."
rsync -avz --exclude={'.git','__pycache__','.env','venv','.venv','.pytest_cache','.ruff_cache','.claude'} \
    "$LOCAL_PATH" "$VPS_HOST:$VPS_PATH/"

# Step 2: Build and restart containers
echo "Building and restarting Docker containers..."
ssh "$VPS_HOST" "cd $VPS_PATH && docker compose -f docker-compose.prod.yml up -d --build"

echo "Deployment complete!"
echo "Site: https://stockpulse.news"
