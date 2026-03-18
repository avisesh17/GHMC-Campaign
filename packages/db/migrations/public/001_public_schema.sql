-- ============================================================
-- GHMC Campaign Platform — Public Schema (Shared)
-- Run once on the Supabase project
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Constituencies ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.constituencies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  city       TEXT NOT NULL DEFAULT 'Hyderabad',
  state      TEXT NOT NULL DEFAULT 'Telangana',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Wards ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_number      TEXT UNIQUE NOT NULL,
  ward_name        TEXT NOT NULL,
  constituency_id  UUID REFERENCES public.constituencies(id),
  ghmc_zone        TEXT,
  total_voters     INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ─── Booths ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booths (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booth_number TEXT NOT NULL,
  booth_name   TEXT,
  address      TEXT,
  lat          NUMERIC(10,7),
  lng          NUMERIC(10,7),
  ward_id      UUID REFERENCES public.wards(id) ON DELETE CASCADE,
  total_voters INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(booth_number, ward_id)
);

-- ─── Tenants ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenants (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   TEXT UNIQUE NOT NULL,
  name                   TEXT NOT NULL,
  party_name             TEXT,
  party_symbol_url       TEXT,
  corporator_name        TEXT,
  corporator_photo_url   TEXT,
  contact_phone          TEXT,
  contact_email          TEXT,
  manifesto_highlights   JSONB DEFAULT '[]',
  db_schema              TEXT UNIQUE NOT NULL,
  plan                   TEXT DEFAULT 'trial' CHECK (plan IN ('trial','basic','pro')),
  status                 TEXT DEFAULT 'active' CHECK (status IN ('active','suspended','expired')),
  can_ward_admin_import  BOOL DEFAULT false,
  trial_ends_at          TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days'),
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- ─── Tenant–Ward mapping ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_wards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ward_id      UUID REFERENCES public.wards(id),
  access_type  TEXT DEFAULT 'primary' CHECK (access_type IN ('primary','observer')),
  allow_import BOOL DEFAULT false,
  assigned_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, ward_id)
);

-- ─── Platform Super Admins ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id    UUID UNIQUE,
  name       TEXT NOT NULL,
  phone      TEXT UNIQUE NOT NULL,
  email      TEXT,
  is_active  BOOL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_booths_ward ON public.booths(ward_id);
CREATE INDEX IF NOT EXISTS idx_tenant_wards_tenant ON public.tenant_wards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_wards_ward ON public.tenant_wards(ward_id);

-- ─── Updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
