begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(54);

create or replace function pg_temp.capture_sqlstate(statement text)
returns text language plpgsql as $$
begin
  execute statement;
  return null;
exception when others then return sqlstate;
end;
$$;

select extensions.is(has_table_privilege('authenticated', 'public.follow_ups', 'insert'), false, 'clients cannot insert follow-ups directly');
select extensions.is(has_table_privilege('authenticated', 'public.follow_ups', 'update'), false, 'clients cannot update follow-ups directly');
select extensions.is(has_table_privilege('authenticated', 'public.follow_ups', 'delete'), false, 'clients cannot hard-delete follow-ups');
select extensions.is(has_table_privilege('authenticated', 'public.appointments', 'insert'), false, 'clients cannot insert appointments directly');
select extensions.is(has_table_privilege('authenticated', 'public.appointments', 'update'), false, 'clients cannot update appointments directly');
select extensions.is(has_table_privilege('authenticated', 'public.appointments', 'delete'), false, 'clients cannot hard-delete appointments');

select extensions.is((select count(*)::integer from public.follow_ups where company_id='10000000-0000-0000-0000-000000000001' and deleted_at is null), 20, 'seed contains twenty follow-ups');
select extensions.is((select count(*)::integer from public.follow_ups where company_id='10000000-0000-0000-0000-000000000001' and status='pending' and (due_at at time zone 'Asia/Karachi')::date=date '2026-07-23'), 5, 'five follow-ups are due on the reference date');
select extensions.is((select count(*)::integer from public.appointments where company_id='10000000-0000-0000-0000-000000000001' and deleted_at is null), 5, 'seed contains five appointments');
select extensions.is((select count(*)::integer from public.appointments where company_id='10000000-0000-0000-0000-000000000001' and appointment_type='site_visit' and status in ('pending','confirmed') and starts_at >= '2026-07-23T00:00:00+05:00'), 3, 'seed contains three upcoming site visits from the reference date');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select extensions.is((select count(*)::integer from public.follow_ups where company_id='10000000-0000-0000-0000-000000000001'), 20, 'owner sees all company follow-ups');
select extensions.is((select count(*)::integer from public.appointments where company_id='10000000-0000-0000-0000-000000000001'), 5, 'owner sees all company appointments');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select extensions.is((select count(*)::integer from public.follow_ups where company_id='10000000-0000-0000-0000-000000000001'), 20, 'admin sees all company follow-ups');
select extensions.is((select count(*)::integer from public.appointments where company_id='10000000-0000-0000-0000-000000000001'), 5, 'admin sees all company appointments');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select extensions.is((select count(*)::integer from public.follow_ups where company_id='10000000-0000-0000-0000-000000000001'), 20, 'manager sees all company follow-ups');
select extensions.is((select count(*)::integer from public.appointments where company_id='10000000-0000-0000-0000-000000000001'), 5, 'manager sees all company appointments');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select extensions.is((select count(*)::integer from public.follow_ups), 5, 'representative sees follow-ups for assigned leads');
select extensions.is((select count(*)::integer from public.appointments), 1, 'representative sees only an assigned or accessible-lead appointment');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
select extensions.is((select count(*)::integer from public.follow_ups where company_id='10000000-0000-0000-0000-000000000001'), 0, 'cross-company follow-up reads are denied');
select extensions.is((select count(*)::integer from public.appointments where company_id='10000000-0000-0000-0000-000000000001'), 0, 'cross-company appointment reads are denied');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
create temporary table workflow_ids (kind text primary key, id uuid);
insert into workflow_ids
select 'owner_follow', public.create_follow_up(
  '10000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '2026-08-02T10:00:00+05:00', 'high', 'Owner follow-up test'
);
select extensions.ok((select id is not null from workflow_ids where kind='owner_follow'), 'owner creates a follow-up through the controlled workflow');
select extensions.is(
  public.create_follow_up(
    '10000000-0000-0000-0000-000000000001',
    '82000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '2026-08-03T10:00:00+05:00', 'normal', 'Ignored duplicate'
  ),
  (select id from workflow_ids where kind='owner_follow'),
  'follow-up creation is idempotent'
);
select extensions.is((select count(*)::integer from public.lead_activities where lead_id='30000000-0000-0000-0000-000000000001' and description='Follow-up scheduled'), 1, 'follow-up scheduling appends one activity');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
insert into workflow_ids
select 'rep_follow', public.create_follow_up(
  '10000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000004',
  '2026-08-02T11:00:00+05:00', 'normal', 'Representative follow-up'
);
select extensions.is((select assigned_member_id from public.follow_ups where id=(select id from workflow_ids where kind='rep_follow')), '20000000-0000-0000-0000-000000000004'::uuid, 'representative follow-up is self-assigned');
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.create_follow_up('10000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','2026-08-02T12:00:00+05:00','normal','Forged assignment') $$),
  '42501',
  'representative cannot forge follow-up assignment'
);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.create_follow_up('10000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','2026-08-02T12:00:00+05:00','normal','Other lead') $$),
  '42501',
  'representative cannot schedule against another representatives lead'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.create_follow_up('10000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000007','2026-08-02T12:00:00+05:00','normal','Invalid assignee') $$),
  '23503',
  'cross-company or suspended follow-up assignee is rejected'
);
create temporary table original_follow as
select updated_at from public.follow_ups where id=(select id from workflow_ids where kind='owner_follow');
select extensions.lives_ok(
  $$ select public.update_follow_up('10000000-0000-0000-0000-000000000001',(select id from workflow_ids where kind='owner_follow'),(select updated_at from original_follow),'20000000-0000-0000-0000-000000000002','2026-08-04T10:30:00+05:00','urgent','Rescheduled') $$,
  'authorized follow-up reschedule succeeds'
);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.update_follow_up('10000000-0000-0000-0000-000000000001',(select id from workflow_ids where kind='owner_follow'),(select updated_at from original_follow),'20000000-0000-0000-0000-000000000002','2026-08-05T10:30:00+05:00','urgent','Stale') $$),
  '40001',
  'stale follow-up update is rejected'
);
select extensions.ok((select count(*) > 0 from public.lead_activities where lead_id='30000000-0000-0000-0000-000000000001' and description='Follow-up rescheduled'), 'follow-up reschedule appends activity');
select extensions.is(public.transition_follow_up('10000000-0000-0000-0000-000000000001',(select id from workflow_ids where kind='owner_follow'),'completed'), true, 'follow-up completion succeeds');
select extensions.is(public.transition_follow_up('10000000-0000-0000-0000-000000000001',(select id from workflow_ids where kind='owner_follow'),'completed'), false, 'follow-up completion is idempotent');
select extensions.ok((select completed_at is not null and completed_by_member_id is not null and cancelled_at is null from public.follow_ups where id=(select id from workflow_ids where kind='owner_follow')), 'follow-up completion metadata is consistent');
select extensions.is(public.transition_follow_up('10000000-0000-0000-0000-000000000001',(select id from workflow_ids where kind='rep_follow'),'cancelled'), true, 'follow-up cancellation succeeds');
select extensions.ok((select cancelled_at is not null and completed_at is null from public.follow_ups where id=(select id from workflow_ids where kind='rep_follow')), 'follow-up cancellation metadata is consistent');

