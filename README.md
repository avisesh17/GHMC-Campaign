# GHMC Campaign Management App

Multi-tenant SaaS platform for managing GHMC election campaigning.

## Quick Start (5 minutes)

```bash
# 1. Install dependencies
cd packages/api && npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 3. Run setup (creates DB schema + loads sample data)
bash scripts/setup.sh

# 4. Start API
npm run dev

# 5. Test
curl http://localhost:3001/health
```

## Test Accounts

| Role | Phone | Name |
|------|-------|------|
| Corporator | 9900112233 | K. Ramesh |
| Ward Admin | 9811223344 | Anita Reddy |
| Volunteer | 9922334455 | Suresh Patil (Booth 12) |
| Volunteer | 9933445566 | Ravi Kumar (Booth 07) |

Campaign slug: **bjp-ward42**

## Project Structure

```
ghmc-campaign/
├── packages/
│   ├── api/               # Fastify backend (Node.js + TypeScript)
│   │   ├── src/
│   │   │   ├── server.ts          # App entry point
│   │   │   ├── routes/            # All API routes
│   │   │   ├── middleware/        # Auth + tenant + errors
│   │   │   └── plugins/db.ts      # Database connection
│   │   └── tests/                 # Jest test suite (48 tests)
│   └── db/
│       ├── migrations/
│       │   ├── public/            # Shared schema (wards, tenants)
│       │   └── tenant/            # Per-corporator schema template
│       └── seeds/                 # 30 sample voters + full campaign data
├── apps/
│   └── mobile/            # React Native + Expo mobile app
│       └── src/
│           ├── screens/           # All app screens
│           ├── services/api.ts    # API client + offline queue
│           ├── store/authStore.ts # Zustand auth state
│           └── navigation/        # React Navigation setup
├── scripts/
│   ├── setup.sh           # One-shot local setup
│   └── run_tests.sh       # Shell-based QA test runner
└── docs/
    └── DEPLOYMENT.md      # Complete step-by-step deployment guide
```

## API Endpoints

```
POST /auth/request-otp     Request login OTP
POST /auth/verify-otp      Verify OTP, get JWT

GET  /api/voters            List voters (with filters)
GET  /api/voters/:id        Voter detail + history
PUT  /api/voters/:id        Update voter

POST /api/canvassing/log    Submit canvassing visit
GET  /api/canvassing/logs   Activity feed
GET  /api/canvassing/summary Coverage stats
GET  /api/canvassing/my-stats Personal volunteer stats

GET  /api/booths            Booth list with coverage
GET  /api/booths/:id/households  Household list

GET  /api/campaigns         Campaign list
GET  /api/events            Event list
GET  /api/events/today      Today's events

GET  /api/reports/coverage         Booth-wise coverage
GET  /api/reports/support-breakdown Support counts
GET  /api/reports/issues           Ward civic issues
GET  /api/reports/volunteer-activity Team activity

GET  /platform/tenants      List all tenants (super admin)
POST /platform/tenants      Create new tenant
```

## Running Tests

```bash
cd packages/api

# Unit + integration tests (Jest)
npm test

# Shell-based QA against live API
bash ../../scripts/run_tests.sh

# With coverage
npx jest --coverage
```

## Deployment

See **docs/DEPLOYMENT.md** for complete step-by-step instructions covering:
- Supabase database setup
- Railway backend deployment
- Expo mobile app setup
- Environment configuration
- Verification checklist

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo |
| Backend | Node.js + Fastify + TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | JWT + Phone OTP |
| Hosting (API) | Railway (free tier) |
| Hosting (Web) | Vercel (free tier) |
| Offline sync | SQLite (expo-sqlite) |
| State management | Zustand |
| Testing | Jest + Supertest |
