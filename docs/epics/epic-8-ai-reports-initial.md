# Epic 8 — Weekly AI Report + Email Approval Workflow

> **Goal:** Send weekly AI-generated reports to admin with recommendations, enabling one-click approvals.

---

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Email provider | **Resend** | Simple API, good DX, cheap |
| AI provider | **Anthropic Claude (claude-sonnet-4-20250514)** | Already have API key, excellent for summaries and analysis |
| Email actions | **Magic links** | One-click approve/reject without login |
| Admin report target | **cobibean777@gmail.com (env-driven)** | Configurable without code change; primary inbox for V1 |

---

## ✅ User Decisions Locked

- **Admin email:** `cobibean777@gmail.com`. Store as `ADMIN_REPORT_EMAIL` env and mirror to a DB table for redundancy.

> Still pending: report day/time preference. Anthropic API key already configured in `.env`.

---

## Schema Reference

This epic builds on Epic 7's voting schema. For detailed schema documentation including:
- City normalization strategy (`cityId` vs `customCityName`)
- Transaction isolation patterns
- Index usage and performance
- Check constraints

See: `docs/testing/database-audit-epic-7.md`

### Epic 7 Schema Used

| Field/Type | Description |
|------------|-------------|
| `SuggestionStatus` enum | `PENDING`, `APPROVED`, `REJECTED`, `IMPLEMENTED` |
| `TimeWindow` enum | `MORNING`, `AFTERNOON`, `EVENING`, `NIGHT` |
| `Suggestion.voteCount` | Total votes on the suggestion |
| `Suggestion.recentVoteCount` | Votes in last 7 days (for trending) |
| `Suggestion.cityId` | FK to City table (for known cities) |
| `Suggestion.customCityName + latitude + longitude` | For suggested new cities |

See: `docs/epics/epic-7-voting.md` and `docs/testing/database-audit-epic-7.md`

---

## Weekly Report Contents

```
📊 WeatherB Weekly Report
Week of January 15-22, 2024

━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━
Markets created:     35
Total bets placed:   142
Total volume:        2,450 FLR
Fees collected:      24.5 FLR
Unique wallets:      67
Avg bets/market:     4.1

━━━━━━━━━━━━━━━━━━━━━━━━━━
🗳️ TOP SUGGESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Miami, FL (47 total votes, +23 this week) 🔥 TRENDING
   → Morning markets requested
   → Est. demand: HIGH
   
2. Seattle, WA (31 total votes, +8 this week)
   → Afternoon preference
   → Est. demand: MEDIUM
   
3. Austin, TX (28 total votes, +5 this week)
   → No time preference
   → Est. demand: MEDIUM

━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AI RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━
Based on voting momentum and market performance:

✅ RECOMMEND ADDING: Miami, FL
   - Strong vote growth (+23 this week)
   - Similar cities perform well
   - Weather volatility is high (good for markets)

⏸️ HOLD: Seattle, WA
   - Votes growing slowly
   - Wait another week for more signal

━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ QUICK ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━
[APPROVE Miami] [REJECT Miami]
[APPROVE Seattle] [REJECT Seattle]
```

---

## Flow

```
┌──────────────────┐     ┌──────────────────┐
│  Weekly Cron     │────▶│  Gather Metrics  │
└──────────────────┘     └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Generate AI      │
                        │ Summary (Claude) │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Send Email       │
                        │ (Resend)         │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Admin Clicks     │
                        │ Approve/Reject   │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ 4-Hour Test      │
                        │ Window           │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Final Confirm    │
                        │ Email            │
                        └──────────────────┘
```

---

## Implementation

### Weekly Job (Vercel Cron Route)

```typescript
// apps/web/src/app/api/cron/weekly-report/route.ts

import { Resend } from 'resend';
import Anthropic from '@anthropic-ai/sdk';

const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(request: Request) {
  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Gather data
    const metrics = await getWeeklyMetrics();
    const suggestions = await getTopSuggestions(10, {
      includeTrending: true, // Use recentVoteCount from Epic 7
    });
    
    // Generate AI summary
    const aiSummary = await generateAISummary(metrics, suggestions);
    
    // Create magic links for actions
    const actions = await createActionLinks(suggestions.slice(0, 3));
    
    // Send email
    await resend.emails.send({
      from: 'WeatherB <reports@weatherb.app>',
      to: process.env.ADMIN_REPORT_EMAIL!,
      subject: `📊 WeatherB Weekly Report - ${formatDate(new Date())}`,
      html: renderReportEmail(metrics, suggestions, aiSummary, actions),
    });

    return Response.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Weekly report failed:', error);
    return Response.json({ error: 'Report generation failed' }, { status: 500 });
  }
}

async function generateAISummary(metrics: WeeklyMetrics, suggestions: SuggestionWithTrending[]) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', // Using Claude Sonnet for cost-effective analysis
    max_tokens: 500,
    system: 'You are an analyst for a weather prediction market. Be concise and actionable.',
    messages: [{
      role: 'user',
      content: `Analyze this data and recommend which cities to add:
        
