create or replace function private.is_active_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members member
    join public.companies company on company.id = member.company_id
    where member.company_id = target_company_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and company.status = 'active'
      and company.deleted_at is null
  );
$$;

create or replace function private.has_company_role(
  target_company_id uuid,
  allowed_roles public.member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members member
    join public.companies company on company.id = member.company_id
    where member.company_id = target_company_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.role = any(allowed_roles)
      and company.status = 'active'
      and company.deleted_at is null
  );
$$;

create or replace function private.current_company_member_id(target_company_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.id
  from public.company_members member
  join public.companies company on company.id = member.company_id
  where member.company_id = target_company_id
    and member.user_id = (select auth.uid())
    and member.status = 'active'
    and company.status = 'active'
    and company.deleted_at is null
  limit 1;
$$;

create or replace function private.shares_active_company(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members mine
    join public.company_members theirs on theirs.company_id = mine.company_id
    join public.companies company on company.id = mine.company_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = other_user_id
      and theirs.status = 'active'
      and company.status = 'active'
      and company.deleted_at is null
  );
$$;

create or replace function private.can_access_lead(target_company_id uuid, target_lead_id uuid)
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
      and (
        private.has_company_role(
          target_company_id,
          array['owner', 'admin', 'sales_manager']::public.member_role[]
        )
        or lead.assigned_member_id = private.current_company_member_id(target_company_id)
      )
  );
$$;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

revoke all on function private.is_active_company_member(uuid) from public, anon;
revoke all on function private.has_company_role(uuid, public.member_role[]) from public, anon;
revoke all on function private.current_company_member_id(uuid) from public, anon;
revoke all on function private.shares_active_company(uuid) from public, anon;
revoke all on function private.can_access_lead(uuid, uuid) from public, anon;

grant execute on function private.is_active_company_member(uuid) to authenticated;
grant execute on function private.has_company_role(uuid, public.member_role[]) to authenticated;
grant execute on function private.current_company_member_id(uuid) to authenticated;
grant execute on function private.shares_active_company(uuid) to authenticated;
grant execute on function private.can_access_lead(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.company_invitations enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.follow_ups enable row level security;
alter table public.appointments enable row level security;
alter table public.notifications enable row level security;
alter table public.company_settings enable row level security;

revoke all on table
  public.profiles,
  public.companies,
  public.company_members,
  public.company_invitations,
  public.leads,
  public.lead_activities,
  public.follow_ups,
  public.appointments,
  public.notifications,
  public.company_settings
from anon;

grant select, insert, update, delete on table
  public.profiles,
  public.companies,
  public.company_members,
  public.company_invitations,
  public.leads,
  public.lead_activities,
  public.follow_ups,
  public.appointments,
  public.notifications,
  public.company_settings
to authenticated;

create policy profiles_select_company_peers
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or private.shares_active_company(id)
);

create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy companies_select_members
on public.companies
for select
to authenticated
using (private.is_active_company_member(id));

create policy companies_update_owner_admin
on public.companies
for update
to authenticated
using (
  private.has_company_role(
    id,
    array['owner', 'admin']::public.member_role[]
  )
)
with check (
  private.has_company_role(
    id,
    array['owner', 'admin']::public.member_role[]
  )
);

create policy company_members_select_company
on public.company_members
for select
to authenticated
using (private.is_active_company_member(company_id));

create policy company_members_insert_owner_admin
on public.company_members
for insert
to authenticated
with check (
  private.has_company_role(company_id, array['owner']::public.member_role[])
  or (
    private.has_company_role(company_id, array['admin']::public.member_role[])
    and role in ('sales_manager', 'sales_representative')
  )
);

create policy company_members_update_owner_admin
on public.company_members
for update
to authenticated
using (
  private.has_company_role(company_id, array['owner']::public.member_role[])
  or (
    private.has_company_role(company_id, array['admin']::public.member_role[])
    and role in ('sales_manager', 'sales_representative')
  )
)
with check (
  private.has_company_role(company_id, array['owner']::public.member_role[])
  or (
    private.has_company_role(company_id, array['admin']::public.member_role[])
    and role in ('sales_manager', 'sales_representative')
  )
);

create policy company_members_delete_owner_admin
on public.company_members
for delete
to authenticated
using (
  private.has_company_role(company_id, array['owner']::public.member_role[])
  or (
    private.has_company_role(company_id, array['admin']::public.member_role[])
    and role in ('sales_manager', 'sales_representative')
  )
);

create policy leads_select_by_role_or_assignment
on public.leads
for select
to authenticated
using (
  private.has_company_role(
    company_id,
    array['owner', 'admin', 'sales_manager']::public.member_role[]
  )
  or assigned_member_id = private.current_company_member_id(company_id)
);

create policy leads_insert_by_role_or_self_assignment
on public.leads
for insert
to authenticated
with check (
  private.has_company_role(
    company_id,
    array['owner', 'admin', 'sales_manager']::public.member_role[]
  )
  or (
    private.has_company_role(
      company_id,
      array['sales_representative']::public.member_role[]
    )
    and assigned_member_id = private.current_company_member_id(company_id)
    and created_by_member_id = private.current_company_member_id(company_id)
  )
);

