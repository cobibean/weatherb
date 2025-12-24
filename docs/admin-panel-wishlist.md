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
| **Create Market Form** | Manual market creation (override scheduler) | Medium | High |
| **Market Queue Preview** | Upcoming scheduled markets | Medium | Low |
| **Edit Market Threshold** | Adjust threshold before betting starts | Low | Medium |

---

## 👥 User Insights

| Feature | Description | Priority | Complexity |
|---------|-------------|----------|------------|
| **Top Bettors Leaderboard** | Whales & most active users | Medium | Medium |
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
- Dashboard stats (provider status, markets today, pending settlements, fees 24h, total volume, total users)
- Emergency controls (pause betting, pause settlement)
- System status panel + recent activity feed
- Markets management (active/past lists, cancel with confirmation)
- Activity logs (audit log with filters + pagination)
- City management (add/activate/deactivate)
- Settings (cadence, daily count, betting buffer, test mode)
- Design system color pie chart with interactive legend
- Color palette swatches

### Next Steps
1. **Volume Over Time Chart** — Visual impact, good for demos
2. **Settler Bot Status** — Critical for operations
3. **Market Queue Preview** — Helps validate scheduler output

---

*Last updated: December 2024*

