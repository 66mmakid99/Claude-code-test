# Deployment Guide

This guide covers deploying the AI Website Checker to Railway and Render.

## Prerequisites

- GitHub account
- Railway or Render account
- (Optional) Gmail account for email features

## Option 1: Deploy to Railway

### Quick Deploy

1. **Sign up for Railway**: https://railway.app
2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account and select this repository

3. **Configure Environment Variables**:
   - Go to your project settings
   - Add these variables:
     ```
     NODE_ENV=production
     PORT=5000
     ```
   - (Optional) For email features:
     ```
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=your-email@gmail.com
     SMTP_PASS=your-app-password
     SMTP_FROM=your-email@gmail.com
     ```

4. **Deploy**:
   - Railway will automatically detect the Dockerfile
   - Build and deployment will start automatically
   - Your app will be live at: `https://your-app.up.railway.app`

### Using Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
cd ai-website-checker
railway init

# Deploy
railway up

# Set environment variables
railway variables set NODE_ENV=production
railway variables set PORT=5000

# (Optional) Set SMTP variables
railway variables set SMTP_HOST=smtp.gmail.com
railway variables set SMTP_PORT=587
railway variables set SMTP_USER=your-email@gmail.com
railway variables set SMTP_PASS=your-app-password
railway variables set SMTP_FROM=your-email@gmail.com

# Open in browser
railway open
```

---

## Option 2: Deploy to Render

### Quick Deploy

1. **Sign up for Render**: https://render.com
2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select this repository

3. **Configure Service**:
   - **Name**: ai-website-checker
   - **Environment**: Docker
   - **Region**: Choose closest to your users
   - **Branch**: main (or your default branch)
   - **Plan**: Free

4. **Environment Variables**:
   - Render will auto-detect `render.yaml`
   - Add these in the dashboard:
     ```
     NODE_ENV=production
     PORT=5000
     ```
   - (Optional) For email:
     ```
     SMTP_USER=your-email@gmail.com
     SMTP_PASS=your-app-password
     SMTP_FROM=your-email@gmail.com
     ```

5. **Deploy**:
   - Click "Create Web Service"
   - Render will build and deploy automatically
   - Your app will be live at: `https://your-app.onrender.com`

### Using Render Blueprint (render.yaml)

```bash
# Push render.yaml to your repository
git add render.yaml
git commit -m "Add Render deployment config"
git push

# Then in Render dashboard:
# New → Blueprint → Connect repository
# Render will automatically use render.yaml
```

---

## Gmail Setup for Email Features (Optional)

To enable PDF report email delivery:

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Create App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password
3. **Use this password** as `SMTP_PASS` environment variable

**Alternative**: Use other SMTP providers (SendGrid, Mailgun, etc.)

---

## Post-Deployment

### Verify Deployment

```bash
# Check health endpoint
curl https://your-app-url.com/api/health

# Expected response:
{
  "status": "OK",
  "message": "AI Website Checker API is running",
  "features": {
    "singleVerification": true,
    "bulkVerification": true,
    "pdfGeneration": true,
    "emailSending": true,
    "database": true
  }
}
```

### Test Website Verification

```bash
curl -X POST https://your-app-url.com/api/verify \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

---

## Database

- SQLite database is created automatically
- Data persists on Railway/Render with volume mounting
- Database file location: `backend/ai-website-checker.sqlite`

---

## Troubleshooting

### Build Fails

- Check Dockerfile syntax
- Ensure all dependencies are in package.json
- Check Railway/Render build logs

### App Crashes After Deploy

- Check environment variables are set correctly
- Verify PORT is set to 5000
- Check application logs in Railway/Render dashboard

### Email Not Working

- Verify SMTP credentials
- Check Gmail app password is correct
- Ensure 2FA is enabled on Gmail

### 403 Errors When Analyzing Sites

- Some websites block bot requests
- This is expected behavior for sites with strict bot protection
- Try different URLs or add custom User-Agent handling

---

## Monitoring

### Railway
- View logs: `railway logs`
- View metrics in Railway dashboard

### Render
- View logs in Render dashboard
- Check deployment status and metrics

---

## Scaling

### Railway
- Upgrade to Pro plan for better performance
- Add more resources in project settings

### Render
- Upgrade from Free to Starter/Professional plan
- Configure auto-scaling in service settings

---

## Cost Estimates

### Railway
- **Free tier**: $5 credit/month (enough for testing)
- **Pro plan**: Pay as you go (~$10-20/month for low traffic)

### Render
- **Free tier**: 750 hours/month (enough for one service)
- **Starter**: $7/month per service
- ⚠️ Free tier services spin down after 15 minutes of inactivity

---

## Custom Domain (Optional)

### Railway
1. Go to project settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### Render
1. Go to service settings → Custom Domain
2. Add your domain
3. Configure DNS with provided CNAME

---

## Continuous Deployment

Both Railway and Render support automatic deployments:
- Push to main branch → Auto deploy
- Pull request previews available on paid plans

---

## Support

- Railway: https://railway.app/help
- Render: https://render.com/docs
- Project issues: [GitHub Issues](https://github.com/your-repo/issues)
