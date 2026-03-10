#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# ==============================================================================
# GCP Nginx & SSL Provisioning Script
# Run this on your GCP VM AFTER you have pointed your DNS A Record to the VM IP!
# ==============================================================================

if [ -z "$1" ]; then
  echo "❌ Error: You must provide your subdomain as an argument."
  echo "Usage: bash setup-nginx.sh api.yourdomain.com"
  exit 1
fi

DOMAIN=$1

echo "=========================================================="
echo "🔒 Starting Nginx & SSL Provisioning for $DOMAIN"
echo "=========================================================="

echo "📦 1. Updating System Packages & Installing Nginx/Certbot..."
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "⚙️  2. Configuring Nginx Reverse Proxy..."
# Create an Nginx configuration specifically tailored for our Node.js & WebSocket backend
sudo cat > /etc/nginx/sites-available/agent-api <<EOF
server {
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        
        # Standard Proxy Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket Support Headers! CRITICAL FOR agent-api
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        proxy_read_timeout 86400; # Prevent websocket from dropping under heavy load
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/agent-api /etc/nginx/sites-enabled/

# Remove the default nginx catch-all site to prevent conflicts
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration for syntax errors
echo "🔍 Testing Nginx Configuration..."
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

echo "✅ Nginx is now actively forwarding traffic for $DOMAIN to port 3000."

echo "🔐 3. Acquiring SSL Certificate from Let's Encrypt..."
echo "Certbot will now attempt to secure your domain."
echo "⚠️ IMPORTANT: If your DNS A Record hasn't propagated to this VM's IP yet, this will fail!"

sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN || {
    echo "⚠️ Certbot automatic generation failed. This usually means your DNS hasn't propagated."
    echo "You can try again manually in a few minutes by running:"
    echo "sudo certbot --nginx -d $DOMAIN"
    exit 1
}

echo "=========================================================="
echo "🎉 SSL Configuration Complete!"
echo "Your backend is now securely accessible at https://$DOMAIN"
echo "and WebSockets will connect seamlessly via wss://$DOMAIN"
echo "=========================================================="