insert into workflow_ids
select 'owner_appointment', public.create_appointment(
  '10000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001', '',
  'site_visit', '2026-08-06T10:00:00+05:00',
  '2026-08-06T11:00:00+05:00', 'DHA Lahore',
  'Owner appointment', '20000000-0000-0000-0000-000000000001'
);
select extensions.ok((select id is not null from workflow_ids where kind='owner_appointment'), 'owner creates a linked appointment');
select extensions.is(
  public.create_appointment(
    '10000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', 'Ignored',
    'consultation', '2026-08-07T10:00:00+05:00', null,
    '', '', '20000000-0000-0000-0000-000000000001'
  ),
  (select id from workflow_ids where kind='owner_appointment'),
  'appointment creation is idempotent'
);
select extensions.is((select count(*)::integer from public.lead_activities where lead_id='30000000-0000-0000-0000-000000000001' and description='Site visit scheduled'), 1, 'appointment scheduling appends one activity');
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.create_appointment('10000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000002',null,'','meeting','2026-08-06T10:00:00+05:00',null,'Office','','20000000-0000-0000-0000-000000000001') $$),
  '22023',
  'unlinked appointment requires a customer name'
);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.create_appointment('10000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','','consultation','2026-08-06T11:00:00+05:00','2026-08-06T10:00:00+05:00','Office','','20000000-0000-0000-0000-000000000001') $$),
  '22023',
  'appointment end must follow its start'
);

