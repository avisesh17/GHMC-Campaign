# GHMC Campaign App — Complete Deployment Guide
# Written for first-time developers. Follow each step exactly.
# Estimated setup time: 45–60 minutes

# ═══════════════════════════════════════════════════════════════
# PART 1 — INSTALL PREREQUISITES (do this once on your computer)
# ═══════════════════════════════════════════════════════════════

# ─── 1.1 Install Node.js (v20 or higher) ──────────────────────
# Go to https://nodejs.org and download the "LTS" version
# After installing, open a terminal and verify:
node --version     # should show v20.x.x or higher
npm --version      # should show 10.x.x or higher

# ─── 1.2 Install Git ──────────────────────────────────────────
# Download from https://git-scm.com/downloads
git --version      # should show git version 2.x.x

# ─── 1.3 Install Expo CLI (for mobile app) ─────────────────────
npm install -g expo-cli eas-cli

# ─── 1.4 Install the Expo Go app on your Android phone ─────────
# Open Play Store → search "Expo Go" → install it
# (This lets you run the app on your phone during development)

# ─── 1.5 Install psql (PostgreSQL client for running SQL) ──────
# Windows: download from https://www.postgresql.org/download/windows/
# Mac: brew install postgresql
# Ubuntu/Debian: sudo apt install postgresql-client
psql --version     # verify installation


# ═══════════════════════════════════════════════════════════════
# PART 2 — SUPABASE SETUP (free database + auth)
# ═══════════════════════════════════════════════════════════════

# ─── 2.1 Create a free Supabase account ────────────────────────
# 1. Go to https://supabase.com
# 2. Click "Start for free" and sign up
# 3. Click "New project"
# 4. Fill in:
#      Project name: ghmc-campaign
#      Database password: (choose a strong password, SAVE IT)
#      Region: ap-south-1 (Mumbai — closest to Hyderabad)
# 5. Wait 2–3 minutes for the project to be created

# ─── 2.2 Get your project credentials ─────────────────────────
# In Supabase dashboard:
# → Settings → API
# Copy these values (you'll need them below):
#   SUPABASE_URL         = https://xxxxxxxxxxxx.supabase.co
#   SUPABASE_ANON_KEY    = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
#   SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# → Settings → Database
# Copy:
#   CONNECTION STRING    = postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
# Replace [YOUR-PASSWORD] with the password you set in step 2.1

# ─── 2.3 Run the public schema migration ──────────────────────
# In Supabase dashboard → SQL Editor → New query
# Paste the ENTIRE contents of:
#   packages/db/migrations/public/001_public_schema.sql
# Click "Run"
# You should see "Success. No rows returned"

# ─── 2.4 Create the tenant schema ──────────────────────────────
# In SQL Editor → New query, run these two commands:

CREATE SCHEMA tenant_bjp_ward42;

# Then run the tenant template. First, in the SQL editor, run:
SET search_path TO tenant_bjp_ward42, public;
# Then paste the ENTIRE contents of:
#   packages/db/migrations/tenant/001_tenant_schema.sql
# Click "Run"

# ─── 2.5 Load sample data ──────────────────────────────────────
# In SQL Editor → New query
# Paste the ENTIRE contents of:
#   packages/db/seeds/001_sample_data.sql
# Click "Run"
# You should see success messages


# ═══════════════════════════════════════════════════════════════
# PART 3 — API BACKEND SETUP (Railway — free hosting)
# ═══════════════════════════════════════════════════════════════

# ─── 3.1 Get the project code ──────────────────────────────────
# Open a terminal in a folder where you want the project
# (e.g., C:\Projects on Windows or ~/Projects on Mac/Linux)
cd ~/Projects   # or wherever you want it

# If you received the code as a zip, unzip it and cd into it:
cd ghmc-campaign

# ─── 3.2 Create your environment file ─────────────────────────
cd packages/api
cp .env.example .env

# Now edit .env with your actual values:
# Open .env in any text editor (Notepad, VS Code, etc.)
# Replace each placeholder with real values:

# SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
#   → paste your Supabase URL from step 2.2

# SUPABASE_SERVICE_KEY=your_service_role_key
#   → paste your service role key from step 2.2

# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
#   → paste your connection string from step 2.2

# JWT_SECRET=change_this_to_a_long_random_string_min_32_chars
#   → replace with any random string of 32+ characters
#   → example: MyGhmcCampaignSecret2026SecureKey99

# DEV_OTP_BYPASS=true
#   → leave as true for now (shows OTP in console during development)

# PLATFORM_ADMIN_KEY=your_platform_admin_key
#   → set this to any secret string for super admin API access
#   → example: GhmcPlatformAdmin2026

