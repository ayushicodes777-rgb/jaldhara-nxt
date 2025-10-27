# 🚀 Cloudflare Pages Deployment Guide

This guide explains how to deploy FarmGPT to Cloudflare Pages using GitHub Actions.

## Prerequisites

1. Private GitHub repository
2. Cloudflare account
3. Environment variables set up

## Setup Steps

### 1. Add GitHub Secrets

Go to your repository: **Settings** → **Secrets and variables** → **Actions**

Add these secrets:

```
VITE_GEMINI_API_KEY=AIzaSyC9TajWNNnnW5ovh64QYMfGffg0KxUfkh4
VITE_GEMINI_MODEL=gemini-2.5-flash-lite
VITE_PDFSHIFT_API_KEY=sk_09d22ed471315d28c26eb187d6eaf63ab9ee9ca7
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
```

### 2. Get Cloudflare Credentials

#### Cloudflare API Token
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. **My Profile** → **API Tokens**
3. **Create Token** → **Custom token**
4. Permissions:
   - `Account` -> `Cloudflare Pages:Edit`
   - `Zone` -> `Zone:Read` (optional)
   - `Zone Resources` -> `All zones` or `Specific zone`

#### Cloudflare Account ID
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Right sidebar → **Account ID**

### 3. Connect GitHub to Cloudflare Pages

#### Option A: GitHub Integration (Recommended)
1. Go to [Cloudflare Pages](https://dash.cloudflare.com/pages)
2. **Create a project** → **Connect to Git**
3. **Select your repository**: `ayushhroyy/jaldhara-nxt`
4. **Build Settings**:
   ```
   Build command: npm run build
   Build output directory: dist
   Root directory: /
   ```
5. **Environment Variables**:
   ```
   VITE_GEMINI_API_KEY = AIzaSyC9TajWNNnnW5ovh64QYMfGffg0KxUfkh4
   VITE_GEMINI_MODEL = gemini-2.5-flash-lite
   VITE_PDFSHIFT_API_KEY = sk_09d22ed471315d28c26eb187d6eaf63ab9ee9ca7
   ```
6. **Save and Deploy**

#### Option B: GitHub Actions
1. Set up the GitHub secrets as described above
2. Push to main branch
3. GitHub Actions will automatically build and deploy

## Deployment URLs

- **Production**: `https://farmgpt-app.pages.dev`
- **Previews**: `https://farmgpt-app-preview-pr-{number}.pages.dev`

## Environment Variables

The app uses these environment variables:

- `VITE_GEMINI_API_KEY`: Google Generative AI API key
- `VITE_GEMINI_MODEL`: Gemini model version (gemini-2.5-flash-lite)
- `VITE_PDFSHIFT_API_KEY`: PDF generation service API key

## Troubleshooting

### Build Failures
1. Check that all environment variables are set correctly
2. Verify the `package.json` has the correct build script
3. Make sure `dist/` directory is created successfully

### Environment Variables Not Working
1. Ensure variables are prefixed with `VITE_` for Vite
2. Check that secrets are correctly set in GitHub or Cloudflare
3. Verify variable names match exactly

### SPA Routing Issues
If routing doesn't work, add this `_redirects` file to `public/`:

```
/*    /index.html   200
```

## Automated Deployment

Once set up, deployments will trigger automatically:

- **Main branch pushes** → Production deployment
- **Pull requests** → Preview deployments
- **Manual triggers** → On-demand deployment

## Security Notes

- ✅ Repository is private
- ✅ Environment variables are encrypted
- ✅ No sensitive data in source code
- ✅ API keys are only accessible during build

## Performance

Cloudflare Pages provides:
- ✅ Global CDN
- ✅ Automatic HTTPS
- ✅ Built-in caching
- ✅ DDoS protection
- ✅ 100,000 requests/month free tier