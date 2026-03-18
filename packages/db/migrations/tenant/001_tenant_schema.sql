-- ============================================================
-- GHMC Campaign — Tenant Schema Template
-- Replace {{SCHEMA}} with actual schema name e.g. tenant_bjp_ward42
-- Run via tenant-provisioner.ts on new corporator signup
-- ============================================================

CREATE SCHEMA IF NOT EXISTS {{SCHEMA}};
SET search_path TO {{SCHEMA}}, public;

-- ─── Users / Volunteers ───────────────────────────────────────
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id           UUID UNIQUE,
  name              TEXT NOT NULL,
  phone             TEXT UNIQUE NOT NULL,
  email             TEXT,
  role              TEXT NOT NULL DEFAULT 'volunteer'
                    CHECK (role IN ('tenant_owner','ward_admin','volunteer','viewer')),
  is_active         BOOL DEFAULT true,
  assigned_ward_id  UUID,
  assigned_booth_id UUID,
  last_login        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── Households ───────────────────────────────────────────────
CREATE TABLE households (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_number   TEXT NOT NULL,
  street         TEXT,
  landmark       TEXT,
  full_address   TEXT,
  lat            NUMERIC(10,7),
  lng            NUMERIC(10,7),
  booth_id       UUID NOT NULL,
  ward_id        UUID NOT NULL,
  total_portions INT DEFAULT 1,
  total_voters   INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_households_booth ON households(booth_id);
CREATE INDEX idx_households_ward  ON households(ward_id);

-- ─── Family Units (portions within a household) ───────────────
CREATE TABLE family_units (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID REFERENCES households(id) ON DELETE CASCADE,
  portion_label TEXT NOT NULL DEFAULT 'Main',
  family_name   TEXT,
  floor_number  INT DEFAULT 0,
  door_label    TEXT,
  voter_count   INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_family_units_household ON family_units(household_id);

-- ─── Voters ───────────────────────────────────────────────────
CREATE TABLE voters (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id          TEXT UNIQUE NOT NULL,
  full_name         TEXT NOT NULL,
  father_name       TEXT,
  age               INT CHECK (age >= 18 AND age <= 120),
  gender            TEXT CHECK (gender IN ('M','F','O')),
  phone             TEXT,
  alt_phone         TEXT,
  house_number      TEXT,
  address           TEXT,
  household_id      UUID REFERENCES households(id),
  family_unit_id    UUID REFERENCES family_units(id),
  booth_id          UUID NOT NULL,
  ward_id           UUID NOT NULL,
  support_level     TEXT DEFAULT 'unknown'
                    CHECK (support_level IN ('supporter','neutral','opposition','unknown')),
  religion          TEXT,
  caste_group       TEXT,
  is_contacted      BOOL DEFAULT false,
  has_voted         BOOL DEFAULT false,
  notes             TEXT,
  last_contacted_at TIMESTAMPTZ,
  imported_batch_id UUID,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_voters_booth        ON voters(booth_id);
CREATE INDEX idx_voters_ward         ON voters(ward_id);
CREATE INDEX idx_voters_support      ON voters(support_level);
CREATE INDEX idx_voters_household    ON voters(household_id);
CREATE INDEX idx_voters_contacted    ON voters(is_contacted);
CREATE INDEX idx_voters_voter_id     ON voters(voter_id);

-- ─── Campaigns ────────────────────────────────────────────────
CREATE TABLE campaigns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  start_date  DATE,
  end_date    DATE,
  status      TEXT DEFAULT 'draft'
              CHECK (status IN ('draft','active','completed','archived')),
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Events ───────────────────────────────────────────────────
CREATE TABLE events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID REFERENCES campaigns(id),
  title          TEXT NOT NULL,
  event_type     TEXT CHECK (event_type IN
                   ('door_to_door','public_meeting','rally',
                    'voter_registration','booth_meeting','other')),
  scheduled_at   TIMESTAMPTZ,
  venue          TEXT,
  lat            NUMERIC(10,7),
  lng            NUMERIC(10,7),
  ward_id        UUID,
  expected_count INT DEFAULT 0,
  actual_count   INT DEFAULT 0,
  status         TEXT DEFAULT 'upcoming'
                 CHECK (status IN ('upcoming','ongoing','completed','cancelled')),
  notes          TEXT,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ─── Canvassing Logs ──────────────────────────────────────────
CREATE TABLE canvassing_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id       UUID REFERENCES voters(id),
  household_id   UUID REFERENCES households(id),
  canvasser_id   UUID NOT NULL REFERENCES users(id),
  campaign_id    UUID REFERENCES campaigns(id),
  scope          TEXT DEFAULT 'voter'
                 CHECK (scope IN ('voter','family','house')),
  visited_at     TIMESTAMPTZ DEFAULT now(),
  outcome        TEXT NOT NULL
                 CHECK (outcome IN ('contacted','not_home','refused','not_found')),
  support_given  TEXT CHECK (support_given IN
                   ('supporter','neutral','opposition','unknown')),
  contact_method TEXT DEFAULT 'door_to_door'
                 CHECK (contact_method IN ('door_to_door','phone','event')),
  follow_up_date DATE,
  notes          TEXT,
  lat            NUMERIC(10,7),
  lng            NUMERIC(10,7),
  synced_at      TIMESTAMPTZ DEFAULT now(),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_logs_voter      ON canvassing_logs(voter_id);
CREATE INDEX idx_logs_canvasser  ON canvassing_logs(canvasser_id);
CREATE INDEX idx_logs_date       ON canvassing_logs(visited_at);
CREATE INDEX idx_logs_outcome    ON canvassing_logs(outcome);
CREATE INDEX idx_logs_household  ON canvassing_logs(household_id);

-- ─── Ward Issues ──────────────────────────────────────────────
CREATE TABLE ward_issues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvassing_log_id UUID REFERENCES canvassing_logs(id),
  voter_id          UUID REFERENCES voters(id),
  household_id      UUID REFERENCES households(id),
  ward_id           UUID NOT NULL,
  reported_by       UUID REFERENCES users(id),
  category          TEXT NOT NULL
                    CHECK (category IN ('roads','water','drainage','parking',
                      'streetlights','parks','garbage','civic','admin',
                      'encroachment','transport','other')),
  description       TEXT,
  severity          TEXT DEFAULT 'medium'
                    CHECK (severity IN ('high','medium','low')),
  status            TEXT DEFAULT 'open'
                    CHECK (status IN ('open','acknowledged','resolved')),
  lat               NUMERIC(10,7),
  lng               NUMERIC(10,7),
  reported_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_issues_ward     ON ward_issues(ward_id, category);
CREATE INDEX idx_issues_severity ON ward_issues(severity, status);

-- ─── Volunteer Tasks ──────────────────────────────────────────
CREATE TABLE volunteer_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID REFERENCES campaigns(id),
  assigned_to  UUID REFERENCES users(id),
  assigned_by  UUID REFERENCES users(id),
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT DEFAULT 'pending'
               CHECK (status IN ('pending','in_progress','done','cancelled')),
  due_date     DATE,
  ward_id      UUID,
  booth_id     UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ─── Import Batches ───────────────────────────────────────────
CREATE TABLE import_batches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     TEXT NOT NULL,
  uploaded_by  UUID REFERENCES users(id),
  ward_id      UUID,
  total_rows   INT DEFAULT 0,
  success_rows INT DEFAULT 0,
  error_rows   INT DEFAULT 0,
  storage_path TEXT,
  error_log    JSONB DEFAULT '[]',
  status       TEXT DEFAULT 'pending'
               CHECK (status IN ('pending','processing','done','failed')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ─── Audit Logs ───────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_user   ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ─── Updated_at triggers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER voters_updated_at   BEFORE UPDATE ON voters   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
