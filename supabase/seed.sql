-- Local/test seed only. The Auth rows below receive randomized, unknowable
-- password hashes and are not reusable demo login credentials. Stage 2 must
-- provision login-capable test users through the Supabase Admin API using
-- secrets supplied through the local environment.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'ahmed.seed@leadpilot.local', extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ahmed Khan"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sara.seed@leadpilot.local', extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sara Malik"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'usman.seed@leadpilot.local', extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Usman Ali"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'hira.seed@leadpilot.local', extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Hira Shah"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'isolation.seed@leadpilot.local', extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Isolation Owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'no-membership.seed@leadpilot.local', extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"No Membership User"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'suspended.seed@leadpilot.local', extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Suspended User"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'invitee.seed@leadpilot.local', extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Stage Three Invitee"}', now(), now(), '', '', '', '')
on conflict (id) do update
set
  email = excluded.email,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  seeded_user.id,
  seeded_user.id,
  seeded_user.id::text,
  jsonb_build_object(
    'sub', seeded_user.id::text,
    'email', seeded_user.email,
    'email_verified', true
  ),
  'email',
  now(),
  now(),
  now()
from auth.users seeded_user
where seeded_user.id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000008'
)
on conflict (provider_id, provider) do update
set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (id, full_name, timezone)
values
  ('00000000-0000-0000-0000-000000000001', 'Ahmed Khan', 'Asia/Karachi'),
  ('00000000-0000-0000-0000-000000000002', 'Sara Malik', 'Asia/Karachi'),
  ('00000000-0000-0000-0000-000000000003', 'Usman Ali', 'Asia/Karachi'),
  ('00000000-0000-0000-0000-000000000004', 'Hira Shah', 'Asia/Karachi'),
  ('00000000-0000-0000-0000-000000000005', 'Isolation Owner', 'Asia/Karachi'),
  ('00000000-0000-0000-0000-000000000006', 'No Membership User', 'Asia/Karachi'),
  ('00000000-0000-0000-0000-000000000007', 'Suspended User', 'Asia/Karachi'),
  ('00000000-0000-0000-0000-000000000008', 'Stage Three Invitee', 'Asia/Karachi')
on conflict (id) do update
set full_name = excluded.full_name, timezone = excluded.timezone;

insert into public.companies (
  id,
  name,
  slug,
  business_email,
  phone,
  city,
  address,
  created_by_user_id
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'Prime Build & Properties',
    'prime-build-properties',
    'hello@primebuild.pk',
    '+92 51 8899000',
    'Islamabad',
    'Jinnah Avenue, Blue Area, Islamabad',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Isolation Test Company',
    'isolation-test-company',
    'isolation@leadpilot.local',
    '+92 51 0000000',
    'Islamabad',
    'Local database tests only',
    '00000000-0000-0000-0000-000000000005'
  )
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  business_email = excluded.business_email,
  phone = excluded.phone,
  city = excluded.city,
  address = excluded.address,
  deleted_at = null;

insert into public.company_members (
  id,
  company_id,
  user_id,
  role,
  status,
  joined_at
)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'active', '2026-01-01T09:00:00+05:00'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'owner', 'active', '2026-01-01T09:00:00+05:00')
on conflict (id) do update
set role = excluded.role, status = excluded.status, joined_at = excluded.joined_at;

insert into public.company_members (
  id,
  company_id,
  user_id,
  role,
  status,
  invited_by_member_id,
  joined_at
)
values
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'admin', 'active', '20000000-0000-0000-0000-000000000001', '2026-01-02T09:00:00+05:00'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'sales_manager', 'active', '20000000-0000-0000-0000-000000000001', '2026-01-03T09:00:00+05:00'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'sales_representative', 'active', '20000000-0000-0000-0000-000000000001', '2026-01-04T09:00:00+05:00'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000007', 'sales_representative', 'suspended', '20000000-0000-0000-0000-000000000005', null),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'owner', 'active', '20000000-0000-0000-0000-000000000005', '2026-01-05T09:00:00+05:00')
on conflict (id) do update
set
  role = excluded.role,
  status = excluded.status,
  invited_by_member_id = excluded.invited_by_member_id,
  joined_at = excluded.joined_at;

