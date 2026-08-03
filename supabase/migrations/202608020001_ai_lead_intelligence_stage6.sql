alter type public.lead_activity_type add value if not exists 'ai_insight_generated';
alter type public.lead_activity_type add value if not exists 'ai_insight_regenerated';
alter type public.lead_activity_type add value if not exists 'ai_score_applied';
alter type public.lead_activity_type add value if not exists 'ai_temperature_applied';

alter type public.notification_type add value if not exists 'ai_insight_completed';
alter type public.notification_type add value if not exists 'ai_generation_failed';
alter type public.notification_type add value if not exists 'ai_recommendation_applied';

alter table public.company_settings add column ai_settings jsonb not null default jsonb_build_object(
  'version', 1,
  'enabled', false,
  'allowed_roles', jsonb_build_array('owner','admin','sales_manager','sales_representative'),
  'model_reference', 'environment_default',
  'daily_company_limit', 50,
  'monthly_company_limit', 500,
  'user_hourly_limit', 10,
  'regeneration_cooldown_minutes', 5,
  'max_concurrent', 2,
  'data_minimization_acknowledged', false,
  'disclaimer_enabled', true,
  'auto_generate_on_create', false
);

create or replace function private.valid_ai_settings(value jsonb)
returns boolean language sql immutable set search_path='' as $$
  select coalesce((jsonb_typeof(value)='object'
    and value->>'version'='1'
    and jsonb_typeof(value->'enabled')='boolean'
    and jsonb_typeof(value->'allowed_roles')='array'
    and jsonb_array_length(value->'allowed_roles') between 1 and 4
    and not exists (
      select 1 from jsonb_array_elements_text(value->'allowed_roles') role_name
      where role_name not in ('owner','admin','sales_manager','sales_representative')
    )
    and (select count(*) from jsonb_array_elements_text(value->'allowed_roles')) =
      (select count(distinct role_name) from jsonb_array_elements_text(value->'allowed_roles') role_name)
    and value->>'model_reference'='environment_default'
    and (value->>'daily_company_limit')::integer between 1 and 1000
    and (value->>'monthly_company_limit')::integer between 1 and 10000
    and (value->>'user_hourly_limit')::integer between 1 and 100
    and (value->>'regeneration_cooldown_minutes')::integer between 0 and 1440
    and (value->>'max_concurrent')::integer between 1 and 10
    and jsonb_typeof(value->'data_minimization_acknowledged')='boolean'
    and jsonb_typeof(value->'disclaimer_enabled')='boolean'
    and jsonb_typeof(value->'auto_generate_on_create')='boolean'
    and (value->>'auto_generate_on_create')::boolean=false
    and (not (value->>'enabled')::boolean
      or (value->>'data_minimization_acknowledged')::boolean)),false);
$$;

alter table public.company_settings
  add constraint company_settings_ai_settings_valid
  check (private.valid_ai_settings(ai_settings));

alter table public.company_settings_audit
  drop constraint company_settings_audit_action_check;
alter table public.company_settings_audit
  add constraint company_settings_audit_action_check check (action in (
    'company_profile_updated','regional_settings_updated','service_catalog_updated',
    'lead_sources_updated','scoring_rules_updated','notification_defaults_updated',
    'ai_settings_updated'
  ));

