begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(44);

create or replace function pg_temp.capture_sqlstate(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlstate; end;
$$;

select extensions.is(has_table_privilege('authenticated','public.lead_ai_insights','insert'),false,'browser clients cannot insert AI insights');
select extensions.is(has_table_privilege('authenticated','public.lead_ai_insights','update'),false,'browser clients cannot edit completed AI insights');
select extensions.is(has_table_privilege('authenticated','public.ai_usage_events','insert'),false,'browser clients cannot forge AI usage');
select extensions.is(has_table_privilege('authenticated','public.ai_usage_events','update'),false,'AI usage events are append-only for clients');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select extensions.is(pg_temp.capture_sqlstate($sql$
  select public.begin_ai_generation('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',repeat('a',64),'mock-v1','mock','prompt-v1',false)
$sql$),'P0001','company AI is disabled by default');

select extensions.lives_ok($sql$
  select public.update_company_ai_settings(
    '10000000-0000-0000-0000-000000000001',
    (select updated_at from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),
    '{"version":1,"enabled":true,"allowed_roles":["owner","admin","sales_manager","sales_representative"],"model_reference":"environment_default","daily_company_limit":50,"monthly_company_limit":500,"user_hourly_limit":10,"regeneration_cooldown_minutes":0,"max_concurrent":2,"data_minimization_acknowledged":true,"disclaimer_enabled":true,"auto_generate_on_create":false}'
  )
$sql$,'owner enables company AI through the controlled workflow');
select extensions.is((select (ai_settings->>'enabled')::boolean from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),true,'enabled AI setting persisted');
select extensions.is((select count(*)::integer from public.company_settings_audit where action='ai_settings_updated'),1,'AI settings update created audit history');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select extensions.is(pg_temp.capture_sqlstate($sql$
  select public.update_company_ai_settings('10000000-0000-0000-0000-000000000001',(select updated_at from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),(select ai_settings from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'))
$sql$),'42501','manager cannot update company AI settings');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select extensions.is(pg_temp.capture_sqlstate($sql$
  select public.update_company_ai_settings('10000000-0000-0000-0000-000000000001',(select updated_at from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),'{"version":1,"enabled":true}')
$sql$),'22023','invalid AI configuration is rejected');

create temporary table ai_ids(kind text primary key,id uuid);
insert into ai_ids select 'initial',((public.begin_ai_generation(
  '10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',repeat('a',64),
  'mock-v1','mock','prompt-v1',false)->>'insight_id')::uuid);
select extensions.ok((select id is not null from ai_ids where kind='initial'),'owner begins generation for an accessible lead');
select extensions.is((public.begin_ai_generation('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',repeat('a',64),'mock-v1','mock','prompt-v1',false)->>'state'),'generating','duplicate active generation is reused as in-progress');
select extensions.is(public.complete_ai_generation(
  '10000000-0000-0000-0000-000000000001',(select id from ai_ids where kind='initial'),
  'Evidence-based test insight summary.','high','hot',88,array['Budget supplied','Timeline supplied'],
  array[]::text[],array[]::text[],'Arrange a qualification consultation.','Thank you for sharing your requirements. May we arrange a brief call?',0.880,12,18,25
),true,'trusted workflow completes structured insight');
select extensions.is((select count(*)::integer from public.lead_ai_insights where status='succeeded'),1,'successful insight is visible to the lead owner');
select extensions.is((select count(*)::integer from public.ai_usage_events where status='succeeded'),1,'successful usage event was recorded');
select extensions.is((public.begin_ai_generation('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',repeat('a',64),'mock-v1','mock','prompt-v1',false)->>'state'),'reused','unchanged fingerprint reuses successful insight');

insert into ai_ids select 'regenerated',((public.begin_ai_generation(
  '10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',repeat('a',64),
  'mock-v1','mock','prompt-v1',true)->>'insight_id')::uuid);
select extensions.ok((select id is not null from ai_ids where kind='regenerated'),'forced regeneration creates a new version after cooldown');
select extensions.is(public.complete_ai_generation(
  '10000000-0000-0000-0000-000000000001',(select id from ai_ids where kind='regenerated'),
  'Second auditable test insight version.','medium','warm',76,array['More qualification needed'],
  array['Decision maker'],array['Timeline uncertainty'],'Confirm the decision maker.','Thank you. Could we confirm who will participate in the project decision?',0.720,10,16,20
),true,'regenerated insight completes');
select extensions.is((select count(*)::integer from public.lead_ai_insights where lead_id='30000000-0000-0000-0000-000000000001' and status='succeeded'),2,'old insight versions remain auditable');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select extensions.is((select count(*)::integer from public.lead_ai_insights where lead_id='30000000-0000-0000-0000-000000000001'),0,'representative cannot view another representatives lead insight');
select extensions.is(pg_temp.capture_sqlstate($sql$
  select public.begin_ai_generation('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',repeat('b',64),'mock-v1','mock','prompt-v1',false)
$sql$),'42501','representative cannot generate for an unauthorized lead');
insert into ai_ids select 'representative',((public.begin_ai_generation(
  '10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000016',repeat('c',64),
  'mock-v1','mock','prompt-v1',false)->>'insight_id')::uuid);
select extensions.ok((select id is not null from ai_ids where kind='representative'),'representative begins AI generation for assigned lead');
select extensions.is(public.complete_ai_generation(
  '10000000-0000-0000-0000-000000000001',(select id from ai_ids where kind='representative'),
  'Representative assigned lead insight.','low','cold',52,array['Early qualification'],
  array['Budget'],array[]::text[],'Ask for budget and timeline.','Thank you. Could you share your expected budget and preferred timeline?',0.650,0,0,3
),true,'representative completes assigned lead insight');
select extensions.is((select count(*)::integer from public.lead_ai_insights where lead_id='30000000-0000-0000-0000-000000000016'),1,'representative views assigned lead insight');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select extensions.is(public.apply_ai_recommendation('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',(select id from ai_ids where kind='regenerated'),'score'),true,'authorized user explicitly applies AI score recommendation');
select extensions.is((select score from public.leads where id='30000000-0000-0000-0000-000000000001'),76::smallint,'AI score is applied only after explicit action');
select extensions.ok((select metadata @> jsonb_build_object('old_score',92,'new_score',76) from public.lead_activities where activity_type='ai_score_applied' order by occurred_at desc limit 1),'score application activity records old and new values');
select extensions.is(public.apply_ai_recommendation('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',(select id from ai_ids where kind='regenerated'),'temperature'),true,'authorized user explicitly applies AI temperature recommendation');
select extensions.is((select temperature::text from public.leads where id='30000000-0000-0000-0000-000000000001'),'warm','AI temperature is applied only after explicit action');
select extensions.ok((select metadata @> jsonb_build_object('old_temperature','hot','new_temperature','warm') from public.lead_activities where activity_type='ai_temperature_applied' order by occurred_at desc limit 1),'temperature application activity records old and new values');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
select extensions.is(pg_temp.capture_sqlstate($sql$
  select public.apply_ai_recommendation('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',(select id from ai_ids where kind='regenerated'),'temperature')
$sql$),'42501','representative cannot apply recommendation to unauthorized lead');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
insert into ai_ids select 'failed',((public.begin_ai_generation(
  '10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',repeat('d',64),
  'mock-v1','mock','prompt-v1',false)->>'insight_id')::uuid);
select extensions.ok((select id is not null from ai_ids where kind='failed'),'a separate generation begins for failure handling');
select extensions.is(public.fail_ai_generation('10000000-0000-0000-0000-000000000001',(select id from ai_ids where kind='failed'),'provider_error',15),true,'provider failure is recorded safely');
select extensions.is((select score from public.leads where id='30000000-0000-0000-0000-000000000002'),86::smallint,'failed AI generation does not change lead data');
select extensions.is((select count(*)::integer from public.ai_usage_events where status='failed'),1,'failed usage event is retained without prompt payload');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select extensions.is(pg_temp.capture_sqlstate($sql$select public.get_ai_usage_summary('10000000-0000-0000-0000-000000000001')$sql$),'42501','manager cannot view company-wide AI usage summary');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select extensions.ok((public.get_ai_usage_summary('10000000-0000-0000-0000-000000000001')->>'succeeded')::integer>=3,'owner can view summarized AI usage');

select extensions.lives_ok($sql$
  select public.update_company_ai_settings(
    '10000000-0000-0000-0000-000000000001',
    (select updated_at from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),
    jsonb_set(jsonb_set((select ai_settings from public.company_settings where company_id='10000000-0000-0000-0000-000000000001'),'{daily_company_limit}','4'),'{monthly_company_limit}','4')
  )
$sql$,'owner can tighten server-side quota settings');
select extensions.is(pg_temp.capture_sqlstate($sql$
  select public.begin_ai_generation('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003',repeat('e',64),'mock-v1','mock','prompt-v1',false)
$sql$),'P0001','company daily quota is enforced server-side');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select extensions.is((select count(*)::integer from public.lead_ai_insights where company_id='10000000-0000-0000-0000-000000000002'),0,'admin without isolation membership cannot read cross-company insights');
select extensions.is(pg_temp.capture_sqlstate($sql$
  select public.begin_ai_generation('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000021',repeat('f',64),'mock-v1','mock','prompt-v1',false)
$sql$),'42501','cross-company AI generation is denied');

reset role;
select extensions.is((select count(*)::integer from public.lead_activities where activity_type in ('ai_insight_generated','ai_insight_regenerated')),3,'generation activities contain no hidden reasoning');
select extensions.is((select count(*)::integer from public.ai_usage_events where error_code is null or error_code='provider_error'),4,'usage records contain only safe status metadata');
select extensions.is((select count(*)::integer from public.lead_ai_insights where status='generating'),0,'all test generation locks are released');

select * from extensions.finish();
rollback;