Metrics: ${JSON.stringify(metrics)}
Top Suggestions: ${JSON.stringify(suggestions.map(s => ({
  city: s.cityId ? s.city?.name : s.customCityName,
  voteCount: s.voteCount,
  recentVoteCount: s.recentVoteCount,
  timeWindow: s.timeWindow,
  trending: s.recentVoteCount > (s.voteCount * 0.3), // 30%+ of votes this week = trending
})))}

Consider: vote momentum (recentVoteCount), similar city performance, weather volatility.
Recommend 0-2 cities to add. Be conservative.`,
    }],
  });
  
  // Extract text from Claude's response
  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock?.text ?? '';
}
```

### Magic Links

```typescript
// apps/web/src/lib/magic-links.ts

import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.MAGIC_LINK_SECRET);

export async function createActionLink(action: 'approve' | 'reject', suggestionId: string) {
  const token = await new SignJWT({ action, suggestionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);
  
  return `${process.env.APP_URL}/api/admin/action?token=${token}`;
}

export async function verifyActionLink(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as { action: string; suggestionId: string };
}
```

### Action Handler

```typescript
// apps/web/src/app/api/admin/action/route.ts

import { db } from '@/lib/db';
import { isolatedTransaction } from '@/lib/db-helpers';
import { verifyActionLink } from '@/lib/magic-links';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (!token) {
    return new Response('Missing token', { status: 400 });
  }

  try {
    const { action, suggestionId } = await verifyActionLink(token);
    
    if (action === 'approve') {
      // Transaction Safety: Use isolatedTransaction() helper from Epic 7 for status updates
      await isolatedTransaction(async (tx) => {
        await tx.suggestion.update({
          where: { id: suggestionId },
          data: { status: 'APPROVED' },
        });
      });
      
      // Start 4-hour test window
      await startTestWindow(suggestionId);
      
      return new Response('Approved! Starting 4-hour test window. You\'ll get another email with results.', {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    
    if (action === 'reject') {
      await isolatedTransaction(async (tx) => {
        await tx.suggestion.update({
          where: { id: suggestionId },
          data: { status: 'REJECTED' },
        });
      });
      
      return new Response('Rejected. This suggestion has been archived.');
    }

    return new Response('Invalid action', { status: 400 });
  } catch (error) {
    console.error('Action handler error:', error);
    return new Response('Invalid or expired token', { status: 400 });
  }
}
```

### Test Window

```typescript
// apps/web/src/lib/test-window.ts

import { db } from '@/lib/db';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

export async function startTestWindow(suggestionId: string) {
  // Fetch suggestion with city info (Epic 7 schema: cityId or customCityName)
  const suggestion = await db.suggestion.findUnique({ 
    where: { id: suggestionId },
    include: { city: true },
  });

  if (!suggestion) {
    throw new Error('Suggestion not found');
  }

  // Get city name from either cityId relation or customCityName
  const cityName = suggestion.cityId ? suggestion.city?.name : suggestion.customCityName;
  const coords = {
    latitude: suggestion.cityId ? suggestion.city?.latitude : suggestion.latitude,
    longitude: suggestion.cityId ? suggestion.city?.longitude : suggestion.longitude,
  };
  
  // Schedule tests over 4 hours
  // Note: In production, use a job queue (e.g., Upstash QStash or similar)
  const tests = [
    { delay: 0, name: 'provider_fetch' },
    { delay: 60 * 60 * 1000, name: 'forecast_accuracy' },
    { delay: 2 * 60 * 60 * 1000, name: 'settler_test' }, // Tests trusted settler pattern (Epic 3 pivot)
    { delay: 4 * 60 * 60 * 1000, name: 'final_report' },
  ];
  
  // For V1, we'll implement a simpler approach using Upstash QStash
  // or a delayed API call mechanism
  for (const test of tests) {
    await scheduleTest({
      suggestionId,
      testName: test.name,
      cityName,
      coords,
      delayMs: test.delay,
    });
  }
}

// After all tests complete
export async function sendTestResults(suggestionId: string, results: TestResult[]) {
  const suggestion = await db.suggestion.findUnique({ 
    where: { id: suggestionId },
    include: { city: true },
  });

  if (!suggestion) return;

  const allPassed = results.every(r => r.passed);
  const cityName = suggestion.cityId ? suggestion.city?.name : suggestion.customCityName;
  
  await resend.emails.send({
    from: 'WeatherB <reports@weatherb.app>',
    to: process.env.ADMIN_REPORT_EMAIL!,
    subject: `${allPassed ? '✅' : '❌'} Test Results: ${cityName}`,
    html: renderTestResultsEmail(suggestion, results, allPassed),
  });
}

async function scheduleTest(params: {
  suggestionId: string;
  testName: string;
  cityName: string | null | undefined;
  coords: { latitude: number | null | undefined; longitude: number | null | undefined };
  delayMs: number;
}) {
  // Implementation depends on chosen job queue
  // Options: Upstash QStash, Vercel KV + polling, etc.
  // Placeholder for actual implementation
  console.log(`Scheduled test: ${params.testName} for ${params.cityName} in ${params.delayMs}ms`);
}

function renderTestResultsEmail(
  suggestion: any, 
  results: TestResult[], 
  allPassed: boolean
): string {
  // Email template implementation
  return `<html>...</html>`;
}
```

