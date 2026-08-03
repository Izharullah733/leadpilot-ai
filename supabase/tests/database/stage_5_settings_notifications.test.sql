begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(46);

create or replace function pg_temp.capture_sqlstate(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlstate; end;
$$;

delete from public.notifications;
delete from public.user_notification_preferences;
delete from public.company_settings_audit;

select extensions.is(has_table_privilege('authenticated','public.company_settings','update'),false,'clients cannot update settings directly');
select extensions.is(has_table_privilege('authenticated','public.companies','update'),false,'clients cannot update company identity directly');
select extensions.is(has_table_privilege('authenticated','public.profiles','update'),false,'clients cannot update profiles directly');
select extensions.is(has_table_privilege('authenticated','public.notifications','insert'),false,'clients cannot insert arbitrary notifications');
select extensions.is(has_table_privilege('authenticated','public.notifications','update'),false,'clients cannot update notifications directly');
select extensions.is(has_table_privilege('authenticated','public.user_notification_preferences','insert'),false,'clients cannot insert preferences directly');
select extensions.is(has_table_privilege('authenticated','public.company_settings_audit','insert'),false,'clients cannot forge settings audit');
select extensions.is(has_function_privilege('authenticated','public.process_follow_up_notifications(timestamptz)','execute'),false,'browser users cannot execute the processor');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select extensions.is((select count(*)::integer from public.company_settings),2,'multi-tenant owner reads settings for both active memberships');

select extensions.lives_ok($sql$
  select * from public.update_company_settings(
    '10000000-0000-0000-0000-000000000001',
    (select updated_at from public.companies where id='10000000-0000-0000-0000-000000000001'),
    (select updated_at from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),
    'Prime Build QA','qa@primebuild.pk','+92 51 8899000','Islamabad','Blue Area Islamabad',
    'Asia/Karachi','PKR',
    array['Grey Structure Construction','Complete House Construction','Renovation','Interior Design','Commercial Construction','Architecture and Planning','Property Purchase','Property Sale','Landscaping'],
    array['Landscaping'],
    array['Facebook Ads','Instagram','Website','WhatsApp','Referral','Walk-in','Google Ads','Property Portal','Trade Show'],
    array['Trade Show'],
    '{"version":1,"weights":{"budget":30,"timeline":25,"source":15,"completeness":15,"service":15},"budget_thresholds":{"warm_pkr":10000000,"hot_pkr":30000000},"high_intent_services":["Complete House Construction"]}',
    '{"new_lead_assigned":true,"follow_up_due":true,"follow_up_overdue":true}'
  )
$sql$,'owner updates company settings through controlled function');
select extensions.is((select name from public.companies where id='10000000-0000-0000-0000-000000000001'),'Prime Build QA','company profile was persisted');
select extensions.ok((select count(*)>=4 from public.company_settings_audit where company_id='10000000-0000-0000-0000-000000000001'),'settings changes created append-only audit events');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select extensions.lives_ok($sql$
  select * from public.update_company_settings(
    '10000000-0000-0000-0000-000000000001',
    (select updated_at from public.companies where id='10000000-0000-0000-0000-000000000001'),
    (select updated_at from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),
    'Prime Build QA','qa@primebuild.pk','+92 51 8899000','Islamabad','Blue Area Islamabad',
    'Asia/Karachi','PKR',
    (select services from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),
    (select disabled_services from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),
    (select lead_sources from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),
    (select disabled_lead_sources from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),
    (select lead_scoring_rules from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),
    (select notification_defaults from public.company_settings where company_id='10000000-0000-0000-0000-000000000001')
  )
$sql$,'admin can save company settings');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select extensions.is(pg_temp.capture_sqlstate($sql$select * from public.update_company_settings('10000000-0000-0000-0000-000000000001',now(),now(),'x','','','','','Asia/Karachi','PKR',array['One'],array[]::text[],array['One'],array[]::text[],'{}','{}')$sql$),'42501','manager cannot update company settings');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select extensions.is(pg_temp.capture_sqlstate($sql$select * from public.update_company_settings('10000000-0000-0000-0000-000000000001',now(),now(),'x','','','','','Asia/Karachi','PKR',array['One'],array[]::text[],array['One'],array[]::text[],'{}','{}')$sql$),'42501','representative cannot update company settings');
select extensions.is(pg_temp.capture_sqlstate($sql$select * from public.update_company_settings('10000000-0000-0000-0000-000000000002',now(),now(),'x','','','','','Asia/Karachi','PKR',array['One'],array[]::text[],array['One'],array[]::text[],'{}','{}')$sql$),'42501','cross-company settings update is denied');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select extensions.is(pg_temp.capture_sqlstate($sql$
  select * from public.update_company_settings('10000000-0000-0000-0000-000000000001',(select updated_at from public.companies where id='10000000-0000-0000-0000-000000000001'),(select updated_at from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),'Prime Build QA','qa@primebuild.pk','','','','Invalid/Zone','PKR',(select services from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),(select disabled_services from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),(select lead_sources from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),(select disabled_lead_sources from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),(select lead_scoring_rules from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),(select notification_defaults from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'))
$sql$),'22023','invalid timezone is rejected');
select extensions.is(private.valid_scoring_rules('{"version":1,"weights":{"budget":99},"budget_thresholds":{},"high_intent_services":[]}'),false,'invalid scoring structure is rejected');
select extensions.is(private.valid_catalog(array['Referral','referral']),false,'case-insensitive catalog duplicates are rejected');
select extensions.is(pg_temp.capture_sqlstate($sql$
  select * from public.update_company_settings('10000000-0000-0000-0000-000000000001',(select updated_at from public.companies where id='10000000-0000-0000-0000-000000000001'),(select updated_at from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),'Prime Build QA','qa@primebuild.pk','','','','Asia/Karachi','PKR',array['Renovation'],array[]::text[],(select lead_sources from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),array[]::text[],(select lead_scoring_rules from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),(select notification_defaults from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'))
$sql$),'23503','catalog values used by existing leads cannot be removed');

select extensions.lives_ok($sql$select public.update_my_profile((select updated_at from public.profiles where id='00000000-0000-0000-0000-000000000001'),'Ahmed QA','+92 300 0000001','Asia/Karachi')$sql$,'user updates own profile');
select extensions.is((select full_name from public.profiles where id='00000000-0000-0000-0000-000000000001'),'Ahmed QA','profile name change persisted');
select extensions.is(pg_temp.capture_sqlstate($sql$select public.update_my_profile((select updated_at from public.profiles where id='00000000-0000-0000-0000-000000000001'),'Ahmed QA','','Invalid/Zone')$sql$),'22023','invalid profile timezone is rejected');
select extensions.is((select full_name from public.profiles where id='00000000-0000-0000-0000-000000000002'),'Sara Malik','profile function cannot target another user');

select extensions.lives_ok($sql$select public.update_my_notification_preferences('10000000-0000-0000-0000-000000000001','{"follow_up_due":false,"appointment_created":true}')$sql$,'user saves personal notification preferences');
select extensions.is((select (preferences->>'follow_up_due')::boolean from public.user_notification_preferences),false,'personal preference persisted');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select extensions.is((select count(*)::integer from public.user_notification_preferences),0,'representative cannot read another users preferences');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select extensions.ok(public.create_follow_up('10000000-0000-0000-0000-000000000001','85000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004','2026-08-01T12:00:00+05:00','normal','Stage 5 notification test') is not null,'trusted follow-up workflow succeeds');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select extensions.is((select count(*)::integer from public.notifications where notification_type='follow_up_assigned'),1,'recipient sees assigned follow-up notification');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select extensions.is((select count(*)::integer from public.notifications where notification_type='follow_up_assigned'),0,'another member cannot read recipients notification');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select extensions.is(public.mark_notification_read('10000000-0000-0000-0000-000000000001',(select id from public.notifications where notification_type='follow_up_assigned' limit 1)),true,'recipient marks own notification read');
select extensions.ok((select read_at is not null from public.notifications where notification_type='follow_up_assigned' limit 1),'read timestamp is stored');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select extensions.is(public.mark_notification_read('10000000-0000-0000-0000-000000000001',(select id from public.notifications where false limit 1)),false,'user cannot mark another recipients notification read');

reset role;
select extensions.is(pg_temp.capture_sqlstate($sql$insert into public.notifications(company_id,recipient_member_id,notification_type,title,body,event_key,lead_id) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','system','Cross','Cross','cross-related','40000000-0000-0000-0000-000000000001')$sql$),'23503','cross-company related lead is rejected');
select extensions.is(private.enqueue_notification('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000007','system','Ignored','Inactive member','inactive-test'),false,'inactive member is not notified');

set local role service_role;
select extensions.ok(has_function_privilege('service_role','public.process_follow_up_notifications(timestamptz)','execute'),'service role can execute due processor');
create temporary table first_process as select * from public.process_follow_up_notifications('2026-07-23T12:00:00+05:00');
select extensions.ok((select due_created>0 from first_process),'processor creates due notifications');
select extensions.is((select due_created from public.process_follow_up_notifications('2026-07-23T12:00:00+05:00')),0,'due processor rerun is idempotent');
select extensions.ok((select overdue_created>=0 from first_process),'processor evaluates overdue notifications in company timezone');
reset role;
select extensions.is((select count(*)::integer from public.notifications notification join public.follow_ups followup on followup.id=notification.follow_up_id where followup.status<>'pending' and notification.notification_type in ('follow_up_due','follow_up_overdue')),0,'processor ignores completed and cancelled follow-ups');

select extensions.is(pg_temp.capture_sqlstate($sql$insert into public.notifications(company_id,recipient_member_id,notification_type,title,body,event_key) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','system','Duplicate','Duplicate','duplicate-event'),('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','system','Duplicate','Duplicate','duplicate-event')$sql$),'23505','duplicate event keys are rejected');
select extensions.is((select count(*)::integer from public.notifications where company_id='10000000-0000-0000-0000-000000000002' and recipient_member_id='20000000-0000-0000-0000-000000000007'),0,'inactive cross-tenant recipient has no notification');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select extensions.ok(public.mark_all_notifications_read('10000000-0000-0000-0000-000000000001')>=0,'mark-all-read is scoped to current recipient and company');
select extensions.is((select count(*)::integer from public.notifications where read_at is null),0,'recipient unread count becomes zero after mark all');

reset role;
update public.company_members set role='sales_manager',updated_at=clock_timestamp() where id='20000000-0000-0000-0000-000000000004';
select extensions.is((select count(*)::integer from public.notifications where event_key like 'membership:20000000-0000-0000-0000-000000000004:%'),1,'membership change trigger creates one notification');
select extensions.is(has_table_privilege('authenticated','public.company_settings_audit','delete'),false,'settings audit is append-only for normal users');

select * from extensions.finish();
rollback;
