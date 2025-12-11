# Deployment Guide - Azure Container Apps

## Prerequisites

1. Azure CLI installed
2. Docker installed
3. Azure Container Registry created
4. Azure Cosmos DB account created

## Step 1: Create Azure Cosmos DB

```bash
# Login to Azure
az login

# Set variables
RESOURCE_GROUP="expense-tracker-rg"
LOCATION="eastus"
COSMOS_ACCOUNT="expense-tracker-cosmos"
DATABASE_NAME="ExpenseTrackerDB"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Cosmos DB account (MongoDB API)
az cosmosdb create \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --kind MongoDB \
  --server-version 4.2 \
  --enable-free-tier true

# Get connection details
COSMOS_ENDPOINT=$(az cosmosdb show --name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP --query documentEndpoint -o tsv)
COSMOS_KEY=$(az cosmosdb keys list --name $COSMOS_ACCOUNT --resource-group $RESOURCE_GROUP --query primaryMasterKey -o tsv)

echo "COSMOS_ENDPOINT=$COSMOS_ENDPOINT"
echo "COSMOS_KEY=$COSMOS_KEY"
```

## Step 2: Build and Push Docker Images

```bash
# Set ACR variables (use your existing ACR)
ACR_NAME="your-acr-name"
ACR_LOGIN_SERVER="$ACR_NAME.azurecr.io"

# Login to ACR
az acr login --name $ACR_NAME

# Build and push backend
cd backend
docker build -t $ACR_LOGIN_SERVER/expense-tracker-backend:latest .
docker push $ACR_LOGIN_SERVER/expense-tracker-backend:latest

# Build and push frontend
cd ../frontend
docker build -t $ACR_LOGIN_SERVER/expense-tracker-frontend:latest .
docker push $ACR_LOGIN_SERVER/expense-tracker-frontend:latest
```

## Step 3: Create Container Apps Environment

```bash
# Create Container Apps environment
CONTAINERAPPS_ENVIRONMENT="expense-tracker-env"

az containerapp env create \
  --name $CONTAINERAPPS_ENVIRONMENT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

## Step 4: Deploy Backend Container App

```bash
# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Create backend container app
az containerapp create \
  --name expense-tracker-backend \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINERAPPS_ENVIRONMENT \
  --image $ACR_LOGIN_SERVER/expense-tracker-backend:latest \
  --target-port 5000 \
  --ingress external \
  --registry-server $ACR_LOGIN_SERVER \
  --cpu 0.5 \
  --memory 1.0Gi \
  --min-replicas 0 \
  --max-replicas 2 \
  --env-vars \
    NODE_ENV=production \
    PORT=5000 \
    COSMOS_ENDPOINT=$COSMOS_ENDPOINT \
    COSMOS_KEY=$COSMOS_KEY \
    COSMOS_DATABASE_NAME=$DATABASE_NAME \
    JWT_SECRET=$JWT_SECRET \
    JWT_EXPIRE=7d \
    CORS_ORIGIN=https://expense-tracker-frontend.nicegrass-12345678.eastus.azurecontainerapps.io

# Get backend URL
BACKEND_URL=$(az containerapp show \
  --name expense-tracker-backend \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "Backend URL: https://$BACKEND_URL"
```

## Step 5: Deploy Frontend Container App

```bash
# Create frontend container app
az containerapp create \
  --name expense-tracker-frontend \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINERAPPS_ENVIRONMENT \
  --image $ACR_LOGIN_SERVER/expense-tracker-frontend:latest \
  --target-port 80 \
  --ingress external \
  --registry-server $ACR_LOGIN_SERVER \
  --cpu 0.5 \
  --memory 1.0Gi \
  --min-replicas 0 \
  --max-replicas 2 \
  --env-vars \
    VITE_API_URL=https://$BACKEND_URL/api

# Get frontend URL
FRONTEND_URL=$(az containerapp show \
  --name expense-tracker-frontend \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn -o tsv)

echo "Frontend URL: https://$FRONTEND_URL"
```

## Step 6: Update Backend CORS

```bash
# Update backend with correct frontend URL
az containerapp update \
  --name expense-tracker-backend \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars CORS_ORIGIN=https://$FRONTEND_URL
```

## Step 7: Setup CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Build and Deploy

on:
  push:
    branches: [ main ]

env:
  ACR_NAME: your-acr-name
  RESOURCE_GROUP: expense-tracker-rg

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Build and push backend
        run: |
          az acr build --registry $ACR_NAME \
            --image expense-tracker-backend:${{ github.sha }} \
            --image expense-tracker-backend:latest \
            --file backend/Dockerfile \
            backend/
      
      - name: Build and push frontend
        run: |
          az acr build --registry $ACR_NAME \
            --image expense-tracker-frontend:${{ github.sha }} \
            --image expense-tracker-frontend:latest \
            --file frontend/Dockerfile \
            frontend/
      
      - name: Deploy backend
        run: |
          az containerapp update \
            --name expense-tracker-backend \
            --resource-group $RESOURCE_GROUP \
            --image $ACR_NAME.azurecr.io/expense-tracker-backend:${{ github.sha }}
      
      - name: Deploy frontend
        run: |
          az containerapp update \
            --name expense-tracker-frontend \
            --resource-group $RESOURCE_GROUP \
            --image $ACR_NAME.azurecr.io/expense-tracker-frontend:${{ github.sha }}
```

## Cost Monitoring

```bash
# View current costs
az consumption usage list \
  --start-date 2024-12-01 \
  --end-date 2024-12-11 \
  --resource-group $RESOURCE_GROUP

# Set budget alert
az consumption budget create \
  --amount 10 \
  --budget-name expense-tracker-budget \
  --category Cost \
  --time-grain Monthly \
  --time-period start=2024-12-01 end=2025-12-31 \
  --resource-group $RESOURCE_GROUP
```

## Troubleshooting

```bash
# View backend logs
az containerapp logs show \
  --name expense-tracker-backend \
  --resource-group $RESOURCE_GROUP \
  --follow

# View frontend logs
az containerapp logs show \
  --name expense-tracker-frontend \
  --resource-group $RESOURCE_GROUP \
  --follow

# Check app status
az containerapp show \
  --name expense-tracker-backend \
  --resource-group $RESOURCE_GROUP

# Restart container app
az containerapp revision restart \
  --name expense-tracker-backend \
  --resource-group $RESOURCE_GROUP
```

## Cleanup

```bash
# Delete everything
az group delete --name $RESOURCE_GROUP --yes --no-wait
```