---

## Tasks

### 8.1 Email Setup
- [ ] Create Resend account
- [ ] Verify sending domain
- [ ] Create email templates

### 8.2 Metrics Gathering
- [ ] Query weekly market stats
- [ ] Query suggestion votes + momentum (use `recentVoteCount`)
- [ ] Calculate derived metrics

### 8.3 AI Summary
- [ ] Create Anthropic client (API key already in `.env`)
- [ ] Install `@anthropic-ai/sdk` package
- [ ] Design prompt for recommendations
- [ ] Handle API errors gracefully

### 8.4 Magic Links
- [ ] Implement JWT-based action links
- [ ] Create action handler API route
- [ ] Handle expired/invalid tokens

### 8.5 Test Window
- [ ] Implement 4-hour test job queue
- [ ] Run provider fetch test
- [ ] Run settler pattern integration test
- [ ] Compile and send results

### 8.6 Weekly Cron Setup

**Implementation Note**: Follow the pattern established in Epic 7's trending cron job:
- Route: `apps/web/src/app/api/cron/update-trending/route.ts` (reference implementation)
- Pattern: Export GET handler, return JSON response, handle errors
- Testing: Use Vercel CLI `vercel dev` to test cron routes locally

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

This runs every Monday at 9:00 AM UTC. Adjust as needed.

Reference: See existing cron config for `/api/cron/update-trending` (Epic 7) and `/api/cron/schedule-daily` (Epic 4).

### Tasks Checklist
- [ ] Create `apps/web/src/app/api/cron/weekly-report/route.ts`
- [ ] Add cron config to `vercel.json`
- [ ] Integrate all components
- [ ] Test end-to-end

---

## Acceptance Criteria

- [ ] Weekly email arrives on schedule (Monday 9 AM UTC)
- [ ] Metrics are accurate
- [ ] AI summary is coherent and actionable
- [ ] Approve/Reject links work with one click
- [ ] 4-hour test window runs after approval
- [ ] Final confirmation email sent with results
- [ ] Approved cities added to scheduler config

---

## Dependencies

- **Epic 7:** Suggestions/votes data
  - Schema: `Suggestion`, `Vote` models with `cityId`/`customCityName` pattern
  - Fields: `voteCount`, `recentVoteCount`, `status` enum
  - Helpers: `isolatedTransaction()` for safe status updates
- **Epic 1:** Weather provider for test window
- **Epic 4:** Vercel Cron pattern for weekly job

> **Note:** Epic 3 pivoted from FDC to trusted settler pattern. Test window uses settler integration test instead of FDC attestation test.

---

## File Structure

All new files follow the Vercel cron pattern established in Epic 4 and 7:

```
apps/web/src/
├── app/api/
│   ├── admin/
│   │   └── action/
│   │       └── route.ts       # Magic link action handler
│   └── cron/
│       └── weekly-report/
│           └── route.ts       # Weekly cron job
├── lib/
│   ├── magic-links.ts         # JWT action links
│   ├── test-window.ts         # 4-hour test orchestration
│   └── weekly-metrics.ts      # Metrics gathering helpers
```

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Email setup | 2 hours |
| Metrics gathering | 3 hours |
| AI summary | 3 hours |
| Magic links | 2 hours |
| Test window | 4 hours |
| Weekly cron | 2 hours |
| **Total** | **~16 hours** |