insert into public.company_settings (
  company_id,
  timezone,
  currency,
  services,
  lead_sources,
  lead_scoring_rules,
  notification_defaults,
  updated_by_member_id
)
values (
  '10000000-0000-0000-0000-000000000001',
  'Asia/Karachi',
  'PKR',
  array[
    'Grey Structure Construction',
    'Complete House Construction',
    'Renovation',
    'Interior Design',
    'Commercial Construction',
    'Architecture and Planning',
    'Property Purchase',
    'Property Sale'
  ],
  array[
    'Facebook Ads',
    'Instagram',
    'Website',
    'WhatsApp',
    'Referral',
    'Walk-in',
    'Google Ads',
    'Property Portal'
  ],
  '{"version":1,"weights":{"budget":30,"timeline":25,"source":15,"completeness":15,"service":15},"budget_thresholds":{"warm_pkr":10000000,"hot_pkr":30000000},"high_intent_services":["Complete House Construction","Commercial Construction","Property Purchase"]}',
  '{"new_lead_assigned":true,"lead_reassigned":true,"follow_up_due":true,"follow_up_overdue":true,"appointment_created":true,"appointment_rescheduled":true,"appointment_cancelled":true,"lead_converted":true,"membership_event":true}',
  '20000000-0000-0000-0000-000000000001'
)
on conflict (company_id) do update
set
  timezone = excluded.timezone,
  currency = excluded.currency,
  services = excluded.services,
  lead_sources = excluded.lead_sources,
  lead_scoring_rules = excluded.lead_scoring_rules,
  notification_defaults = excluded.notification_defaults,
  updated_by_member_id = excluded.updated_by_member_id;

insert into public.company_settings (
  company_id, timezone, currency, services, lead_sources,
  lead_scoring_rules, notification_defaults, updated_by_member_id
)
values (
  '10000000-0000-0000-0000-000000000002', 'Asia/Karachi', 'PKR',
  array['Isolation Test','Property Purchase','Property Sale'],
  array['Referral','Test Fixture','Website'],
  '{"version":1,"weights":{"budget":30,"timeline":25,"source":15,"completeness":15,"service":15},"budget_thresholds":{"warm_pkr":10000000,"hot_pkr":30000000},"high_intent_services":["Property Purchase"]}',
  '{"new_lead_assigned":true,"follow_up_due":true,"follow_up_overdue":true,"membership_event":true}',
  '20000000-0000-0000-0000-000000000005'
)
on conflict (company_id) do update set
  timezone=excluded.timezone, currency=excluded.currency,
  services=excluded.services, lead_sources=excluded.lead_sources,
  lead_scoring_rules=excluded.lead_scoring_rules,
  notification_defaults=excluded.notification_defaults,
  disabled_services='{}', disabled_lead_sources='{}',
  updated_by_member_id=excluded.updated_by_member_id;

