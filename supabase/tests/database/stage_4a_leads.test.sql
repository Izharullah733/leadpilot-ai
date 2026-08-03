begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(42);

create or replace function pg_temp.capture_sqlstate(statement text)
returns text language plpgsql as $$
begin
  execute statement;
  return null;
exception when others then return sqlstate;
end;
$$;

select extensions.is(has_table_privilege('authenticated', 'public.leads', 'insert'), false, 'clients cannot insert leads directly');
select extensions.is(has_table_privilege('authenticated', 'public.leads', 'update'), false, 'clients cannot update leads directly');
select extensions.is(has_table_privilege('authenticated', 'public.leads', 'delete'), false, 'clients cannot hard-delete leads');
select extensions.is(has_table_privilege('authenticated', 'public.lead_activities', 'insert'), false, 'clients cannot forge activities');
select extensions.is(
  (select concat(count(*), '|', count(*) filter (where temperature='hot'), '|', count(*) filter (where temperature='warm'), '|', count(*) filter (where temperature='cold'), '|', count(*) filter (where stage='converted'), '|', coalesce(sum(budget_pkr) filter (where stage not in ('converted','lost')),0)) from public.leads where company_id='10000000-0000-0000-0000-000000000001' and deleted_at is null),
  '20|8|8|4|4|660000000',
  'seed lead aggregate parity is intact'
);
select extensions.is(
  (select count(*)::integer from public.leads where company_id='10000000-0000-0000-0000-000000000001' and created_at >= '2026-07-01T00:00:00+05:00' and created_at < '2026-08-01T00:00:00+05:00'),
  4,
  'company-timezone July report range returns four leads'
);
select extensions.is(
  (select string_agg(month_key || ':' || lead_count, ',' order by month_key) from (select to_char(created_at at time zone 'Asia/Karachi','YYYY-MM') as month_key, count(*)::text as lead_count from public.leads where company_id='10000000-0000-0000-0000-000000000001' group by 1) months),
  '2026-02:2,2026-03:3,2026-04:3,2026-05:4,2026-06:4,2026-07:4',
  'monthly trend is derived from seeded lead dates'
);
select extensions.is(
  (select string_agg(source || ':' || lead_count, ',' order by source) from (select source, count(*)::text as lead_count from public.leads where company_id='10000000-0000-0000-0000-000000000001' group by source) sources),
  'Facebook Ads:3,Google Ads:2,Instagram:3,Property Portal:2,Referral:3,Walk-in:2,Website:3,WhatsApp:2',
  'lead source grouping matches the central dataset'
);
select extensions.is(
  (select string_agg(lead_count, ',' order by assigned_member_id) from (select assigned_member_id, count(*)::text as lead_count from public.leads where company_id='10000000-0000-0000-0000-000000000001' group by assigned_member_id) assignments),
  '5,5,5,5',
  'team lead assignments reconcile to five per member'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select extensions.is((select count(*)::integer from public.leads where company_id='10000000-0000-0000-0000-000000000001'), 20, 'owner sees all company leads');

create temporary table created_ids (kind text primary key, id uuid);
insert into created_ids
select 'owner', public.create_lead(
  '10000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001',
  'Stage Four Owner Lead', '+92 300 1112233', 'owner.lead@example.com',
  'Complete House Construction', 'Islamabad', '10 Marla', 12000000,
  'Within 3 months', 'Website', '20000000-0000-0000-0000-000000000001',
  75, 'warm', 'Stage 4A database test'
);
select extensions.ok((select id is not null from created_ids where kind='owner'), 'owner creates a lead through the controlled workflow');
select extensions.is((select lead_number from public.leads where id=(select id from created_ids where kind='owner')), 'LP-1021', 'company lead numbering continues safely from the seed');
select extensions.is(
  public.create_lead(
    '10000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    'Ignored Duplicate', '+92 300 1112233', '', 'Renovation', 'Lahore', '',
    5000000, '', 'Website', '20000000-0000-0000-0000-000000000001',
    60, 'warm', ''
  ),
  (select id from created_ids where kind='owner'),
  'repeated create request is idempotent'
);
select extensions.is((select count(*)::integer from public.lead_activities where lead_id=(select id from created_ids where kind='owner') and activity_type='created'), 1, 'creation appends exactly one activity');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select extensions.lives_ok(
  $$ select public.create_lead('10000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000002','Admin Lead','+92 300 2223344','','Renovation','Lahore','5 Marla',4000000,'Within 1 month','Referral','20000000-0000-0000-0000-000000000002',65,'warm','') $$,
  'admin can create a company lead'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok(
  $$ select public.create_lead('10000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000003','Manager Lead','+92 300 3334455','','Interior Design','Rawalpindi','1 Kanal',8000000,'Within 3 months','Google Ads','20000000-0000-0000-0000-000000000003',70,'warm','') $$,
  'sales manager can create a company lead'
);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.create_lead('10000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000004','Bad Assignee','+92 300 4445566','','Renovation','Islamabad','',1000000,'','Website','20000000-0000-0000-0000-000000000005',50,'cold','') $$),
  '23503',
  'cross-company assignee is rejected'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.create_lead('10000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000005','Suspended Assignee','+92 300 5556677','','Renovation','Islamabad','',1000000,'','Website','20000000-0000-0000-0000-000000000007',50,'cold','') $$),
  '23503',
  'suspended assignee is rejected'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.create_lead('10000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000006','Invalid Budget','+92 300 6667788','','Renovation','Islamabad','',-1,'','Website','20000000-0000-0000-0000-000000000003',101,'cold','') $$),
  '22023',
  'invalid score and budget are rejected'
);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.create_lead('10000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000009','Forged Company','+92 300 9990011','','Renovation','Islamabad','',1000000,'','Website','20000000-0000-0000-0000-000000000005',50,'cold','') $$),
  '42501',
  'a member cannot create a lead for a company they do not belong to'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
