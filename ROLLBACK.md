# Rollback Procedures

This document describes how to rollback DigiTransac to a previous version in case of issues.

## Quick Reference

| Scenario | Command | Time to Recover |
|----------|---------|-----------------|
| Bad deployment | Activate previous revision | ~30 seconds |
| Bad code merged | Revert commit + redeploy | ~5 minutes |
| Database issue | Restore from backup | ~10-30 minutes |

---

## 1. Rollback to Previous Azure Container Apps Revision

Azure Container Apps automatically keeps previous revisions. This is the **fastest** rollback method.

### List Available Revisions

```bash
# Backend revisions
az containerapp revision list \
  --name digitransac-backend \
  --resource-group rg-digitransac \
  --output table

# Frontend revisions
az containerapp revision list \
  --name digitransac-frontend \
  --resource-group rg-digitransac \
  --output table
```

### Activate Previous Revision

```bash
# Get the revision name from the list above (e.g., digitransac-backend--abc123)
# Then activate it:

# Rollback backend
az containerapp revision activate \
  --name digitransac-backend \
  --resource-group rg-digitransac \
  --revision digitransac-backend--<previous-revision-suffix>

# Rollback frontend
az containerapp revision activate \
  --name digitransac-frontend \
  --resource-group rg-digitransac \
  --revision digitransac-frontend--<previous-revision-suffix>
```

### Route Traffic to Previous Revision

If you need to gradually shift traffic:

```bash
az containerapp ingress traffic set \
  --name digitransac-backend \
  --resource-group rg-digitransac \
  --revision-weight digitransac-backend--<old-revision>=100
```

---

## 2. Rollback Using Git Tags

Every release is tagged with a version number.

### List Available Tags

```bash
git fetch --tags
git tag -l "v*" --sort=-v:refname | head -10
```

### Deploy Specific Version

```bash
# Check out the tag
git checkout v1.0.0

# Or revert to previous commit
git revert HEAD --no-edit
git push origin main
```

The CI/CD pipeline will automatically deploy the reverted code.

---

## 3. Deploy Specific Docker Image

If you know the exact image version to rollback to:

```bash
# Find available images
az acr repository show-tags \
  --name herdswebsiteacr \
  --repository digitransac-backend \
  --orderby time_desc \
  --top 10

# Deploy specific image
az containerapp update \
  --name digitransac-backend \
  --resource-group rg-digitransac \
  --image herdswebsiteacr.azurecr.io/digitransac-backend:20260201-abc1234
```

---

## 4. Database Rollback

### MongoDB Atlas Backup Restore

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com)
2. Navigate to your cluster → **Backup**
3. Select a snapshot from before the issue
4. Click **Restore** → Choose restore options

### Point-in-Time Recovery (if enabled)

```bash
# MongoDB Atlas supports continuous backup with PITR
# Contact MongoDB Atlas support or use the UI for PITR
```

### Manual Data Fix

For small data issues, you can fix directly:

```bash
# Connect to MongoDB
mongosh "mongodb+srv://..."

# Example: Revert a field change
db.users.updateMany(
  { updatedAt: { $gt: ISODate("2026-02-07T00:00:00Z") } },
  { $set: { status: "active" } }
)
```

---

## 5. Emergency Procedures

### Complete Service Outage

1. **Check Azure Status**: https://status.azure.com
2. **Check Container App Logs**:
   ```bash
   az containerapp logs show \
     --name digitransac-backend \
     --resource-group rg-digitransac \
     --follow
   ```
3. **Restart the app**:
   ```bash
   az containerapp revision restart \
     --name digitransac-backend \
     --resource-group rg-digitransac \
     --revision <current-revision>
   ```

### Scale Down (Stop Bleeding)

If the issue is causing data corruption:

```bash
# Scale to zero
az containerapp update \
  --name digitransac-backend \
  --resource-group rg-digitransac \
  --min-replicas 0 \
  --max-replicas 0
```

### Re-enable After Fix

```bash
az containerapp update \
  --name digitransac-backend \
  --resource-group rg-digitransac \
  --min-replicas 1 \
  --max-replicas 3
```

---

## Version History

| Version | Date | Commit | Notes |
|---------|------|--------|-------|
| 1.1.0 | 2026-02-07 | TBD | Package updates, release management |
| 1.0.0 | 2026-02-01 | 3c75556 | Initial Azure deployment |

---

## Contacts

| Role | Contact |
|------|---------|
| On-call Engineer | [Your contact info] |
| Azure Admin | [Azure admin contact] |
| MongoDB Admin | [MongoDB admin contact] |

---

## Post-Rollback Checklist

After a rollback, ensure:

- [ ] Health checks pass (`/api/health/live` returns 200)
- [ ] Database connections work (`/api/health/ready` returns 200)
- [ ] Monitor error rates for 30 minutes
- [ ] Create incident report if production was impacted
- [ ] Update CHANGELOG.md with hotfix notes