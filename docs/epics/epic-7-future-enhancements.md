# Epic 7 - Future Enhancements

**Status:** Ideas for post-V1 improvements
**Current Version:** V1 (Basic voting/suggestions complete)
**Last Updated:** 2024-12-28

---

## Overview

Epic 7 V1 provides the core voting/suggestions functionality. This document tracks potential enhancements for future iterations based on user feedback and usage patterns.

---

## High Priority Enhancements

### 1. Geocoding API Integration

**Problem:** Users must manually enter coordinates
**Current:** Free-text city name + manual lat/long entry
**Proposed:** Autocomplete city search with automatic coordinates

**Implementation:**
- Integrate geocoding API (OpenCage, Mapbox, or Google Geocoding)
- Add autocomplete dropdown to SuggestionForm
- Auto-populate coordinates when city selected
- Fallback to manual entry if API unavailable

**Benefits:**
- Better UX (less friction)
- More accurate coordinates
- Reduced user errors

**Effort:** ~4 hours
**Dependencies:** API key + billing setup

---

### 2. Session-Based Authentication

**Problem:** Current auth is header-based (simple but not production-grade)
**Current:** `x-wallet-address` header sent from client
**Proposed:** Proper session tokens with database validation

**Implementation:**
- Add Session model to Prisma schema
- Sign-in flow: wallet signature → session token
- Verify session token on protected routes
- Session expiration (7 days default)

**Benefits:**
- More secure
- Can't spoof wallet address
- Session management
- Rate limiting per session

**Effort:** ~6 hours
**Dependencies:** None (all infrastructure exists)

**Files to modify:**
- `lib/auth-helpers.ts` - Add session validation
- `prisma/schema.prisma` - Add Session model
- All API routes - Switch to session auth

---

### 3. Admin Approval UI

**Problem:** Admins must use database directly to approve/reject
**Current:** Admin panel exists but no suggestion management
**Proposed:** Admin panel page for reviewing suggestions

**Implementation:**
- New page: `/admin/suggestions`
- Table view with filters (pending/approved/rejected)
- One-click approve/reject buttons
- Bulk actions
- Admin-only route protection

**Benefits:**
- No database access needed
- Faster approval workflow
- Audit trail (who approved what)

**Effort:** ~5 hours
**Dependencies:** Admin authentication (exists from Epic 6)

---

## Medium Priority Enhancements

### 4. User Notifications

**Problem:** Users don't know when their suggestion gets votes/approved
**Proposed:** Email or in-app notifications for key events

**Events to notify:**
- Your suggestion reached 10/25/50/100 votes
- Your suggestion was approved by admin
- Your suggestion was implemented (market created)

**Implementation Options:**
- **Email:** Use Resend or similar (requires email collection)
- **In-app:** Toast notifications when user visits site
- **Push:** Browser push notifications (requires service worker)

**Effort:** ~8 hours (email), ~12 hours (push)
**Dependencies:** Email service (Resend/SendGrid) or push service

---

### 5. Suggestion Detail Page

**Problem:** All info crammed in card, no space for extended discussion
**Proposed:** Dedicated page per suggestion at `/suggestions/[id]`

**Features:**
- Full suggestion details
- Vote history timeline
- List of wallets who voted
- Admin notes (if approved/rejected)
- Share button (social media)

**Effort:** ~3 hours
**Dependencies:** None

---

### 6. User Profile Page

**Problem:** Can't see all suggestions/votes by a specific user
**Proposed:** Profile page at `/users/[wallet]`

**Features:**
- List of suggestions by this user
- Vote history (what they voted for)
- Stats (total votes cast, suggestions made)
- Reputation score (based on implemented suggestions)

**Effort:** ~4 hours
**Dependencies:** None

---

## Low Priority / Gamification

### 7. Unlock Thresholds

**Concept:** "50 votes to unlock this city!"
**Implementation:**
- Define unlock threshold per suggestion
- Progress bar showing votes needed
- Celebration when threshold reached
- Auto-approve when threshold met (optional)

**Effort:** ~2 hours
**Impact:** Increases engagement

---

### 8. Streak Bonuses

**Concept:** Reward users who vote consistently
**Implementation:**
- Track voting streaks (consecutive days)
- Display streak badge on profile
- Bonus: Double vote weight after 7-day streak

**Effort:** ~4 hours
**Impact:** Increases daily active users

---

### 9. Suggester Rewards

**Concept:** Badge/points when your suggestion gets implemented
**Implementation:**
- Award "Implemented" badge to suggester wallet
- Display badge count on profile
- Leaderboard of top suggesters

**Effort:** ~3 hours
**Impact:** Encourages quality suggestions