insert into public.leads (
  id, company_id, lead_number, full_name, phone, email, service_required,
  location, property_size, budget_pkr, expected_timeline, source,
  assigned_member_id, score, temperature, stage, notes, converted_at,
  created_by_member_id, created_at
)
values
  ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','LP-1001','Ali Raza','+92 300 1234567','ali.raza@example.com','Complete House Construction','DHA Phase 6, Lahore','10 Marla',28500000,'Within 1 month','Facebook Ads','20000000-0000-0000-0000-000000000001',92,'hot','negotiation','Client has approved the initial layout and wants a detailed BOQ.',null,'20000000-0000-0000-0000-000000000001','2026-07-06T10:00:00+05:00'),
  ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','LP-1002','Ayesha Siddiqui','+92 321 4455678','ayesha.s@example.com','Interior Design','Bahria Town, Islamabad','1 Kanal',12500000,'Within 3 months','Instagram','20000000-0000-0000-0000-000000000002',86,'hot','proposal_sent','Interested in contemporary interiors and turnkey execution.',null,'20000000-0000-0000-0000-000000000002','2026-07-08T11:00:00+05:00'),
  ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','LP-1003','Fahad Mehmood','+92 333 8765421','fahad.m@example.com','Commercial Construction','Blue Area, Islamabad','8,000 sq ft',72000000,'Within 1 month','Referral','20000000-0000-0000-0000-000000000003',95,'hot','site_visit','Corporate office project; decision-making committee is available this week.',null,'20000000-0000-0000-0000-000000000003','2026-07-10T09:30:00+05:00'),
  ('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','LP-1004','Zainab Ahmed','+92 301 9988776','zainab.a@example.com','Property Purchase','Gulberg III, Lahore','2 Kanal',95000000,'Within 6 months','Property Portal','20000000-0000-0000-0000-000000000004',72,'warm','qualified','Looking for a commercial property with reliable rental yield.',null,'20000000-0000-0000-0000-000000000004','2026-07-11T13:00:00+05:00'),
  ('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','LP-1005','Hamza Javed','+92 315 2233445','hamza.j@example.com','Grey Structure Construction','Bahria Town, Rawalpindi','1 Kanal',19000000,'Within 3 months','Google Ads','20000000-0000-0000-0000-000000000001',78,'warm','contacted','Comparing three contractors; values transparent material specifications.',null,'20000000-0000-0000-0000-000000000001','2026-06-05T10:00:00+05:00'),
  ('30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','LP-1006','Maryam Iqbal','+92 322 5566778','maryam.i@example.com','Renovation','DHA Phase 5, Karachi','500 sq yd',17500000,'Within 1 month','Website','20000000-0000-0000-0000-000000000002',89,'hot','converted','Full kitchen, bathrooms and facade renovation required.','2026-06-20T14:00:00+05:00','20000000-0000-0000-0000-000000000002','2026-06-12T12:00:00+05:00'),
  ('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','LP-1007','Bilal Aslam','+92 304 6677889','bilal.a@example.com','Architecture and Planning','Hayatabad, Peshawar','2 Kanal',8500000,'Within 6 months','Walk-in','20000000-0000-0000-0000-000000000003',64,'warm','qualified','Needs concept design and authority approvals before construction.',null,'20000000-0000-0000-0000-000000000003','2026-06-18T09:00:00+05:00'),
  ('30000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','LP-1008','Sana Tariq','+92 336 7788990','sana.t@example.com','Property Sale','Clifton, Karachi','1,000 sq yd',210000000,'Flexible','Referral','20000000-0000-0000-0000-000000000004',81,'hot','converted','Owner wants discreet marketing to qualified buyers.','2026-07-02T15:00:00+05:00','20000000-0000-0000-0000-000000000004','2026-06-25T11:30:00+05:00'),
  ('30000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','LP-1009','Omer Farooq','+92 300 8899001','omer.f@example.com','Complete House Construction','G-13, Islamabad','14 Marla',33000000,'Within 3 months','WhatsApp','20000000-0000-0000-0000-000000000001',76,'warm','proposal_sent','Family home with basement; structural drawings are ready.',null,'20000000-0000-0000-0000-000000000001','2026-05-04T10:15:00+05:00'),
  ('30000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','LP-1010','Nimra Khan','+92 321 9900112','nimra.k@example.com','Interior Design','Askari 11, Lahore','10 Marla',6500000,'Within 1 month','Instagram','20000000-0000-0000-0000-000000000002',69,'warm','contacted','Wants design consultation before finalizing full scope.',null,'20000000-0000-0000-0000-000000000002','2026-05-11T14:00:00+05:00'),
  ('30000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','LP-1011','Saad Qureshi','+92 333 1011223','saad.q@example.com','Commercial Construction','Saddar, Rawalpindi','4,500 sq ft',45000000,'Within 6 months','Website','20000000-0000-0000-0000-000000000003',58,'cold','new_inquiry','Early-stage inquiry for a mixed-use building.',null,'20000000-0000-0000-0000-000000000003','2026-05-18T09:45:00+05:00'),
  ('30000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','LP-1012','Hina Akram','+92 301 2122334','hina.a@example.com','Renovation','Model Town, Lahore','1 Kanal',14000000,'Within 3 months','Facebook Ads','20000000-0000-0000-0000-000000000004',74,'warm','converted','Interested in energy-efficient upgrades and landscaping.','2026-06-03T12:00:00+05:00','20000000-0000-0000-0000-000000000004','2026-05-26T16:00:00+05:00'),
  ('30000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000001','LP-1013','Waqas Nadeem','+92 315 3233445','waqas.n@example.com','Property Purchase','DHA Phase 8, Lahore','1 Kanal',78000000,'Within 1 month','Property Portal','20000000-0000-0000-0000-000000000001',88,'hot','site_visit','Cash buyer; shortlisted three properties for visits.',null,'20000000-0000-0000-0000-000000000001','2026-04-07T10:00:00+05:00'),
  ('30000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000001','LP-1014','Maha Shahid','+92 322 4344556','maha.s@example.com','Architecture and Planning','E-11, Islamabad','12 Marla',5200000,'Within 3 months','Google Ads','20000000-0000-0000-0000-000000000002',67,'warm','contacted','Requires modern elevation and space-efficient plan.',null,'20000000-0000-0000-0000-000000000002','2026-04-16T12:30:00+05:00'),
  ('30000000-0000-0000-0000-000000000015','10000000-0000-0000-0000-000000000001','LP-1015','Adnan Sheikh','+92 304 5455667','adnan.s@example.com','Grey Structure Construction','Gulshan-e-Iqbal, Karachi','400 sq yd',23500000,'Within 6 months','Referral','20000000-0000-0000-0000-000000000003',54,'cold','converted','Land transfer is in progress; collecting preliminary estimates.','2026-05-09T13:00:00+05:00','20000000-0000-0000-0000-000000000003','2026-04-24T11:00:00+05:00'),
  ('30000000-0000-0000-0000-000000000016','10000000-0000-0000-0000-000000000001','LP-1016','Rabia Noor','+92 336 6566778','rabia.n@example.com','Complete House Construction','DHA Phase 2, Islamabad','1 Kanal',49000000,'Within 1 month','Website','20000000-0000-0000-0000-000000000004',91,'hot','proposal_sent','Ready to proceed after final scope and payment milestone review.',null,'20000000-0000-0000-0000-000000000004','2026-03-06T09:30:00+05:00'),
  ('30000000-0000-0000-0000-000000000017','10000000-0000-0000-0000-000000000001','LP-1017','Talha Mirza','+92 300 7677889','talha.m@example.com','Property Sale','Bahria Town, Karachi','500 sq yd',68000000,'Flexible','WhatsApp','20000000-0000-0000-0000-000000000001',48,'cold','contacted','Exploring market price; no immediate urgency.',null,'20000000-0000-0000-0000-000000000001','2026-03-17T15:00:00+05:00'),
  ('30000000-0000-0000-0000-000000000018','10000000-0000-0000-0000-000000000001','LP-1018','Iqra Yousaf','+92 321 8788990','iqra.y@example.com','Interior Design','Johar Town, Lahore','5 Marla',3800000,'Within 3 months','Instagram','20000000-0000-0000-0000-000000000002',62,'warm','qualified','Needs compact storage solutions and a warm neutral palette.',null,'20000000-0000-0000-0000-000000000002','2026-03-27T10:30:00+05:00'),
  ('30000000-0000-0000-0000-000000000019','10000000-0000-0000-0000-000000000001','LP-1019','Danish Abbasi','+92 333 9899001','danish.a@example.com','Commercial Construction','University Road, Peshawar','12,000 sq ft',110000000,'Within 6 months','Walk-in','20000000-0000-0000-0000-000000000003',84,'hot','negotiation','Retail plaza; financing and approvals are in place.',null,'20000000-0000-0000-0000-000000000003','2026-02-10T11:00:00+05:00'),
  ('30000000-0000-0000-0000-000000000020','10000000-0000-0000-0000-000000000001','LP-1020','Mehwish Saleem','+92 301 0900112','mehwish.s@example.com','Renovation','F-8, Islamabad','2 Kanal',26000000,'Within 3 months','Facebook Ads','20000000-0000-0000-0000-000000000004',57,'cold','new_inquiry','Requested portfolio and rough cost range by email.',null,'20000000-0000-0000-0000-000000000004','2026-02-22T14:00:00+05:00')
