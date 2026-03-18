-- ============================================================
-- GHMC Campaign — Sample Seed Data
-- Run AFTER public schema migration
-- Creates: 1 constituency, 3 wards, 6 booths, 1 tenant
-- Then seeds tenant schema with users + voters + campaign data
-- ============================================================

-- ─── Constituency ─────────────────────────────────────────────
INSERT INTO public.constituencies (id, name, city, state) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Secunderabad', 'Hyderabad', 'Telangana')
ON CONFLICT DO NOTHING;

-- ─── Wards ────────────────────────────────────────────────────
INSERT INTO public.wards (id, ward_number, ward_name, constituency_id, ghmc_zone, total_voters) VALUES
  ('22222222-0000-0000-0000-000000000001', '42', 'Secunderabad West',  '11111111-0000-0000-0000-000000000001', 'Central', 18420),
  ('22222222-0000-0000-0000-000000000002', '43', 'Bowenpally',         '11111111-0000-0000-0000-000000000001', 'Central', 16800),
  ('22222222-0000-0000-0000-000000000003', '44', 'Alwal North',        '11111111-0000-0000-0000-000000000001', 'North',   15200)
ON CONFLICT DO NOTHING;

-- ─── Booths (Ward 42) ─────────────────────────────────────────
INSERT INTO public.booths (id, booth_number, booth_name, address, lat, lng, ward_id, total_voters) VALUES
  ('33333333-0000-0000-0000-000000000001', 'B12', 'Govt. High School Booth 12',  'Sector 5, Lane 3, Bowenpally',     17.4413, 78.4984, '22222222-0000-0000-0000-000000000001', 420),
  ('33333333-0000-0000-0000-000000000002', 'B07', 'Community Hall Booth 07',     'Park Ave, Secunderabad West',      17.4398, 78.4971, '22222222-0000-0000-0000-000000000001', 380),
  ('33333333-0000-0000-0000-000000000003', 'B03', 'Municipal Office Booth 03',   'Main Road, Secunderabad West',     17.4421, 78.4995, '22222222-0000-0000-0000-000000000001', 350),
  ('33333333-0000-0000-0000-000000000004', 'B15', 'Ward Office Booth 15',        'Trimulgherry Rd, Secunderabad',   17.4445, 78.5012, '22222222-0000-0000-0000-000000000001', 410),
  ('33333333-0000-0000-0000-000000000005', 'B09', 'Masjid Trust Hall Booth 09',  'Bowenpally Main St',               17.4389, 78.4962, '22222222-0000-0000-0000-000000000001', 390),
  ('33333333-0000-0000-0000-000000000006', 'B01', 'Primary School Booth 01',     'Nehru Nagar, Secunderabad West',  17.4372, 78.4948, '22222222-0000-0000-0000-000000000001', 470)
ON CONFLICT DO NOTHING;

-- ─── Tenant (BJP Ward 42) ─────────────────────────────────────
INSERT INTO public.tenants (
  id, slug, name, party_name, corporator_name,
  contact_phone, contact_email, db_schema, plan, status,
  can_ward_admin_import,
  manifesto_highlights
) VALUES (
  '44444444-0000-0000-0000-000000000001',
  'bjp-ward42',
  'K. Ramesh Campaign — BJP Ward 42',
  'Bharatiya Janata Party',
  'K. Ramesh',
  '9900112233',
  'ramesh@bjpward42.in',
  'tenant_bjp_ward42',
  'basic',
  'active',
  false,
  '[
    {"icon":"roads","title":"Roads & infrastructure","detail":"Complete 23 pending road works in 6 months"},
    {"icon":"water","title":"24-hour water supply","detail":"Upgrade pipeline network in Sectors 3-8"},
    {"icon":"parks","title":"2 new parks","detail":"Bowenpally ground & Alwal lake park development"},
    {"icon":"streetlights","title":"LED streetlights","detail":"100% LED coverage across all 18 sectors"},
    {"icon":"drainage","title":"Drainage overhaul","detail":"Fix 14 clogged drainage lines before monsoon"}
  ]'
) ON CONFLICT DO NOTHING;

-- ─── Tenant–Ward mapping ──────────────────────────────────────
INSERT INTO public.tenant_wards (tenant_id, ward_id, access_type, allow_import) VALUES
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'primary', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- TENANT SCHEMA SEED  (schema: tenant_bjp_ward42)
-- ============================================================
SET search_path TO tenant_bjp_ward42, public;

