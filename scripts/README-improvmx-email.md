# ImprovMX Email Forwarding Setup Guide

Since `weatherb.app` uses **Vercel DNS** (not Cloudflare), ImprovMX is the perfect free solution for email forwarding!

## Why ImprovMX?

- ✅ **100% Free** for 1 domain with 25 aliases
- ✅ Works with **any DNS provider** (including Vercel)
- ✅ No need to change nameservers
- ✅ Simple API for automation
- ✅ Fast setup

## Quick Setup (Automated)

### Step 1: Create ImprovMX Account

1. Go to https://improvmx.com
2. Sign up for free account
3. Go to https://improvmx.com/api
4. Copy your API key

### Step 2: Add Environment Variables

Add to your `.env` file:

```bash
# ImprovMX Email Forwarding
IMPROVMX_API_KEY=your_api_key_here
FORWARD_TO_EMAIL=your-personal-email@gmail.com
```

### Step 3: Run the Setup Script

```bash
npm exec -- tsx scripts/setup-improvmx-email.ts
```

The script will:
1. ✅ Add `weatherb.app` to ImprovMX
2. ✅ Show you DNS records to add to Vercel
3. ✅ Create email aliases:
   - `hello@weatherb.app`
   - `contact@weatherb.app`
   - `admin@weatherb.app`
   - `noreply@weatherb.app`
   - `support@weatherb.app`
   - `*@weatherb.app` (catch-all)

### Step 4: Add DNS Records to Vercel

The script will show you the DNS records needed. Add them in:

**Vercel Dashboard → Your Project → Settings → Domains → weatherb.app → DNS**

You'll need to add:
- **MX Record**: Points to ImprovMX mail servers
- **TXT Record**: For domain verification

After adding DNS records:
- Wait 5-10 minutes for DNS propagation
- Run the script again to create aliases (or create them manually)

## Manual Setup (Alternative)

If you prefer to set it up manually:

1. **Add Domain to ImprovMX**:
   - Go to https://improvmx.com
   - Click "Add Domain"
   - Enter `weatherb.app`
   - Enter your notification email

2. **Add DNS Records to Vercel**:
   - ImprovMX will show you MX and TXT records
   - Add them in Vercel Dashboard → Domains → weatherb.app → DNS

3. **Verify Domain**:
   - Wait for DNS propagation (5-10 minutes)
   - ImprovMX will verify automatically

4. **Create Aliases**:
   - In ImprovMX dashboard, go to Aliases
   - Create each alias:
     - `hello@weatherb.app` → your-email@gmail.com
     - `contact@weatherb.app` → your-email@gmail.com
     - etc.

## Testing

After setup, test your email addresses:

```bash
# Send a test email to hello@weatherb.app
# It should forward to your personal email within a few minutes
```

## Sending Emails FROM @weatherb.app

To send emails FROM `@weatherb.app` addresses:

1. **Gmail Setup**:
   - Gmail → Settings → Accounts → Send mail as
   - Add another email address: `hello@weatherb.app`
   - SMTP Server: `smtp.improvmx.com`
   - Port: `587`
   - Security: TLS
   - Username: Your ImprovMX email address
   - Password: Use ImprovMX SMTP password (generate in dashboard)

2. **Or use Resend** (already configured):
   - Your app already uses Resend for sending emails
   - Update `EMAIL_FROM` in `.env` to use `@weatherb.app` addresses
   - Resend will handle sending from your domain (requires domain verification in Resend)

## Troubleshooting

- **DNS not working?** Wait 5-10 minutes for DNS propagation
- **Emails not forwarding?** Check ImprovMX dashboard for errors
- **API errors?** Verify your API key is correct
- **Domain not verified?** Make sure TXT record is added correctly in Vercel DNS

## Email Addresses Created

The script creates these addresses (all forward to your personal email):
- `hello@weatherb.app` - General inquiries
- `contact@weatherb.app` - Contact form
- `admin@weatherb.app` - Admin notifications
- `noreply@weatherb.app` - Automated emails
- `support@weatherb.app` - Support requests
- Catch-all: `*@weatherb.app` - Everything else

## Free Plan Limits

- ✅ 1 domain
- ✅ 25 aliases per domain
- ✅ Unlimited forwarding
- ✅ Catch-all support

Perfect for weatherB! 🎉