on conflict (id) do update
set
  lead_number = excluded.lead_number,
  full_name = excluded.full_name,
  phone = excluded.phone,
  email = excluded.email,
  service_required = excluded.service_required,
  location = excluded.location,
  property_size = excluded.property_size,
  budget_pkr = excluded.budget_pkr,
  expected_timeline = excluded.expected_timeline,
  source = excluded.source,
  assigned_member_id = excluded.assigned_member_id,
  score = excluded.score,
  temperature = excluded.temperature,
  stage = excluded.stage,
  notes = excluded.notes,
  converted_at = excluded.converted_at,
  created_by_member_id = excluded.created_by_member_id,
  created_at = excluded.created_at,
  deleted_at = null;

insert into public.leads (
  id, company_id, lead_number, full_name, phone, service_required, location,
  budget_pkr, source, assigned_member_id, score, temperature, stage,
  created_by_member_id, created_at
)
values (
  '30000000-0000-0000-0000-000000000021',
  '10000000-0000-0000-0000-000000000002',
  'ISO-0001',
  'Tenant Isolation Lead',
  '+92 300 0000000',
  'Isolation Test',
  'Islamabad',
  1000000,
  'Test Fixture',
  '20000000-0000-0000-0000-000000000005',
  50,
  'cold',
  'new_inquiry',
  '20000000-0000-0000-0000-000000000005',
  '2026-07-01T09:00:00+05:00'
)
on conflict (id) do update
set
  assigned_member_id = excluded.assigned_member_id,
  score = excluded.score,
  budget_pkr = excluded.budget_pkr,
  deleted_at = null;

