# DigiTransac Deployment Guide

This guide covers deploying DigiTransac to Azure using GitHub Actions CI/CD with **OIDC Federation** (no stored secrets).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Security: OIDC Federation](#security-oidc-federation)
4. [Azure Key Vault Integration](#azure-key-vault-integration)
5. [Azure Infrastructure](#azure-infrastructure)
6. [GitHub Configuration](#github-configuration)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Manual Deployment](#manual-deployment)
9. [Monitoring & Observability](#monitoring--observability)
10. [Troubleshooting](#troubleshooting)
11. [Cost Optimization](#cost-optimization)
12. [Security Best Practices](#security-best-practices)

---

## Prerequisites

- Azure CLI installed (`az --version`)
- Azure subscription with Owner or Contributor access
- GitHub repository with Actions enabled
- Docker installed locally (for testing)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Azure Cloud                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Azure Container Apps Environment            │   │
│  │  ┌─────────────────┐      ┌─────────────────────────┐  │   │
│  │  │   Web App       │      │       API App            │  │   │
│  │  │   (nginx)       │─────▶│    (.NET 9 API)         │  │   │
│  │  │   Port 80       │      │      Port 8080          │  │   │
│  │  └─────────────────┘      └───────────┬─────────────┘  │   │
│  └───────────────────────────────────────┼─────────────────┘   │
│                                          │                      │
│  ┌────────────────┐    ┌─────────────────▼─────────────────┐   │
│  │ Azure Key Vault │    │   Azure Cosmos DB (MongoDB API)  │   │
│  │   (Secrets)     │    │        Serverless Tier           │   │
│  └────────────────┘    └───────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Azure Container Registry                   │    │
│  │          (Docker images storage)                        │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Current Azure Resources

| Resource | Name | Purpose |
|----------|------|---------|
| Resource Group | `rg-digitransac` | Contains all resources |
| Container Registry | `herdswebsiteacr.azurecr.io` | Docker images |
| Backend App | `digitransac-backend` | .NET 9 API |
| Frontend App | `digitransac-frontend` | React + nginx |
| Cosmos DB | `digitransac-docdb` | MongoDB API database |
| Key Vault | `digitransac-kv-3895` | Secrets management |

### URLs

- **Backend**: https://digitransac-backend.nicemeadow-64e62875.centralindia.azurecontainerapps.io
- **Frontend**: https://digitransac-frontend.nicemeadow-64e62875.centralindia.azurecontainerapps.io

---

## Security: OIDC Federation

We use **OpenID Connect (OIDC) federation** for passwordless authentication from GitHub Actions to Azure. This is more secure than stored secrets because:

1. **No long-lived secrets** - Tokens are short-lived (expires in minutes)
2. **No secret rotation** - Nothing to rotate or accidentally leak
3. **Scoped access** - Only specific branches/environments can authenticate

### How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  GitHub Actions │────▶│  Azure AD       │────▶│  Azure          │
│  (OIDC Token)   │     │  (Validates)    │     │  (Resources)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Federated Credentials Configured

| Credential | Subject | Purpose |
|------------|---------|---------|
| `github-main` | `repo:Krishna-Chaitanya4/DigiTransac:ref:refs/heads/main` | Production deploys |
| `github-fresh-start` | `repo:Krishna-Chaitanya4/DigiTransac:ref:refs/heads/fresh-start` | Development deploys |
| `github-pr` | `repo:Krishna-Chaitanya4/DigiTransac:pull_request` | PR validation |

---

## Azure Key Vault Integration

The API integrates with Azure Key Vault for secure secrets management at runtime.

### How It Works

1. Container App has **System-Assigned Managed Identity**
2. Managed Identity has **Key Vault Secrets User** role
3. API uses `Azure.Extensions.AspNetCore.Configuration.Secrets` to load secrets
4. Secrets are mapped to configuration keys (e.g., `Jwt--Key` → `Jwt:Key`)

### Key Vault Secrets (with proper naming)

| Secret Name | Configuration Key | Purpose |
|-------------|-------------------|---------|
| `MongoDb--ConnectionString` | `MongoDb:ConnectionString` | Database connection |
| `MongoDb--DatabaseName` | `MongoDb:DatabaseName` | Database name |
| `Jwt--Key` | `Jwt:Key` | JWT signing key |
| `Email--SenderEmail` | `Email:SenderEmail` | Email sender address |
| `Email--AppPassword` | `Email:AppPassword` | Gmail App Password |

### Environment Variable to Enable

Set this in Container App to enable Key Vault:
```
AZURE_KEY_VAULT_URL=https://digitransac-kv-3895.vault.azure.net/
```

The API automatically detects this and loads secrets from Key Vault using DefaultAzureCredential (Managed Identity).

---

## Azure Infrastructure

### Existing Setup

The Azure resources were created manually and are already configured. No infrastructure-as-code is needed.

### Azure AD Application

- **Name**: `digitransac-github-actions`
- **Client ID**: `4bca284a-c71d-47e0-bb2b-c84055b19463`
- **Tenant ID**: `b421e9f0-d99f-4542-a1b9-5c7742e9b601`

### Role Assignments

The Service Principal has:
- **Contributor** role on `rg-digitransac` (deploy apps)
- **AcrPush** role on `herdswebsiteacr` (push images)

### Updating Secrets in Key Vault

```bash
KEYVAULT_NAME="digitransac-kv-3895"

# Generate strong secrets
JWT_SECRET=$(openssl rand -base64 48)
ENCRYPTION_KEK=$(openssl rand -base64 32)

# Update Key Vault secrets
az keyvault secret set --vault-name $KEYVAULT_NAME --name "JwtSecretKey" --value "$JWT_SECRET"
az keyvault secret set --vault-name $KEYVAULT_NAME --name "EncryptionKek" --value "$ENCRYPTION_KEK"
```

### Configuring Email for OTP/Password Reset

The application uses Gmail SMTP to send verification codes and password reset emails. You MUST configure these secrets for email functionality to work.

#### Step 1: Get a Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled
3. Go to [App passwords](https://myaccount.google.com/apppasswords)
4. Generate a new app password for "Mail"
5. Copy the 16-character password (spaces included)

#### Step 2: Update Container App Secrets

```bash
# Replace with your actual Gmail address and app password
az containerapp secret set \
  --name digitransac-backend \
  --resource-group rg-digitransac \
  --secrets "email-sender=your-email@gmail.com" "email-app-password=xxxx xxxx xxxx xxxx"

# Restart the app to apply changes
az containerapp revision restart \
  --name digitransac-backend \
  --resource-group rg-digitransac \
  --revision $(az containerapp revision list --name digitransac-backend --resource-group rg-digitransac --query "[0].name" -o tsv)
```

#### Current Email Configuration

| Secret | Container App Secret | Purpose |
|--------|---------------------|---------|
| Gmail Address | `email-sender` | From address for emails |
| Gmail App Password | `email-app-password` | Authentication for Gmail SMTP |

> ⚠️ **IMPORTANT**: The current values are placeholders. Email functionality (OTP, password reset) will NOT work until you update these with real Gmail credentials.

---

## GitHub Configuration

### Required Variables (NOT Secrets!)

Configure in: **Repository Settings → Secrets and variables → Actions → Variables**

| Variable | Value |
|----------|-------|
| `AZURE_CLIENT_ID` | `4bca284a-c71d-47e0-bb2b-c84055b19463` |
| `AZURE_TENANT_ID` | `b421e9f0-d99f-4542-a1b9-5c7742e9b601` |
| `AZURE_SUBSCRIPTION_ID` | `2c81db62-853c-45ab-a8a1-b12ec62aeccf` |

> **Note**: These are NOT secrets - they are public identifiers used for OIDC. The actual authentication happens via GitHub's OIDC token which Azure validates.

### Environment Setup (Optional)

For production deployments, create a GitHub Environment:

1. Go to **Settings → Environments → New environment**
2. Name: `production`
3. Add protection rules:
   - Required reviewers
   - Wait timer (5 minutes)

---

## CI/CD Pipeline

### Unified Pipeline

We use a single unified pipeline (`.github/workflows/pipeline.yml`) with stages:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CI/CD Pipeline                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │  Setup   │──▶│ Validate │──▶│  Build   │──▶│  Deploy  │    │
│  │          │   │          │   │  & Push  │   │          │    │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘    │
│       │              │              │              │            │
│       ▼              ▼              ▼              ▼            │
│   Version       Tests, Lint    Docker Build    Update Apps     │
│   Generation    Security Scan  Push to ACR     Health Check    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Trigger Conditions

| Trigger | Stages Run |
|---------|------------|
| Push to `main` | All stages (Validate → Build → Deploy → Verify) |
| Pull Request to `main` | Validate only (tests, lint, security) |
| Manual dispatch | All stages (with optional skip tests) |

### Pipeline Features

- **OIDC Authentication** - No stored secrets
- **Parallel Validation** - Backend & Frontend tests run concurrently
- **Security Scanning** - npm audit & dotnet vulnerabilities check
- **Versioned Deployments** - Each deploy tagged with date + commit SHA
- **Health Checks** - Automated verification after deployment
- **Summary Reports** - Clear status in workflow output

### Manual Trigger

1. Go to **Actions → CI/CD Pipeline**
2. Click **Run workflow**
3. Options:
   - `skip_tests`: Emergency deploy without validation
   - `version_tag`: Custom version tag

---

## Manual Deployment

### Local Docker Build & Push

```bash
# Login to Azure
az login
az acr login --name herdswebsiteacr

# Build and push API
docker build -t herdswebsiteacr.azurecr.io/digitransac-backend:manual ./api
docker push herdswebsiteacr.azurecr.io/digitransac-backend:manual

# Build and push Web (build frontend first)
cd web
npm ci
npm run build
cd ..
docker build -t herdswebsiteacr.azurecr.io/digitransac-frontend:manual ./web
docker push herdswebsiteacr.azurecr.io/digitransac-frontend:manual
```

### Update Container Apps

```bash
# Update Backend
az containerapp update \
  --name digitransac-backend \
  --resource-group rg-digitransac \
  --image herdswebsiteacr.azurecr.io/digitransac-backend:manual

# Update Frontend
az containerapp update \
  --name digitransac-frontend \
  --resource-group rg-digitransac \
  --image herdswebsiteacr.azurecr.io/digitransac-frontend:manual
```

---

## Monitoring & Observability

### Application Insights

Access via Azure Portal:
1. Go to your resource group
2. Open Application Insights resource
3. View logs, metrics, and traces

### Key Metrics to Monitor

- Request rate and latency
- Error rate (4xx, 5xx)
- Database query performance
- Container CPU/Memory usage

### Alerts Setup

```bash
# Create alert for high error rate
az monitor metrics alert create \
  --name "High Error Rate" \
  --resource-group rg-digitransac-dev \
  --scopes "/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.App/containerApps/digitransac-api-dev" \
  --condition "avg requests/failed > 10" \
  --window-size 5m \
  --evaluation-frequency 1m
```

### Log Queries

```kusto
// API errors in the last hour
ContainerAppConsoleLogs
| where ContainerAppName_s == "digitransac-api-dev"
| where Log_s contains "error" or Log_s contains "Error"
| order by TimeGenerated desc
| take 100

// Request latency percentiles
requests
| summarize percentile(duration, 50), percentile(duration, 95), percentile(duration, 99) by bin(timestamp, 5m)
| order by timestamp desc
```

---

## Troubleshooting

### Common Issues

#### 1. OIDC Authentication Failure

```
Error: AADSTS70021: No matching federated identity record found
```

**Solution**: Verify the federated credential subject matches exactly:
```bash
# List federated credentials
az ad app federated-credential list --id 4bca284a-c71d-47e0-bb2b-c84055b19463
```

#### 2. Container App not starting

```bash
# Check logs
az containerapp logs show \
  --name digitransac-backend \
  --resource-group rg-digitransac \
  --follow

# Check revision status
az containerapp revision list \
  --name digitransac-backend \
  --resource-group rg-digitransac
```

#### 3. Image pull failures

```bash
# Verify ACR access
az acr login --name herdswebsiteacr

# List images
az acr repository list --name herdswebsiteacr

# Check specific image tags
az acr repository show-tags --name herdswebsiteacr --repository digitransac-backend
```

#### 4. Database connection issues

```bash
# Check connection string in Container App
az containerapp show \
  --name digitransac-backend \
  --resource-group rg-digitransac \
  --query "properties.template.containers[0].env"
```

#### 5. Health check failing

```bash
# Test endpoints manually
curl https://digitransac-backend.nicemeadow-64e62875.centralindia.azurecontainerapps.io/api/health/live
curl https://digitransac-frontend.nicemeadow-64e62875.centralindia.azurecontainerapps.io
```

---

## Cost Optimization

### Current Configuration (Dev/Staging)

Both Container Apps are configured with **scale-to-zero**:
- `minReplicas: 0` - Apps scale down to 0 when idle
- `maxReplicas: 3` - Can scale up to 3 instances under load
- **Cold start time**: ~5-10 seconds on first request

### Estimated Monthly Costs

| Resource | Configuration | Idle Cost | Active Cost |
|----------|--------------|-----------|-------------|
| Container Apps (x2) | Scale to zero | ~$0 | ~$30-90/mo |
| MongoDB vCore | Cluster | ~$100-150/mo | ~$100-150/mo |
| Container Registry | Basic | ~$5/mo | ~$5/mo |
| Key Vault | Standard | ~$0 | ~$0.03/10K ops |
| Log Analytics | Pay-per-GB | ~$5/mo | ~$5-20/mo |
| **Total** | | **~$110/mo** | **~$150-270/mo** |

### Cost Management Commands

```bash
# Scale to zero (dev/staging environment)
az containerapp update --name digitransac-backend --resource-group rg-digitransac --min-replicas 0
az containerapp update --name digitransac-frontend --resource-group rg-digitransac --min-replicas 0

# Scale for production (always-on)
az containerapp update --name digitransac-backend --resource-group rg-digitransac --min-replicas 1
az containerapp update --name digitransac-frontend --resource-group rg-digitransac --min-replicas 1

# Purge old container images (run monthly)
az acr run --cmd "acr purge --filter 'digitransac-*:.*' --ago 30d --untagged" --registry herdswebsiteacr /dev/null
```

### Cost Alerts

Set up cost alerts in Azure Portal:
1. Go to **Cost Management + Billing**
2. Create a **Budget** (e.g., $150/month)
3. Set alerts at 50%, 80%, 100%

---

## Security Best Practices

1. **OIDC Federation** - No long-lived secrets (already implemented!)
2. **Key Vault Integration** - All secrets in Azure Key Vault
3. **Managed Identities** - Container Apps use system-assigned identities
4. **Minimal Permissions** - Service Principal has only required roles
5. **Audit Logging** - All Azure operations are logged
6. **Branch Protection** - Production deploys require PR review

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review GitHub Actions logs (Actions tab)
3. Check Azure Portal for resource health
4. Open a GitHub issue for persistent problems