# ─── 3.3 Install dependencies and test locally ─────────────────
cd ~/Projects/ghmc-campaign/packages/api
npm install

# Start the API server:
npm run dev
# You should see: "GHMC API running on port 3001"

# Test it's working — open a new terminal and run:
curl http://localhost:3001/health
# You should see: {"status":"ok","timestamp":"..."}

# ─── 3.4 Run the test suite ────────────────────────────────────
# Make sure your DATABASE_URL in .env points to your Supabase DB
# (Tests use the real DB with the seeded data)
npm test
# You should see all tests passing (some may be skipped if DB not connected)

# ─── 3.5 Deploy to Railway (free cloud hosting) ────────────────
# 1. Go to https://railway.app and sign up with GitHub
# 2. Click "New Project" → "Deploy from GitHub repo"
#    (if you don't have a GitHub repo yet, see step 3.5a below)
# 3. Select your repository
# 4. Railway will detect it's a Node.js project
# 5. Go to your Railway project → Variables tab
# 6. Add ALL variables from your .env file:
#    Click "+ New Variable" for each one:
#      PORT = 3001
#      NODE_ENV = production
#      SUPABASE_URL = ...
#      DATABASE_URL = ...
#      JWT_SECRET = ...
#      SUPABASE_SERVICE_KEY = ...
#      DEV_OTP_BYPASS = false   ← set to false in production!
#      PLATFORM_ADMIN_KEY = ...
# 7. Go to Settings → Networking → Generate Domain
# 8. Your API URL will be something like: https://ghmc-api.railway.app

# ─── 3.5a: Push to GitHub (if needed) ─────────────────────────
# Create a GitHub account at github.com if you don't have one
# Create a new repository called "ghmc-campaign"
# Then in your terminal:
cd ~/Projects/ghmc-campaign
git init
git add .
git commit -m "Initial GHMC campaign app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ghmc-campaign.git
git push -u origin main

# ─── 3.6 Note your API URL ─────────────────────────────────────
# After Railway deploys (takes 2–3 minutes), note the URL:
# Example: https://ghmc-campaign-api.railway.app
# You'll need this for the mobile app configuration


# ═══════════════════════════════════════════════════════════════
# PART 4 — MOBILE APP SETUP (React Native with Expo)
# ═══════════════════════════════════════════════════════════════

# ─── 4.1 Install mobile dependencies ──────────────────────────
cd ~/Projects/ghmc-campaign/apps/mobile
npm install

# ─── 4.2 Set the API URL ───────────────────────────────────────
# Create a file called .env in apps/mobile/:
echo "EXPO_PUBLIC_API_URL=https://YOUR_RAILWAY_URL.railway.app" > .env
# Replace YOUR_RAILWAY_URL with your actual Railway URL from step 3.6
# For local testing use: EXPO_PUBLIC_API_URL=http://192.168.1.xxx:3001
# (replace with your computer's local IP address)

# Find your local IP:
# Windows: ipconfig | findstr "IPv4"
# Mac/Linux: ifconfig | grep "inet " | grep -v 127.0.0.1

# ─── 4.3 Start the development server ─────────────────────────
npm start
# A QR code will appear in the terminal

# ─── 4.4 Run on your phone ─────────────────────────────────────
# 1. Make sure your phone and computer are on the SAME WiFi network
# 2. Open "Expo Go" app on your Android phone
# 3. Tap "Scan QR code"
# 4. Scan the QR code from the terminal
# 5. The GHMC Campaign app will load on your phone!

# ─── 4.5 Test the login flow ───────────────────────────────────
# In the app:
# 1. Campaign slug: bjp-ward42
# 2. Phone: 9922334455 (Suresh Patil, volunteer)
# 3. OTP: check the Railway logs (or local terminal if running locally)
#    Go to Railway → your project → Deployments → View logs
#    Search for "[DEV OTP]" to see the code
# 4. Enter the 6-digit OTP
# 5. You should be logged in as Suresh Patil (volunteer, Booth 12)

# Other test logins:
#   Phone: 9811223344 → Anita Reddy (ward_admin)
#   Phone: 9900112233 → K. Ramesh (tenant_owner / corporator)


# ═══════════════════════════════════════════════════════════════
# PART 5 — RUNNING TESTS
# ═══════════════════════════════════════════════════════════════

cd ~/Projects/ghmc-campaign/packages/api

# Run all tests:
npm test

# Run a specific test file:
npx jest tests/auth.test.ts --verbose

# Run with coverage report:
npx jest --coverage

# Run tests in watch mode (re-runs on file changes):
npm run test:watch

