#!/bin/bash
# ============================================
# ClawZz Deployment Verification Script
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL=${BACKEND_URL:-"https://clawzz-backend.onrender.com"}
ORCHESTRATOR_URL=${ORCHESTRATOR_URL:-"https://clawzz-orchestrator.onrender.com"}
FRONTEND_URL=${FRONTEND_URL:-"https://clawzz.vercel.app"}

echo "🔍 ClawZz Deployment Verification"
echo "=================================="
echo ""

# Check if URLs are provided
if [ -z "$BACKEND_URL" ] || [ -z "$ORCHESTRATOR_URL" ] || [ -z "$FRONTEND_URL" ]; then
    echo -e "${YELLOW}⚠️  Using default URLs. Set environment variables to override:${NC}"
    echo "   BACKEND_URL, ORCHESTRATOR_URL, FRONTEND_URL"
    echo ""
fi

echo "Testing endpoints:"
echo "  Backend: $BACKEND_URL"
echo "  Orchestrator: $ORCHESTRATOR_URL"
echo "  Frontend: $FRONTEND_URL"
echo ""

# Track failures
FAILED=0

# ============================================
# Function to test endpoint
# ============================================
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Testing $name... "
    
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$HTTP_STATUS" = "$expected_status" ]; then
        echo -e "${GREEN}✓ OK ($HTTP_STATUS)${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED ($HTTP_STATUS)${NC}"
        return 1
    fi
}

# ============================================
# Test Backend
# ============================================
echo "📡 Testing Backend Services"
echo "----------------------------"

test_endpoint "Backend Health" "$BACKEND_URL/health" || FAILED=$((FAILED+1))
test_endpoint "Backend API" "$BACKEND_URL/api/v1" || FAILED=$((FAILED+1))

# Test specific endpoints if available
if curl -s "$BACKEND_URL/api/v1/rooms" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Rooms endpoint accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Rooms endpoint may require auth${NC}"
fi

echo ""

# ============================================
# Test Orchestrator
# ============================================
echo "🤖 Testing Orchestrator Service"
echo "--------------------------------"

test_endpoint "Orchestrator Health" "$ORCHESTRATOR_URL/health" || FAILED=$((FAILED+1))

# Check if orchestrator is responding with correct format
ORCHESTRATOR_HEALTH=$(curl -s "$ORCHESTRATOR_URL/health" 2>/dev/null || echo "{}")
if echo "$ORCHESTRATOR_HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Orchestrator reports healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Orchestrator response: $ORCHESTRATOR_HEALTH${NC}"
fi

echo ""

# ============================================
# Test Frontend
# ============================================
echo "🎨 Testing Frontend"
echo "-------------------"

test_endpoint "Frontend" "$FRONTEND_URL" || FAILED=$((FAILED+1))

# Check if frontend loads properly
FRONTEND_HTML=$(curl -s "$FRONTEND_URL" 2>/dev/null || echo "")
if echo "$FRONTEND_HTML" | grep -q "ClawZz\|clawzz\|React"; then
    echo -e "${GREEN}✓ Frontend content loaded${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend may not be loading correctly${NC}"
fi

echo ""

# ============================================
# Test External Services
# ============================================
echo "🔗 Testing External Integrations"
echo "---------------------------------"

# Test if environment variables are set
if [ -n "$DATABASE_URL" ]; then
    echo -n "Testing Database connection... "
    if psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database connected${NC}"
    else
        echo -e "${RED}✗ Database connection failed${NC}"
        FAILED=$((FAILED+1))
    fi
else
    echo -e "${YELLOW}⚠️  DATABASE_URL not set, skipping database test${NC}"
fi

if [ -n "$REDIS_URL" ]; then
    echo -n "Testing Redis connection... "
    if redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis connected${NC}"
    else
        echo -e "${RED}✗ Redis connection failed${NC}"
        FAILED=$((FAILED+1))
    fi
else
    echo -e "${YELLOW}⚠️  REDIS_URL not set, skipping Redis test${NC}"
fi

if [ -n "$R2_ENDPOINT" ] && [ -n "$R2_ACCESS_KEY_ID" ]; then
    echo -n "Testing R2 Storage... "
    if aws s3 ls "s3://$R2_BUCKET_NAME" --endpoint-url="$R2_ENDPOINT" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ R2 Storage accessible${NC}"
    else
        echo -e "${YELLOW}⚠️  R2 Storage may require configuration${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  R2 credentials not set, skipping storage test${NC}"
fi

echo ""

# ============================================
# Summary
# ============================================
echo "=================================="
echo "📊 Verification Summary"
echo "=================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All systems operational!${NC}"
    echo ""
    echo "Your ClawZz platform is deployed and ready:"
    echo "  🌐 Frontend: $FRONTEND_URL"
    echo "  🔌 Backend API: $BACKEND_URL/api/v1"
    echo "  🤖 Orchestrator: $ORCHESTRATOR_URL"
    echo ""
    exit 0
else
    echo -e "${RED}❌ $FAILED check(s) failed${NC}"
    echo ""
    echo "Please review the errors above and:"
    echo "  1. Check service logs in your hosting dashboard"
    echo "  2. Verify environment variables are set correctly"
    echo "  3. Ensure all services are running"
    echo ""
    exit 1
fi
