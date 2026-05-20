#!/bin/bash
# StockPulse Production Deployment Script
# Run this on your VPS after SSHing in and uploading the project

set -e

DOMAIN="stockpulse.news"
EMAIL="${1:-admin@$DOMAIN}"

echo "=== StockPulse Deployment Script ==="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please create .env from .env.example and fill in your API keys"
    echo ""
    echo "Required variables:"
    echo "  ANTHROPIC_API_KEY=sk-ant-..."
    echo "  SUPABASE_URL=https://xxx.supabase.co"
    echo "  SUPABASE_ANON_KEY=eyJ..."
    echo ""
    exit 1
fi

# Create required directories
mkdir -p certbot/conf certbot/www

# Check if SSL certificates already exist
if [ -d "certbot/conf/live/$DOMAIN" ]; then
    echo "SSL certificates found. Starting full stack..."
    docker compose -f docker-compose.prod.yml up -d --build
    echo ""
    echo "=== Deployment Complete ==="
    echo "Your site is live at: https://$DOMAIN"
    echo "To view logs: docker compose -f docker-compose.prod.yml logs -f"
    exit 0
fi

echo "Step 1: Starting app and nginx (HTTP only for initial setup)..."

# Use init config for first run (HTTP only, no SSL)
cp nginx/conf.d/init.conf nginx/conf.d/active.conf

# Create temporary compose override for initial setup
cat > docker-compose.init.yml << 'EOF'
services:
  app:
    build: .
    restart: unless-stopped
    env_file:
      - .env
    expose:
      - "8000"

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d/active.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - app
EOF

docker compose -f docker-compose.init.yml up -d --build

echo "Waiting for services to start..."
sleep 15

# Test if app is responding
if curl -s http://localhost/health | grep -q "ok"; then
    echo "App is responding!"
else
    echo "WARNING: App health check failed, but continuing..."
fi

echo ""
echo "Step 2: Obtaining SSL certificate from Let's Encrypt..."
docker run --rm \
    -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
    -v "$(pwd)/certbot/www:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

echo ""
echo "Step 3: Switching to HTTPS configuration..."
docker compose -f docker-compose.init.yml down

# Clean up init files
rm -f nginx/conf.d/active.conf docker-compose.init.yml

echo ""
echo "Step 4: Starting full production stack with SSL..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Your site is live at: https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  View logs:     docker compose -f docker-compose.prod.yml logs -f"
echo "  Restart:       docker compose -f docker-compose.prod.yml restart"
echo "  Stop:          docker compose -f docker-compose.prod.yml down"
echo "  Rebuild:       docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "n8n dashboard: http://$DOMAIN:5678"

echo ""
echo "Step 5: Prefetching stock data..."
curl -X POST "https://stockpulse.news/api/v1/internal/prefetch-stocks" -H "X-Webhook-Secret: stockpulse-webhook-secret" -H "Content-Type: application/json"                                                                                  
echo ""
echo "Prefetch request sent. Check logs for progress."