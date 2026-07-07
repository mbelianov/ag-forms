#!/bin/bash
# Initialize Database with Default Admin User
# Menu entrypoint — run with no arguments for the interactive menu, or
# pass a mode flag directly:
#   --mode seed       : create the default admin user (default behaviour)
#   --mode reset      : forward to reset-patient-data.sh (interactive)
#   --mode reset-dry  : forward to reset-patient-data.sh --dry-run
#   --mode reset-force: forward to reset-patient-data.sh --force
#   --mode peek       : print first 5 rows from each table

set -e

MODE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode)
            MODE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--mode seed|reset|reset-dry|reset-force|peek]"
            exit 1
            ;;
    esac
done

# Interactive menu when no mode is supplied
if [ -z "$MODE" ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "  Database Initialization Tool"
    echo "╚══════════════════════════════════════════════════════╝"
    echo ""
    echo "  1) Seed default admin user (first-time setup)"
    echo "  2) Reset patient & examination data (dry run / preview)"
    echo "  3) Reset patient & examination data (delete, with confirmation)"
    echo "  4) Reset patient & examination data (delete, no prompt)"
    echo "  5) Peek — print first 5 rows from each table"
    echo "  Q) Quit"
    echo ""
    read -p "  Select option: " choice
    
    case "${choice^^}" in
        1) MODE="seed" ;;
        2) MODE="reset-dry" ;;
        3) MODE="reset" ;;
        4) MODE="reset-force" ;;
        5) MODE="peek" ;;
        Q) echo "  Quit."; exit 0 ;;
        *)
            echo "  Unknown option '$choice'. Defaulting to seed."
            MODE="seed"
            ;;
    esac
    echo ""
fi

# Peek mode — print first 5 rows from each table
peek_tables() {
    local cs="${AZURE_STORAGE_CONNECTION_STRING:-UseDevelopmentStorage=true}"
    
    # Parse connection string
    if [ "$cs" = "UseDevelopmentStorage=true" ]; then
        local account_name="devstoreaccount1"
        local account_key="Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
        local table_endpoint="http://127.0.0.1:10002/devstoreaccount1"
    else
        # Parse production connection string
        local account_name=$(echo "$cs" | grep -oP 'AccountName=\K[^;]+')
        local account_key=$(echo "$cs" | grep -oP 'AccountKey=\K[^;]+')
        local table_endpoint=$(echo "$cs" | grep -oP 'TableEndpoint=\K[^;]+' || echo "https://${account_name}.table.core.windows.net")
        table_endpoint="${table_endpoint%/}"
    fi
    
    local tables=("Users" "Patients" "Examinations" "AuditLogs")
    local width=72
    
    echo ""
    echo "╔$(printf '═%.0s' $(seq 1 $width))╗"
    printf "║  %-${width}s║\n" "Peek — first 5 rows per table"
    printf "║  %-${width}s║\n" "$account_name  ·  $table_endpoint"
    echo "╚$(printf '═%.0s' $(seq 1 $width))╝"
    
    for table in "${tables[@]}"; do
        local date=$(date -u +"%a, %d %b %Y %H:%M:%S GMT")
        local url="${table_endpoint}/${table}()?\$top=5"
        local uri_path=$(echo "$url" | sed "s|${table_endpoint}||")
        local canonical="/${account_name}${uri_path}"
        
        local signature=$(echo -n "${date}\n${canonical}" | openssl dgst -sha256 -hmac "$(echo -n "$account_key" | base64 -d)" -binary | base64)
        
        echo ""
        echo "  ┌─  $table  $(printf '─%.0s' $(seq 1 $((width - 5 - ${#table}))))"
        
        local response=$(curl -s -w "\n%{http_code}" "$url" \
            -H "Authorization: SharedKeyLite ${account_name}:${signature}" \
            -H "x-ms-date: $date" \
            -H "x-ms-version: 2020-12-06" \
            -H "Accept: application/json;odata=nometadata" \
            -H "DataServiceVersion: 3.0;NetFx" 2>/dev/null)
        
        local http_code=$(echo "$response" | tail -n1)
        local body=$(echo "$response" | sed '$d')
        
        if [ "$http_code" = "404" ]; then
            echo "  │  (table does not exist yet)"
        elif [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            local row_count=$(echo "$body" | jq -r '.value | length' 2>/dev/null || echo 0)
            
            if [ "$row_count" -eq 0 ]; then
                echo "  │  (empty)"
            else
                echo "$body" | jq -r '.value[] | to_entries | map("\(.key): \(.value)") | join("\n")' 2>/dev/null | \
                awk 'BEGIN{row=0} /^PartitionKey:/{if(row>0) print "  │"; row++; print "  │  ── row "row" ──"} {print "  │    "$0}'
                echo "  │"
                echo "  │  $row_count row(s) shown  (table may contain more)"
            fi
        else
            echo "  │  [ERROR] HTTP $http_code"
        fi
        
        echo "  └$(printf '─%.0s' $(seq 1 $((width - 1))))"
    done
    echo ""
}

if [ "$MODE" = "peek" ]; then
    peek_tables
    exit 0
fi

# Delegate reset modes to reset-patient-data.sh
if [[ "$MODE" =~ ^reset ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    RESET_SCRIPT="$SCRIPT_DIR/reset-patient-data.sh"
    
    if [ ! -f "$RESET_SCRIPT" ]; then
        echo -e "  \033[0;31m[ERROR] reset-patient-data.sh not found at: $RESET_SCRIPT\033[0m"
        exit 1
    fi
    
    case "$MODE" in
        reset-dry)
            "$RESET_SCRIPT" --dry-run
            ;;
        reset-force)
            "$RESET_SCRIPT" --force
            ;;
        *)
            "$RESET_SCRIPT"
            ;;
    esac
    exit $?
