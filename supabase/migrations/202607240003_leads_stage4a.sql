create table public.lead_number_counters (
  company_id uuid primary key references public.companies (id) on delete cascade,
  next_number bigint not null check (next_number >= 1),
  updated_at timestamptz not null default now()
);

insert into public.lead_number_counters (company_id, next_number)
select
  company.id,
  greatest(
    coalesce(max((regexp_match(lead.lead_number, '([0-9]+)$'))[1]::bigint), 1000) + 1,
    1001
  )
from public.companies company
left join public.leads lead on lead.company_id = company.id
group by company.id;

create table public.lead_create_requests (
  id uuid primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index leads_company_score_idx
  on public.leads (company_id, score desc) where deleted_at is null;
create index leads_company_budget_idx
  on public.leads (company_id, budget_pkr desc) where deleted_at is null;
create index leads_company_service_idx
  on public.leads (company_id, service_required) where deleted_at is null;
create index leads_company_lower_name_idx
  on public.leads (company_id, lower(full_name)) where deleted_at is null;

alter table public.lead_number_counters enable row level security;
alter table public.lead_create_requests enable row level security;
revoke all on public.lead_number_counters, public.lead_create_requests
  from public, anon, authenticated;
grant select, insert, update, delete
  on public.lead_number_counters, public.lead_create_requests
  to service_role;
grant select, insert, update, delete
  on public.leads, public.lead_activities
  to service_role;

revoke insert, update, delete on public.leads from authenticated;
revoke insert, update, delete on public.lead_activities from authenticated;

drop policy if exists leads_select_by_role_or_assignment on public.leads;
create policy leads_select_by_role_or_assignment
on public.leads
for select
to authenticated
using (
  deleted_at is null
  and (
    private.has_company_role(
      company_id,
      array['owner', 'admin', 'sales_manager']::public.member_role[]
    )
    or assigned_member_id = private.current_company_member_id(company_id)
  )
);

create or replace function private.can_access_lead(
  target_company_id uuid,
  target_lead_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leads lead
    where lead.company_id = target_company_id
      and lead.id = target_lead_id
      and lead.deleted_at is null
      and (
        private.has_company_role(
          target_company_id,
          array['owner', 'admin', 'sales_manager']::public.member_role[]
        )
        or lead.assigned_member_id =
          private.current_company_member_id(target_company_id)
      )
  );
$$;

create or replace function private.require_lead_member(
  target_company_id uuid
)
returns public.company_members
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
begin
  select member.*
  into actor
  from public.company_members member
  join public.companies company on company.id = member.company_id
  where member.company_id = target_company_id
    and member.user_id = (select auth.uid())
    and member.status = 'active'
    and company.status = 'active'
    and company.deleted_at is null;

  if actor.id is null then
    raise exception 'active company membership is required'
      using errcode = '42501';
  end if;
  return actor;
end;
$$;

create or replace function private.require_active_assignee(
  target_company_id uuid,
  target_member_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.company_members member
    where member.company_id = target_company_id
      and member.id = target_member_id
      and member.status = 'active'
  ) then
    raise exception 'assigned member is not active in this company'
      using errcode = '23503';
  end if;
end;
$$;

revoke all on function private.require_lead_member(uuid)
  from public, anon, authenticated;
revoke all on function private.require_active_assignee(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.create_lead(
  target_company_id uuid,
  request_id uuid,
  lead_full_name text,
  lead_phone text,
  lead_email text,
  lead_service text,
  lead_location text,
  lead_property_size text,
  lead_budget_pkr bigint,
  lead_expected_timeline text,
  lead_source text,
  lead_assigned_member_id uuid,
  lead_score integer,
  lead_temperature public.lead_temperature,
  lead_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  assignment_id uuid;
  sequence_number bigint;
  created_lead_id uuid;
  existing_lead_id uuid;
begin
  actor := private.require_lead_member(target_company_id);
  perform pg_advisory_xact_lock(hashtextextended(request_id::text, 0));

  select item.lead_id
  into existing_lead_id
  from public.lead_create_requests item
  where item.id = request_id
    and item.company_id = target_company_id
    and item.user_id = (select auth.uid());
  if existing_lead_id is not null then
    return existing_lead_id;
  end if;

  assignment_id := case
    when actor.role = 'sales_representative' then actor.id
    else lead_assigned_member_id
  end;
  if assignment_id is null then
    raise exception 'an active assignee is required' using errcode = '22023';
  end if;
  if actor.role = 'sales_representative'
    and lead_assigned_member_id is distinct from actor.id
  then
    raise exception 'representatives can only create self-assigned leads'
      using errcode = '42501';
  end if;
  perform private.require_active_assignee(target_company_id, assignment_id);

  if btrim(lead_full_name) = '' or btrim(lead_phone) = ''
    or btrim(lead_service) = '' or btrim(lead_location) = ''
    or btrim(lead_source) = '' or lead_budget_pkr < 0
    or lead_score not between 0 and 100
  then
    raise exception 'invalid lead values' using errcode = '22023';
  end if;

  insert into public.lead_number_counters (company_id, next_number)
  values (target_company_id, 1002)
  on conflict (company_id) do update
  set next_number = public.lead_number_counters.next_number + 1,
      updated_at = now()
  returning next_number - 1 into sequence_number;

  insert into public.leads (
    company_id, lead_number, full_name, phone, email, service_required,
    location, property_size, budget_pkr, expected_timeline, source,
    assigned_member_id, score, temperature, stage, notes,
    created_by_member_id, updated_by_member_id
  )
  values (
    target_company_id,
    'LP-' || lpad(sequence_number::text, 4, '0'),
    btrim(lead_full_name),
    btrim(lead_phone),
    nullif(lower(btrim(lead_email)), ''),
    btrim(lead_service),
    btrim(lead_location),
    nullif(btrim(lead_property_size), ''),
    lead_budget_pkr,
    nullif(btrim(lead_expected_timeline), ''),
    btrim(lead_source),
    assignment_id,
    lead_score,
    lead_temperature,
    'new_inquiry',
    nullif(btrim(lead_notes), ''),
    actor.id,
    actor.id
  )
  returning id into created_lead_id;

  insert into public.lead_activities (
    company_id, lead_id, actor_member_id, activity_type,
    description, metadata
  )
  values (
    target_company_id, created_lead_id, actor.id, 'created',
    'Lead created',
    jsonb_build_object('assigned_member_id', assignment_id)
  );

  insert into public.lead_create_requests (
    id, company_id, user_id, lead_id
  )
  values (
    request_id, target_company_id, (select auth.uid()), created_lead_id
  );
  return created_lead_id;
end;
$$;

create or replace function public.update_lead(
  target_company_id uuid,
  target_lead_id uuid,
  expected_updated_at timestamptz,
  lead_full_name text,
  lead_phone text,
  lead_email text,
  lead_service text,
  lead_location text,
  lead_property_size text,
  lead_budget_pkr bigint,
  lead_expected_timeline text,
  lead_source text,
  lead_assigned_member_id uuid,
  lead_score integer,
  lead_temperature public.lead_temperature,
  lead_stage public.lead_stage,
  lead_notes text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  existing public.leads;
  next_updated_at timestamptz;
  changed_fields text[] := '{}'::text[];
begin
  actor := private.require_lead_member(target_company_id);
  select lead.*
  into existing
  from public.leads lead
  where lead.company_id = target_company_id
    and lead.id = target_lead_id
    and lead.deleted_at is null
  for update;

  if existing.id is null then
    raise exception 'lead was not found' using errcode = 'P0002';
  end if;
  if actor.role = 'sales_representative'
    and existing.assigned_member_id <> actor.id
  then
    raise exception 'lead update is not permitted' using errcode = '42501';
  end if;
  if actor.role = 'sales_representative'
    and lead_assigned_member_id is distinct from actor.id
  then
    raise exception 'representatives cannot reassign leads'
      using errcode = '42501';
  end if;
  if existing.updated_at <> expected_updated_at then
    raise exception 'lead was changed by another user'
      using errcode = '40001';
  end if;
  if lead_stage = 'converted' and existing.stage <> 'converted' then
    raise exception 'use the conversion workflow' using errcode = '22023';
  end if;
  if existing.stage = 'converted' and lead_stage <> 'converted' then
    raise exception 'converted leads cannot be reopened'
      using errcode = '22023';
  end if;
  perform private.require_active_assignee(
    target_company_id, lead_assigned_member_id
  );

  if existing.full_name is distinct from btrim(lead_full_name) then changed_fields := array_append(changed_fields, 'full_name'); end if;
  if existing.phone is distinct from btrim(lead_phone) then changed_fields := array_append(changed_fields, 'phone'); end if;
  if existing.email is distinct from nullif(lower(btrim(lead_email)), '') then changed_fields := array_append(changed_fields, 'email'); end if;
  if existing.service_required is distinct from btrim(lead_service) then changed_fields := array_append(changed_fields, 'service_required'); end if;
  if existing.location is distinct from btrim(lead_location) then changed_fields := array_append(changed_fields, 'location'); end if;
  if existing.property_size is distinct from nullif(btrim(lead_property_size), '') then changed_fields := array_append(changed_fields, 'property_size'); end if;
  if existing.budget_pkr is distinct from lead_budget_pkr then changed_fields := array_append(changed_fields, 'budget_pkr'); end if;
  if existing.expected_timeline is distinct from nullif(btrim(lead_expected_timeline), '') then changed_fields := array_append(changed_fields, 'expected_timeline'); end if;
  if existing.source is distinct from btrim(lead_source) then changed_fields := array_append(changed_fields, 'source'); end if;
  if existing.notes is distinct from nullif(btrim(lead_notes), '') then changed_fields := array_append(changed_fields, 'notes'); end if;

  update public.leads
  set full_name = btrim(lead_full_name),
      phone = btrim(lead_phone),
      email = nullif(lower(btrim(lead_email)), ''),
      service_required = btrim(lead_service),
      location = btrim(lead_location),
      property_size = nullif(btrim(lead_property_size), ''),
      budget_pkr = lead_budget_pkr,
      expected_timeline = nullif(btrim(lead_expected_timeline), ''),
      source = btrim(lead_source),
      assigned_member_id = lead_assigned_member_id,
      score = lead_score,
      temperature = lead_temperature,
      stage = lead_stage,
      converted_at = case
        when lead_stage = 'converted' then existing.converted_at
        else null
      end,
      notes = nullif(btrim(lead_notes), ''),
      updated_by_member_id = actor.id,
      updated_at = clock_timestamp()
  where id = existing.id
  returning updated_at into next_updated_at;

  if existing.assigned_member_id is distinct from lead_assigned_member_id then
    insert into public.lead_activities (
      company_id, lead_id, actor_member_id, activity_type,
      description, metadata
    )
    values (
      target_company_id, existing.id, actor.id, 'assignment_changed',
      'Lead assignment changed',
      jsonb_build_object(
        'old_member_id', existing.assigned_member_id,
        'new_member_id', lead_assigned_member_id
      )
    );
  end if;
  if existing.stage is distinct from lead_stage then
    insert into public.lead_activities (
      company_id, lead_id, actor_member_id, activity_type,
      description, metadata
    )
    values (
      target_company_id, existing.id, actor.id, 'stage_changed',
      'Lead stage changed',
      jsonb_build_object('old_stage', existing.stage, 'new_stage', lead_stage)
    );
  end if;
  if existing.temperature is distinct from lead_temperature then
    insert into public.lead_activities (
      company_id, lead_id, actor_member_id, activity_type,
      description, metadata
    )
    values (
      target_company_id, existing.id, actor.id, 'updated',
      'Lead temperature changed',
      jsonb_build_object(
        'change', 'temperature',
        'old_temperature', existing.temperature,
        'new_temperature', lead_temperature
      )
    );
  end if;
  if cardinality(changed_fields) > 0 then
    insert into public.lead_activities (
      company_id, lead_id, actor_member_id, activity_type,
      description, metadata
    )
    values (
      target_company_id, existing.id, actor.id, 'updated',
      'Lead details updated',
      jsonb_build_object('fields', to_jsonb(changed_fields))
    );
  end if;
  return next_updated_at;
end;
$$;

create or replace function public.convert_lead(
  target_company_id uuid,
  target_lead_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  existing public.leads;
begin
  actor := private.require_lead_member(target_company_id);
  select lead.*
  into existing
  from public.leads lead
  where lead.company_id = target_company_id
    and lead.id = target_lead_id
    and lead.deleted_at is null
  for update;
  if existing.id is null then
    raise exception 'lead was not found' using errcode = 'P0002';
  end if;
  if actor.role = 'sales_representative'
    and existing.assigned_member_id <> actor.id
  then
    raise exception 'lead conversion is not permitted' using errcode = '42501';
  end if;
  if existing.stage = 'converted' then
    return false;
  end if;

  update public.leads
  set stage = 'converted',
      converted_at = clock_timestamp(),
      updated_by_member_id = actor.id,
      updated_at = clock_timestamp()
  where id = existing.id;
  insert into public.lead_activities (
    company_id, lead_id, actor_member_id, activity_type,
    description, metadata
  )
  values (
    target_company_id, existing.id, actor.id, 'converted',
    'Lead converted',
    jsonb_build_object('old_stage', existing.stage, 'new_stage', 'converted')
  );
  return true;
end;
$$;

create or replace function public.set_lead_archived(
  target_company_id uuid,
  target_lead_id uuid,
  archive_lead boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  existing public.leads;
begin
  actor := private.require_lead_member(target_company_id);
  if actor.role not in ('owner', 'admin', 'sales_manager') then
    raise exception 'lead archive action is not permitted'
      using errcode = '42501';
  end if;
  select lead.*
  into existing
  from public.leads lead
  where lead.company_id = target_company_id
    and lead.id = target_lead_id
  for update;
  if existing.id is null then
    raise exception 'lead was not found' using errcode = 'P0002';
  end if;
  if archive_lead = (existing.deleted_at is not null) then
    return;
  end if;

  update public.leads
  set deleted_at = case when archive_lead then clock_timestamp() else null end,
      updated_by_member_id = actor.id,
      updated_at = clock_timestamp()
  where id = existing.id;
  insert into public.lead_activities (
    company_id, lead_id, actor_member_id, activity_type,
    description, metadata
  )
  values (
    target_company_id, existing.id, actor.id, 'updated',
    case when archive_lead then 'Lead archived' else 'Lead restored' end,
    jsonb_build_object(
      'change', case when archive_lead then 'archived' else 'restored' end
    )
  );
end;
$$;

revoke all on function public.create_lead(
  uuid, uuid, text, text, text, text, text, text, bigint, text, text,
  uuid, integer, public.lead_temperature, text
) from public, anon;
revoke all on function public.update_lead(
  uuid, uuid, timestamptz, text, text, text, text, text, text, bigint,
  text, text, uuid, integer, public.lead_temperature,
  public.lead_stage, text
) from public, anon;
revoke all on function public.convert_lead(uuid, uuid) from public, anon;
revoke all on function public.set_lead_archived(uuid, uuid, boolean)
  from public, anon;

grant execute on function public.create_lead(
  uuid, uuid, text, text, text, text, text, text, bigint, text, text,
  uuid, integer, public.lead_temperature, text
) to authenticated;
grant execute on function public.update_lead(
  uuid, uuid, timestamptz, text, text, text, text, text, text, bigint,
  text, text, uuid, integer, public.lead_temperature,
  public.lead_stage, text
) to authenticated;
grant execute on function public.convert_lead(uuid, uuid) to authenticated;
grant execute on function public.set_lead_archived(uuid, uuid, boolean)
  to authenticated;
