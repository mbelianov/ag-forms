#!/bin/bash
# Reset patient and examination data from Azure Table Storage (Azurite dev or real account)
#
# Performs a cascading hard-delete of all entities across the following partitions, in
# dependency order so that no child record outlives its parent:
#
#     Deletion order (child to parent):
#       1. Examinations  - MRN lookup rows          (PartitionKey = "MRN")
#       2. Examinations  - EXAM lookup rows          (PartitionKey = "EXAM")
#       3. Examinations  - timeline rows per patient (PartitionKey starts with "PATIENT_")
#       4. Counters      - MRN year counters         (PartitionKey = "COUNTER", RowKey starts with "MRN_")
#       5. Patients      - search index rows         (PartitionKey starts with "PATIENT_SEARCH_")
#       6. Patients      - primary patient rows      (PartitionKey = "PATIENT")
#       7. Patients      - legacy MRN lookup rows    (PartitionKey = "MRN")  [retired partition]
#
# AuditLogs are intentionally preserved (immutable compliance trail).
#
# Usage:
#   ./reset-patient-data.sh              # Interactive with confirmation
#   ./reset-patient-data.sh --dry-run    # Preview what would be deleted
#   ./reset-patient-data.sh --force      # Skip confirmation prompt
#   ./reset-patient-data.sh --connection-string "..." # Use custom connection string

set -e  # Exit on error

# Default values
DRY_RUN=false
FORCE=false
CONNECTION_STRING="${AZURE_STORAGE_CONNECTION_STRING:-UseDevelopmentStorage=true}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --connection-string)
            CONNECTION_STRING="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--dry-run] [--force] [--connection-string <string>]"
            exit 1
            ;;
    esac
done

# Color helpers
print_step() { echo -e "  >> \033[0;36m$1\033[0m"; }
print_ok() { echo -e "  \033[0;32m[OK] $1\033[0m"; }
print_warn() { echo -e "  \033[0;33m[WARN] $1\033[0m"; }
print_fail() { echo -e "  \033[0;31m[FAIL] $1\033[0m"; }
print_info() { echo -e "       \033[0;90m$1\033[0m"; }

# Parse connection string
parse_connection_string() {
    local cs="$1"
    
    if [ "$cs" = "UseDevelopmentStorage=true" ]; then
        ACCOUNT_NAME="devstoreaccount1"
        ACCOUNT_KEY="Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
        TABLE_ENDPOINT="http://127.0.0.1:10002/devstoreaccount1"
        return
    fi
    
    # Parse key-value pairs
    while IFS='=' read -r key value; do
        case "$key" in
            AccountName) ACCOUNT_NAME="$value" ;;
            AccountKey) ACCOUNT_KEY="$value" ;;
            TableEndpoint) TABLE_ENDPOINT="${value%/}" ;;
            DefaultEndpointsProtocol) PROTOCOL="$value" ;;
            EndpointSuffix) ENDPOINT_SUFFIX="$value" ;;
        esac
    done < <(echo "$cs" | tr ';' '\n')
    
    # Build table endpoint if not provided
    if [ -z "$TABLE_ENDPOINT" ]; then
        PROTOCOL="${PROTOCOL:-https}"
        ENDPOINT_SUFFIX="${ENDPOINT_SUFFIX:-core.windows.net}"
        TABLE_ENDPOINT="${PROTOCOL}://${ACCOUNT_NAME}.table.${ENDPOINT_SUFFIX}"
    fi
}

# Generate HMAC-SHA256 signature for Azure Shared Key Lite
generate_signature() {
    local account_name="$1"
    local account_key="$2"
    local date="$3"
    local canonical_resource="$4"
    
    local string_to_sign="${date}\n${canonical_resource}"
    echo -n "$string_to_sign" | openssl dgst -sha256 -hmac "$(echo -n "$account_key" | base64 -d)" -binary | base64
}