create table public.lead_ai_insights (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null,
  generated_by_member_id uuid not null,
  provider text not null check (provider in ('openai','mock')),
  model text not null check (length(model) between 2 and 120),
  prompt_version text not null check (length(prompt_version) between 2 and 40),
  input_fingerprint text not null check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('generating','succeeded','failed')),
  generation_kind text not null default 'initial' check (generation_kind in ('initial','regeneration')),
  summary text,
  buying_intent text check (buying_intent is null or buying_intent in ('low','medium','high')),
  recommended_temperature public.lead_temperature,
  recommended_score smallint check (recommended_score is null or recommended_score between 0 and 100),
  score_factors text[],
  missing_information text[],
  risk_flags text[],
  recommended_next_action text,
  suggested_reply text,
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  tokens_input integer check (tokens_input is null or tokens_input >= 0),
  tokens_output integer check (tokens_output is null or tokens_output >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text check (error_code is null or error_code in (
    'configuration_missing','provider_timeout','provider_rate_limited','provider_error',
    'malformed_output','model_refusal','network_error','generation_expired'
  )),
  correlation_id uuid not null,
  generation_expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint lead_ai_insights_lead_fkey foreign key(company_id,lead_id)
    references public.leads(company_id,id) on delete cascade,
  constraint lead_ai_insights_member_fkey foreign key(company_id,generated_by_member_id)
    references public.company_members(company_id,id) on delete restrict,
  constraint lead_ai_insights_status_shape check (
    (status='generating' and completed_at is null and generation_expires_at is not null
      and summary is null and error_code is null)
    or (status='failed' and completed_at is not null and error_code is not null)
    or (status='succeeded' and completed_at is not null and error_code is null
      and summary is not null and buying_intent is not null
      and recommended_temperature is not null and recommended_score is not null
      and score_factors is not null and missing_information is not null and risk_flags is not null
      and recommended_next_action is not null and suggested_reply is not null and confidence is not null)
  ),
  constraint lead_ai_insights_output_lengths check (
    (summary is null or length(summary) between 10 and 1200)
    and (recommended_next_action is null or length(recommended_next_action) between 5 and 600)
    and (suggested_reply is null or length(suggested_reply) between 5 and 1200)
    and coalesce(cardinality(score_factors),0) <= 8
    and coalesce(cardinality(missing_information),0) <= 8
    and coalesce(cardinality(risk_flags),0) <= 8
  )
);

create unique index lead_ai_insights_one_generating_per_lead
  on public.lead_ai_insights(company_id,lead_id) where status='generating';
create index lead_ai_insights_lead_latest
  on public.lead_ai_insights(company_id,lead_id,created_at desc);
create index lead_ai_insights_latest_success
  on public.lead_ai_insights(company_id,lead_id,created_at desc) where status='succeeded';
create index lead_ai_insights_fingerprint
  on public.lead_ai_insights(company_id,lead_id,input_fingerprint,created_at desc);
create index lead_ai_insights_created_at on public.lead_ai_insights(company_id,created_at desc);

