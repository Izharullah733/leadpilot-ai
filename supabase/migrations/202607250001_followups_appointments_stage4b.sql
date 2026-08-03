alter table public.appointments
  add column completed_at timestamptz,
  add column completed_by_member_id uuid,
  add column cancelled_at timestamptz,
  add constraint appointments_completed_by_member_fkey
    foreign key (company_id, completed_by_member_id)
    references public.company_members (company_id, id) on delete restrict,
  add constraint appointments_completion_check check (
    (status = 'completed' and completed_at is not null and completed_by_member_id is not null)
    or
    (status <> 'completed' and completed_at is null and completed_by_member_id is null)
  ),
  add constraint appointments_cancellation_check check (
    (status = 'cancelled' and cancelled_at is not null)
    or
    (status <> 'cancelled' and cancelled_at is null)
  );

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create table public.workflow_create_requests (
  id uuid primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  record_kind text not null check (record_kind in ('follow_up', 'appointment')),
  follow_up_id uuid references public.follow_ups (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (record_kind = 'follow_up' and follow_up_id is not null and appointment_id is null)
    or
    (record_kind = 'appointment' and appointment_id is not null and follow_up_id is null)
  )
);

create index follow_ups_company_priority_due_idx
  on public.follow_ups (company_id, priority, due_at)
  where deleted_at is null and status = 'pending';
create index appointments_company_type_status_start_idx
  on public.appointments (company_id, appointment_type, status, starts_at)
  where deleted_at is null;

alter table public.workflow_create_requests enable row level security;
revoke all on public.workflow_create_requests from public, anon, authenticated;
grant select, insert, update, delete on public.workflow_create_requests to service_role;
grant select, insert, update, delete on public.follow_ups, public.appointments
  to service_role;

revoke insert, update, delete on public.follow_ups, public.appointments
  from authenticated;

drop policy if exists follow_ups_select_by_role_or_assignment on public.follow_ups;
drop policy if exists follow_ups_insert_by_role_or_self_assignment on public.follow_ups;
drop policy if exists follow_ups_update_by_role_or_assignment on public.follow_ups;
drop policy if exists follow_ups_delete_by_role_or_assignment on public.follow_ups;
create policy follow_ups_select_visible
on public.follow_ups
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
    or private.can_access_lead(company_id, lead_id)
  )
);

drop policy if exists appointments_select_by_role_or_assignment on public.appointments;
drop policy if exists appointments_insert_by_role_or_self_assignment on public.appointments;
drop policy if exists appointments_update_by_role_or_assignment on public.appointments;
drop policy if exists appointments_delete_by_role_or_assignment on public.appointments;
create policy appointments_select_visible
on public.appointments
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
    or (lead_id is not null and private.can_access_lead(company_id, lead_id))
  )
);

create or replace function private.require_workflow_lead(
  target_company_id uuid,
  target_lead_id uuid
)
returns public.leads
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  selected_lead public.leads;
begin
  actor := private.require_lead_member(target_company_id);
  select lead.*
  into selected_lead
  from public.leads lead
  where lead.company_id = target_company_id
    and lead.id = target_lead_id
    and lead.deleted_at is null;
  if selected_lead.id is null then
    raise exception 'lead was not found' using errcode = 'P0002';
  end if;
  if actor.role = 'sales_representative'
    and selected_lead.assigned_member_id <> actor.id
  then
    raise exception 'lead access is not permitted' using errcode = '42501';
  end if;
  return selected_lead;
end;
$$;

