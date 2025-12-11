# Azure Cosmos DB Setup Guide

## Prerequisites
- Azure account with an active subscription
- Azure CLI installed (optional, can use Azure Portal)

## Option 1: Create Cosmos DB via Azure Portal

### Step 1: Create Cosmos DB Account
1. Go to [Azure Portal](https://portal.azure.com)
2. Click "Create a resource"
3. Search for "Azure Cosmos DB"
4. Click "Create" → "Azure Cosmos DB for MongoDB"

### Step 2: Configure Basic Settings
- **Subscription**: Select your subscription
- **Resource Group**: Create new or use existing (e.g., `rg-expense-tracker`)
- **Account Name**: Choose unique name (e.g., `cosmos-expense-tracker-[yourname]`)
- **Location**: Choose nearest region (e.g., `East US`)
- **Capacity mode**: Select **Serverless** (for low cost)
- **Version**: MongoDB 4.2 or higher

### Step 3: Configure Networking
- **Connectivity method**: All networks (or configure firewall rules)
- Enable "Allow access from Azure Portal" for easy management

### Step 4: Review and Create
- Review settings
- Click "Create" (deployment takes 5-10 minutes)

### Step 5: Get Connection Details
1. Once deployed, go to your Cosmos DB account
2. In left menu, click "Keys"
3. Copy the following:
   - **URI** (this is your `COSMOS_ENDPOINT`)
   - **PRIMARY KEY** (this is your `COSMOS_KEY`)

### Step 6: Update Backend .env File
```env
COSMOS_ENDPOINT=https://your-account-name.documents.azure.com:443/
COSMOS_KEY=your-primary-key-here
COSMOS_DATABASE_NAME=ExpenseTrackerDB
```

## Option 2: Create Cosmos DB via Azure CLI

```bash
# Login to Azure
az login

# Set variables
RESOURCE_GROUP="rg-expense-tracker"
LOCATION="eastus"
ACCOUNT_NAME="cosmos-expense-tracker-$(whoami)"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Cosmos DB account (Serverless mode)
az cosmosdb create \
  --name $ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --kind MongoDB \
  --server-version 4.2 \
  --capabilities EnableServerless \
  --locations regionName=$LOCATION

# Get connection string
az cosmosdb keys list \
  --name $ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --type connection-strings
```

## Cost Estimate
- **Serverless mode**: Pay per request
  - First 1,000,000 RUs: $0.25 per 1M RUs
  - Storage: $0.25 per GB/month
- **Estimated monthly cost**: $5-15 for moderate usage
- **Free tier**: First 1000 RU/s and 25 GB storage free (if available on your account)

## Testing Connection

After updating your `.env` file, restart the backend server:

```bash
cd backend
npm run dev
```

You should see:
```
✅ Database "ExpenseTrackerDB" is ready
✅ All Cosmos DB containers are ready
✅ Cosmos DB connected and ready
🚀 Server is running on port 5000
```

## Troubleshooting

### Error: "Authorization token not valid"
- Double-check your `COSMOS_KEY` in `.env`
- Ensure there are no extra spaces or quotes

### Error: "Unable to connect"
- Verify `COSMOS_ENDPOINT` URL is correct
- Check firewall settings in Azure Portal
- Ensure "Allow access from Azure Portal" is enabled

### Error: "Request rate is large"
- You've exceeded free tier limits
- Consider upgrading or optimizing queries

## Next Steps
Once Cosmos DB is set up and connected, you can:
1. Test user registration
2. Test user login
3. Proceed with category and expense features
