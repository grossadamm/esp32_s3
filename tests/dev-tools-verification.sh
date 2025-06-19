#!/bin/bash

# Dev Tools MCP Project Verification Tests using curl
# Usage: ./tests/dev-tools-verification.sh

BASE_URL="http://localhost:3000"
TEXT_ENDPOINT="$BASE_URL/api/text"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

send_text_query() {
    local query="$1"
    local test_name="$2"
    local should_fail_on_error="$3"
    
    echo -e "\n${BLUE}🔍 $test_name${NC}"
    echo -e "Query: \"$query\""
    
    # Escape quotes in the query for JSON
    escaped_query=$(echo "$query" | sed 's/"/\\"/g')
    
    response=$(curl -s -X POST "$TEXT_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$escaped_query\"}" \
        --max-time 30)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Response received${NC}"
        
        # Check if response contains error indicators
        if echo "$response" | grep -q "Bad Request\|Error\|Failed\|Cannot POST" 2>/dev/null; then
            echo -e "${RED}❌ Error in response:${NC}"
            echo "$response" | jq -r '.response // "No response field"' 2>/dev/null || echo "$response"
            
            if [ "$should_fail_on_error" = "true" ]; then
                echo -e "${RED}💥 Critical test failed - aborting test suite${NC}"
                exit 1
            fi
        else
            echo "$response" | jq -r '.response // "No response field"' 2>/dev/null || echo "$response"
            echo "$response" | jq -r '.toolsUsed // [] | join(", ")' 2>/dev/null | sed 's/^/🔧 Tools used: /'
        fi
    else
        echo -e "${RED}❌ Request failed${NC}"
        if [ "$should_fail_on_error" = "true" ]; then
            echo -e "${RED}💥 Critical test failed - aborting test suite${NC}"
            exit 1
        fi
    fi
    
    sleep 1
}

check_server() {
    echo -e "${YELLOW}🔍 Checking if server is running...${NC}"
    
    if curl -s "$BASE_URL" --max-time 5 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is running${NC}"
        return 0
    else
        echo -e "${RED}❌ Server is not running${NC}"
        echo "Please start the voice-agent server first:"
        echo "docker compose up -d"
        echo "Server should be available at http://localhost:3000"
        return 1
    fi
}

main() {
    echo "🚀 Starting Dev Tools MCP Project Verification Tests"
    echo "=" | tr '\n' '=' | head -c 60; echo

    # Check if server is running
    if ! check_server; then
        exit 1
    fi

    # Check if jq is available for pretty JSON parsing
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠️ jq not found - JSON output will be raw${NC}"
    fi

    # Run the tests
    send_text_query "Create a new project called \"my-test-project\"" "📝 Test 1: Create Project" "true"
    
    send_text_query "List all my projects" "📋 Test 2: List Projects"
    
    send_text_query "Enter the project \"my-test-project\"" "🎯 Test 3: Enter Project"
    
    send_text_query "Show me all projects and which one is active" "📋 Test 4: List Projects (with active project)"
    
    send_text_query "Leave the current project" "🚪 Test 5: Leave Project"
    
    send_text_query "Create a project named \"second-project\"" "📝 Test 6: Create Second Project"
    
    send_text_query "List all projects" "📋 Test 7: List All Projects"
    
    send_text_query "Delete the project called \"my-test-project\"" "🗑️ Test 8: Delete Project by Name"
    
    send_text_query "Delete project with ID 2" "🗑️ Test 9: Delete Project by ID"
    
    send_text_query "List all projects to see if they were deleted" "📋 Test 10: Final Project List"

    echo
    echo "=" | tr '\n' '=' | head -c 60; echo
    echo -e "${GREEN}✅ Project verification tests completed!${NC}"
}

main "$@" 