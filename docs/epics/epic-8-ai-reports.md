# Epic 8 — Weekly AI Report + Email Approval Workflow

> **Goal:** Send weekly AI-generated reports to admin with recommendations, enabling one-click approvals.

---

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Email provider | **Resend** | Simple API, good DX, cheap |
| AI provider | **OpenAI GPT-4** | Best for summaries, cheap at this volume |
| Email actions | **Magic links** | One-click approve/reject without login |

---

## ⚠️ Get This Answered From User

| Question | Why It Matters | Options |
|----------|----------------|---------|
| **Admin email address?** | Where to send reports | Provide email |
| **Report day/time?** | When to send weekly report | Monday 9am / Sunday evening |
| **OpenAI API key available?** | For AI summaries | Yes / Use alternative |

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
1. Miami, FL (47 votes) 🔥
   → Morning markets requested
   → Est. demand: HIGH
   
2. Seattle, WA (31 votes)
   → Afternoon preference
   → Est. demand: MEDIUM
   
3. Austin, TX (28 votes)
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
                         │ Summary (GPT-4)  │
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

### Weekly Job

```typescript
// services/scheduler/src/weekly-report.ts

import { Resend } from 'resend';
import OpenAI from 'openai';

const resend = new Resend(process.env.RESEND_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function sendWeeklyReport() {
  // Gather data
  const metrics = await getWeeklyMetrics();
  const suggestions = await getTopSuggestions(10);
  
  // Generate AI summary
  const aiSummary = await generateAISummary(metrics, suggestions);
  
  // Create magic links for actions
  const actions = await createActionLinks(suggestions.slice(0, 3));
  
  // Send email
  await resend.emails.send({
    from: 'WeatherB <reports@weatherb.app>',
    to: process.env.ADMIN_EMAIL,
    subject: `📊 WeatherB Weekly Report - ${formatDate(new Date())}`,
    html: renderReportEmail(metrics, suggestions, aiSummary, actions),
  });
}

async function generateAISummary(metrics, suggestions) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'system',
      content: 'You are an analyst for a weather prediction market. Be concise and actionable.',
    }, {
      role: 'user',
      content: `Analyze this data and recommend which cities to add:
        
Metrics: ${JSON.stringify(metrics)}
Top Suggestions: ${JSON.stringify(suggestions)}

Consider: vote momentum, similar city performance, weather volatility.
Recommend 0-2 cities to add. Be conservative.`,
    }],
    max_tokens: 500,
  });
  
  return response.choices[0].message.content;
}
```

### Magic Links

```typescript
// lib/magic-links.ts
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
// app/api/admin/action/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  const { action, suggestionId } = await verifyActionLink(token);
  
  if (action === 'approve') {
    // Update suggestion status
    await db.suggestion.update({
      where: { id: suggestionId },
      data: { status: 'APPROVED' },
    });
    
    // Start 4-hour test window
    await startTestWindow(suggestionId);
    
    return new Response('Approved! Starting 4-hour test window. You\'ll get another email with results.', {
      headers: { 'Content-Type': 'text/html' },
    });
  }
  
  if (action === 'reject') {
    await db.suggestion.update({
      where: { id: suggestionId },
      data: { status: 'REJECTED' },
    });
    
    return new Response('Rejected. This suggestion has been archived.');
  }
}
```

### Test Window

```typescript
// services/scheduler/src/test-window.ts

export async function startTestWindow(suggestionId: string) {
  const suggestion = await db.suggestion.findUnique({ where: { id: suggestionId } });
  
  // Schedule tests over 4 hours
  const tests = [
    { delay: 0, name: 'provider_fetch' },
    { delay: 60 * 60 * 1000, name: 'forecast_accuracy' },
    { delay: 2 * 60 * 60 * 1000, name: 'fdc_attestation' },
    { delay: 4 * 60 * 60 * 1000, name: 'final_report' },
  ];
  
  for (const test of tests) {
    await testQueue.add('integration-test', {
      suggestionId,
      testName: test.name,
      city: suggestion,
    }, {
      delay: test.delay,
    });
  }
}

// After all tests complete
export async function sendTestResults(suggestionId: string, results: TestResult[]) {
  const allPassed = results.every(r => r.passed);
  
  await resend.emails.send({
    from: 'WeatherB <reports@weatherb.app>',
    to: process.env.ADMIN_EMAIL,
    subject: `${allPassed ? '✅' : '❌'} Test Results: ${suggestion.cityName}`,
    html: renderTestResultsEmail(suggestion, results, allPassed),
  });
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
- [ ] Query suggestion votes + momentum
- [ ] Calculate derived metrics

### 8.3 AI Summary
- [ ] Create OpenAI client
- [ ] Design prompt for recommendations
- [ ] Handle API errors gracefully

### 8.4 Magic Links
- [ ] Implement JWT-based action links
- [ ] Create action handler API route
- [ ] Handle expired/invalid tokens

### 8.5 Test Window
- [ ] Implement 4-hour test job queue
- [ ] Run provider fetch test
- [ ] Run FDC attestation test
- [ ] Compile and send results

### 8.6 Weekly Cron
- [ ] Set up weekly cron job
- [ ] Integrate all components
- [ ] Test end-to-end

---

## Acceptance Criteria

- [ ] Weekly email arrives on schedule
- [ ] Metrics are accurate
- [ ] AI summary is coherent and actionable
- [ ] Approve/Reject links work with one click
- [ ] 4-hour test window runs after approval
- [ ] Final confirmation email sent with results
- [ ] Approved cities added to scheduler config

---

## Dependencies

- **Epic 7:** Suggestions/votes data
- **Epic 1:** Weather provider for test window
- **Epic 3:** FDC for attestation test

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