create policy leads_update_by_role_or_assignment
on public.leads
for update
to authenticated
using (
  private.has_company_role(
    company_id,
    array['owner', 'admin', 'sales_manager']::public.member_role[]
  )
  or assigned_member_id = private.current_company_member_id(company_id)
)
with check (
  private.has_company_role(
    company_id,
    array['owner', 'admin', 'sales_manager']::public.member_role[]
  )
  or assigned_member_id = private.current_company_member_id(company_id)
);

create policy leads_delete_owner_admin
on public.leads
for delete
to authenticated
using (
  private.has_company_role(
    company_id,
    array['owner', 'admin']::public.member_role[]
  )
);

create policy lead_activities_select_visible_lead
on public.lead_activities
for select
to authenticated
using (private.can_access_lead(company_id, lead_id));

create policy lead_activities_insert_visible_lead
on public.lead_activities
for insert
to authenticated
with check (
  private.can_access_lead(company_id, lead_id)
  and actor_member_id = private.current_company_member_id(company_id)
);

create policy follow_ups_select_by_role_or_assignment
on public.follow_ups
for select
to authenticated
using (
  private.has_company_role(
    company_id,
    array['owner', 'admin', 'sales_manager']::public.member_role[]
  )
  or assigned_member_id = private.current_company_member_id(company_id)
);

create policy follow_ups_insert_by_role_or_self_assignment
on public.follow_ups
for insert
to authenticated
with check (
  private.can_access_lead(company_id, lead_id)
  and (
    private.has_company_role(
      company_id,
      array['owner', 'admin', 'sales_manager']::public.member_role[]
    )
    or (
      assigned_member_id = private.current_company_member_id(company_id)
      and created_by_member_id = private.current_company_member_id(company_id)
    )
  )
);

create policy follow_ups_update_by_role_or_assignment
on public.follow_ups
for update
to authenticated
using (
  private.has_company_role(
    company_id,
    array['owner', 'admin', 'sales_manager']::public.member_role[]
  )
  or assigned_member_id = private.current_company_member_id(company_id)
)
with check (
  private.has_company_role(
    company_id,
    array['owner', 'admin', 'sales_manager']::public.member_role[]
  )
  or assigned_member_id = private.current_company_member_id(company_id)
);

create policy follow_ups_delete_by_role_or_assignment
on public.follow_ups
for delete
to authenticated
using (
  private.has_company_role(
    company_id,
    array['owner', 'admin', 'sales_manager']::public.member_role[]
  )
  or assigned_member_id = private.current_company_member_id(company_id)
);

create policy appointments_select_by_role_or_assignment
on public.appointments
for select
to authenticated
using (
  private.has_company_role(
    company_id,
    array['owner', 'admin', 'sales_manager']::public.member_role[]
  )
  or assigned_member_id = private.current_company_member_id(company_id)
);

create policy appointments_insert_by_role_or_self_assignment
on public.appointments
for insert
to authenticated
with check (
  (lead_id is null or private.can_access_lead(company_id, lead_id))
  and (
    private.has_company_role(
      company_id,
      array['owner', 'admin', 'sales_manager']::public.member_role[]
    )
    or (
      assigned_member_id = private.current_company_member_id(company_id)
      and created_by_member_id = private.current_company_member_id(company_id)
    )
  )
);

create policy appointments_update_by_role_or_assignment
on public.appointments
for update
to authenticated
using (
  private.has_company_role(
    company_id,
    array['owner', 'admin', 'sales_manager']::public.member_role[]
  )
  or assigned_member_id = private.current_company_member_id(company_id)
)
with check (
  private.has_company_role(
    company_id,
    array['owner', 'admin', 'sales_manager']::public.member_role[]
  )
  or assigned_member_id = private.current_company_member_id(company_id)
);

create policy appointments_delete_by_role_or_assignment
on public.appointments
for delete
to authenticated
using (
  private.has_company_role(
    company_id,
    array['owner', 'admin', 'sales_manager']::public.member_role[]
  )
  or assigned_member_id = private.current_company_member_id(company_id)
);

create policy company_settings_select_members
on public.company_settings
for select
to authenticated
using (private.is_active_company_member(company_id));

create policy company_settings_insert_owner_admin
on public.company_settings
for insert
to authenticated
with check (
  private.has_company_role(
    company_id,
    array['owner', 'admin']::public.member_role[]
  )
);

create policy company_settings_update_owner_admin
on public.company_settings
for update
to authenticated
using (
  private.has_company_role(
    company_id,
    array['owner', 'admin']::public.member_role[]
  )
)
with check (
  private.has_company_role(
    company_id,
    array['owner', 'admin']::public.member_role[]
  )
);

-- Invitation runtime policies are intentionally deferred until the Stage 2
-- invitation workflow can validate tokens and role hierarchy server-side.
-- With RLS enabled and no policies, authenticated and anonymous clients cannot
-- access company_invitations.

create policy notifications_select_recipient
on public.notifications
for select
to authenticated
using (
  recipient_member_id = private.current_company_member_id(company_id)
);