# Expected test output:
# PASS tests/auth.test.ts        (12 tests)
# PASS tests/canvassing.test.ts  (14 tests)
# PASS tests/integration.test.ts (22 tests)
# Test Suites: 3 passed
# Tests:       48 passed


# ═══════════════════════════════════════════════════════════════
# PART 6 — VERIFYING YOUR SETUP (Checklist)
# ═══════════════════════════════════════════════════════════════

# ✅ Check 1: Health endpoint
curl https://YOUR_RAILWAY_URL.railway.app/health
# Expected: {"status":"ok","timestamp":"2026-03-17T..."}

# ✅ Check 2: Request OTP
curl -X POST https://YOUR_RAILWAY_URL.railway.app/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9922334455","tenantSlug":"bjp-ward42"}'
# Expected: {"message":"OTP sent","tenantName":"K. Ramesh Campaign...","devOtp":"XXXXXX"}

# ✅ Check 3: Verify OTP (use the devOtp from above)
curl -X POST https://YOUR_RAILWAY_URL.railway.app/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9922334455","otp":"XXXXXX","tenantSlug":"bjp-ward42"}'
# Expected: {"token":"eyJ...","user":{"name":"Suresh Patil","role":"volunteer"...}}

# ✅ Check 4: Get voter list (replace TOKEN with the token from Check 3)
curl https://YOUR_RAILWAY_URL.railway.app/api/voters \
  -H "Authorization: Bearer TOKEN"
# Expected: {"voters":[...],"total":30,"limit":50,"offset":0}

# ✅ Check 5: Supabase data
# In Supabase → Table Editor:
# → public.tenants    → should show "K. Ramesh Campaign"
# → public.wards      → should show 3 wards
# → public.booths     → should show 6 booths
# → tenant_bjp_ward42.voters → should show 30 voters


# ═══════════════════════════════════════════════════════════════
# PART 7 — QUICK REFERENCE: TEST ACCOUNTS
# ═══════════════════════════════════════════════════════════════

# Campaign slug: bjp-ward42

# CORPORATOR (full access):
#   Phone: 9900112233  Name: K. Ramesh

# WARD ADMIN (ward-level access):
#   Phone: 9811223344  Name: Anita Reddy

# VOLUNTEERS (booth-level, canvassing):
#   Phone: 9922334455  Name: Suresh Patil  (Booth 12)
#   Phone: 9933445566  Name: Ravi Kumar    (Booth 07)
#   Phone: 9944556677  Name: Deepa Menon   (Booth 03)
#   Phone: 9955667788  Name: Sunita Nair   (Booth 15)

# VIEWER (read-only):
#   Phone: 9966778899  Name: Vijay Sharma

# SAMPLE VOTER IDs to test search:
#   APM0042381  Laxmi Devi Krishnamurthy  (supporter)
#   APM0029871  Raju Yadav                (supporter)
#   APM0055120  Priya Sharma              (opposition)
#   APM0038921  Mohammed Ali Khan         (neutral)

# PLATFORM ADMIN API KEY:
#   Set in .env as PLATFORM_ADMIN_KEY
#   Use in header: x-platform-key: YOUR_KEY


# ═══════════════════════════════════════════════════════════════
# PART 8 — TROUBLESHOOTING
# ═══════════════════════════════════════════════════════════════

# Problem: "Cannot connect to database"
# Solution: Check DATABASE_URL in .env — ensure password is correct
#   and the Supabase project is in the "active" state (not paused)

# Problem: "Tenant not found" on login
# Solution: Make sure you ran the seed SQL in Supabase
#   Check: SELECT * FROM public.tenants; — should show 1 row

# Problem: Mobile app shows "Network request failed"
# Solution: Phone and computer must be on same WiFi
#   Use your computer's LOCAL IP (e.g. 192.168.1.105) not localhost
#   Check firewall isn't blocking port 3001

# Problem: Tests failing with "connection refused"
# Solution: Tests need a real DB connection
#   Make sure DATABASE_URL in .env is set correctly
#   Or set TEST_DATABASE_URL separately in .env

# Problem: Railway deploy failing
# Solution: Check the build logs in Railway dashboard
#   Most common cause: missing environment variables
#   Make sure all variables from .env are added to Railway

# Problem: OTP not showing in logs
# Solution: Check DEV_OTP_BYPASS=true is set in .env
#   In Railway, check Deployment logs for "[DEV OTP]" line

# ═══════════════════════════════════════════════════════════════
# Need help? Check:
# - Supabase docs: https://supabase.com/docs
# - Expo docs: https://docs.expo.dev
# - Railway docs: https://docs.railway.app
# ═══════════════════════════════════════════════════════════════