---

### 10. Prediction Accuracy Tracking

**Concept:** Track if voters were right about demand
**Implementation:**
- After market created, track betting volume
- If volume > threshold, voters were "right"
- Display accuracy % on user profile

**Effort:** ~6 hours
**Dependencies:** Epic 9 (event indexing) for volume data

---

## Technical Improvements

### 11. Rate Limiting

**Problem:** No spam prevention beyond duplicate checks
**Proposed:** Rate limits on voting and suggestion creation

**Limits:**
- Max 5 suggestions per wallet per day
- Max 50 votes per wallet per day
- IP-based rate limiting for anonymous requests

**Implementation:**
- Use Upstash Redis (already in use for city rotation)
- Add rate limit middleware
- Return 429 Too Many Requests

**Effort:** ~3 hours
**Dependencies:** Upstash Redis (exists)

---

### 12. Suggestion Search

**Problem:** Can't search for specific cities
**Proposed:** Search bar to filter suggestions

**Implementation:**
- Full-text search on cityName + comment
- Filter by city, time window, status
- Advanced filters (vote range, date range)

**Effort:** ~4 hours
**Dependencies:** PostgreSQL full-text search (built-in)

---

### 13. Voting Analytics

**Problem:** No visibility into voting patterns
**Proposed:** Analytics dashboard for admin

**Metrics:**
- Votes per day (chart)
- Suggestions per day (chart)
- Top cities by suggestions
- Top voters (by vote count)
- Conversion rate (suggestions → implemented)

**Effort:** ~6 hours
**Dependencies:** Chart library (Recharts or similar)

---

### 14. Export Suggestions

**Problem:** Can't easily export for analysis
**Proposed:** CSV export for admin

**Implementation:**
- Button: "Export to CSV"
- Includes all suggestion data + vote counts
- Filtered by current view (pending/approved/etc)

**Effort:** ~2 hours
**Dependencies:** None (use Papa Parse or similar)

---

## Epic 8 Integration Ideas

### 15. Weekly Email Top Suggestions Section

**Already planned in Epic 8, but details:**
- Top 5 suggestions by votes
- Top 3 trending suggestions
- One-click approve buttons (magic links)
- "Create market" button (auto-populates scheduler)

**Effort:** Part of Epic 8
**Dependencies:** Epic 8 implementation

---

## Breaking Changes (Consider Carefully)

### 16. On-Chain Voting

**Problem:** Off-chain votes can be manipulated
**Proposed:** Move voting to smart contract

**Benefits:**
- Tamper-proof
- Transparent
- Verifiable

**Drawbacks:**
- Gas costs (even on Flare)
- Slower UX
- Can't undo votes easily

**Effort:** ~20 hours (new contract + UI changes)
**Recommendation:** Only if off-chain voting shows abuse

---

### 17. Vote Weight by Wallet Activity

**Problem:** All votes equal, regardless of user engagement
**Proposed:** Weight votes by user activity

**Factors:**
- Account age
- Total bets placed
- Win rate
- Suggestions implemented

**Drawbacks:**
- Complicated
- May discourage new users

**Effort:** ~8 hours
**Recommendation:** Monitor engagement first

---

## Monitoring & Metrics

**Track these metrics to prioritize enhancements:**

| Metric | Target | Action if Below |
|--------|--------|-----------------|
| Suggestions per week | 20+ | Promote feature more |
| Votes per suggestion | 5+ | Improve visibility |
| Suggestion → Market conversion | 10% | Better admin workflow needed |
| Repeat voters (weekly) | 50+ | Add notifications/gamification |

---

## Implementation Priority

**Recommend this order based on impact/effort ratio:**

1. **Rate Limiting** (3h) - Prevent spam
2. **Admin Approval UI** (5h) - Unblock workflow
3. **Session Auth** (6h) - Security improvement
4. **Suggestion Detail Page** (3h) - Better UX
5. **Geocoding API** (4h) - Remove friction
6. **User Notifications** (8h) - Increase engagement
7. **Voting Analytics** (6h) - Data-driven decisions

**Total for Phase 2:** ~35 hours

---

## Notes

- V1 is intentionally minimal to validate the feature
- Don't over-engineer before seeing user behavior
- Many gamification ideas can wait until we have active users
- Focus on removing friction (geocoding, session auth) first
- Admin approval UI is highest priority blocker

---

## References

- Epic 7 Implementation: `docs/plans/2024-12-28-epic-7-implementation.md`
- Epic 7 Summary: `docs/epic-7-implementation-summary.md`
- Database Schema: `apps/web/prisma/schema.prisma`
