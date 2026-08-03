alter type public.notification_type add value if not exists 'lead_reassigned';
alter type public.notification_type add value if not exists 'lead_converted';
alter type public.notification_type add value if not exists 'follow_up_assigned';
alter type public.notification_type add value if not exists 'follow_up_rescheduled';
alter type public.notification_type add value if not exists 'follow_up_overdue';
alter type public.notification_type add value if not exists 'follow_up_completed';
alter type public.notification_type add value if not exists 'appointment_created';
alter type public.notification_type add value if not exists 'appointment_rescheduled';
alter type public.notification_type add value if not exists 'appointment_confirmed';
alter type public.notification_type add value if not exists 'appointment_cancelled';
alter type public.notification_type add value if not exists 'membership_event';

alter table public.company_settings
  add column disabled_services text[] not null default '{}',
  add column disabled_lead_sources text[] not null default '{}';

alter table public.notifications
  add column event_key text,
  add column archived_at timestamptz,
  add constraint notifications_event_key_length check (
    event_key is null or length(event_key) between 4 and 240
  );

create unique index notifications_company_recipient_event_key
  on public.notifications (company_id, recipient_member_id, event_key)
  where event_key is not null;
create index notifications_recipient_recent_idx
  on public.notifications (company_id, recipient_member_id, created_at desc)
  where archived_at is null;

create table public.user_notification_preferences (
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, member_id),
  constraint user_notification_preferences_member_fkey
    foreign key (company_id, member_id)
    references public.company_members (company_id, id) on delete cascade
);

create table public.company_settings_audit (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  actor_member_id uuid not null,
  action text not null check (action in (
    'company_profile_updated', 'regional_settings_updated',
    'service_catalog_updated', 'lead_sources_updated',
    'scoring_rules_updated', 'notification_defaults_updated'
  )),
  changed_fields jsonb not null default '[]'::jsonb
    check (jsonb_typeof(changed_fields) = 'array'),
  occurred_at timestamptz not null default now(),
  constraint company_settings_audit_actor_fkey
    foreign key (company_id, actor_member_id)
    references public.company_members (company_id, id) on delete restrict
);

create index company_settings_audit_company_occurred_idx
  on public.company_settings_audit (company_id, occurred_at desc);

alter table public.user_notification_preferences enable row level security;
alter table public.company_settings_audit enable row level security;

revoke all on public.user_notification_preferences,
  public.company_settings_audit from public, anon, authenticated;
grant select on public.user_notification_preferences to authenticated;
grant select on public.company_settings_audit to authenticated;
grant select, insert, update, delete on public.user_notification_preferences,
  public.company_settings_audit to service_role;

create policy user_notification_preferences_select_self
on public.user_notification_preferences for select to authenticated
using (member_id = private.current_company_member_id(company_id));

create policy company_settings_audit_select_owner_admin
on public.company_settings_audit for select to authenticated
using (private.has_company_role(
  company_id, array['owner','admin']::public.member_role[]
));

drop policy if exists company_settings_insert_owner_admin on public.company_settings;
drop policy if exists company_settings_update_owner_admin on public.company_settings;
drop policy if exists companies_update_owner_admin on public.companies;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;

revoke insert, update, delete on public.company_settings, public.companies,
  public.profiles, public.notifications from authenticated;

create or replace function private.valid_timezone(value text)
returns boolean language sql immutable set search_path = '' as $$
  select value = any(array[
    'Asia/Karachi','UTC','Asia/Dubai','Asia/Riyadh','Europe/London',
    'America/New_York','America/Los_Angeles'
  ]);
$$;

