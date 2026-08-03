begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(15);

create or replace function pg_temp.capture_sqlstate(command text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  execute command;
  return null;
exception when others then
  return sqlstate;
end;
$$;

set local role anon;
select extensions.is(
  pg_temp.capture_sqlstate('select * from public.companies'),
  '42501',
  'anonymous users cannot read companies'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select extensions.is(
  (
    select count(*)::integer
    from public.leads
    where company_id = '10000000-0000-0000-0000-000000000001'
  ),
  20,
  'owners can read every lead in their company'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select extensions.is(
  (
    select count(*)::integer
    from public.leads
    where company_id = '10000000-0000-0000-0000-000000000001'
  ),
  20,
  'admins can read every lead in their company'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select extensions.is(
  (
    select count(*)::integer
    from public.leads
    where company_id = '10000000-0000-0000-0000-000000000001'
  ),
  20,
  'sales managers can read every lead in their company'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select extensions.is(
  (
    select count(*)::integer
    from public.leads
    where company_id = '10000000-0000-0000-0000-000000000001'
  ),
  5,
  'sales representatives can read only their assigned leads'
);
select extensions.is(
  (
    select count(*)::integer
    from public.companies
    where id = '10000000-0000-0000-0000-000000000002'
  ),
  0,
  'company records from another tenant are hidden'
);
select extensions.is(
  pg_temp.capture_sqlstate($command$
    insert into public.leads (
      company_id, lead_number, full_name, phone, service_required, location,
      budget_pkr, source, assigned_member_id, score, temperature, stage,
      created_by_member_id
    )
    values (
      '10000000-0000-0000-0000-000000000002',
      'FORGED-1',
      'Forged Tenant Lead',
      '+92 300 9999999',
      'Test',
      'Islamabad',
      1,
      'Test',
      '20000000-0000-0000-0000-000000000005',
      50,
      'cold',
      'new_inquiry',
      '20000000-0000-0000-0000-000000000005'
    )
  $command$),
  '42501',
  'a representative cannot forge another company_id'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
reset role;
select extensions.is(
  pg_temp.capture_sqlstate($command$
    update public.leads
    set assigned_member_id = '20000000-0000-0000-0000-000000000005'
    where id = '30000000-0000-0000-0000-000000000001'
  $command$),
  '23503',
  'cross-company member assignment is rejected by a composite foreign key'
);
select extensions.is(
  pg_temp.capture_sqlstate($command$
    update public.leads
    set company_id = '10000000-0000-0000-0000-000000000002'
    where id = '30000000-0000-0000-0000-000000000001'
  $command$),
  '23514',
  'company_id cannot be changed after insert'
);
select extensions.is(
  pg_temp.capture_sqlstate($command$
    update public.leads
    set score = 101
    where id = '30000000-0000-0000-0000-000000000001'
  $command$),
  '23514',
  'lead scores above 100 are rejected'
);
select extensions.is(
  pg_temp.capture_sqlstate($command$
    update public.leads
    set budget_pkr = -1
    where id = '30000000-0000-0000-0000-000000000001'
  $command$),
  '23514',
  'negative lead budgets are rejected'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
reset role;
select extensions.is(
  pg_temp.capture_sqlstate($command$
    update public.appointments
    set ends_at = starts_at - interval '1 minute'
    where id = '60000000-0000-0000-0000-000000000001'
  $command$),
  '23514',
  'appointment end time must be later than its start time'
);
select extensions.is(
  pg_temp.capture_sqlstate($command$
    update public.follow_ups
    set status = 'completed'
    where id = '50000000-0000-0000-0000-000000000001'
  $command$),
  '23514',
  'completed follow-ups require completion time and member'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
select extensions.is(
  (
    select count(*)::integer
    from public.leads
    where company_id = '10000000-0000-0000-0000-000000000001'
  ),
  0,
  'an owner cannot read another company leads'
);
reset role;
select extensions.is(
  pg_temp.capture_sqlstate($command$
    update public.company_members
    set role = 'admin'
    where id = '20000000-0000-0000-0000-000000000001'
  $command$),
  '23514',
  'the final active owner cannot be demoted'
);

select extensions.finish();

rollback;