insert into public.follow_ups (
  id, company_id, lead_id, assigned_member_id, due_at, status, priority,
  notes, created_by_member_id
)
select
  schedule.id,
  '10000000-0000-0000-0000-000000000001'::uuid,
  lead.id,
  lead.assigned_member_id,
  schedule.due_at,
  'pending'::public.follow_up_status,
  schedule.priority,
  'Demo follow-up migrated from the Phase 1 next-follow-up date.',
  lead.assigned_member_id
from (
  values
    ('50000000-0000-0000-0000-000000000001'::uuid, 'LP-1001', '2026-07-23T09:00:00+05:00'::timestamptz, 'high'::public.task_priority),
    ('50000000-0000-0000-0000-000000000002'::uuid, 'LP-1002', '2026-07-23T10:00:00+05:00'::timestamptz, 'high'::public.task_priority),
    ('50000000-0000-0000-0000-000000000003'::uuid, 'LP-1003', '2026-07-24T09:00:00+05:00'::timestamptz, 'normal'::public.task_priority),
    ('50000000-0000-0000-0000-000000000004'::uuid, 'LP-1004', '2026-07-25T09:00:00+05:00'::timestamptz, 'normal'::public.task_priority),
    ('50000000-0000-0000-0000-000000000005'::uuid, 'LP-1005', '2026-07-23T11:00:00+05:00'::timestamptz, 'high'::public.task_priority),
    ('50000000-0000-0000-0000-000000000006'::uuid, 'LP-1006', '2026-07-22T09:00:00+05:00'::timestamptz, 'normal'::public.task_priority),
    ('50000000-0000-0000-0000-000000000007'::uuid, 'LP-1007', '2026-07-26T09:00:00+05:00'::timestamptz, 'normal'::public.task_priority),
    ('50000000-0000-0000-0000-000000000008'::uuid, 'LP-1008', '2026-07-24T10:00:00+05:00'::timestamptz, 'normal'::public.task_priority),
    ('50000000-0000-0000-0000-000000000009'::uuid, 'LP-1009', '2026-07-27T09:00:00+05:00'::timestamptz, 'normal'::public.task_priority),
    ('50000000-0000-0000-0000-000000000010'::uuid, 'LP-1010', '2026-07-23T12:00:00+05:00'::timestamptz, 'high'::public.task_priority),
    ('50000000-0000-0000-0000-000000000011'::uuid, 'LP-1011', '2026-07-29T09:00:00+05:00'::timestamptz, 'normal'::public.task_priority),
    ('50000000-0000-0000-0000-000000000012'::uuid, 'LP-1012', '2026-07-25T11:00:00+05:00'::timestamptz, 'normal'::public.task_priority),
    ('50000000-0000-0000-0000-000000000013'::uuid, 'LP-1013', '2026-07-23T13:00:00+05:00'::timestamptz, 'urgent'::public.task_priority),
    ('50000000-0000-0000-0000-000000000014'::uuid, 'LP-1014', '2026-07-28T09:00:00+05:00'::timestamptz, 'normal'::public.task_priority),
    ('50000000-0000-0000-0000-000000000015'::uuid, 'LP-1015', '2026-07-30T09:00:00+05:00'::timestamptz, 'normal'::public.task_priority),
    ('50000000-0000-0000-0000-000000000016'::uuid, 'LP-1016', '2026-07-22T10:00:00+05:00'::timestamptz, 'high'::public.task_priority),
    ('50000000-0000-0000-0000-000000000017'::uuid, 'LP-1017', '2026-08-01T09:00:00+05:00'::timestamptz, 'low'::public.task_priority),
    ('50000000-0000-0000-0000-000000000018'::uuid, 'LP-1018', '2026-07-26T11:00:00+05:00'::timestamptz, 'normal'::public.task_priority),
    ('50000000-0000-0000-0000-000000000019'::uuid, 'LP-1019', '2026-07-24T12:00:00+05:00'::timestamptz, 'high'::public.task_priority),
    ('50000000-0000-0000-0000-000000000020'::uuid, 'LP-1020', '2026-07-31T09:00:00+05:00'::timestamptz, 'normal'::public.task_priority)
) as schedule(id, lead_number, due_at, priority)
join public.leads lead
  on lead.company_id = '10000000-0000-0000-0000-000000000001'
  and lead.lead_number = schedule.lead_number
