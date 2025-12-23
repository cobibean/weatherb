# Admin Panel Wishlist

> Future enhancements for the WeatherB admin panel. Items are organized by priority and complexity.

---

## 📊 Analytics & Charts

| Feature | Description | Priority | Complexity |
|---------|-------------|----------|------------|
| **Volume Over Time** | Line chart showing daily/weekly betting volume | High | Medium |
| **YES vs NO Distribution** | Bar chart of bet split across all markets | Medium | Low |
| **Settlement Success Rate** | Track FDC verification reliability | High | Medium |
| **Revenue Chart** | Running total of 1% fee from losing pools | Medium | Low |
| **User Growth** | Daily signups over time | Low | Low |

---

## 🎯 Market Management

| Feature | Description | Priority | Complexity |
|---------|-------------|----------|------------|
| **Recent Markets Table** | List with status, city, threshold, volume, time remaining | High | Medium |
| **Create Market Form** | Manual market creation (override scheduler) | Medium | High |
| **Pause/Cancel Market** | Emergency controls with confirmation | High | Medium |
| **Market Queue Preview** | Upcoming scheduled markets | Medium | Low |
| **Edit Market Threshold** | Adjust threshold before betting starts | Low | Medium |

---

## 👥 User Insights

| Feature | Description | Priority | Complexity |
|---------|-------------|----------|------------|
| **Top Bettors Leaderboard** | Whales & most active users | Medium | Medium |
| **Wallet Distribution** | Pie chart of bet sizes | Low | Low |
| **User Search** | Find user by wallet address | Medium | Low |
| **User Activity Log** | Bet history for specific user | Low | Medium |

---

## ⚙️ System Health

| Feature | Description | Priority | Complexity |
|---------|-------------|----------|------------|
| **Settler Bot Status** | Last run, success rate, gas used | High | Medium |
| **Scheduler Status** | Next market creation time | High | Low |
| **Weather Provider Health** | API response times, uptime | High | Medium |
| **Database Stats** | Row counts, query performance | Low | Medium |
| **Contract Balance** | FLR balance for gas | Medium | Low |

---

## 🔔 Activity & Notifications

| Feature | Description | Priority | Complexity |
|---------|-------------|----------|------------|
| **Live Events Stream** | Real-time bets, settlements, new markets | Medium | High |
| **Alert Configuration** | Email/webhook for low balance, failed settlements | Medium | High |
| **Daily Summary Email** | Automated report of key metrics | Low | Medium |

---

## 🔐 Security & Access

| Feature | Description | Priority | Complexity |
|---------|-------------|----------|------------|
| **Admin Wallet Allowlist** | Manage authorized admin wallets | High | Low |
| **Audit Log** | Track admin actions | Medium | Medium |
| **2FA for Admin Actions** | Extra confirmation for critical ops | Low | High |

---

## 📱 UX Improvements

| Feature | Description | Priority | Complexity |
|---------|-------------|----------|------------|
| **Dark Mode** | Toggle for admin panel | Low | Low |
| **Keyboard Shortcuts** | Quick navigation | Low | Medium |
| **Export to CSV** | Download data for analysis | Medium | Low |
| **Mobile Responsive Tables** | Horizontal scroll or card view | Medium | Medium |

---

## Implementation Notes

### Already Built ✅
- Stats cards (Active Markets, Total Volume, Cumulative Vol., Users, Resolved, Fees Earned)
- Design system color pie chart with interactive legend
- Color palette swatches

### Next Steps
1. **Recent Markets Table** — Most practical, high value
2. **Volume Over Time Chart** — Visual impact, good for demos
3. **Settler Bot Status** — Critical for operations

---

*Last updated: December 2024*