# Make Azure Table Storage REST API call
invoke_table_request() {
    local method="$1"
    local uri="$2"
    local extra_headers="$3"
    
    local date=$(date -u +"%a, %d %b %Y %H:%M:%S GMT")
    local uri_path=$(echo "$uri" | sed "s|${TABLE_ENDPOINT}||")
    local canonical="/${ACCOUNT_NAME}${uri_path}"
    
    local signature=$(generate_signature "$ACCOUNT_NAME" "$ACCOUNT_KEY" "$date" "$canonical")
    local auth="SharedKeyLite ${ACCOUNT_NAME}:${signature}"
    
    local response
    local http_code
    
    if [ "$method" = "DELETE" ]; then
        http_code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$uri" \
            -H "Authorization: $auth" \
            -H "x-ms-date: $date" \
            -H "x-ms-version: 2020-12-06" \
            -H "Accept: application/json;odata=nometadata" \
            -H "DataServiceVersion: 3.0;NetFx" \
            -H "If-Match: *" \
            $extra_headers)
        
        # 404 on DELETE = already gone, treat as success
        if [ "$http_code" = "404" ] || [ "$http_code" = "204" ]; then
            return 0
        elif [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            return 0
        else
            return 1
        fi
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$uri" \
            -H "Authorization: $auth" \
            -H "x-ms-date: $date" \
            -H "x-ms-version: 2020-12-06" \
            -H "Accept: application/json;odata=nometadata" \
            -H "DataServiceVersion: 3.0;NetFx" \
            $extra_headers)
        
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            echo "$body"
            return 0
        elif [ "$http_code" = "404" ]; then
            echo "[]"
            return 0
        else
            return 1
        fi
    fi
}

# Get all entities from a table with optional filter
get_all_entities() {
    local table_name="$1"
    local filter="$2"
    
    local query="\$select=PartitionKey,RowKey"
    if [ -n "$filter" ]; then
        query="${query}&\$filter=$(echo -n "$filter" | jq -sRr @uri)"
    fi
    
    local uri="${TABLE_ENDPOINT}/${table_name}()?${query}"
    local result=$(invoke_table_request "GET" "$uri" "")
    
    if [ $? -eq 0 ]; then
        echo "$result" | jq -r '.value // [] | .[] | "\(.PartitionKey)|\(.RowKey)"'
    fi
}

# Delete a single entity
delete_entity() {
    local table_name="$1"
    local partition_key="$2"
    local row_key="$3"
    
    local pk_encoded=$(echo -n "$partition_key" | jq -sRr @uri)
    local rk_encoded=$(echo -n "$row_key" | jq -sRr @uri)
    local uri="${TABLE_ENDPOINT}/${table_name}(PartitionKey='${pk_encoded}',RowKey='${rk_encoded}')"
    
    invoke_table_request "DELETE" "$uri" "" > /dev/null 2>&1
}

# Summary tracking
declare -a SUMMARY_STEPS=()
declare -a SUMMARY_TABLES=()
declare -a SUMMARY_PARTITIONS=()
declare -a SUMMARY_FOUND=()
declare -a SUMMARY_DELETED=()
declare -a SUMMARY_STATUS=()

add_summary_row() {
    SUMMARY_STEPS+=("$1")
    SUMMARY_TABLES+=("$2")
    SUMMARY_PARTITIONS+=("$3")
    SUMMARY_FOUND+=("$4")
    SUMMARY_DELETED+=("$5")
    SUMMARY_STATUS+=("$6")
}

print_summary() {
    local dry_run="$1"
    
    echo ""
    echo "======================================================================"
    if [ "$dry_run" = "true" ]; then
        echo "  DRY-RUN SUMMARY (no changes made)"
    else
        echo "  OPERATION SUMMARY"
    fi
    echo "======================================================================"
    echo ""
    
    printf "%-4s %-14s %-28s %8s %8s  %s\n" "Step" "Table" "Partition/Filter" "Found" "Deleted" "Status"
    printf "%s\n" "------------------------------------------------------------------------"
    
    local total_found=0
    local total_deleted=0
    
    for i in "${!SUMMARY_STEPS[@]}"; do
        local color=""
        case "${SUMMARY_STATUS[$i]}" in
            OK) color="\033[0;32m" ;;
            SKIPPED) color="\033[0;33m" ;;
            *) color="\033[0;31m" ;;
        esac
        
        printf "${color}%-4s %-14s %-28s %8s %8s  %s\033[0m\n" \
            "${SUMMARY_STEPS[$i]}" "${SUMMARY_TABLES[$i]}" "${SUMMARY_PARTITIONS[$i]}" \
            "${SUMMARY_FOUND[$i]}" "${SUMMARY_DELETED[$i]}" "${SUMMARY_STATUS[$i]}"
        
        total_found=$((total_found + ${SUMMARY_FOUND[$i]}))
        total_deleted=$((total_deleted + ${SUMMARY_DELETED[$i]}))
    done
    
    printf "%s\n" "------------------------------------------------------------------------"
    printf "%-4s %-14s %-28s %8s %8s\n" "" "" "TOTAL" "$total_found" "$total_deleted"
    echo ""
}