on conflict (id) do update
set
  lead_id = excluded.lead_id,
  assigned_member_id = excluded.assigned_member_id,
  due_at = excluded.due_at,
  status = excluded.status,
  priority = excluded.priority,
  notes = excluded.notes,
  completed_at = null,
  completed_by_member_id = null,
  cancelled_at = null,
  deleted_at = null;

insert into public.appointments (
  id, company_id, lead_id, customer_name, appointment_type, status,
  starts_at, ends_at, location, assigned_member_id, created_by_member_id
)
values
  ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','Fahad Mehmood','site_visit','confirmed','2026-07-24T11:00:00+05:00','2026-07-24T12:00:00+05:00','Blue Area, Islamabad','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003'),
  ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','Ayesha Siddiqui','consultation','confirmed','2026-07-24T15:30:00+05:00','2026-07-24T16:30:00+05:00','Prime Build Office, Islamabad','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002'),
  ('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000013','Waqas Nadeem','site_visit','pending','2026-07-25T10:00:00+05:00','2026-07-25T11:00:00+05:00','DHA Phase 8, Lahore','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000016','Rabia Noor','consultation','confirmed','2026-07-25T16:00:00+05:00','2026-07-25T17:00:00+05:00','Video call','20000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004'),
  ('60000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000019','Danish Abbasi','site_visit','pending','2026-07-27T12:00:00+05:00','2026-07-27T13:00:00+05:00','University Road, Peshawar','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003')
on conflict (id) do update
set
  lead_id = excluded.lead_id,
  customer_name = excluded.customer_name,
  appointment_type = excluded.appointment_type,
  status = excluded.status,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  location = excluded.location,
  assigned_member_id = excluded.assigned_member_id,
  created_by_member_id = excluded.created_by_member_id,
  deleted_at = null;

insert into public.lead_activities (
  id, company_id, lead_id, actor_member_id, activity_type, description, occurred_at
)
select
  ('40000000-0000-0000-0000-' || right(lead.id::text, 12))::uuid,
  lead.company_id,
  lead.id,
  lead.created_by_member_id,
  'created',
  'Lead imported from the Phase 1 deterministic demo dataset.',
  lead.created_at
from public.leads lead
where lead.company_id = '10000000-0000-0000-0000-000000000001'
on conflict (id) do update
set
  actor_member_id = excluded.actor_member_id,
  description = excluded.description,
  occurred_at = excluded.occurred_at;

