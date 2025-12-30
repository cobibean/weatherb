# Epic 8 Setup Checklist

## Complete Setup Guide for AI-Powered City Approval Workflow

### Prerequisites

- [ ] Node.js 18+ installed
- [ ] PostgreSQL database running
- [ ] Flare/Coston2 wallet with FLR for gas
- [ ] Vercel account for deployment
- [ ] Resend account for emails
- [ ] OpenAI API key for AI insights

### Environment Variables Setup

#### 1. Core Database & Redis

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/weatherb
DIRECT_URL=postgresql://user:pass@host:5432/weatherb

# Redis (for city rotation)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

#### 2. Blockchain Configuration

```bash
# Network
RPC_URL=https://coston2-api.flare.network/ext/C/rpc
NEXT_PUBLIC_CHAIN_ID=114
NEXT_PUBLIC_CONTRACT_ADDRESS=0x_YOUR_CONTRACT

# Private Keys (Generate new wallets!)
SCHEDULER_PRIVATE_KEY=0x_SCHEDULER_KEY  # For creating markets
SETTLER_PRIVATE_KEY=0x_SETTLER_KEY      # For settling markets
ADMIN_PRIVATE_KEY=0x_ADMIN_KEY          # For admin operations

# Admin Access
ADMIN_WALLETS=0x_WALLET1,0x_WALLET2     # Comma-separated admin wallets
```

#### 3. Epic 8 Specific

```bash
# Email Configuration
RESEND_API_KEY=re_YOUR_API_KEY          # From resend.com
ADMIN_EMAIL=admin@example.com           # Where to send reports
EMAIL_FROM=WeatherB <noreply@weatherb.com>

# AI Integration
OPENAI_API_KEY=sk-YOUR_OPENAI_KEY       # For weekly insights

# Magic Links
MAGIC_LINK_SECRET=xxx                    # Generate: openssl rand -hex 32

# Test Window Configuration
TEST_WALLET_ENCRYPTION_KEY=xxx          # Generate: openssl rand -hex 32
TEST_FUNDING_AMOUNT=10                  # FLR per test wallet
TEST_MARKET_COUNT=5                      # Markets per test

# Security
CRON_SECRET=xxx                          # For Vercel cron auth

# App URL
NEXT_PUBLIC_APP_URL=https://weatherb.com
```

### Database Setup

#### 1. Run Migrations

```bash
# Generate Prisma client
pnpm prisma generate

# Push schema to database
pnpm prisma db push

# Verify schema
pnpm prisma studio
```

#### 2. Verify Tables Created

Check for these Epic 8 tables:
- `Market` - With isTest field
- `TestRun` - Test window tracking
- `MagicLink` - Approval tokens
- `Suggestion` - City suggestions
- `Vote` - Suggestion votes

### Vercel Deployment

#### 1. Install Vercel CLI

```bash
npm i -g vercel
```

#### 2. Deploy Application

```bash
# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### 3. Configure Environment Variables

In Vercel Dashboard:
1. Go to Settings → Environment Variables
2. Add all variables from `.env`
3. Ensure they're available for Production

#### 4. Setup Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 9 * * 1"
    },
    {
      "path": "/api/cron/test-monitor",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/settle-markets",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Testing the System

#### 1. Test Database Connection

```bash
pnpm prisma db pull
# Should complete without errors
```

#### 2. Test Email System

```bash
# Create test file: test-email.ts
import { sendTestEmail } from './src/lib/email';

await sendTestEmail({
  to: 'your-email@example.com',
  subject: 'Test Email',
  html: '<p>Epic 8 email test</p>'
});

# Run: pnpm tsx test-email.ts
```

#### 3. Test Wallet Generation

```bash
# Create test file: test-wallets.ts
import { generateTestWallets } from './src/lib/test-wallets';

const wallets = await generateTestWallets(3);
console.log('Generated wallets:', wallets.length);