create or replace function private.valid_catalog(values_list text[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(array_length(values_list, 1), 0) between 1 and 50
    and not exists (
      select 1 from unnest(values_list) item
      where length(btrim(item)) not between 2 and 100
        or item ~ '[<>]'
    )
    and (select count(*) from unnest(values_list)) =
      (select count(distinct lower(btrim(item))) from unnest(values_list) item);
$$;

create or replace function private.valid_scoring_rules(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(value) = 'object'
    and value->>'version' = '1'
    and jsonb_typeof(value->'weights') = 'object'
    and (value->'weights') ?& array['budget','timeline','source','completeness','service']
    and not exists (
      select 1 from jsonb_each_text(value->'weights') item
      where item.value !~ '^\d{1,3}$'
        or item.value::integer not between 0 and 100
    )
    and (
      select coalesce(sum(item.value::integer), 0)
      from jsonb_each_text(value->'weights') item
    ) = 100
    and jsonb_typeof(value->'budget_thresholds') = 'object'
    and (value->'budget_thresholds'->>'warm_pkr') ~ '^\d+$'
    and (value->'budget_thresholds'->>'hot_pkr') ~ '^\d+$'
    and (value->'budget_thresholds'->>'hot_pkr')::bigint >
      (value->'budget_thresholds'->>'warm_pkr')::bigint
    and jsonb_typeof(value->'high_intent_services') = 'array';
$$;

create or replace function private.valid_notification_preferences(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(value) = 'object'
    and not exists (
      select 1 from jsonb_each(value) item
      where item.key not in (
        'new_lead_assigned','lead_reassigned','follow_up_due',
        'follow_up_overdue','appointment_created','appointment_rescheduled',
        'appointment_cancelled','lead_converted','membership_event'
      ) or jsonb_typeof(item.value) <> 'boolean'
    );
$$;

create or replace function public.update_company_settings(
  target_company_id uuid,
  expected_company_updated_at timestamptz,
  expected_settings_updated_at timestamptz,
  company_name text,
  company_business_email text,
  company_phone text,
  company_city text,
  company_address text,
  settings_timezone text,
  settings_currency text,
  settings_services text[],
  settings_disabled_services text[],
  settings_lead_sources text[],
  settings_disabled_lead_sources text[],
  settings_scoring_rules jsonb,
  settings_notification_defaults jsonb
)
returns table(company_updated_at timestamptz, settings_updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  actor public.company_members;
  existing_company public.companies;
  existing_settings public.company_settings;
  changed text[] := '{}';
begin
  actor := private.require_lead_member(target_company_id);
  if actor.role not in ('owner','admin') then
    raise exception 'company settings update is not permitted' using errcode='42501';
  end if;
  select * into existing_company from public.companies
    where id=target_company_id and deleted_at is null for update;
  select * into existing_settings from public.company_settings
    where company_id=target_company_id for update;
  if existing_company.id is null or existing_settings.company_id is null then
    raise exception 'company settings were not found' using errcode='P0002';
  end if;
  if existing_company.updated_at <> expected_company_updated_at
    or existing_settings.updated_at <> expected_settings_updated_at then
    raise exception 'company settings were changed by another user' using errcode='40001';
  end if;
  if length(btrim(company_name)) not between 2 and 160
    or (company_business_email <> '' and company_business_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    or length(company_phone) > 40 or length(company_city) > 120
    or length(company_address) > 500 or company_name ~ '[<>]'
    or company_city ~ '[<>]' or company_address ~ '[<>]' then
    raise exception 'invalid company profile values' using errcode='22023';
  end if;
  if not private.valid_timezone(settings_timezone)
    or settings_currency <> 'PKR'
    or not private.valid_catalog(settings_services)
    or not private.valid_catalog(settings_lead_sources)
    or not coalesce(settings_disabled_services <@ settings_services, false)
    or not coalesce(settings_disabled_lead_sources <@ settings_lead_sources, false)
    or not private.valid_scoring_rules(settings_scoring_rules)
    or not private.valid_notification_preferences(settings_notification_defaults) then
    raise exception 'invalid company settings values' using errcode='22023';
  end if;
  if exists (
    select 1 from public.leads lead
    where lead.company_id=target_company_id and lead.deleted_at is null
      and not (lead.service_required = any(settings_services))
  ) or exists (
    select 1 from public.leads lead
    where lead.company_id=target_company_id and lead.deleted_at is null
      and not (lead.source = any(settings_lead_sources))
  ) then
    raise exception 'catalog values used by existing leads cannot be removed' using errcode='23503';
  end if;

  if (existing_company.name,existing_company.business_email,existing_company.phone,
      existing_company.city,existing_company.address) is distinct from
     (btrim(company_name),nullif(lower(btrim(company_business_email)),''),
      nullif(btrim(company_phone),''),nullif(btrim(company_city),''),
      nullif(btrim(company_address),'')) then
    changed := array_append(changed,'company_profile');
  end if;
  if (existing_settings.timezone,existing_settings.currency) is distinct from
     (settings_timezone,settings_currency) then changed:=array_append(changed,'regional'); end if;
  if (existing_settings.services,existing_settings.disabled_services) is distinct from
     (settings_services,settings_disabled_services) then changed:=array_append(changed,'services'); end if;
  if (existing_settings.lead_sources,existing_settings.disabled_lead_sources) is distinct from
     (settings_lead_sources,settings_disabled_lead_sources) then changed:=array_append(changed,'sources'); end if;
  if existing_settings.lead_scoring_rules is distinct from settings_scoring_rules then changed:=array_append(changed,'scoring'); end if;
  if existing_settings.notification_defaults is distinct from settings_notification_defaults then changed:=array_append(changed,'notifications'); end if;

  update public.companies set
    name=btrim(company_name), business_email=nullif(lower(btrim(company_business_email)),''),
    phone=nullif(btrim(company_phone),''), city=nullif(btrim(company_city),''),
    address=nullif(btrim(company_address),''), updated_at=clock_timestamp()
  where id=target_company_id returning updated_at into company_updated_at;
  update public.company_settings set
    timezone=settings_timezone, currency=settings_currency,
    services=settings_services, disabled_services=settings_disabled_services,
    lead_sources=settings_lead_sources,
    disabled_lead_sources=settings_disabled_lead_sources,
    lead_scoring_rules=settings_scoring_rules,
    notification_defaults=settings_notification_defaults,
    updated_by_member_id=actor.id, updated_at=clock_timestamp()
  where company_id=target_company_id returning updated_at into settings_updated_at;

  if 'company_profile'=any(changed) then insert into public.company_settings_audit(company_id,actor_member_id,action,changed_fields) values(target_company_id,actor.id,'company_profile_updated','["name","business_email","phone","city","address"]'); end if;
  if 'regional'=any(changed) then insert into public.company_settings_audit(company_id,actor_member_id,action,changed_fields) values(target_company_id,actor.id,'regional_settings_updated','["timezone","currency"]'); end if;
  if 'services'=any(changed) then insert into public.company_settings_audit(company_id,actor_member_id,action,changed_fields) values(target_company_id,actor.id,'service_catalog_updated','["services","disabled_services"]'); end if;
  if 'sources'=any(changed) then insert into public.company_settings_audit(company_id,actor_member_id,action,changed_fields) values(target_company_id,actor.id,'lead_sources_updated','["lead_sources","disabled_lead_sources"]'); end if;
  if 'scoring'=any(changed) then insert into public.company_settings_audit(company_id,actor_member_id,action,changed_fields) values(target_company_id,actor.id,'scoring_rules_updated','["lead_scoring_rules"]'); end if;
  if 'notifications'=any(changed) then insert into public.company_settings_audit(company_id,actor_member_id,action,changed_fields) values(target_company_id,actor.id,'notification_defaults_updated','["notification_defaults"]'); end if;
  return next;
end;
$$;

create or replace function public.update_my_profile(
  expected_updated_at timestamptz,
  profile_full_name text,
  profile_phone text,
  profile_timezone text
)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare existing public.profiles; next_updated timestamptz;
begin
  select * into existing from public.profiles where id=(select auth.uid()) for update;
  if existing.id is null then raise exception 'profile was not found' using errcode='P0002'; end if;
  if existing.updated_at <> expected_updated_at then raise exception 'profile was changed by another session' using errcode='40001'; end if;
  if length(btrim(profile_full_name)) not between 2 and 120
    or profile_full_name ~ '[<>]' or length(profile_phone)>40
    or (nullif(btrim(profile_phone),'') is not null
      and btrim(profile_phone) !~ '^(\+92|0)[ -]?3[0-9]{2}[ -]?[0-9]{7}$')
    or not private.valid_timezone(profile_timezone) then
    raise exception 'invalid profile values' using errcode='22023';
  end if;
  update public.profiles set full_name=btrim(profile_full_name),
    phone=nullif(btrim(profile_phone),''), timezone=profile_timezone,
    updated_at=clock_timestamp() where id=existing.id returning updated_at into next_updated;
  return next_updated;
end;
$$;

create or replace function private.notification_enabled(
  target_company_id uuid, target_member_id uuid, category text
)
returns boolean language sql stable security definer set search_path='' as $$
  with preference_key as (
    select case category
      when 'lead_assigned' then 'new_lead_assigned'
      when 'follow_up_assigned' then 'follow_up_due'
      when 'follow_up_rescheduled' then 'follow_up_due'
      when 'follow_up_completed' then 'follow_up_due'
      when 'appointment_created' then 'appointment_confirmed'
      when 'appointment_rescheduled' then 'appointment_confirmed'
      else category
    end as value
  )
  select coalesce(
    (select (preference.preferences->>preference_key.value)::boolean
      from public.user_notification_preferences preference
      cross join preference_key
      where preference.company_id=target_company_id and preference.member_id=target_member_id),
    (select (settings.notification_defaults->>preference_key.value)::boolean
      from public.company_settings settings
      cross join preference_key
      where settings.company_id=target_company_id),
    true
  );
$$;

create or replace function private.enqueue_notification(
  target_company_id uuid, target_recipient_member_id uuid,
  target_type public.notification_type, target_title text, target_body text,
  target_event_key text, target_lead_id uuid default null,
  target_follow_up_id uuid default null, target_appointment_id uuid default null,
  target_payload jsonb default '{}'::jsonb
)
returns boolean language plpgsql security definer set search_path='' as $$
declare inserted_count integer;
begin
  if not exists(select 1 from public.company_members member
    where member.company_id=target_company_id and member.id=target_recipient_member_id
      and member.status='active') then return false; end if;
  if target_type::text <> 'membership_event'
    and not private.notification_enabled(target_company_id,target_recipient_member_id,target_type::text) then return false; end if;
  insert into public.notifications(company_id,recipient_member_id,notification_type,
    title,body,event_key,lead_id,follow_up_id,appointment_id,payload)
  values(target_company_id,target_recipient_member_id,target_type,btrim(target_title),
    btrim(target_body),target_event_key,target_lead_id,target_follow_up_id,
    target_appointment_id,coalesce(target_payload,'{}'::jsonb))
  on conflict (company_id,recipient_member_id,event_key) where event_key is not null do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count=1;
end;
$$;

create or replace function private.create_business_notifications()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='leads' then
    if tg_op='INSERT' and new.assigned_member_id is not null then
      perform private.enqueue_notification(new.company_id,new.assigned_member_id,'lead_assigned','New lead assigned',new.full_name||' was assigned to you','lead:'||new.id||':assigned:'||new.assigned_member_id,new.id);
    elsif tg_op='UPDATE' then
      if new.assigned_member_id is distinct from old.assigned_member_id and new.assigned_member_id is not null then
        perform private.enqueue_notification(new.company_id,new.assigned_member_id,'lead_reassigned','Lead reassigned',new.full_name||' is now assigned to you','lead:'||new.id||':reassigned:'||new.updated_at,new.id);
      end if;
      if new.stage='converted' and old.stage<>'converted' and new.assigned_member_id is not null then
        perform private.enqueue_notification(new.company_id,new.assigned_member_id,'lead_converted','Lead converted',new.full_name||' was marked converted','lead:'||new.id||':converted',new.id);
      end if;
    end if;
  elsif tg_table_name='follow_ups' then
    if tg_op='INSERT' then
      perform private.enqueue_notification(new.company_id,new.assigned_member_id,'follow_up_assigned','Follow-up assigned','A follow-up was assigned to you','followup:'||new.id||':assigned',new.lead_id,new.id);
    elsif tg_op='UPDATE' then
      if new.assigned_member_id is distinct from old.assigned_member_id then
        perform private.enqueue_notification(new.company_id,new.assigned_member_id,'follow_up_assigned','Follow-up assigned','A follow-up was assigned to you','followup:'||new.id||':assigned:'||new.assigned_member_id,new.lead_id,new.id);
      end if;
      if new.due_at is distinct from old.due_at then
        perform private.enqueue_notification(new.company_id,new.assigned_member_id,'follow_up_rescheduled','Follow-up rescheduled','Your follow-up schedule changed','followup:'||new.id||':rescheduled:'||new.updated_at,new.lead_id,new.id);
      end if;
      if new.status='completed' and old.status='pending' then
        perform private.enqueue_notification(new.company_id,new.assigned_member_id,'follow_up_completed','Follow-up completed','A follow-up was marked complete','followup:'||new.id||':completed',new.lead_id,new.id);
      end if;
    end if;
  elsif tg_table_name='appointments' then
    if tg_op='INSERT' then
      perform private.enqueue_notification(new.company_id,new.assigned_member_id,'appointment_created','Appointment created',new.customer_name||' appointment was created','appointment:'||new.id||':created',new.lead_id,null,new.id);
    elsif tg_op='UPDATE' then
      if new.assigned_member_id is distinct from old.assigned_member_id then
        perform private.enqueue_notification(new.company_id,new.assigned_member_id,'appointment_created','Appointment assigned',new.customer_name||' appointment was assigned to you','appointment:'||new.id||':assigned:'||new.assigned_member_id,new.lead_id,null,new.id);
      end if;
      if new.starts_at is distinct from old.starts_at then
        perform private.enqueue_notification(new.company_id,new.assigned_member_id,'appointment_rescheduled','Appointment rescheduled',new.customer_name||' appointment schedule changed','appointment:'||new.id||':rescheduled:'||new.updated_at,new.lead_id,null,new.id);
      end if;
      if new.status='confirmed' and old.status='pending' then
        perform private.enqueue_notification(new.company_id,new.assigned_member_id,'appointment_confirmed','Appointment confirmed',new.customer_name||' appointment was confirmed','appointment:'||new.id||':confirmed',new.lead_id,null,new.id);
      elsif new.status='cancelled' and old.status not in ('cancelled','completed') then
        perform private.enqueue_notification(new.company_id,new.assigned_member_id,'appointment_cancelled','Appointment cancelled',new.customer_name||' appointment was cancelled','appointment:'||new.id||':cancelled',new.lead_id,null,new.id);
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger leads_notifications after insert or update on public.leads
for each row execute function private.create_business_notifications();
create trigger follow_ups_notifications after insert or update on public.follow_ups
for each row execute function private.create_business_notifications();
create trigger appointments_notifications after insert or update on public.appointments
for each row execute function private.create_business_notifications();

create or replace function private.validate_lead_catalog_values()
returns trigger language plpgsql security invoker set search_path='' as $$
declare settings public.company_settings;
begin
  select * into settings from public.company_settings item
    where item.company_id=new.company_id;
  if settings.company_id is null then
    raise exception 'company settings were not found' using errcode='23503';
  end if;
  if (tg_op='INSERT' or new.service_required is distinct from old.service_required)
    and (not (new.service_required=any(settings.services))
      or new.service_required=any(settings.disabled_services)) then
    raise exception 'service is not enabled for this company' using errcode='23503';
  end if;
  if (tg_op='INSERT' or new.source is distinct from old.source)
    and (not (new.source=any(settings.lead_sources))
      or new.source=any(settings.disabled_lead_sources)) then
    raise exception 'lead source is not enabled for this company' using errcode='23503';
  end if;
  return new;
end;
$$;
create trigger leads_validate_catalog before insert or update of service_required,source
on public.leads for each row execute function private.validate_lead_catalog_values();

create or replace function private.create_membership_notification()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='active' and (tg_op='INSERT' or old.status is distinct from new.status or old.role is distinct from new.role) then
    perform private.enqueue_notification(new.company_id,new.id,'membership_event','Membership updated','Your company membership or role was updated','membership:'||new.id||':'||new.updated_at,null,null,null,jsonb_build_object('role',new.role,'status',new.status));
  end if;
  return new;
end;
$$;
create trigger company_members_notifications after insert or update on public.company_members
for each row execute function private.create_membership_notification();

create or replace function public.update_my_notification_preferences(
  target_company_id uuid, requested_preferences jsonb
)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare actor public.company_members; next_updated timestamptz;
begin
  actor:=private.require_lead_member(target_company_id);
  if not private.valid_notification_preferences(requested_preferences) then
    raise exception 'invalid notification preferences' using errcode='22023'; end if;
  insert into public.user_notification_preferences(company_id,member_id,preferences)
  values(target_company_id,actor.id,requested_preferences)
  on conflict(company_id,member_id) do update set preferences=excluded.preferences,
    updated_at=clock_timestamp()
  returning updated_at into next_updated;
  return next_updated;
end;
$$;

create or replace function public.mark_notification_read(
  target_company_id uuid, target_notification_id uuid
)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor public.company_members; changed integer;
begin
  actor:=private.require_lead_member(target_company_id);
  update public.notifications set read_at=coalesce(read_at,clock_timestamp()),updated_at=clock_timestamp()
  where company_id=target_company_id and id=target_notification_id
    and recipient_member_id=actor.id and archived_at is null;
  get diagnostics changed=row_count; return changed=1;
end;
$$;

create or replace function public.mark_all_notifications_read(target_company_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare actor public.company_members; changed integer;
begin
  actor:=private.require_lead_member(target_company_id);
  update public.notifications set read_at=clock_timestamp(),updated_at=clock_timestamp()
  where company_id=target_company_id and recipient_member_id=actor.id
    and read_at is null and archived_at is null;
  get diagnostics changed=row_count; return changed;
end;
$$;

create or replace function public.process_follow_up_notifications(reference_at timestamptz default now())
returns table(due_created integer,overdue_created integer)
language plpgsql security definer set search_path='' as $$
declare item record; company_date date; inserted boolean;
begin
  due_created:=0; overdue_created:=0;
  for item in select followup.*,settings.timezone from public.follow_ups followup
    join public.company_settings settings on settings.company_id=followup.company_id
    join public.company_members member on member.company_id=followup.company_id
      and member.id=followup.assigned_member_id and member.status='active'
    where followup.status='pending' and followup.deleted_at is null
  loop
    company_date := (reference_at at time zone item.timezone)::date;
    if (item.due_at at time zone item.timezone)::date = company_date then
      inserted:=private.enqueue_notification(item.company_id,item.assigned_member_id,'follow_up_due','Follow-up due today','A follow-up is due today','followup:'||item.id||':due:'||company_date,item.lead_id,item.id);
      if inserted then due_created:=due_created+1; end if;
    elsif (item.due_at at time zone item.timezone)::date < company_date then
      inserted:=private.enqueue_notification(item.company_id,item.assigned_member_id,'follow_up_overdue','Follow-up overdue','A follow-up is overdue','followup:'||item.id||':overdue:'||(item.due_at at time zone item.timezone)::date,item.lead_id,item.id);
      if inserted then overdue_created:=overdue_created+1; end if;
    end if;
  end loop;
  return next;
end;
$$;

revoke all on function public.update_company_settings(uuid,timestamptz,timestamptz,text,text,text,text,text,text,text,text[],text[],text[],text[],jsonb,jsonb) from public,anon;
revoke all on function public.update_my_profile(timestamptz,text,text,text) from public,anon;
revoke all on function public.update_my_notification_preferences(uuid,jsonb) from public,anon;
revoke all on function public.mark_notification_read(uuid,uuid) from public,anon;
revoke all on function public.mark_all_notifications_read(uuid) from public,anon;
revoke all on function public.process_follow_up_notifications(timestamptz) from public,anon,authenticated;
grant execute on function public.update_company_settings(uuid,timestamptz,timestamptz,text,text,text,text,text,text,text,text[],text[],text[],text[],jsonb,jsonb) to authenticated;
grant execute on function public.update_my_profile(timestamptz,text,text,text) to authenticated;
grant execute on function public.update_my_notification_preferences(uuid,jsonb) to authenticated;
grant execute on function public.mark_notification_read(uuid,uuid) to authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;
grant execute on function public.process_follow_up_notifications(timestamptz) to service_role;

revoke all on function private.enqueue_notification(uuid,uuid,public.notification_type,text,text,text,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function private.notification_enabled(uuid,uuid,text) from public,anon,authenticated;
