#!/bin/bash
# 🔧 Azure Service Principal Verification Script
# This script helps diagnose and fix Azure login issues

echo "🔍 Azure Service Principal Diagnostic Script"
echo "==========================================="

# Check if Azure CLI is installed and logged in
echo "1. Checking Azure CLI..."
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not found. Please install it first."
    exit 1
fi

echo "✅ Azure CLI found"

# Check if logged in
echo "2. Checking Azure login status..."
if ! az account show &> /dev/null; then
    echo "❌ Not logged in to Azure. Please run: az login"
    exit 1
fi

echo "✅ Logged in to Azure"

# Show current subscription
echo "3. Current Azure subscription:"
az account show --query "{name:name, id:id, tenantId:tenantId}" -o table

# Get subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "📋 Subscription ID: $SUBSCRIPTION_ID"

# Create or update service principal
echo "4. Creating/updating service principal for GitHub Actions..."
SP_NAME="freegamesscout-github-actions"

# Delete existing service principal if it exists
echo "🧹 Cleaning up existing service principal..."
az ad sp delete --id "http://$SP_NAME" 2>/dev/null || true

# Create new service principal
echo "🔨 Creating new service principal..."
SP_OUTPUT=$(az ad sp create-for-rbac \
    --name "$SP_NAME" \
    --role contributor \
    --scopes "/subscriptions/$SUBSCRIPTION_ID" \
    --sdk-auth)

echo "✅ Service principal created successfully!"
echo ""
echo "🔐 GitHub Secret (AZURE_CREDENTIALS):"
echo "======================================"
echo "$SP_OUTPUT"
echo ""
echo "📋 Additional GitHub Secrets needed:"
echo "===================================="
echo "AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
echo ""
echo "📝 Next Steps:"
echo "1. Copy the JSON above and add it to GitHub Secrets as 'AZURE_CREDENTIALS'"
echo "2. Add your subscription ID as 'AZURE_SUBSCRIPTION_ID'"
echo "3. Make sure 'MONGO_CONNECTION_STRING' is also set"
echo "4. Re-run your GitHub Actions workflow"