-- Runtime triggers fire while seed records are inserted. Replace those events
-- with a small deterministic inbox suitable for the client demonstration.
delete from public.notifications;
insert into public.notifications (
  id, company_id, recipient_member_id, notification_type, title, body,
  lead_id, follow_up_id, event_key, created_at
)
values
  ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','follow_up_due','Follow-up due today','Ali Raza requires a follow-up today.','30000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','seed:owner:follow-up-due','2026-07-23T08:30:00+05:00'),
  ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000008','system','Isolation workspace ready','Your isolation-test workspace is ready.',null,null,'seed:isolation:ready','2026-07-23T08:00:00+05:00'),
  ('70000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','appointment_created','Consultation scheduled','Ayesha Siddiqui has a confirmed consultation.','30000000-0000-0000-0000-000000000002',null,'seed:admin:appointment','2026-07-23T09:00:00+05:00'),
  ('70000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','lead_assigned','Lead assigned','Rabia Noor is assigned to you.','30000000-0000-0000-0000-000000000016',null,'seed:rep:lead','2026-07-23T09:15:00+05:00')
on conflict (id) do update set
  title=excluded.title, body=excluded.body, read_at=null,
  archived_at=null, created_at=excluded.created_at;

do $$
declare
  demo_company constant uuid := '10000000-0000-0000-0000-000000000001';
  total_leads integer;
  hot_leads integer;
  warm_leads integer;
  cold_leads integer;
  converted_leads integer;
  active_pipeline bigint;
  follow_ups_today integer;
  upcoming_site_visits integer;
  uneven_assignments integer;
begin
  select
    count(*),
    count(*) filter (where temperature = 'hot'),
    count(*) filter (where temperature = 'warm'),
    count(*) filter (where temperature = 'cold'),
    count(*) filter (where stage = 'converted'),
    coalesce(sum(budget_pkr) filter (where stage not in ('converted', 'lost')), 0)
  into
    total_leads,
    hot_leads,
    warm_leads,
    cold_leads,
    converted_leads,
    active_pipeline
  from public.leads
  where company_id = demo_company
    and deleted_at is null;

  select count(*)
  into follow_ups_today
  from public.follow_ups
  where company_id = demo_company
    and deleted_at is null
    and status = 'pending'
    and (due_at at time zone 'Asia/Karachi')::date = date '2026-07-23';

  select count(*)
  into upcoming_site_visits
  from public.appointments
  where company_id = demo_company
    and deleted_at is null
    and appointment_type = 'site_visit'
    and status in ('pending', 'confirmed')
    and starts_at >= timestamptz '2026-07-23T00:00:00+05:00';

  select count(*)
  into uneven_assignments
  from (
    select member.id
    from public.company_members member
    left join public.leads lead
      on lead.company_id = member.company_id
      and lead.assigned_member_id = member.id
      and lead.deleted_at is null
    where member.company_id = demo_company
      and member.status = 'active'
    group by member.id
    having count(lead.id) <> 5
  ) assignment_mismatches;

  if total_leads <> 20
    or hot_leads <> 8
    or warm_leads <> 8
    or cold_leads <> 4
    or converted_leads <> 4
    or active_pipeline <> 660000000
    or follow_ups_today <> 5
    or upcoming_site_visits <> 3
    or uneven_assignments <> 0
  then
    raise exception
      'Demo parity failed: total %, H/W/C %/%/%, converted %, pipeline %, follow-ups %, visits %, assignment mismatches %',
      total_leads,
      hot_leads,
      warm_leads,
      cold_leads,
      converted_leads,
      active_pipeline,
      follow_ups_today,
      upcoming_site_visits,
      uneven_assignments;
  end if;
end;
$$;

insert into public.lead_number_counters (company_id, next_number)
select
  company.id,
  greatest(
    coalesce(
      max((regexp_match(lead.lead_number, '([0-9]+)$'))[1]::bigint),
      1000
    ) + 1,
    1001
  )
from public.companies company
left join public.leads lead on lead.company_id = company.id
group by company.id
on conflict (company_id) do update
set next_number = excluded.next_number,
    updated_at = now();
