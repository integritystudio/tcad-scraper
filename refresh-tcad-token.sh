#!/bin/bash

# Script to refresh TCAD API token automatically
# The token expires every 5 minutes, so this should be run periodically

echo "🔄 Refreshing TCAD API token..."

# Fetch new token from API
RESPONSE=$(curl -s -X POST 'https://prod-container.trueprodigyapi.com/trueprodigy/cadpublic/auth/token' \
  -H 'Content-Type: application/json' \
  -d '{"office":"Travis"}')

# Extract token from JSON response using jq
NEW_TOKEN=$(echo "$RESPONSE" | jq -r '.user.token // empty')

if [ -z "$NEW_TOKEN" ]; then
  echo "❌ Failed to fetch new token"
  echo "Response: $RESPONSE"
  exit 1
fi

# Update Doppler
echo "📝 Updating Doppler..."
doppler secrets set TCAD_API_KEY="$NEW_TOKEN" --silent

# Update ~/.env file
echo "📝 Updating ~/.env..."
if [ -f ~/.env ]; then
  # Update existing key or add if not present
  if grep -q "^TCAD_API_KEY=" ~/.env; then
    sed -i "s|^TCAD_API_KEY=.*|TCAD_API_KEY=$NEW_TOKEN|" ~/.env
  else
    echo "TCAD_API_KEY=$NEW_TOKEN" >> ~/.env
  fi
else
  echo "TCAD_API_KEY=$NEW_TOKEN" > ~/.env
fi

# Decode JWT to show expiration time
EXP_TIMESTAMP=$(echo "$NEW_TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | grep -o '"exp":[0-9]*' | cut -d':' -f2)
if [ ! -z "$EXP_TIMESTAMP" ]; then
  EXP_TIME=$(date -d "@$EXP_TIMESTAMP" '+%Y-%m-%d %H:%M:%S' 2>/dev/null)
  echo "✅ Token refreshed successfully"
  echo "   Expires at: $EXP_TIME (in 5 minutes)"
else
  echo "✅ Token refreshed successfully"
  echo "   Token: ${NEW_TOKEN:0:50}..."
fi

echo ""
echo "💡 Tip: Run this script every 4 minutes to keep token fresh"
echo "   Example cron: */4 * * * * /home/aledlie/tcad-scraper/refresh-tcad-token.sh"