# Run: pnpm tsx test-wallets.ts
```

#### 4. Test AI Integration

```bash
curl http://localhost:3000/api/admin/test-weekly-report
# Should return metrics (email won't send without config)
```

#### 5. Test Magic Links

```bash
# Generate a magic link
curl -X POST http://localhost:3000/api/admin/suggestions/approve \
  -H "Content-Type: application/json" \
  -d '{"suggestionId": "test-123"}'

# Check the response for magic link URL
```

### Production Checklist

#### Security

- [ ] All private keys are unique (not from examples)
- [ ] ENCRYPTION_KEY is securely generated
- [ ] MAGIC_LINK_SECRET is unique
- [ ] CRON_SECRET is configured
- [ ] Admin wallets are correct
- [ ] Database has SSL enabled

#### Configuration

- [ ] Email "from" address verified in Resend
- [ ] OpenAI API key has sufficient credits
- [ ] Contract addresses are correct for network
- [ ] RPC URL matches the blockchain network
- [ ] App URL is production domain

#### Testing

- [ ] Create test suggestion through UI
- [ ] Approve suggestion starts test window
- [ ] Test window completes after 4 hours
- [ ] Email received with results
- [ ] Magic links work for approve/deny
- [ ] Weekly report generates on Monday

#### Monitoring

- [ ] Vercel logs accessible
- [ ] Database metrics visible
- [ ] Email delivery tracking enabled
- [ ] Error alerting configured
- [ ] Cron job monitoring active

### Post-Deployment Verification

1. **Create Test Suggestion**:
```bash
curl -X POST https://weatherb.com/api/suggestions \
  -H "Content-Type: application/json" \
  -d '{
    "customCityName": "Test City",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "wallet": "0xYourWallet"
  }'
```

2. **Check Admin Panel**:
- Navigate to `/admin`
- Verify suggestion appears in "Pending" tab
- Click "Start Test" button

3. **Monitor Test Progress**:
- Check "Testing" tab shows active test
- Wait for email after 4 hours
- Verify all metrics in email

4. **Test Magic Links**:
- Click approve/deny link in email
- Verify redirect to confirmation page
- Check suggestion status updated

5. **Verify Weekly Report**:
- Wait for Monday 9 AM UTC, or
- Trigger manually: `/api/admin/test-weekly-report?sendEmail=true`
- Verify AI insights included

### Troubleshooting

#### "Database connection failed"
- Check DATABASE_URL format
- Verify database is accessible
- Check SSL requirements

#### "Email not sending"
- Verify RESEND_API_KEY
- Check ADMIN_EMAIL is set
- Look for errors in Resend dashboard

#### "Test window not starting"
- Check SCHEDULER_PRIVATE_KEY has FLR
- Verify contract address
- Check RPC_URL is accessible

#### "AI insights missing"
- Verify OPENAI_API_KEY
- Check API credits
- System falls back to template if AI fails

#### "Magic links not working"
- Check MAGIC_LINK_SECRET is set
- Verify APP_URL is correct
- Check link hasn't expired (48 hours)

### Rollback Procedure

If issues after deployment:

1. **Revert Vercel Deployment**:
```bash
vercel rollback
```

2. **Restore Database** (if schema changed):
```bash
# From backup
pg_restore -d weatherb backup.sql
```

3. **Clear Test Data**:
```sql
DELETE FROM "TestRun" WHERE "createdAt" > '2024-01-01';
DELETE FROM "Market" WHERE "isTest" = true;
DELETE FROM "MagicLink" WHERE "used" = false;
```

### Success Criteria

- [ ] Admin can approve/deny suggestions
- [ ] Test windows run automatically
- [ ] Results emails sent successfully
- [ ] Magic links work correctly
- [ ] Weekly reports generated with AI insights
- [ ] Test markets hidden from public
- [ ] Funds recovered after tests
- [ ] No private keys exposed in logs

### Support Resources

- **Documentation**: `/docs/epic-8-implementation-guide.md`
- **Admin Manual**: `/docs/admin-operations-manual.md`
- **Integration Tests**: `/src/lib/__tests__/integration/`
- **Vercel Logs**: dashboard.vercel.com
- **Database Admin**: Supabase/PostgreSQL dashboard