insert into created_ids
select 'representative', public.create_lead(
  '10000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000007',
  'Representative Lead', '+92 300 7778899', '', 'Interior Design',
  'Lahore', '5 Marla', 3000000, 'Within 3 months', 'Instagram',
  '20000000-0000-0000-0000-000000000004', 62, 'warm', ''
);
select extensions.is((select assigned_member_id from public.leads where id=(select id from created_ids where kind='representative')), '20000000-0000-0000-0000-000000000004'::uuid, 'representative creation is self-assigned');
select extensions.is((select count(*)::integer from public.leads), 6, 'representative aggregate scope includes five seed leads and their new lead');
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.create_lead('10000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000008','Forged Assignment','+92 300 8889900','','Renovation','Islamabad','',1000000,'','Website','20000000-0000-0000-0000-000000000001',50,'cold','') $$),
  '42501',
  'representative cannot forge assignment'
);
select extensions.is((select count(*)::integer from public.leads where assigned_member_id <> '20000000-0000-0000-0000-000000000004'), 0, 'representative cannot read other members leads');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
select extensions.is((select count(*)::integer from public.leads where company_id='10000000-0000-0000-0000-000000000001'), 0, 'cross-company lead reads are denied');

reset role;
select extensions.is(
  (select count(*)::integer from (select company_id, lead_number from public.leads group by company_id, lead_number having count(*) > 1) duplicates),
  0,
  'controlled lead creation keeps company lead numbers unique'
);
create temporary table original_update as
select updated_at from public.leads where id='30000000-0000-0000-0000-000000000001';
grant select on original_update to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$ select public.update_lead('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',(select updated_at from original_update),'Ali Raza','+92 300 1234567','ali.raza@example.com','Complete House Construction','DHA Phase 6, Lahore','10 Marla',28500000,'Within 1 month','Facebook Ads','20000000-0000-0000-0000-000000000001',92,'hot','negotiation','Updated in Stage 4A test') $$,
  'authorized optimistic lead update succeeds'
);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.update_lead('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',(select updated_at from original_update),'Ali Raza','+92 300 1234567','','Complete House Construction','Lahore','10 Marla',28500000,'','Facebook Ads','20000000-0000-0000-0000-000000000001',92,'hot','negotiation','Stale') $$),
  '40001',
  'stale optimistic update is rejected'
);
select extensions.ok((select count(*) > 0 from public.lead_activities where lead_id='30000000-0000-0000-0000-000000000001' and description='Lead details updated'), 'meaningful edit appends activity');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.update_lead('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',(select updated_at from public.leads where id='30000000-0000-0000-0000-000000000001'),'Ali Raza','+92 300 1234567','ali.raza@example.com','Complete House Construction','DHA Phase 6, Lahore','10 Marla',28500000,'Within 1 month','Facebook Ads','20000000-0000-0000-0000-000000000001',92,'hot','negotiation','Unauthorized') $$),
  '42501',
  'representative cannot edit another members lead'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.set_lead_archived('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000021',true) $$),
  '42501',
  'cross-company lead mutation is denied'
);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select extensions.is(public.convert_lead('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'), true, 'authorized conversion succeeds');
select extensions.is(public.convert_lead('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'), false, 'repeated conversion is idempotent');
select extensions.is((select count(*)::integer from public.lead_activities where lead_id='30000000-0000-0000-0000-000000000001' and activity_type='converted'), 1, 'conversion activity is not duplicated');
select extensions.ok((select converted_at is not null from public.leads where id='30000000-0000-0000-0000-000000000001' and stage='converted'), 'conversion timestamp and stage are consistent');
select extensions.is(
  (select coalesce(sum(budget_pkr),0)::bigint from public.leads where company_id='10000000-0000-0000-0000-000000000001' and stage not in ('converted','lost') and deleted_at is null),
  658500000::bigint,
  'converted leads are excluded from the active pipeline aggregate'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.convert_lead('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002') $$),
  '42501',
  'representative cannot convert another members lead'
);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.set_lead_archived('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004',true) $$),
  '42501',
  'representative cannot archive leads'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok(
  $$ select public.set_lead_archived('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004',true) $$,
  'manager can soft archive a lead'
);
select extensions.is((select count(*)::integer from public.leads where id='30000000-0000-0000-0000-000000000004'), 0, 'archived lead is excluded from normal RLS reads');
select extensions.lives_ok(
  $$ select public.set_lead_archived('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004',false) $$,
  'manager can restore an archived lead'
);
select extensions.is((select count(*)::integer from public.leads where id='30000000-0000-0000-0000-000000000004'), 1, 'restored lead returns to normal reads');

reset role;
select extensions.finish();
rollback;
