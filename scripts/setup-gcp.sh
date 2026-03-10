#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# ==============================================================================
# GCP Ubuntu VM Provisioning Script
# Use this script to prep a brand-new Ubuntu Server for deployment
# ==============================================================================

echo "=========================================================="
echo "🚀 Starting Server Provisioning for Agent API"
echo "=========================================================="

echo "📦 1. Updating System Packages..."
sudo apt-get update
sudo apt-get upgrade -y

echo "🐳 2. Installing Docker Engine..."
# Remove any official old docker installations
sudo apt-get remove -y docker docker-engine docker.io containerd runc || true

# Install dependencies
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker’s official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Compose
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Enable Docker to start on boot
sudo systemctl enable docker
sudo systemctl start docker

# Add current user to the docker group so 'sudo' is not needed for docker cmds
sudo usermod -aG docker $USER
echo "✅ Docker installed and configured."

echo "📂 3. Setting up Deployment Directories..."
sudo mkdir -p /opt/agent-api
sudo chown -R $USER:$USER /opt/agent-api

echo "🔐 4. Instantiating secure .env layout..."
# Create a blank secure .env file with strict permissions
touch /opt/agent-api/.env
chmod 600 /opt/agent-api/.env

cat <<EOF > /opt/agent-api/.env
# Paste your keys in here!
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=us-central1
PORT=3000
ALLOWED_ORIGINS=https://your-frontend-domain.com

# Do NOT include quotation marks unless your variable natively contains spaces
EOF

echo "✅ Environment dummy file seeded."

echo "=========================================================="
echo "🎉 Provisioning Complete!"
echo "=========================================================="
echo ""
echo "⚠️  CRITICAL NEXT STEPS:"
echo "1. Log out and immediately log back in via SSH for Docker permissions to apply."
echo "2. Edit your live environment variables: 'nano /opt/agent-api/.env'"
echo "3. Link this VM to your Github Action Secrets (HOST, USERNAME, SSH_PRIVATE_KEY)."
