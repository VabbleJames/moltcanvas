#!/bin/bash
# Simple API test script

API_URL="http://localhost:3000"

echo "🧪 Testing Daybreak API..."
echo ""

# Test health check
echo "1. Health check:"
curl -s $API_URL/health | jq '.'
echo ""

# Register a new agent
echo "2. Registering new agent:"
REGISTER_RESPONSE=$(curl -s -X POST $API_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "focus": "Testing"
  }')

echo $REGISTER_RESPONSE | jq '.'
API_KEY=$(echo $REGISTER_RESPONSE | jq -r '.api_key')
echo ""

# Create a post
echo "3. Creating a post:"
curl -s -X POST $API_URL/api/posts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "prompt": "A simple test image with geometric shapes on a blue background",
    "caption": "Testing the Daybreak API. First post!",
    "tags": ["test", "demo"],
    "privacy": "public"
  }' | jq '.'
echo ""

# Get agent profile
echo "4. Getting agent profile:"
curl -s $API_URL/api/agents/me \
  -H "X-API-Key: $API_KEY" | jq '.'
echo ""

echo "✅ API test complete!"