-- ─── Users ────────────────────────────────────────────────────
INSERT INTO users (id, name, phone, email, role, is_active, assigned_ward_id, assigned_booth_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'K. Ramesh',    '9900112233', 'ramesh@bjpward42.in',  'tenant_owner', true,  '22222222-0000-0000-0000-000000000001', NULL),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Anita Reddy',  '9811223344', 'anita@bjpward42.in',   'ward_admin',   true,  '22222222-0000-0000-0000-000000000001', NULL),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Suresh Patil', '9922334455', 'suresh@bjpward42.in',  'volunteer',    true,  '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Ravi Kumar',   '9933445566', 'ravi@bjpward42.in',    'volunteer',    true,  '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Deepa Menon',  '9944556677', 'deepa@bjpward42.in',   'volunteer',    true,  '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000003'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Sunita Nair',  '9955667788', NULL,                    'volunteer',    true,  '22222222-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000004'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Vijay Sharma', '9966778899', NULL,                    'viewer',       true,  '22222222-0000-0000-0000-000000000001', NULL)
ON CONFLICT DO NOTHING;

-- ─── Households (Booth 12, Sector 5) ─────────────────────────
INSERT INTO households (id, house_number, street, landmark, full_address, lat, lng, booth_id, ward_id, total_portions, total_voters) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', '114', 'Lane 3, Sector 5', 'Near Temple', 'H.No 114, Lane 3, Sector 5, Bowenpally', 17.44138, 78.49841, '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 3, 8),
  ('bbbbbbbb-0000-0000-0000-000000000002', '116', 'Lane 3, Sector 5', NULL,           'H.No 116, Lane 3, Sector 5, Bowenpally', 17.44142, 78.49848, '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 1, 3),
  ('bbbbbbbb-0000-0000-0000-000000000003', '118', 'Lane 3, Sector 5', NULL,           'H.No 118, Lane 3, Sector 5, Bowenpally', 17.44147, 78.49855, '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 2, 5),
  ('bbbbbbbb-0000-0000-0000-000000000004', '120', 'Lane 4, Sector 5', NULL,           'H.No 120, Lane 4, Sector 5, Bowenpally', 17.44155, 78.49862, '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 1, 2),
  ('bbbbbbbb-0000-0000-0000-000000000005', '122', 'Lane 4, Sector 5', 'Corner house', 'H.No 122, Lane 4, Sector 5, Bowenpally', 17.44161, 78.49870, '33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 1, 4)
ON CONFLICT DO NOTHING;

-- ─── Family Units ─────────────────────────────────────────────
INSERT INTO family_units (id, household_id, portion_label, family_name, floor_number, door_label, voter_count) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Portion A', 'Krishnamurthy family', 0, 'Door A', 3),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'Portion B', 'Yadav family',         1, 'Door B', 3),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'Portion C', 'Shaikh family',        2, 'Door C', 2),
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 'Main',      'Reddy family',         0, 'Main',   3),
  ('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000003', 'Ground',    'Pillai family',        0, 'Door A', 3),
  ('cccccccc-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000003', 'First',     'Singh family',         1, 'Door B', 2)
ON CONFLICT DO NOTHING;

-- ─── Voters (30 sample voters across booths) ─────────────────
INSERT INTO voters (id, voter_id, full_name, father_name, age, gender, phone, alt_phone, house_number, household_id, family_unit_id, booth_id, ward_id, support_level, religion, caste_group, is_contacted, notes) VALUES
-- Household 114, Portion A - Krishnamurthy family
('dddddddd-0000-0000-0000-000000000001','APM0042381','Laxmi Devi Krishnamurthy','K. Ramnath',     45,'F','9876543210',NULL,'114','bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','supporter','Hindu','OBC', true,'Cooperative. Both husband and wife supporters.'),
('dddddddd-0000-0000-0000-000000000002','APM0042382','Ramnath Krishnamurthy',  'K. Subramaniam', 50,'M','9876543211',NULL,'114','bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','supporter','Hindu','OBC', true, NULL),
('dddddddd-0000-0000-0000-000000000003','APM0042383','Asha Krishnamurthy',     'K. Ramnath',     23,'F',NULL,           NULL,'114','bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','unknown', 'Hindu','OBC', false,NULL),
-- Household 114, Portion B - Yadav family
('dddddddd-0000-0000-0000-000000000004','APM0029871','Raju Yadav',             'Mohan Yadav',    38,'M','9123456780',NULL,'114','bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','supporter','Hindu','OBC', true, NULL),
('dddddddd-0000-0000-0000-000000000005','APM0029872','Sunita Yadav',           'Raju Yadav',     34,'F','9123456781',NULL,'114','bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','neutral', 'Hindu','OBC', true, 'Undecided, follow up'),
('dddddddd-0000-0000-0000-000000000006','APM0029873','Ankit Yadav',            'Raju Yadav',     19,'M',NULL,           NULL,'114','bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','unknown', 'Hindu','OBC', false,NULL),
-- Household 114, Portion C - Shaikh family
('dddddddd-0000-0000-0000-000000000007','APM0038944','Mohammed Shaikh',        'Abdul Shaikh',   42,'M','9988776655',NULL,'114','bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','unknown', 'Muslim','General',false,NULL),
('dddddddd-0000-0000-0000-000000000008','APM0038945','Fatima Shaikh',          'Mohammed Shaikh',39,'F',NULL,           NULL,'114','bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','unknown', 'Muslim','General',false,NULL),
-- Household 116
('dddddddd-0000-0000-0000-000000000009','APM0055120','Priya Sharma',           'Vikram Sharma',  29,'F','9001122334',NULL,'116','bbbbbbbb-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','opposition','Hindu','General',true,'Strong opposition'),
('dddddddd-0000-0000-0000-000000000010','APM0055121','Vikram Sharma',          'R. Sharma',      55,'M','9001122335',NULL,'116','bbbbbbbb-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','opposition','Hindu','General',true, NULL),
('dddddddd-0000-0000-0000-000000000011','APM0055122','Meena Sharma',           'Vikram Sharma',  52,'F',NULL,           NULL,'116','bbbbbbbb-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','neutral', 'Hindu','General',true, NULL),
-- Household 122
('dddddddd-0000-0000-0000-000000000012','APM0061034','Venkat Rao T.',          'T. Krishnarao',  48,'M','9988001122',NULL,'122','bbbbbbbb-0000-0000-0000-000000000005',NULL,                                    '33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','supporter','Hindu','SC',   true, NULL),
('dddddddd-0000-0000-0000-000000000013','APM0061035','Sarada Venkat',          'Venkat Rao',     44,'F','9988001123',NULL,'122','bbbbbbbb-0000-0000-0000-000000000005',NULL,                                    '33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','supporter','Hindu','SC',   true, NULL),
-- Booth 07 voters
('dddddddd-0000-0000-0000-000000000014','APM0038921','Mohammed Ali Khan',      'Rashid Khan',    41,'M','9123456780',NULL,'201','bbbbbbbb-0000-0000-0000-000000000003',NULL,                                    '33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','neutral', 'Muslim','General',true, NULL),
('dddddddd-0000-0000-0000-000000000015','APM0038922','Salma Begum',            'Mohammed Ali',   37,'F',NULL,           NULL,'201','bbbbbbbb-0000-0000-0000-000000000003',NULL,                                    '33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','unknown', 'Muslim','General',false,NULL),
('dddddddd-0000-0000-0000-000000000016','APM0044201','Sunita Devi Gupta',      'Ram Gupta',      32,'F','9000112233',NULL,'202',NULL,                                   NULL,                                    '33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','supporter','Hindu','OBC', false,NULL),
('dddddddd-0000-0000-0000-000000000017','APM0044202','Ram Gupta',              'Shyam Gupta',    58,'M','9000112234',NULL,'202',NULL,                                   NULL,                                    '33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','supporter','Hindu','OBC', false,NULL),
('dddddddd-0000-0000-0000-000000000018','APM0050001','Kavitha Reddy',          'S. Reddy',       35,'F','9111222333',NULL,'203',NULL,                                   NULL,                                    '33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','neutral', 'Hindu','BC',   true, NULL),
-- Booth 03 voters
('dddddddd-0000-0000-0000-000000000019','APM0060001','Suresh Babu P.',         'P. Narasimha',   52,'M','9222333444',NULL,'301',NULL,NULL,'33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','supporter','Hindu','OBC', true, NULL),
('dddddddd-0000-0000-0000-000000000020','APM0060002','Padma Suresh',           'Suresh Babu',    48,'F',NULL,          NULL,'301',NULL,NULL,'33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','supporter','Hindu','OBC', true, NULL),
('dddddddd-0000-0000-0000-000000000021','APM0060003','Rajesh Nair',            'K. Nair',        44,'M','9333444555',NULL,'302',NULL,NULL,'33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','unknown', 'Hindu','General',false,NULL),
('dddddddd-0000-0000-0000-000000000022','APM0060004','Ananya Nair',            'Rajesh Nair',    19,'F',NULL,          NULL,'302',NULL,NULL,'33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000001','unknown', 'Hindu','General',false,NULL),
-- Booth 15 voters
('dddddddd-0000-0000-0000-000000000023','APM0070001','Srinivas Rao',           'Kondaiah Rao',   61,'M','9444555666',NULL,'401',NULL,NULL,'33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','supporter','Hindu','SC',  true, NULL),
('dddddddd-0000-0000-0000-000000000024','APM0070002','Lakshmi Rao',            'Srinivas Rao',   57,'F',NULL,          NULL,'401',NULL,NULL,'33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','supporter','Hindu','SC',  true, NULL),
('dddddddd-0000-0000-0000-000000000025','APM0070003','Arun Kumar',             'S. Kumar',       28,'M','9555666777',NULL,'402',NULL,NULL,'33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','opposition','Hindu','General',true,'Young voter, strong opposition. Follow up.'),
-- Booth 09 voters
('dddddddd-0000-0000-0000-000000000026','APM0080001','Hyder Ali',              'Mir Ali',        50,'M','9666777888',NULL,'501',NULL,NULL,'33333333-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000001','neutral', 'Muslim','General',true, NULL),
('dddddddd-0000-0000-0000-000000000027','APM0080002','Zainab Hyder',           'Hyder Ali',      46,'F',NULL,          NULL,'501',NULL,NULL,'33333333-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000001','unknown', 'Muslim','General',false,NULL),
('dddddddd-0000-0000-0000-000000000028','APM0080003','Rekha Pillai',           'R. Pillai',      33,'F','9777888999',NULL,'502',NULL,NULL,'33333333-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000001','supporter','Hindu','BC',   false,NULL),
-- Booth 01 voters
('dddddddd-0000-0000-0000-000000000029','APM0090001','Prasad Varma',           'V. Varma',       67,'M','9888999000',NULL,'601',NULL,NULL,'33333333-0000-0000-0000-000000000006','22222222-0000-0000-0000-000000000001','supporter','Hindu','OBC', true, 'Senior citizen, needs transport on polling day'),
('dddddddd-0000-0000-0000-000000000030','APM0090002','Kalyani Prasad',         'Prasad Varma',   63,'F',NULL,          NULL,'601',NULL,NULL,'33333333-0000-0000-0000-000000000006','22222222-0000-0000-0000-000000000001','supporter','Hindu','OBC', true, NULL)
ON CONFLICT DO NOTHING;

-- ─── Campaign ─────────────────────────────────────────────────
INSERT INTO campaigns (id, name, description, start_date, end_date, status, created_by) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001',
   'GHMC 2026 Ward 42 Campaign',
   'Main election campaign for Ward 42 Secunderabad West',
   '2026-03-01', '2026-04-15', 'active',
   'aaaaaaaa-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ─── Events ───────────────────────────────────────────────────
INSERT INTO events (id, campaign_id, title, event_type, scheduled_at, venue, ward_id, expected_count, status, created_by) VALUES
  ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'Morning door-to-door drive',     'door_to_door',    '2026-03-17 07:00:00+05:30', 'Sectors 4-7, Booth 12',          '22222222-0000-0000-0000-000000000001', 32, 'upcoming', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', 'Public meeting — Bowenpally',    'public_meeting',  '2026-03-22 17:00:00+05:30', 'Bowenpally Grounds',             '22222222-0000-0000-0000-000000000001', 500,'upcoming', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('ffffffff-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000001', 'Voter registration camp',        'voter_registration','2026-03-18 10:00:00+05:30','Alwal Community Centre',          '22222222-0000-0000-0000-000000000001', 100,'upcoming', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('ffffffff-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000001', 'Youth brigade rally',            'rally',           '2026-03-25 16:00:00+05:30', 'Secunderabad Stadium',            '22222222-0000-0000-0000-000000000001', 800,'upcoming', 'aaaaaaaa-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ─── Volunteer Tasks ──────────────────────────────────────────
INSERT INTO volunteer_tasks (campaign_id, assigned_to, assigned_by, title, description, status, due_date, ward_id, booth_id) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000002','Cover houses 101-140','Door-to-door canvassing in Sector 5','pending','2026-03-17','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000002','Attend booth meeting','Evening booth coordination meeting','pending','2026-03-18','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000002','Cover houses 201-250','Door-to-door for Booth 07','pending','2026-03-17','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000002'),
  ('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000002','Distribute pamphlets','Manifesto pamphlet distribution Booth 03','in_progress','2026-03-17','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000003');

-- ─── Sample Canvassing Logs ───────────────────────────────────
INSERT INTO canvassing_logs (voter_id, household_id, canvasser_id, campaign_id, scope, visited_at, outcome, support_given, contact_method, notes, lat, lng) VALUES
  ('dddddddd-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003','eeeeeeee-0000-0000-0000-000000000001','voter','2026-03-15 10:24:00+05:30','contacted','supporter','door_to_door','Both husband and wife confirmed support',17.44138,78.49841),
  ('dddddddd-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003','eeeeeeee-0000-0000-0000-000000000001','voter','2026-03-15 10:28:00+05:30','contacted','supporter','door_to_door',NULL,17.44138,78.49841),
  ('dddddddd-0000-0000-0000-000000000004','bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003','eeeeeeee-0000-0000-0000-000000000001','voter','2026-03-15 10:45:00+05:30','contacted','supporter','door_to_door',NULL,17.44142,78.49848),
  ('dddddddd-0000-0000-0000-000000000005','bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003','eeeeeeee-0000-0000-0000-000000000001','voter','2026-03-15 10:47:00+05:30','contacted','neutral','door_to_door','Said will decide later',17.44142,78.49848),
  ('dddddddd-0000-0000-0000-000000000009',NULL,'aaaaaaaa-0000-0000-0000-000000000004','eeeeeeee-0000-0000-0000-000000000001','voter','2026-03-15 09:30:00+05:30','contacted','opposition','door_to_door','Strong opposition, do not revisit',17.44155,78.49862),
  ('dddddddd-0000-0000-0000-000000000007',NULL,'aaaaaaaa-0000-0000-0000-000000000003','eeeeeeee-0000-0000-0000-000000000001','voter','2026-03-07 08:10:00+05:30','not_home',NULL,'door_to_door','Door locked',17.44138,78.49841);

-- ─── Sample Ward Issues ───────────────────────────────────────
INSERT INTO ward_issues (voter_id, household_id, ward_id, reported_by, category, description, severity, status, lat, lng) VALUES
  ('dddddddd-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003','roads',       'Road broken near H.No 114, large pothole',          'high',   'open',17.44138,78.49841),
  ('dddddddd-0000-0000-0000-000000000004',NULL,                                  '22222222-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003','water',        'No water supply for 3 days in Sector 5',           'high',   'open',17.44142,78.49848),
  ('dddddddd-0000-0000-0000-000000000014',NULL,                                  '22222222-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000004','drainage',     'Drain overflowing near Booth 07 lane',              'high',   'open',17.43980,78.49710),
  ('dddddddd-0000-0000-0000-000000000019',NULL,                                  '22222222-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000005','streetlights', 'Street light not working for 2 weeks in Sector 3', 'medium', 'open',17.44210,78.49950),
  ('dddddddd-0000-0000-0000-000000000023',NULL,                                  '22222222-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000006','parking',      'Illegal parking blocking school entrance',          'medium', 'open',17.44450,78.50120);

-- Update last_contacted_at for contacted voters
UPDATE voters SET is_contacted = true, last_contacted_at = '2026-03-15 10:24:00+05:30'
WHERE id IN (
  'dddddddd-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000002',
  'dddddddd-0000-0000-0000-000000000004','dddddddd-0000-0000-0000-000000000005',
  'dddddddd-0000-0000-0000-000000000009'
);
