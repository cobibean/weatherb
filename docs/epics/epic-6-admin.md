# Epic 6 — Admin Panel + Config

> **Goal:** Build an admin interface for configuring the platform and monitoring operations.

---

## Decisions Made (Reversible)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth | **Wallet allowlist** | Simple, no passwords, crypto-native |
| Location | **Separate route in web app** | No separate deploy needed |
| Database | **Prisma + PostgreSQL** | Already using for indexing |
| Admin wallets | **Single wallet to start; allowlist-backed** | Keep scope small; support future multi-admin |

---

## ✅ User Decisions Locked

- **Admin wallet:** `<ADMIN_WALLET_ADDRESS_PLACEHOLDER>` (start with one address, but keep `admin_wallets[]` allowlist design).
- **Future-proofing:** Keep revoke/rotate flow ready so a lost key doesn't brick the project. Multi-admin optional later; design supports it.

---

## Admin Features

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Cadence | 5 minutes | Time between market resolve times |
| Testing Mode | true | Single city only when enabled |
| Daily Market Count | 5 | Markets created per day |
| Betting Buffer | 10 minutes | Close betting this long before resolve (admin-adjustable) |

### City Management

- View allowlisted cities
- Add new city (name, lat/long, timezone)
- Deactivate city (soft delete)

### Bot Management

- View settler bot address
- Update settler address (triggers contract call)
- View scheduler status

### Emergency Controls

- Pause all betting
- Pause settlement
- Emergency cancel specific market

---

## Page Structure

```
apps/web/src/app/
└── admin/
    ├── layout.tsx            # Admin layout + auth check
    ├── page.tsx              # Dashboard overview
    ├── settings/
    │   └── page.tsx          # System settings
    ├── cities/
    │   └── page.tsx          # City management
    ├── markets/
    │   └── page.tsx          # Market list + actions
    └── logs/
        └── page.tsx          # Settlement logs
```

---

## Auth Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';

const ADMIN_WALLETS = process.env.ADMIN_WALLETS?.split(',') || [];

export function middleware(request) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Check for admin session cookie
    const session = request.cookies.get('admin_session');
    
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    
    // Verify session contains allowed wallet
    const wallet = verifySession(session.value);
    if (!ADMIN_WALLETS.includes(wallet.toLowerCase())) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
}
```

---

## Dashboard

```tsx
// app/admin/page.tsx
export default async function AdminDashboard() {
  const stats = await getAdminStats();
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Provider Status" value={stats.providerHealth} />
        <StatCard title="Markets Today" value={stats.marketsToday} />
        <StatCard title="Settlement Queue" value={stats.pendingSettlements} />
        <StatCard title="Fees (24h)" value={`${stats.fees24h} FLR`} />
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <RecentMarketsTable markets={stats.recentMarkets} />
        <FailedSettlementsTable failures={stats.failures} />
      </div>
    </div>
  );
}
```

---

## Tasks

### 6.1 Admin Auth
- [ ] Create admin login page with wallet signature
- [ ] Implement session management
- [ ] Add middleware for admin routes
- [ ] Environment variable for admin wallet list

### 6.2 Dashboard
- [ ] Create stats overview cards
- [ ] Provider health display
- [ ] Recent markets table
- [ ] Settlement failures list

### 6.3 Settings Page
- [ ] CRUD for system settings
- [ ] Validation for cadence/buffer values
- [ ] Save to database

### 6.4 City Management
- [ ] City list with status
- [ ] Add city form (name, lat, long, timezone)
- [ ] Deactivate/reactivate city

### 6.5 Emergency Controls
- [ ] Pause buttons with confirmation
- [ ] Market cancel with refund trigger
- [ ] Audit log for admin actions

---

## Database Schema Additions

```prisma
// prisma/schema.prisma

model SystemConfig {
  id        String   @id @default("default")
  cadence   Int      @default(5)     // minutes
  testMode  Boolean  @default(true)
  dailyCount Int     @default(5)
  bettingBuffer Int  @default(60)    // seconds
  isPaused  Boolean  @default(false)
  updatedAt DateTime @updatedAt
}

model City {
  id        String   @id @default(cuid())
  name      String
  latitude  Float
  longitude Float
  timezone  String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
}

model AdminLog {
  id        String   @id @default(cuid())
  wallet    String
  action    String
  details   Json?
  createdAt DateTime @default(now())
}
```

---

## Acceptance Criteria

- [ ] Only allowlisted wallets can access /admin
- [ ] Dashboard shows real-time stats
- [ ] Settings can be modified and persist
- [ ] Cities can be added/deactivated
- [ ] Pause buttons work (contract + services)
- [ ] All admin actions logged

---

## Dependencies

- **Epic 0:** Database setup
- **Epic 5:** Web app structure
- **Epic 2:** Contract pause functions

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Admin auth | 3 hours |
| Dashboard | 4 hours |
| Settings page | 3 hours |
| City management | 3 hours |
| Emergency controls | 3 hours |
| **Total** | **~16 hours** |