create table public.ai_usage_events (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  member_id uuid not null,
  lead_id uuid not null,
  insight_id uuid not null references public.lead_ai_insights(id) on delete cascade,
  provider text not null check (provider in ('openai','mock')),
  model text not null check (length(model) between 2 and 120),
  status text not null check (status in ('succeeded','failed')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  constraint ai_usage_member_fkey foreign key(company_id,member_id)
    references public.company_members(company_id,id) on delete restrict,
  constraint ai_usage_lead_fkey foreign key(company_id,lead_id)
    references public.leads(company_id,id) on delete cascade,
  constraint ai_usage_insight_unique unique(insight_id)
);
create index ai_usage_company_created on public.ai_usage_events(company_id,created_at desc);
create index ai_usage_member_created on public.ai_usage_events(company_id,member_id,created_at desc);

alter table public.lead_ai_insights enable row level security;
alter table public.ai_usage_events enable row level security;
revoke all on public.lead_ai_insights,public.ai_usage_events from public,anon,authenticated;
grant select on public.lead_ai_insights to authenticated;
grant select on public.ai_usage_events to authenticated;
grant select,insert,update,delete on public.lead_ai_insights,public.ai_usage_events to service_role;

create policy lead_ai_insights_select_accessible_lead on public.lead_ai_insights
for select to authenticated using(private.can_access_lead(company_id,lead_id));
create policy ai_usage_events_select_owner_admin on public.ai_usage_events
for select to authenticated using(private.has_company_role(
  company_id,array['owner','admin']::public.member_role[]));

create or replace function public.update_company_ai_settings(
  target_company_id uuid, expected_updated_at timestamptz, requested_settings jsonb
)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare actor public.company_members; existing public.company_settings; changed_at timestamptz;
begin
  actor:=private.require_lead_member(target_company_id);
  if actor.role not in ('owner','admin') then
    raise exception 'company AI settings update is not permitted' using errcode='42501';
  end if;
  if not private.valid_ai_settings(requested_settings) then
    raise exception 'invalid company AI settings' using errcode='22023';
  end if;
  select * into existing from public.company_settings where company_id=target_company_id for update;
  if existing.company_id is null then raise exception 'company settings not found' using errcode='P0002'; end if;
  if existing.updated_at<>expected_updated_at then
    raise exception 'settings were changed by another session' using errcode='40001';
  end if;
  update public.company_settings set ai_settings=requested_settings,
    updated_by_member_id=actor.id,updated_at=clock_timestamp()
  where company_id=target_company_id returning updated_at into changed_at;
  insert into public.company_settings_audit(company_id,actor_member_id,action,changed_fields)
  values(target_company_id,actor.id,'ai_settings_updated','["ai_settings"]');
  return changed_at;
end;
$$;

create or replace function public.begin_ai_generation(
  target_company_id uuid,target_lead_id uuid,requested_fingerprint text,
  requested_model text,requested_provider text,requested_prompt_version text,
  force_regeneration boolean default false
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.company_members; config jsonb; existing public.lead_ai_insights;
  created_id uuid; daily_count integer; monthly_count integer; hourly_count integer; active_count integer;
begin
  actor:=private.require_lead_member(target_company_id);
  if not private.can_access_lead(target_company_id,target_lead_id) then
    raise exception 'lead access is not permitted' using errcode='42501';
  end if;
  if requested_fingerprint !~ '^[a-f0-9]{64}$' or length(requested_model) not between 2 and 120
    or requested_provider not in ('openai','mock') or length(requested_prompt_version) not between 2 and 40 then
    raise exception 'invalid AI generation request' using errcode='22023';
  end if;
  select ai_settings into config from public.company_settings where company_id=target_company_id;
  if config is null or not (config->>'enabled')::boolean then
    raise exception 'company AI is disabled' using errcode='P0001';
  end if;
  if not (config->'allowed_roles' ? actor.role::text) then
    raise exception 'role is not allowed to use company AI' using errcode='42501';
  end if;

  update public.lead_ai_insights set status='failed',error_code='generation_expired',
    completed_at=clock_timestamp()
  where company_id=target_company_id and lead_id=target_lead_id and status='generating'
    and generation_expires_at<=clock_timestamp();

  select * into existing from public.lead_ai_insights
  where company_id=target_company_id and lead_id=target_lead_id and status='succeeded'
    and input_fingerprint=requested_fingerprint order by created_at desc limit 1;
  if existing.id is not null and not force_regeneration then
    return jsonb_build_object('state','reused','insight_id',existing.id);
  end if;
  if exists(select 1 from public.lead_ai_insights where company_id=target_company_id
    and lead_id=target_lead_id and status='generating') then
    return jsonb_build_object('state','generating');
  end if;
  if force_regeneration and exists(select 1 from public.lead_ai_insights
    where company_id=target_company_id and lead_id=target_lead_id and status='succeeded'
      and created_at>clock_timestamp()-make_interval(mins=>(config->>'regeneration_cooldown_minutes')::integer)) then
    raise exception 'AI regeneration cooldown is active' using errcode='P0001';
  end if;
  select count(*) into daily_count from public.lead_ai_insights where company_id=target_company_id
    and created_at>=date_trunc('day',clock_timestamp());
  select count(*) into monthly_count from public.lead_ai_insights where company_id=target_company_id
    and created_at>=date_trunc('month',clock_timestamp());
  select count(*) into hourly_count from public.lead_ai_insights where company_id=target_company_id
    and generated_by_member_id=actor.id and created_at>=clock_timestamp()-interval '1 hour';
  select count(*) into active_count from public.lead_ai_insights where company_id=target_company_id
    and status='generating';
  if daily_count >= (config->>'daily_company_limit')::integer then
    raise exception 'company daily AI limit reached' using errcode='P0001'; end if;
  if monthly_count >= (config->>'monthly_company_limit')::integer then
    raise exception 'company monthly AI limit reached' using errcode='P0001'; end if;
  if hourly_count >= (config->>'user_hourly_limit')::integer then
    raise exception 'user hourly AI limit reached' using errcode='P0001'; end if;
  if active_count >= (config->>'max_concurrent')::integer then
    raise exception 'company concurrent AI limit reached' using errcode='P0001'; end if;

  insert into public.lead_ai_insights(company_id,lead_id,generated_by_member_id,provider,
    model,prompt_version,input_fingerprint,status,generation_kind,correlation_id,generation_expires_at)
  values(target_company_id,target_lead_id,actor.id,requested_provider,requested_model,
    requested_prompt_version,requested_fingerprint,'generating',
    case when exists(select 1 from public.lead_ai_insights where company_id=target_company_id
      and lead_id=target_lead_id and status='succeeded') then 'regeneration' else 'initial' end,
    extensions.gen_random_uuid(),clock_timestamp()+interval '3 minutes') returning id into created_id;
  return jsonb_build_object('state','created','insight_id',created_id);
end;
$$;

create or replace function public.complete_ai_generation(
  target_company_id uuid,target_insight_id uuid,output_summary text,output_buying_intent text,
  output_temperature public.lead_temperature,output_score integer,output_score_factors text[],
  output_missing_information text[],output_risk_flags text[],output_next_action text,
  output_suggested_reply text,output_confidence numeric,usage_input_tokens integer,
  usage_output_tokens integer,request_latency_ms integer
)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor public.company_members; insight public.lead_ai_insights; changed integer;
begin
  actor:=private.require_lead_member(target_company_id);
  select * into insight from public.lead_ai_insights where company_id=target_company_id
    and id=target_insight_id for update;
  if insight.id is null or insight.generated_by_member_id<>actor.id or insight.status<>'generating' then
    raise exception 'AI generation cannot be completed' using errcode='42501'; end if;
  if output_buying_intent not in ('low','medium','high') or output_score not between 0 and 100
    or output_confidence not between 0 and 1 or length(output_summary) not between 10 and 1200
    or length(output_next_action) not between 5 and 600 or length(output_suggested_reply) not between 5 and 1200
    or cardinality(output_score_factors)>8 or cardinality(output_missing_information)>8
    or cardinality(output_risk_flags)>8 then raise exception 'invalid AI output' using errcode='22023'; end if;
  update public.lead_ai_insights set status='succeeded',summary=btrim(output_summary),
    buying_intent=output_buying_intent,recommended_temperature=output_temperature,
    recommended_score=output_score,score_factors=output_score_factors,
    missing_information=output_missing_information,risk_flags=output_risk_flags,
    recommended_next_action=btrim(output_next_action),suggested_reply=btrim(output_suggested_reply),
    confidence=output_confidence,tokens_input=greatest(coalesce(usage_input_tokens,0),0),
    tokens_output=greatest(coalesce(usage_output_tokens,0),0),latency_ms=greatest(coalesce(request_latency_ms,0),0),
    completed_at=clock_timestamp() where id=insight.id and status='generating';
  get diagnostics changed=row_count;
  if changed<>1 then return false; end if;
  insert into public.ai_usage_events(company_id,member_id,lead_id,insight_id,provider,model,status,
    input_tokens,output_tokens,latency_ms)
  values(insight.company_id,actor.id,insight.lead_id,insight.id,insight.provider,insight.model,'succeeded',
    greatest(coalesce(usage_input_tokens,0),0),greatest(coalesce(usage_output_tokens,0),0),greatest(coalesce(request_latency_ms,0),0));
  insert into public.lead_activities(company_id,lead_id,actor_member_id,activity_type,description,metadata)
  values(insight.company_id,insight.lead_id,actor.id,
    case when insight.generation_kind='regeneration' then 'ai_insight_regenerated'::public.lead_activity_type
      else 'ai_insight_generated'::public.lead_activity_type end,
    case when insight.generation_kind='regeneration' then 'AI insight regenerated' else 'AI insight generated' end,
    jsonb_build_object('insight_id',insight.id,'prompt_version',insight.prompt_version,'provider',insight.provider));
  return true;
end;
$$;

create or replace function public.fail_ai_generation(
  target_company_id uuid,target_insight_id uuid,safe_error_code text,request_latency_ms integer default 0
)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor public.company_members; insight public.lead_ai_insights; changed integer;
begin
  actor:=private.require_lead_member(target_company_id);
  if safe_error_code not in ('configuration_missing','provider_timeout','provider_rate_limited',
    'provider_error','malformed_output','model_refusal','network_error','generation_expired') then
    raise exception 'invalid safe AI error code' using errcode='22023'; end if;
  select * into insight from public.lead_ai_insights where company_id=target_company_id
    and id=target_insight_id for update;
  if insight.id is null or insight.generated_by_member_id<>actor.id or insight.status<>'generating' then return false; end if;
  update public.lead_ai_insights set status='failed',error_code=safe_error_code,
    latency_ms=greatest(coalesce(request_latency_ms,0),0),completed_at=clock_timestamp()
  where id=insight.id and status='generating'; get diagnostics changed=row_count;
  if changed=1 then insert into public.ai_usage_events(company_id,member_id,lead_id,insight_id,
    provider,model,status,latency_ms,error_code)
    values(insight.company_id,actor.id,insight.lead_id,insight.id,insight.provider,insight.model,
      'failed',greatest(coalesce(request_latency_ms,0),0),safe_error_code); end if;
  return changed=1;
end;
$$;

create or replace function public.apply_ai_recommendation(
  target_company_id uuid,target_lead_id uuid,target_insight_id uuid,recommendation_kind text
)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor public.company_members; insight public.lead_ai_insights; lead_row public.leads;
begin
  actor:=private.require_lead_member(target_company_id);
  if not private.can_access_lead(target_company_id,target_lead_id) then
    raise exception 'lead access is not permitted' using errcode='42501'; end if;
  select * into insight from public.lead_ai_insights where company_id=target_company_id
    and id=target_insight_id and lead_id=target_lead_id and status='succeeded';
  if insight.id is null then raise exception 'AI insight is unavailable' using errcode='P0002'; end if;
  select * into lead_row from public.leads where company_id=target_company_id and id=target_lead_id for update;
  if recommendation_kind='score' then
    update public.leads set score=insight.recommended_score,updated_by_member_id=actor.id,
      updated_at=clock_timestamp() where id=lead_row.id;
    insert into public.lead_activities(company_id,lead_id,actor_member_id,activity_type,description,metadata)
    values(target_company_id,target_lead_id,actor.id,'ai_score_applied','AI score recommendation applied',
      jsonb_build_object('insight_id',insight.id,'old_score',lead_row.score,'new_score',insight.recommended_score));
  elsif recommendation_kind='temperature' then
    update public.leads set temperature=insight.recommended_temperature,updated_by_member_id=actor.id,
      updated_at=clock_timestamp() where id=lead_row.id;
    insert into public.lead_activities(company_id,lead_id,actor_member_id,activity_type,description,metadata)
    values(target_company_id,target_lead_id,actor.id,'ai_temperature_applied','AI temperature recommendation applied',
      jsonb_build_object('insight_id',insight.id,'old_temperature',lead_row.temperature,'new_temperature',insight.recommended_temperature));
  else raise exception 'invalid AI recommendation kind' using errcode='22023'; end if;
  return true;
end;
$$;

create or replace function public.get_ai_usage_summary(target_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor public.company_members;
begin
  actor:=private.require_lead_member(target_company_id);
  if actor.role not in ('owner','admin') then raise exception 'AI usage summary is not permitted' using errcode='42501'; end if;
  return (select jsonb_build_object(
    'today',count(*) filter(where created_at>=date_trunc('day',clock_timestamp())),
    'month',count(*) filter(where created_at>=date_trunc('month',clock_timestamp())),
    'succeeded',count(*) filter(where status='succeeded'),
    'failed',count(*) filter(where status='failed'),
    'input_tokens',coalesce(sum(input_tokens),0),'output_tokens',coalesce(sum(output_tokens),0)
  ) from public.ai_usage_events where company_id=target_company_id);
end;
$$;

revoke all on function public.update_company_ai_settings(uuid,timestamptz,jsonb) from public,anon;
revoke all on function public.begin_ai_generation(uuid,uuid,text,text,text,text,boolean) from public,anon;
revoke all on function public.complete_ai_generation(uuid,uuid,text,text,public.lead_temperature,integer,text[],text[],text[],text,text,numeric,integer,integer,integer) from public,anon;
revoke all on function public.fail_ai_generation(uuid,uuid,text,integer) from public,anon;
revoke all on function public.apply_ai_recommendation(uuid,uuid,uuid,text) from public,anon;
revoke all on function public.get_ai_usage_summary(uuid) from public,anon;
grant execute on function public.update_company_ai_settings(uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.begin_ai_generation(uuid,uuid,text,text,text,text,boolean) to authenticated;
grant execute on function public.complete_ai_generation(uuid,uuid,text,text,public.lead_temperature,integer,text[],text[],text[],text,text,numeric,integer,integer,integer) to authenticated;
grant execute on function public.fail_ai_generation(uuid,uuid,text,integer) to authenticated;
grant execute on function public.apply_ai_recommendation(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.get_ai_usage_summary(uuid) to authenticated;

revoke all on function private.valid_ai_settings(jsonb) from public,anon,authenticated;