revoke all on function private.require_workflow_lead(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.create_follow_up(
  target_company_id uuid,
  request_id uuid,
  target_lead_id uuid,
  target_assigned_member_id uuid,
  target_due_at timestamptz,
  target_priority public.task_priority,
  target_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  selected_lead public.leads;
  assignment_id uuid;
  created_id uuid;
  existing_id uuid;
begin
  actor := private.require_lead_member(target_company_id);
  selected_lead := private.require_workflow_lead(target_company_id, target_lead_id);
  perform pg_advisory_xact_lock(hashtextextended(request_id::text, 0));
  select item.follow_up_id into existing_id
  from public.workflow_create_requests item
  where item.id = request_id
    and item.company_id = target_company_id
    and item.user_id = (select auth.uid())
    and item.record_kind = 'follow_up';
  if existing_id is not null then return existing_id; end if;

  assignment_id := case
    when actor.role = 'sales_representative' then actor.id
    else coalesce(target_assigned_member_id, selected_lead.assigned_member_id)
  end;
  if actor.role = 'sales_representative'
    and target_assigned_member_id is distinct from actor.id
  then
    raise exception 'representatives can only assign themselves'
      using errcode = '42501';
  end if;
  perform private.require_active_assignee(target_company_id, assignment_id);
  if target_due_at is null or length(coalesce(target_notes, '')) > 5000 then
    raise exception 'invalid follow-up values' using errcode = '22023';
  end if;

  insert into public.follow_ups (
    company_id, lead_id, assigned_member_id, due_at, status,
    priority, notes, created_by_member_id
  )
  values (
    target_company_id, selected_lead.id, assignment_id, target_due_at,
    'pending', target_priority, nullif(btrim(target_notes), ''), actor.id
  )
  returning id into created_id;
  insert into public.lead_activities (
    company_id, lead_id, actor_member_id, activity_type,
    description, metadata
  )
  values (
    target_company_id, selected_lead.id, actor.id, 'follow_up_scheduled',
    'Follow-up scheduled',
    jsonb_build_object(
      'follow_up_id', created_id,
      'assigned_member_id', assignment_id,
      'due_at', target_due_at
    )
  );
  insert into public.workflow_create_requests (
    id, company_id, user_id, record_kind, follow_up_id
  )
  values (
    request_id, target_company_id, (select auth.uid()), 'follow_up', created_id
  );
  return created_id;
end;
$$;

create or replace function public.update_follow_up(
  target_company_id uuid,
  target_follow_up_id uuid,
  expected_updated_at timestamptz,
  target_assigned_member_id uuid,
  target_due_at timestamptz,
  target_priority public.task_priority,
  target_notes text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  existing public.follow_ups;
  next_updated_at timestamptz;
begin
  actor := private.require_lead_member(target_company_id);
  select item.* into existing
  from public.follow_ups item
  where item.company_id = target_company_id
    and item.id = target_follow_up_id
    and item.deleted_at is null
  for update;
  if existing.id is null then
    raise exception 'follow-up was not found' using errcode = 'P0002';
  end if;
  if actor.role = 'sales_representative'
    and existing.assigned_member_id <> actor.id
  then
    raise exception 'follow-up update is not permitted' using errcode = '42501';
  end if;
  if actor.role = 'sales_representative'
    and target_assigned_member_id is distinct from actor.id
  then
    raise exception 'representatives cannot reassign follow-ups'
      using errcode = '42501';
  end if;
  if existing.updated_at <> expected_updated_at then
    raise exception 'follow-up was changed by another user'
      using errcode = '40001';
  end if;
  if existing.status <> 'pending' then
    raise exception 'only pending follow-ups can be edited'
      using errcode = '22023';
  end if;
  perform private.require_active_assignee(
    target_company_id, target_assigned_member_id
  );
  if target_due_at is null or length(coalesce(target_notes, '')) > 5000 then
    raise exception 'invalid follow-up values' using errcode = '22023';
  end if;

  update public.follow_ups
  set assigned_member_id = target_assigned_member_id,
      due_at = target_due_at,
      priority = target_priority,
      notes = nullif(btrim(target_notes), ''),
      updated_at = clock_timestamp()
  where id = existing.id
  returning updated_at into next_updated_at;
  insert into public.lead_activities (
    company_id, lead_id, actor_member_id, activity_type,
    description, metadata
  )
  values (
    target_company_id, existing.lead_id, actor.id, 'updated',
    case
      when existing.due_at is distinct from target_due_at
        then 'Follow-up rescheduled'
      else 'Follow-up updated'
    end,
    jsonb_build_object(
      'follow_up_id', existing.id,
      'old_due_at', existing.due_at,
      'new_due_at', target_due_at,
      'old_member_id', existing.assigned_member_id,
      'new_member_id', target_assigned_member_id
    )
  );
  return next_updated_at;
end;
$$;

create or replace function public.transition_follow_up(
  target_company_id uuid,
  target_follow_up_id uuid,
  target_status public.follow_up_status
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  existing public.follow_ups;
begin
  actor := private.require_lead_member(target_company_id);
  if target_status not in ('completed', 'cancelled') then
    raise exception 'invalid follow-up transition' using errcode = '22023';
  end if;
  select item.* into existing
  from public.follow_ups item
  where item.company_id = target_company_id
    and item.id = target_follow_up_id
    and item.deleted_at is null
  for update;
  if existing.id is null then
    raise exception 'follow-up was not found' using errcode = 'P0002';
  end if;
  if actor.role = 'sales_representative'
    and existing.assigned_member_id <> actor.id
  then
    raise exception 'follow-up transition is not permitted'
      using errcode = '42501';
  end if;
  if existing.status = target_status then return false; end if;
  if existing.status <> 'pending' then
    raise exception 'completed or cancelled follow-ups are final'
      using errcode = '22023';
  end if;

  update public.follow_ups
  set status = target_status,
      completed_at = case when target_status = 'completed' then clock_timestamp() else null end,
      completed_by_member_id = case when target_status = 'completed' then actor.id else null end,
      cancelled_at = case when target_status = 'cancelled' then clock_timestamp() else null end,
      updated_at = clock_timestamp()
  where id = existing.id;
  insert into public.lead_activities (
    company_id, lead_id, actor_member_id, activity_type,
    description, metadata
  )
  values (
    target_company_id, existing.lead_id, actor.id,
    case when target_status = 'completed'
      then 'follow_up_completed'::public.lead_activity_type
      else 'updated'::public.lead_activity_type
    end,
    case when target_status = 'completed'
      then 'Follow-up completed'
      else 'Follow-up cancelled'
    end,
    jsonb_build_object('follow_up_id', existing.id, 'status', target_status)
  );
  return true;
end;
$$;

create or replace function public.set_follow_up_archived(
  target_company_id uuid,
  target_follow_up_id uuid,
  archive_record boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  existing public.follow_ups;
begin
  actor := private.require_lead_member(target_company_id);
  if actor.role not in ('owner', 'admin', 'sales_manager') then
    raise exception 'follow-up archive action is not permitted'
      using errcode = '42501';
  end if;
  select item.* into existing
  from public.follow_ups item
  where item.company_id = target_company_id and item.id = target_follow_up_id
  for update;
  if existing.id is null then
    raise exception 'follow-up was not found' using errcode = 'P0002';
  end if;
  if archive_record = (existing.deleted_at is not null) then return; end if;
  update public.follow_ups
  set deleted_at = case when archive_record then clock_timestamp() else null end,
      updated_at = clock_timestamp()
  where id = existing.id;
  insert into public.lead_activities (
    company_id, lead_id, actor_member_id, activity_type,
    description, metadata
  )
  values (
    target_company_id, existing.lead_id, actor.id, 'updated',
    case when archive_record then 'Follow-up archived' else 'Follow-up restored' end,
    jsonb_build_object('follow_up_id', existing.id, 'archived', archive_record)
  );
end;
$$;

create or replace function public.create_appointment(
  target_company_id uuid,
  request_id uuid,
  target_lead_id uuid,
  target_customer_name text,
  target_appointment_type public.appointment_type,
  target_starts_at timestamptz,
  target_ends_at timestamptz,
  target_location text,
  target_notes text,
  target_assigned_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  selected_lead public.leads;
  assignment_id uuid;
  customer text;
  created_id uuid;
  existing_id uuid;
begin
  actor := private.require_lead_member(target_company_id);
  perform pg_advisory_xact_lock(hashtextextended(request_id::text, 0));
  select item.appointment_id into existing_id
  from public.workflow_create_requests item
  where item.id = request_id
    and item.company_id = target_company_id
    and item.user_id = (select auth.uid())
    and item.record_kind = 'appointment';
  if existing_id is not null then return existing_id; end if;

  if target_lead_id is not null then
    selected_lead := private.require_workflow_lead(
      target_company_id, target_lead_id
    );
    customer := selected_lead.full_name;
  else
    if actor.role = 'sales_representative' then
      raise exception 'representatives must use an assigned lead'
        using errcode = '42501';
    end if;
    customer := btrim(target_customer_name);
  end if;
  assignment_id := case
    when actor.role = 'sales_representative' then actor.id
    else coalesce(
      target_assigned_member_id,
      selected_lead.assigned_member_id,
      actor.id
    )
  end;
  if actor.role = 'sales_representative'
    and target_assigned_member_id is distinct from actor.id
  then
    raise exception 'representatives can only assign themselves'
      using errcode = '42501';
  end if;
  perform private.require_active_assignee(target_company_id, assignment_id);
  if length(customer) not between 2 and 160
    or target_starts_at is null
    or (target_ends_at is not null and target_ends_at <= target_starts_at)
    or length(coalesce(target_location, '')) > 500
    or length(coalesce(target_notes, '')) > 5000
  then
    raise exception 'invalid appointment values' using errcode = '22023';
  end if;

  insert into public.appointments (
    company_id, lead_id, customer_name, appointment_type, status,
    starts_at, ends_at, location, notes, assigned_member_id,
    created_by_member_id
  )
  values (
    target_company_id, target_lead_id, customer, target_appointment_type,
    'pending', target_starts_at, target_ends_at,
    nullif(btrim(target_location), ''), nullif(btrim(target_notes), ''),
    assignment_id, actor.id
  )
  returning id into created_id;
  if target_lead_id is not null then
    insert into public.lead_activities (
      company_id, lead_id, actor_member_id, activity_type,
      description, metadata
    )
    values (
      target_company_id, target_lead_id, actor.id, 'appointment_scheduled',
      case when target_appointment_type = 'site_visit'
        then 'Site visit scheduled'
        else 'Appointment scheduled'
      end,
      jsonb_build_object(
        'appointment_id', created_id,
        'appointment_type', target_appointment_type,
        'starts_at', target_starts_at,
        'assigned_member_id', assignment_id
      )
    );
  end if;
  insert into public.workflow_create_requests (
    id, company_id, user_id, record_kind, appointment_id
  )
  values (
    request_id, target_company_id, (select auth.uid()),
    'appointment', created_id
  );
  return created_id;
end;
$$;

create or replace function public.update_appointment(
  target_company_id uuid,
  target_appointment_id uuid,
  expected_updated_at timestamptz,
  target_customer_name text,
  target_appointment_type public.appointment_type,
  target_starts_at timestamptz,
  target_ends_at timestamptz,
  target_location text,
  target_notes text,
  target_assigned_member_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  existing public.appointments;
  customer text;
  next_updated_at timestamptz;
begin
  actor := private.require_lead_member(target_company_id);
  select item.* into existing
  from public.appointments item
  where item.company_id = target_company_id
    and item.id = target_appointment_id
    and item.deleted_at is null
  for update;
  if existing.id is null then
    raise exception 'appointment was not found' using errcode = 'P0002';
  end if;
  if actor.role = 'sales_representative'
    and existing.assigned_member_id <> actor.id
  then
    raise exception 'appointment update is not permitted' using errcode = '42501';
  end if;
  if actor.role = 'sales_representative'
    and target_assigned_member_id is distinct from actor.id
  then
    raise exception 'representatives cannot reassign appointments'
      using errcode = '42501';
  end if;
  if existing.updated_at <> expected_updated_at then
    raise exception 'appointment was changed by another user'
      using errcode = '40001';
  end if;
  if existing.status in ('completed', 'cancelled') then
    raise exception 'completed or cancelled appointments are final'
      using errcode = '22023';
  end if;
  perform private.require_active_assignee(
    target_company_id, target_assigned_member_id
  );
  customer := case
    when existing.lead_id is not null then (
      select lead.full_name from public.leads lead
      where lead.company_id = target_company_id and lead.id = existing.lead_id
    )
    else btrim(target_customer_name)
  end;
  if length(customer) not between 2 and 160
    or target_starts_at is null
    or (target_ends_at is not null and target_ends_at <= target_starts_at)
    or length(coalesce(target_location, '')) > 500
    or length(coalesce(target_notes, '')) > 5000
  then
    raise exception 'invalid appointment values' using errcode = '22023';
  end if;

  update public.appointments
  set customer_name = customer,
      appointment_type = target_appointment_type,
      starts_at = target_starts_at,
      ends_at = target_ends_at,
      location = nullif(btrim(target_location), ''),
      notes = nullif(btrim(target_notes), ''),
      assigned_member_id = target_assigned_member_id,
      updated_at = clock_timestamp()
  where id = existing.id
  returning updated_at into next_updated_at;
  if existing.lead_id is not null then
    insert into public.lead_activities (
      company_id, lead_id, actor_member_id, activity_type,
      description, metadata
    )
    values (
      target_company_id, existing.lead_id, actor.id, 'updated',
      case
        when existing.starts_at is distinct from target_starts_at
          or existing.ends_at is distinct from target_ends_at
        then 'Appointment rescheduled'
        else 'Appointment updated'
      end,
      jsonb_build_object(
        'appointment_id', existing.id,
        'old_starts_at', existing.starts_at,
        'new_starts_at', target_starts_at,
        'old_member_id', existing.assigned_member_id,
        'new_member_id', target_assigned_member_id
      )
    );
  end if;
  return next_updated_at;
end;
$$;

create or replace function public.transition_appointment(
  target_company_id uuid,
  target_appointment_id uuid,
  target_status public.appointment_status
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  existing public.appointments;
begin
  actor := private.require_lead_member(target_company_id);
  if target_status not in ('confirmed', 'completed', 'cancelled') then
    raise exception 'invalid appointment transition' using errcode = '22023';
  end if;
  select item.* into existing
  from public.appointments item
  where item.company_id = target_company_id
    and item.id = target_appointment_id
    and item.deleted_at is null
  for update;
  if existing.id is null then
    raise exception 'appointment was not found' using errcode = 'P0002';
  end if;
  if actor.role = 'sales_representative'
    and existing.assigned_member_id <> actor.id
  then
    raise exception 'appointment transition is not permitted'
      using errcode = '42501';
  end if;
  if existing.status = target_status then return false; end if;
  if existing.status in ('completed', 'cancelled')
    or (target_status = 'confirmed' and existing.status <> 'pending')
    or (target_status = 'completed' and existing.status <> 'confirmed')
  then
    raise exception 'invalid appointment transition' using errcode = '22023';
  end if;

  update public.appointments
  set status = target_status,
      completed_at = case when target_status = 'completed' then clock_timestamp() else null end,
      completed_by_member_id = case when target_status = 'completed' then actor.id else null end,
      cancelled_at = case when target_status = 'cancelled' then clock_timestamp() else null end,
      updated_at = clock_timestamp()
  where id = existing.id;
  if existing.lead_id is not null then
    insert into public.lead_activities (
      company_id, lead_id, actor_member_id, activity_type,
      description, metadata
    )
    values (
      target_company_id, existing.lead_id, actor.id, 'updated',
      case target_status
        when 'confirmed' then 'Appointment confirmed'
        when 'completed' then 'Appointment completed'
        else 'Appointment cancelled'
      end,
      jsonb_build_object(
        'appointment_id', existing.id,
        'status', target_status
      )
    );
  end if;
  return true;
end;
$$;

create or replace function public.set_appointment_archived(
  target_company_id uuid,
  target_appointment_id uuid,
  archive_record boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  existing public.appointments;
begin
  actor := private.require_lead_member(target_company_id);
  if actor.role not in ('owner', 'admin', 'sales_manager') then
    raise exception 'appointment archive action is not permitted'
      using errcode = '42501';
  end if;
  select item.* into existing
  from public.appointments item
  where item.company_id = target_company_id and item.id = target_appointment_id
  for update;
  if existing.id is null then
    raise exception 'appointment was not found' using errcode = 'P0002';
  end if;
  if archive_record = (existing.deleted_at is not null) then return; end if;
  update public.appointments
  set deleted_at = case when archive_record then clock_timestamp() else null end,
      updated_at = clock_timestamp()
  where id = existing.id;
  if existing.lead_id is not null then
    insert into public.lead_activities (
      company_id, lead_id, actor_member_id, activity_type,
      description, metadata
    )
    values (
      target_company_id, existing.lead_id, actor.id, 'updated',
      case when archive_record then 'Appointment archived' else 'Appointment restored' end,
      jsonb_build_object('appointment_id', existing.id, 'archived', archive_record)
    );
  end if;
end;
$$;

revoke all on function public.create_follow_up(
  uuid, uuid, uuid, uuid, timestamptz, public.task_priority, text
) from public, anon;
revoke all on function public.update_follow_up(
  uuid, uuid, timestamptz, uuid, timestamptz, public.task_priority, text
) from public, anon;
revoke all on function public.transition_follow_up(
  uuid, uuid, public.follow_up_status
) from public, anon;
revoke all on function public.set_follow_up_archived(uuid, uuid, boolean)
  from public, anon;
revoke all on function public.create_appointment(
  uuid, uuid, uuid, text, public.appointment_type, timestamptz, timestamptz,
  text, text, uuid
) from public, anon;
revoke all on function public.update_appointment(
  uuid, uuid, timestamptz, text, public.appointment_type, timestamptz,
  timestamptz, text, text, uuid
) from public, anon;
revoke all on function public.transition_appointment(
  uuid, uuid, public.appointment_status
) from public, anon;
revoke all on function public.set_appointment_archived(uuid, uuid, boolean)
  from public, anon;

grant execute on function public.create_follow_up(
  uuid, uuid, uuid, uuid, timestamptz, public.task_priority, text
) to authenticated;
grant execute on function public.update_follow_up(
  uuid, uuid, timestamptz, uuid, timestamptz, public.task_priority, text
) to authenticated;
grant execute on function public.transition_follow_up(
  uuid, uuid, public.follow_up_status
) to authenticated;
grant execute on function public.set_follow_up_archived(uuid, uuid, boolean)
  to authenticated;
grant execute on function public.create_appointment(
  uuid, uuid, uuid, text, public.appointment_type, timestamptz, timestamptz,
  text, text, uuid
) to authenticated;
grant execute on function public.update_appointment(
  uuid, uuid, timestamptz, text, public.appointment_type, timestamptz,
  timestamptz, text, text, uuid
) to authenticated;
grant execute on function public.transition_appointment(
  uuid, uuid, public.appointment_status
) to authenticated;
grant execute on function public.set_appointment_archived(uuid, uuid, boolean)
  to authenticated;