# Main script
echo ""
echo "======================================================================"
echo "  Patient & Examination Data Reset Tool"
echo "======================================================================"
echo ""

# Parse connection string
parse_connection_string "$CONNECTION_STRING"

print_info "Storage account : $ACCOUNT_NAME"
print_info "Table endpoint  : $TABLE_ENDPOINT"
echo ""

# Verify connectivity
print_step "Verifying storage connectivity..."
if invoke_table_request "GET" "${TABLE_ENDPOINT}/Tables()" "" > /dev/null 2>&1; then
    print_ok "Storage is reachable"
else
    print_fail "Cannot reach storage at $TABLE_ENDPOINT"
    print_info "Ensure Azurite is running:  ./start-azurite.sh"
    exit 1
fi

# Enumerate entities
echo ""
print_step "Enumerating entities to delete..."

print_info "Examinations / MRN partition..."
exam_mrn=$(get_all_entities "Examinations" "PartitionKey eq 'MRN'")
exam_mrn_count=$(echo "$exam_mrn" | grep -c . || echo 0)

print_info "Examinations / EXAM partition..."
exam_lookup=$(get_all_entities "Examinations" "PartitionKey eq 'EXAM'")
exam_lookup_count=$(echo "$exam_lookup" | grep -c . || echo 0)

print_info "Examinations / PATIENT_* timeline rows..."
exam_timeline=$(get_all_entities "Examinations" "PartitionKey ge 'PATIENT_' and PartitionKey lt 'PATIENT~'")
exam_timeline_count=$(echo "$exam_timeline" | grep -c . || echo 0)

print_info "Counters / MRN_* counters..."
mrn_counters=$(get_all_entities "Counters" "PartitionKey eq 'COUNTER' and RowKey ge 'MRN_' and RowKey lt 'MRN~'")
mrn_counters_count=$(echo "$mrn_counters" | grep -c . || echo 0)

print_info "Patients / PATIENT_SEARCH_* rows..."
patient_search=$(get_all_entities "Patients" "PartitionKey ge 'PATIENT_SEARCH_' and PartitionKey lt 'PATIENT_SEARCH~'")
patient_search_count=$(echo "$patient_search" | grep -c . || echo 0)

print_info "Patients / PATIENT rows..."
patient_primary=$(get_all_entities "Patients" "PartitionKey eq 'PATIENT'")
patient_primary_count=$(echo "$patient_primary" | grep -c . || echo 0)

print_info "Patients / MRN legacy rows..."
patient_legacy=$(get_all_entities "Patients" "PartitionKey eq 'MRN'")
patient_legacy_count=$(echo "$patient_legacy" | grep -c . || echo 0)

grand_total=$((exam_mrn_count + exam_lookup_count + exam_timeline_count + mrn_counters_count + patient_search_count + patient_primary_count + patient_legacy_count))

echo ""
echo -e "  \033[0;33mFound $grand_total total entities to delete:\033[0m"
print_info "  Examinations / MRN         : $exam_mrn_count"
print_info "  Examinations / EXAM        : $exam_lookup_count"
print_info "  Examinations / PATIENT_*   : $exam_timeline_count"
print_info "  Counters / MRN_*           : $mrn_counters_count"
print_info "  Patients / PATIENT_SEARCH_*: $patient_search_count"
print_info "  Patients / PATIENT         : $patient_primary_count"
print_info "  Patients / MRN (legacy)    : $patient_legacy_count"
echo ""

# Handle dry run
if [ "$DRY_RUN" = true ]; then
    add_summary_row "1" "Examinations" "MRN" "$exam_mrn_count" "$exam_mrn_count" "SKIPPED"
    add_summary_row "2" "Examinations" "EXAM" "$exam_lookup_count" "$exam_lookup_count" "SKIPPED"
    add_summary_row "3" "Examinations" "PATIENT_*" "$exam_timeline_count" "$exam_timeline_count" "SKIPPED"
    add_summary_row "4" "Counters" "COUNTER/MRN_*" "$mrn_counters_count" "$mrn_counters_count" "SKIPPED"
    add_summary_row "5" "Patients" "PATIENT_SEARCH_*" "$patient_search_count" "$patient_search_count" "SKIPPED"
    add_summary_row "6" "Patients" "PATIENT" "$patient_primary_count" "$patient_primary_count" "SKIPPED"
    add_summary_row "7" "Patients" "MRN (legacy)" "$patient_legacy_count" "$patient_legacy_count" "SKIPPED"
    print_summary "true"
    echo -e "  \033[0;33mNo changes were made (dry run).\033[0m"
    exit 0