fi

# Seed mode (default)
echo -e "\033[0;32mInitializing database...\033[0m"

# Check if backend is running
BACKEND_RUNNING=false
if curl -s -o /dev/null -w "%{http_code}" http://localhost:7071/api/HealthCheck 2>/dev/null | grep -q "200"; then
    BACKEND_RUNNING=true
fi

if [ "$BACKEND_RUNNING" = false ]; then
    echo -e "\033[0;31mError: Backend is not running. Please start it first with ./start-functions.sh\033[0m"
    exit 1
fi

echo -e "\033[0;33mBackend is running. Creating admin user...\033[0m"
echo -e "\033[0;90m(Tables will be created automatically on first user registration)\033[0m"

# Create default admin user
ADMIN_USER=$(cat <<EOF
{
    "username": "admin",
    "password": "Admin123!@#$",
    "fullName": "System Administrator",
    "email": "admin@example.com",
    "role": "admin"
}
EOF
)

REGISTER_ENDPOINT="http://localhost:7071/api/v1/auth/register"

echo ""
echo -e "\033[0;90mAttempting to register admin user at: $REGISTER_ENDPOINT\033[0m"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$REGISTER_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "$ADMIN_USER" 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo ""
    echo "========================================"
    echo -e "\033[0;32mDatabase initialized successfully!\033[0m"
    echo "========================================"
    echo ""
    echo -e "\033[0;36mDefault Admin User Created:\033[0m"
    echo -e "\033[0;37m  Username: admin\033[0m"
    echo -e "\033[0;37m  Password: Admin123!@#$\033[0m"
    echo -e "\033[0;37m  Email: admin@example.com\033[0m"
    echo -e "\033[0;37m  Role: admin\033[0m"
    echo ""
    echo -e "\033[0;36mYou can now log in at: http://localhost:3000\033[0m"
    echo "========================================"
    echo ""
elif [ "$HTTP_CODE" = "409" ] || echo "$BODY" | grep -q "already exists"; then
    echo ""
    echo "========================================"
    echo -e "\033[0;33mAdmin user already exists!\033[0m"
    echo "========================================"
    echo ""
    echo -e "\033[0;36mExisting Admin User:\033[0m"
    echo -e "\033[0;37m  Username: admin\033[0m"
    echo -e "\033[0;37m  Password: Admin123!@#$\033[0m"
    echo ""
    echo -e "\033[0;36mYou can log in at: http://localhost:3000\033[0m"
    echo "========================================"
    echo ""
else
    echo ""
    echo "========================================"
    echo -e "\033[0;31mFailed to create admin user\033[0m"
    echo "========================================"
    echo ""
    echo -e "\033[0;33mError Details:\033[0m"
    echo -e "\033[0;37m  Status Code: $HTTP_CODE\033[0m"
    echo -e "\033[0;37m  Response: $BODY\033[0m"
    echo ""
    echo -e "\033[0;33mPossible issues:\033[0m"
    echo -e "\033[0;37m1. Validation error - check that the user data meets requirements\033[0m"
    echo -e "\033[0;37m2. Backend error - check Terminal 2 (backend logs) for detailed error messages\033[0m"
    echo -e "\033[0;37m3. Azurite connection issue - ensure Terminal 1 (Azurite) is running\033[0m"
    echo ""
    echo -e "\033[0;36mManual registration command (for debugging):\033[0m"
    echo -e "\033[0;37mcurl -v -X POST http://localhost:7071/api/v1/auth/register -H \"Content-Type: application/json\" -d '{\"username\":\"admin\",\"password\":\"Admin123!@#\$\",\"fullName\":\"System Administrator\",\"email\":\"admin@example.com\",\"role\":\"admin\"}'\033[0m"
    echo ""
    echo -e "\033[0;33mCheck the backend logs in Terminal 2 for the actual error.\033[0m"
    echo "========================================"
    echo ""
    exit 1
fi

# Made with Bob