create temporary table original_appointment as
select updated_at from public.appointments where id=(select id from workflow_ids where kind='owner_appointment');
select extensions.lives_ok(
  $$ select public.update_appointment('10000000-0000-0000-0000-000000000001',(select id from workflow_ids where kind='owner_appointment'),(select updated_at from original_appointment),'Ali Raza','site_visit','2026-08-06T12:00:00+05:00','2026-08-06T13:00:00+05:00','DHA Lahore','Rescheduled','20000000-0000-0000-0000-000000000002') $$,
  'authorized appointment reschedule succeeds'
);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.update_appointment('10000000-0000-0000-0000-000000000001',(select id from workflow_ids where kind='owner_appointment'),(select updated_at from original_appointment),'Ali Raza','site_visit','2026-08-07T12:00:00+05:00',null,'DHA Lahore','Stale','20000000-0000-0000-0000-000000000002') $$),
  '40001',
  'stale appointment update is rejected'
);
select extensions.ok((select count(*) > 0 from public.lead_activities where lead_id='30000000-0000-0000-0000-000000000001' and description='Appointment rescheduled'), 'appointment reschedule appends activity');
select extensions.is(public.transition_appointment('10000000-0000-0000-0000-000000000001',(select id from workflow_ids where kind='owner_appointment'),'confirmed'), true, 'appointment confirmation succeeds');
select extensions.is(public.transition_appointment('10000000-0000-0000-0000-000000000001',(select id from workflow_ids where kind='owner_appointment'),'confirmed'), false, 'appointment confirmation is idempotent');
select extensions.is(public.transition_appointment('10000000-0000-0000-0000-000000000001',(select id from workflow_ids where kind='owner_appointment'),'completed'), true, 'confirmed appointment can be completed');
select extensions.ok((select completed_at is not null and completed_by_member_id is not null and cancelled_at is null from public.appointments where id=(select id from workflow_ids where kind='owner_appointment')), 'appointment completion metadata is consistent');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.update_appointment('10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',(select updated_at from public.appointments where id='60000000-0000-0000-0000-000000000001'),'Fahad Mehmood','site_visit','2026-08-07T12:00:00+05:00',null,'Blue Area','','20000000-0000-0000-0000-000000000004') $$),
  '42501',
  'representative cannot update another members appointment'
);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.create_appointment('10000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000001','','site_visit','2026-08-08T10:00:00+05:00',null,'Lahore','','20000000-0000-0000-0000-000000000004') $$),
  '42501',
  'representative cannot schedule an appointment for an inaccessible lead'
);
select extensions.is(
  pg_temp.capture_sqlstate($$ select public.set_appointment_archived('10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000004',true) $$),
  '42501',
  'representative cannot archive appointments'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok($$ select public.set_follow_up_archived('10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000004',true) $$, 'manager can archive a follow-up');
select extensions.is((select count(*)::integer from public.follow_ups where id='50000000-0000-0000-0000-000000000004'), 0, 'archived follow-up is excluded from normal reads');
select extensions.lives_ok($$ select public.set_appointment_archived('10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000004',true) $$, 'manager can archive an appointment');
select extensions.is((select count(*)::integer from public.appointments where id='60000000-0000-0000-0000-000000000004'), 0, 'archived appointment is excluded from normal reads');

reset role;
select extensions.finish();
rollback;