fi

if [ "$grand_total" -eq 0 ]; then
    print_ok "Nothing to delete - all target partitions are already empty."
    exit 0
fi

# Confirmation
if [ "$FORCE" != true ]; then
    echo -e "  \033[0;31mWARNING: This operation permanently deletes data.\033[0m"
    echo -e "     \033[0;33mAuditLogs are preserved. Users are preserved.\033[0m"
    echo ""
    read -p "  Type YES to proceed, anything else to abort: " confirm
    if [ "$confirm" != "YES" ]; then
        print_warn "Aborted by user."
        exit 0
    fi
    echo ""
fi

# Deletion pass
overall_status="SUCCESS"
failed_step=""

delete_batch() {
    local step="$1"
    local table="$2"
    local partition="$3"
    local entities="$4"
    local count="$5"
    
    print_step "Step $step - [$table] $partition  ($count rows)"
    
    if [ "$count" -eq 0 ]; then
        print_info "  (nothing to delete)"
        add_summary_row "$step" "$table" "$partition" 0 0 "OK"
        return 0
    fi
    
    local deleted=0
    while IFS='|' read -r pk rk; do
        if [ -n "$pk" ] && [ -n "$rk" ]; then
            if delete_entity "$table" "$pk" "$rk"; then
                deleted=$((deleted + 1))
            else
                print_fail "Error deleting entity: $pk | $rk"
                add_summary_row "$step" "$table" "$partition" "$count" "$deleted" "FAILED"
                return 1
            fi
        fi
    done <<< "$entities"
    
    print_ok "Deleted $deleted / $count rows"
    add_summary_row "$step" "$table" "$partition" "$count" "$deleted" "OK"
    return 0
}

# Execute deletions in order
if ! delete_batch "1" "Examinations" "MRN" "$exam_mrn" "$exam_mrn_count"; then
    overall_status="FAILED"
    failed_step="Step 1 [Examinations / MRN]"
fi

if [ "$overall_status" = "SUCCESS" ] && ! delete_batch "2" "Examinations" "EXAM" "$exam_lookup" "$exam_lookup_count"; then
    overall_status="FAILED"
    failed_step="Step 2 [Examinations / EXAM]"
fi

if [ "$overall_status" = "SUCCESS" ] && ! delete_batch "3" "Examinations" "PATIENT_*" "$exam_timeline" "$exam_timeline_count"; then
    overall_status="FAILED"
    failed_step="Step 3 [Examinations / PATIENT_*]"
fi

if [ "$overall_status" = "SUCCESS" ] && ! delete_batch "4" "Counters" "COUNTER/MRN_*" "$mrn_counters" "$mrn_counters_count"; then
    overall_status="FAILED"
    failed_step="Step 4 [Counters / MRN_*]"
fi

if [ "$overall_status" = "SUCCESS" ] && ! delete_batch "5" "Patients" "PATIENT_SEARCH_*" "$patient_search" "$patient_search_count"; then
    overall_status="FAILED"
    failed_step="Step 5 [Patients / PATIENT_SEARCH_*]"
fi

if [ "$overall_status" = "SUCCESS" ] && ! delete_batch "6" "Patients" "PATIENT" "$patient_primary" "$patient_primary_count"; then
    overall_status="FAILED"
    failed_step="Step 6 [Patients / PATIENT]"
fi

if [ "$overall_status" = "SUCCESS" ] && ! delete_batch "7" "Patients" "MRN (legacy)" "$patient_legacy" "$patient_legacy_count"; then
    overall_status="FAILED"
    failed_step="Step 7 [Patients / MRN]"
fi

# Final report
print_summary "false"

if [ "$overall_status" = "SUCCESS" ]; then
    echo -e "  \033[0;32mAll patient and examination data has been deleted successfully.\033[0m"
    echo -e "     \033[0;36mRun ./init-database.sh to re-seed the admin user.\033[0m"
else
    echo ""
    print_fail "Operation did not complete cleanly. Failed at: $failed_step"
    echo ""
    echo -e "  \033[0;33mManual recovery guidance:\033[0m"
    echo -e "  \033[0;37m- Check which steps show status OK in the table above.\033[0m"
    echo -e "  \033[0;37m- The remaining steps were NOT executed - their data is intact.\033[0m"
    echo -e "  \033[0;37m- Re-run this script after fixing the underlying error.\033[0m"
    echo -e "  \033[0;37m- If partial deletion leaves orphaned records, re-run with --force.\033[0m"
    echo ""
    exit 1
fi

# Made with Bob
