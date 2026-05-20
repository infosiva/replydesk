#!/bin/bash
# Server Setup Script - Run this FIRST on a fresh Ubuntu/Debian VPS
# Usage: curl -fsSL <url>/setup-server.sh | bash

set -e

echo "=== StockPulse Server Setup ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash setup-server.sh"
    exit 1
fi

echo "Updating system packages..."
apt update && apt upgrade -y

echo ""
echo "Installing Docker..."
apt install -y ca-certificates curl gnupg

# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
systemctl enable docker
systemctl start docker

echo ""
echo "Installing additional tools..."
apt install -y git curl unzip

echo ""
echo "Creating app directory..."
mkdir -p /opt/stockpulse

echo ""
echo "=== Server Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Upload your project to /opt/stockpulse"
echo "  2. Create .env file with your API keys"
echo "  3. Run: cd /opt/stockpulse && bash deploy.sh"
echo ""
