# 🎓 CI/CD Setup Guide for FreeGamesScout Backend

## 📚 What You'll Learn

This guide will teach you how to set up a complete CI/CD (Continuous Integration/Continuous Deployment) pipeline using GitHub Actions and Azure.

## 🏗️ Pipeline Architecture

```
Developer → GitHub Push → CI/CD Pipeline → Azure Production
    ↓           ↓              ↓              ↓
  Code       Triggers        Tests &         Live App
 Changes     Workflow        Build &         Running
                            Deploy
```

## 🔧 What Our Pipeline Does

### **Stage 1: Continuous Integration (CI)**
1. **Code Quality Checks**
   - Security audit (`npm audit`)
   - Dependency vulnerability scanning

2. **Functional Testing**
   - Scraping functionality test (Epic, Steam, GOG, Prime Gaming)
   - API endpoint testing

3. **Container Testing**
   - Docker build verification
   - Container runtime testing

### **Stage 2: Continuous Deployment (CD)**
1. **Azure Authentication**
2. **Infrastructure Provisioning** (Azure Container Apps, Database, etc.)
3. **Application Deployment**
4. **Health Verification**

## 🔐 Required GitHub Secrets

You need to set up these secrets in your GitHub repository:

### **Step 1: MongoDB Connection String**
```
Secret Name: MONGO_CONNECTION_STRING
Value: mongodb+srv://xxxxxxxx
```

### **Step 2: Azure Credentials**
We need to create an Azure Service Principal for GitHub to authenticate with Azure.

#### **Commands to run:**
```bash
# Login to Azure (you'll need Azure CLI installed)
az login

# Get your subscription ID
az account show --query id --output tsv

# Create service principal (replace YOUR_SUBSCRIPTION_ID)
az ad sp create-for-rbac \
  --name "freegamesscout-github-actions" \
  --role contributor \
  --scopes /subscriptions/YOUR_SUBSCRIPTION_ID \
  --sdk-auth
```

The output will be JSON like this:
```json
{
  "clientId": "xxxx",
  "clientSecret": "xxxx",
  "subscriptionId": "xxxx",
  "tenantId": "xxxx"
}
```

#### **GitHub Secrets to create:**
```
Secret Name: AZURE_CREDENTIALS
Value: [paste the entire JSON output above]

Secret Name: AZURE_SUBSCRIPTION_ID  
Value: [your subscription ID]
```

## 🌍 GitHub Variables (Optional)

```
Variable Name: AZURE_LOCATION
Value: eastus (or your preferred region)
```

## 📋 Setup Checklist

### **Phase 1: GitHub Repository Setup**
- [ ] Push your code to GitHub
- [ ] Create `.github/workflows/ci-cd.yml` file
- [ ] Set up GitHub secrets

### **Phase 2: Azure Prerequisites**
- [ ] Install Azure CLI (`brew install azure-cli` on macOS)
- [ ] Run `az login` to authenticate
- [ ] Create Azure Service Principal
- [ ] Add secrets to GitHub

### **Phase 3: Test the Pipeline**
- [ ] Push changes to trigger workflow
- [ ] Monitor GitHub Actions tab
- [ ] Verify deployment in Azure

## 🚀 How to Deploy

### **Manual Trigger (Testing)**
1. Go to your GitHub repository
2. Click on "Actions" tab
3. Select "CI/CD Pipeline" workflow
4. Click "Run workflow"

### **Automatic Trigger (Production)**
1. Make changes to your code
2. Commit and push to `main` branch
3. Pipeline automatically runs
4. If tests pass, deploys to Azure

## 🔍 Monitoring Your Pipeline

### **GitHub Actions Dashboard**
- **Green ✅**: Step completed successfully
- **Red ❌**: Step failed, click to see details
- **Yellow 🟡**: Step is currently running

### **Pipeline Stages**
1. **🧪 Run Tests**: Validates your code works
2. **🐳 Docker Build & Test**: Ensures containerization works
3. **🚀 Deploy to Azure**: Deploys to production (only on main branch)

## 🎯 Benefits You Get

1. **Automated Quality Assurance**
   - Every change is tested before deployment
   - Catches bugs before they reach production

2. **Zero-Downtime Deployments**
   - Blue-green deployment strategy
   - Rollback capability if issues occur

3. **Consistent Environments**
   - Same deployment process every time
   - Infrastructure as Code (Bicep templates)

4. **Security Best Practices**
   - Secrets management through GitHub
   - Least-privilege Azure permissions

## 🔧 Troubleshooting Common Issues

### **"Secret not found" errors**
- Check that all required secrets are set in GitHub
- Verify secret names match exactly (case-sensitive)

### **Azure authentication failures**
- Verify Azure Service Principal has correct permissions
- Check that subscription ID is correct

### **Docker build failures**
- Check Dockerfile syntax
- Verify all dependencies are properly specified

## 📚 Next Steps After Setup

1. **Monitor First Deployment**
2. **Set up Branch Protection Rules**
3. **Add More Tests** (unit tests, integration tests)
4. **Configure Notifications** (Slack, email alerts)
5. **Add Staging Environment** (deploy to staging first, then production)

## 🎓 Learning Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Azure Container Apps Documentation](https://docs.microsoft.com/en-us/azure/container-apps/)
- [Azure Developer CLI Guide](https://docs.microsoft.com/en-us/azure/developer/azure-developer-cli/)

---

**Ready to set up? Follow the steps above, and I'll help you through any issues!**
