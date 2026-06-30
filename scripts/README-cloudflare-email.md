# Cloudflare Email Routing Setup Guide

⚠️ **Note**: Your domain `weatherb.app` currently uses **Vercel DNS**, not Cloudflare DNS. 
For Vercel DNS, use **ImprovMX** instead (see `README-improvmx-email.md`).

If you want to use Cloudflare Email Routing, you'll need to:
1. Move your domain's nameservers to Cloudflare (free)
2. Then use this guide

---

This guide will help you set up email addresses for `weatherb.app` using Cloudflare Email Routing (100% free).

## Prerequisites

1. **Cloudflare Account**: Your domain `weatherb.app` must be added to Cloudflare
2. **API Token**: Create a Cloudflare API token with Email Routing permissions
3. **Zone ID & Account ID**: You'll need these IDs from Cloudflare

## Quick Setup (Automated)

### Step 1: Get Your Cloudflare IDs

1. **Zone ID**: 
   - Go to Cloudflare Dashboard → Select `weatherb.app`
   - Scroll down on Overview page → Zone ID is on the right sidebar

2. **Account ID**:
   - Go to Cloudflare Dashboard → Right sidebar → Account ID is shown

3. **Create API Token**:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use "Edit zone DNS" template
   - Add custom permissions:
     - `Email Routing:Edit` (Zone)
   - Select your zone: `weatherb.app`
   - Create token and copy it

### Step 2: Add Environment Variables

Add these to your `.env` file:

```bash
# Cloudflare Email Routing
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
FORWARD_TO_EMAIL=your-personal-email@gmail.com
```

### Step 3: Run the Setup Script

```bash
pnpm tsx scripts/setup-cloudflare-email.ts
```

That's it! The script will:
- ✅ Enable Email Routing DNS records
- ✅ Create destination address (your personal email)
- ✅ Create routing rules for:
  - `hello@weatherb.app`
  - `contact@weatherb.app`
  - `admin@weatherb.app`
  - `noreply@weatherb.app`
  - `support@weatherb.app`
- ✅ Create catch-all rule (forwards everything else)

## Manual Setup (Alternative)

If you prefer to set it up manually:

1. **Enable Email Routing**:
   - Cloudflare Dashboard → `weatherb.app` → Email → Email Routing
   - Click "Get Started"
   - Cloudflare will add DNS records automatically

2. **Create Destination Address**:
   - Email Routing → Addresses → Create Address
   - Add your personal email (e.g., `your-email@gmail.com`)
   - Verify the email (check your inbox)

3. **Create Routing Rules**:
   - Email Routing → Rules → Create Rule
   - For each address (`hello@weatherb.app`, etc.):
     - Name: "Forward hello@weatherb.app"
     - Matcher: `to` equals `hello@weatherb.app`
     - Action: Forward to your destination address

## Testing

After setup, test your email addresses:

```bash
# Send a test email to hello@weatherb.app
# It should forward to your personal email within a few minutes
```

## Sending Emails (Optional)

To send emails FROM `@weatherb.app` addresses:

1. **Gmail Setup**:
   - Gmail → Settings → Accounts → Send mail as
   - Add another email address: `hello@weatherb.app`
   - SMTP Server: `smtp.mx.cloudflare.net`
   - Port: `587`
   - Security: TLS
   - Username: Your Cloudflare email address
   - Password: Use Cloudflare Email Routing password (generate in dashboard)

2. **Or use Resend** (already configured):
   - Your app already uses Resend for sending emails
   - Update `EMAIL_FROM` in `.env` to use `@weatherb.app` addresses
   - Resend will handle sending from your domain

## Troubleshooting

- **DNS not working?** Wait 5-10 minutes for DNS propagation
- **Emails not forwarding?** Check Cloudflare Email Routing dashboard for errors
- **API errors?** Verify your API token has correct permissions
- **Can't verify destination?** Check spam folder for verification email

## Email Addresses Created

The script creates these addresses (all forward to your personal email):
- `hello@weatherb.app` - General inquiries
- `contact@weatherb.app` - Contact form
- `admin@weatherb.app` - Admin notifications
- `noreply@weatherb.app` - Automated emails
- `support@weatherb.app` - Support requests
- Catch-all: `*@weatherb.app` - Everything else
