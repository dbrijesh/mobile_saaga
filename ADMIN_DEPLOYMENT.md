# Admin Dashboard Deployment Details

## 🚀 Deployed Admin Dashboard

### Live URL
```
http://saaga-admin-dashboard-1767096900.s3-website-ap-southeast-1.amazonaws.com
```

**Access your admin dashboard here:** [http://saaga-admin-dashboard-1767096900.s3-website-ap-southeast-1.amazonaws.com](http://saaga-admin-dashboard-1767096900.s3-website-ap-southeast-1.amazonaws.com)

---

## 📋 Deployment Details

### AWS Resources

**S3 Bucket Name:** `saaga-admin-dashboard-1767096900`
**Region:** `ap-southeast-1` (Singapore)
**Hosting Type:** S3 Static Website Hosting

### Backend API Configuration

The admin dashboard is already configured to connect to your backend:

```
API URL: https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev
```

---

## 🔑 Admin Login

To access the admin dashboard, you'll need to:

1. **Create an admin user** in AWS Cognito:
   ```bash
   aws cognito-idp admin-create-user \
     --user-pool-id ap-southeast-1_iORsaH7z5 \
     --username admin@saaga.com \
     --user-attributes Name=email,Value=admin@saaga.com Name=name,Value="Admin User" \
     --temporary-password "TempPass123!" \
     --region ap-southeast-1
   ```

2. **Sign in** with the credentials:
   - Email: `admin@saaga.com`
   - Password: `TempPass123!` (you'll be prompted to change it on first login)

---

## 🔧 Redeployment

To redeploy the admin dashboard after making changes:

1. **Build the app:**
   ```bash
   cd admin
   npx vite build
   ```

2. **Upload to S3:**
   ```bash
   aws s3 sync dist/ s3://saaga-admin-dashboard-1767096900/ --region ap-southeast-1 --delete
   ```

3. **(Optional) Invalidate CloudFront cache** if you set up CloudFront:
   ```bash
   aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
   ```

---

## 🌐 Custom Domain (Optional)

To use a custom domain (e.g., admin.saaga.com):

### Option 1: CloudFront + Route 53

1. **Create CloudFront distribution:**
   - Origin: `saaga-admin-dashboard-1767096900.s3-website-ap-southeast-1.amazonaws.com`
   - Alternate domain names: `admin.saaga.com`
   - SSL certificate: Request via AWS Certificate Manager

2. **Update Route 53:**
   - Create A record pointing to CloudFront distribution
   - Enable alias record

### Option 2: AWS Amplify Hosting

Alternatively, you can use AWS Amplify for easier custom domain setup:

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify
amplify init

# Add hosting
amplify add hosting

# Deploy
amplify publish
```

---

## 🔐 Security Recommendations

### 1. Enable HTTPS (Recommended)

The current deployment uses HTTP. For production, set up CloudFront with SSL:

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name saaga-admin-dashboard-1767096900.s3-website-ap-southeast-1.amazonaws.com \
  --default-root-object index.html
```

### 2. Restrict Admin Access

Add IP whitelisting or Cognito authentication:

- Use AWS WAF to restrict access by IP
- Implement Cognito authentication (already configured in the app)

### 3. Enable Logging

```bash
aws s3api put-bucket-logging \
  --bucket saaga-admin-dashboard-1767096900 \
  --bucket-logging-status file://logging.json
```

---

## 📊 Features Available

The deployed admin dashboard includes:

✅ **Dashboard Overview**
- Total orders, revenue, active users
- Recent orders list
- Sales charts

✅ **Order Management**
- View all orders
- Filter by status (pending, processing, delivered, etc.)
- Update order status
- View order details

✅ **Inventory Management**
- View all products
- Update stock levels
- Manage product information

✅ **Authentication**
- AWS Cognito integration
- Secure login/logout

---

## 🛠 Troubleshooting

### Issue: "Access Denied" when accessing the URL

**Solution:** Check that the bucket policy is correctly applied:
```bash
aws s3api get-bucket-policy --bucket saaga-admin-dashboard-1767096900 --region ap-southeast-1
```

### Issue: Changes not appearing after redeployment

**Solution:** Clear browser cache or use hard refresh (Ctrl+Shift+R)

### Issue: API calls failing

**Solution:** Check CORS configuration in the backend serverless.yml:
```yaml
cors: true
```

---

## 📱 Mobile-Friendly

The admin dashboard is responsive and works on:
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Tablets (iPad, Android tablets)
- Mobile devices (iOS, Android)

---

## 💡 Next Steps

1. **Create admin users** in Cognito
2. **Test the dashboard** by logging in
3. **(Optional) Set up CloudFront** for HTTPS and better performance
4. **(Optional) Configure custom domain**
5. **Set up monitoring** with CloudWatch

---

## 📝 Cost Estimate

### S3 Hosting
- Storage: ~1 MB = $0.023/month
- Data transfer: First 100 GB free
- Requests: First 2,000 free

### Estimated Monthly Cost
- **Without CloudFront:** ~$0.50/month
- **With CloudFront:** ~$1-2/month (depends on traffic)

---

## 🔗 Related Resources

- **Backend API:** https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev
- **Backend Documentation:** See BACKEND_CONFIGURATION.md
- **API Documentation:** See API_DOCUMENTATION.md
- **Cognito User Pool:** ap-southeast-1_iORsaH7z5

---

## ✅ Deployment Summary

- ✅ Built admin app successfully
- ✅ Created S3 bucket: saaga-admin-dashboard-1767096900
- ✅ Uploaded static files to S3
- ✅ Configured static website hosting
- ✅ Set public read permissions
- ✅ Admin dashboard live at: http://saaga-admin-dashboard-1767096900.s3-website-ap-southeast-1.amazonaws.com

**Your admin dashboard is now live and ready to use!** 🎉
