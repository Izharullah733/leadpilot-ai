create table public.membership_audit (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  actor_member_id uuid,
  target_member_id uuid,
  invitation_id uuid references public.company_invitations (id) on delete set null,
  action text not null check (
    action in (
      'invitation_created',
      'invitation_resent',
      'invitation_revoked',
      'invitation_accepted',
      'role_changed',
      'member_suspended',
      'member_reactivated',
      'member_removed',
      'owner_added'
    )
  ),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  constraint membership_audit_actor_fkey foreign key (company_id, actor_member_id)
    references public.company_members (company_id, id) on delete restrict,
  constraint membership_audit_target_fkey foreign key (company_id, target_member_id)
    references public.company_members (company_id, id) on delete restrict
);

create index membership_audit_company_occurred_idx
  on public.membership_audit (company_id, occurred_at desc);

alter table public.membership_audit enable row level security;

revoke all on table public.membership_audit from public, anon, authenticated;
grant select on table public.membership_audit to authenticated;

create policy membership_audit_select_owner_admin
on public.membership_audit
for select
to authenticated
using (
  private.has_company_role(
    company_id,
    array['owner', 'admin']::public.member_role[]
  )
);

-- Sensitive membership and invitation writes must use the controlled RPCs
-- below. Ordinary clients retain RLS-protected reads only.
revoke insert, update, delete on public.company_members from authenticated;
revoke select, insert, update, delete on public.company_invitations from authenticated;
grant select, insert, update, delete on public.company_members to service_role;
grant select, insert, update, delete on public.company_invitations to service_role;
grant select, insert, update, delete on public.membership_audit to service_role;

create or replace function private.require_membership_manager(
  target_company_id uuid,
  allow_manager_read boolean default false
)
returns public.member_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role public.member_role;
begin
  select member.role
  into actor_role
  from public.company_members member
  join public.companies company on company.id = member.company_id
  where member.company_id = target_company_id
    and member.user_id = (select auth.uid())
    and member.status = 'active'
    and company.status = 'active'
    and company.deleted_at is null;

  if actor_role is null
    or (
      actor_role not in ('owner', 'admin')
      and not (allow_manager_read and actor_role = 'sales_manager')
    )
  then
    raise exception 'membership action is not permitted'
      using errcode = '42501';
  end if;

  return actor_role;
end;
$$;

revoke all on function private.require_membership_manager(uuid, boolean)
  from public, anon, authenticated;

create or replace function public.list_my_tenants()
returns table (
  company_id uuid,
  company_name text,
  member_id uuid,
  role public.member_role
)
language sql
stable
security definer
set search_path = ''
as $$
  select company.id, company.name, member.id, member.role
  from public.company_members member
  join public.companies company on company.id = member.company_id
  where member.user_id = (select auth.uid())
    and member.status = 'active'
    and company.status = 'active'
    and company.deleted_at is null
  order by member.joined_at nulls last, company.name, company.id;
$$;

create or replace function public.list_company_members(target_company_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  full_name text,
  email text,
  role public.member_role,
  membership_status public.membership_status,
  joined_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role public.member_role;
begin
  select member.role
  into actor_role
  from public.company_members member
  join public.companies company on company.id = member.company_id
  where member.company_id = target_company_id
    and member.user_id = (select auth.uid())
    and member.status = 'active'
    and company.status = 'active'
    and company.deleted_at is null;

  if actor_role is null then
    raise exception 'company membership is required'
      using errcode = '42501';
  end if;

  return query
  select
    member.id,
    member.user_id,
    profile.full_name,
    lower(auth_user.email),
    member.role,
    member.status,
    member.joined_at,
    member.created_at
  from public.company_members member
  join public.profiles profile on profile.id = member.user_id
  join auth.users auth_user on auth_user.id = member.user_id
  where member.company_id = target_company_id
    and member.status <> 'removed'
    and (
      actor_role <> 'sales_representative'
      or member.user_id = (select auth.uid())
    )
  order by
    case member.role
      when 'owner' then 0
      when 'admin' then 1
      when 'sales_manager' then 2
      else 3
    end,
    profile.full_name;
end;
$$;

create or replace function public.list_company_invitations(target_company_id uuid)
returns table (
  invitation_id uuid,
  email text,
  role public.member_role,
  invitation_status public.invitation_status,
  expires_at timestamptz,
  created_at timestamptz,
  inviter_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_membership_manager(target_company_id, true);

  return query
  select
    invitation.id,
    invitation.email,
    invitation.role,
    case
      when invitation.status = 'pending' and invitation.expires_at <= now()
        then 'expired'::public.invitation_status
      else invitation.status
    end,
    invitation.expires_at,
    invitation.created_at,
    inviter_profile.full_name
  from public.company_invitations invitation
  join public.company_members inviter on inviter.id = invitation.invited_by_member_id
  join public.profiles inviter_profile on inviter_profile.id = inviter.user_id
  where invitation.company_id = target_company_id
  order by invitation.created_at desc;
end;
$$;

create or replace function public.create_company_invitation(
  target_company_id uuid,
  invited_email text,
  invited_role public.member_role,
  invitation_token_hash text,
  invitation_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  normalized_email text := lower(btrim(invited_email));
  invitation_id uuid;
begin
  select member.*
  into actor
  from public.company_members member
  where member.company_id = target_company_id
    and member.user_id = (select auth.uid())
    and member.status = 'active';

  if actor.id is null or actor.role not in ('owner', 'admin') then
    raise exception 'invitation action is not permitted'
      using errcode = '42501';
  end if;

  if invited_role = 'owner'
    or (actor.role = 'admin' and invited_role not in ('sales_manager', 'sales_representative'))
  then
    raise exception 'invitation role is not permitted'
      using errcode = '42501';
  end if;

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid invitation email'
      using errcode = '22023';
  end if;

  if length(invitation_token_hash) <> 64
    or invitation_token_hash !~ '^[0-9a-f]{64}$'
    or invitation_expires_at <= now()
  then
    raise exception 'invalid invitation security parameters'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.company_members member
    join auth.users auth_user on auth_user.id = member.user_id
    where member.company_id = target_company_id
      and member.status = 'active'
      and lower(auth_user.email) = normalized_email
  ) then
    raise exception 'user is already an active company member'
      using errcode = '23505';
  end if;

  update public.company_invitations
  set status = 'expired'
  where company_id = target_company_id
    and lower(email) = normalized_email
    and status = 'pending'
    and expires_at <= now();

  insert into public.company_invitations (
    company_id,
    email,
    role,
    token_hash,
    status,
    invited_by_member_id,
    expires_at
  )
  values (
    target_company_id,
    normalized_email,
    invited_role,
    invitation_token_hash,
    'pending',
    actor.id,
    invitation_expires_at
  )
  returning id into invitation_id;

  insert into public.membership_audit (
    company_id, actor_member_id, invitation_id, action, metadata
  )
  values (
    target_company_id,
    actor.id,
    invitation_id,
    'invitation_created',
    jsonb_build_object('role', invited_role, 'email', normalized_email)
  );

  return invitation_id;
end;
$$;

create or replace function public.rotate_company_invitation(
  target_company_id uuid,
  target_invitation_id uuid,
  invitation_token_hash text,
  invitation_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  invitation public.company_invitations;
begin
  select member.*
  into actor
  from public.company_members member
  where member.company_id = target_company_id
    and member.user_id = (select auth.uid())
    and member.status = 'active';

  select item.*
  into invitation
  from public.company_invitations item
  where item.company_id = target_company_id
    and item.id = target_invitation_id
  for update;

  if actor.id is null
    or actor.role not in ('owner', 'admin')
    or (actor.role = 'admin' and invitation.role = 'admin')
  then
    raise exception 'invitation action is not permitted'
      using errcode = '42501';
  end if;

  if invitation.id is null or invitation.status <> 'pending' then
    raise exception 'pending invitation was not found'
      using errcode = 'P0002';
  end if;

  if length(invitation_token_hash) <> 64
    or invitation_token_hash !~ '^[0-9a-f]{64}$'
    or invitation_expires_at <= now()
  then
    raise exception 'invalid invitation security parameters'
      using errcode = '22023';
  end if;

  update public.company_invitations
  set token_hash = invitation_token_hash,
      expires_at = invitation_expires_at,
      status = 'pending'
  where id = invitation.id;

  insert into public.membership_audit (
    company_id, actor_member_id, invitation_id, action
  )
  values (
    target_company_id, actor.id, invitation.id, 'invitation_resent'
  );
end;
$$;

create or replace function public.revoke_company_invitation(
  target_company_id uuid,
  target_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  invitation public.company_invitations;
begin
  select member.*
  into actor
  from public.company_members member
  where member.company_id = target_company_id
    and member.user_id = (select auth.uid())
    and member.status = 'active';

  select item.*
  into invitation
  from public.company_invitations item
  where item.company_id = target_company_id
    and item.id = target_invitation_id
  for update;

  if actor.id is null
    or actor.role not in ('owner', 'admin')
    or (actor.role = 'admin' and invitation.role = 'admin')
  then
    raise exception 'invitation action is not permitted'
      using errcode = '42501';
  end if;

  if invitation.id is null or invitation.status <> 'pending' then
    raise exception 'pending invitation was not found'
      using errcode = 'P0002';
  end if;

  update public.company_invitations
  set status = 'revoked'
  where id = invitation.id;

  insert into public.membership_audit (
    company_id, actor_member_id, invitation_id, action
  )
  values (
    target_company_id, actor.id, invitation.id, 'invitation_revoked'
  );
end;
$$;

create or replace function public.manage_company_member(
  target_company_id uuid,
  target_member_id uuid,
  requested_action text,
  requested_role public.member_role default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.company_members;
  target public.company_members;
  audit_action text;
  old_role public.member_role;
begin
  select member.*
  into actor
  from public.company_members member
  where member.company_id = target_company_id
    and member.user_id = (select auth.uid())
    and member.status = 'active';

  select member.*
  into target
  from public.company_members member
  where member.company_id = target_company_id
    and member.id = target_member_id
  for update;

  if actor.id is null or actor.role not in ('owner', 'admin') then
    raise exception 'member action is not permitted'
      using errcode = '42501';
  end if;

  if target.id is null then
    raise exception 'company member was not found'
      using errcode = 'P0002';
  end if;

  if actor.id = target.id then
    raise exception 'members cannot manage their own role or status'
      using errcode = '42501';
  end if;

  if actor.role = 'admin'
    and (
      target.role in ('owner', 'admin')
      or requested_role in ('owner', 'admin')
    )
  then
    raise exception 'admins cannot manage owners or admins'
      using errcode = '42501';
  end if;

  old_role := target.role;

  case requested_action
    when 'change_role' then
      if requested_role is null or target.status = 'removed' then
        raise exception 'invalid role change'
          using errcode = '22023';
      end if;
      update public.company_members
      set role = requested_role
      where id = target.id;
      audit_action := case
        when requested_role = 'owner' and old_role <> 'owner' then 'owner_added'
        else 'role_changed'
      end;
    when 'suspend' then
      if target.status <> 'active' then
        raise exception 'only active members can be suspended'
          using errcode = '22023';
      end if;
      update public.company_members set status = 'suspended' where id = target.id;
      audit_action := 'member_suspended';
    when 'reactivate' then
      if target.status <> 'suspended' then
        raise exception 'only suspended members can be reactivated'
          using errcode = '22023';
      end if;
      update public.company_members
      set status = 'active', joined_at = coalesce(joined_at, now())
      where id = target.id;
      audit_action := 'member_reactivated';
    when 'remove' then
      if target.status = 'removed' then
        raise exception 'member is already removed'
          using errcode = '22023';
      end if;
      update public.company_members set status = 'removed' where id = target.id;
      audit_action := 'member_removed';
    else
      raise exception 'unknown member action'
        using errcode = '22023';
  end case;

  insert into public.membership_audit (
    company_id,
    actor_member_id,
    target_member_id,
    action,
    metadata
  )
  values (
    target_company_id,
    actor.id,
    target.id,
    audit_action,
    case
      when requested_action = 'change_role'
        then jsonb_build_object('from_role', old_role, 'to_role', requested_role)
      else '{}'::jsonb
    end
  );
end;
$$;

create or replace function public.inspect_company_invitation(raw_token text)
returns table (
  company_name text,
  email text,
  role public.member_role,
  invitation_status public.invitation_status,
  expires_at timestamptz,
  is_valid boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    company.name,
    invitation.email,
    invitation.role,
    case
      when invitation.status = 'pending' and invitation.expires_at <= now()
        then 'expired'::public.invitation_status
      else invitation.status
    end,
    invitation.expires_at,
    invitation.status = 'pending' and invitation.expires_at > now()
  from public.company_invitations invitation
  join public.companies company on company.id = invitation.company_id
  where raw_token ~ '^[A-Za-z0-9_-]{43}$'
    and invitation.token_hash = encode(
      extensions.digest(raw_token, 'sha256'),
      'hex'
    )
  limit 1;
$$;

create or replace function public.accept_company_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.company_invitations;
  authenticated_email text;
  accepted_member_id uuid;
begin
  if raw_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invitation is invalid or unavailable'
      using errcode = '22023';
  end if;

  select item.*
  into invitation
  from public.company_invitations item
  where item.token_hash = encode(
    extensions.digest(raw_token, 'sha256'),
    'hex'
  )
  for update;

  if invitation.id is null
    or invitation.status <> 'pending'
    or invitation.expires_at <= now()
  then
    raise exception 'invitation is invalid or unavailable'
      using errcode = '22023';
  end if;

  select lower(auth_user.email)
  into authenticated_email
  from auth.users auth_user
  where auth_user.id = (select auth.uid())
    and auth_user.email_confirmed_at is not null;

  if authenticated_email is null
    or authenticated_email <> lower(invitation.email)
  then
    raise exception 'invitation email does not match the authenticated account'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.company_members member
    where member.company_id = invitation.company_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
  ) then
    raise exception 'user is already an active company member'
      using errcode = '23505';
  end if;

  insert into public.company_members (
    company_id,
    user_id,
    role,
    status,
    invited_by_member_id,
    joined_at
  )
  values (
    invitation.company_id,
    (select auth.uid()),
    invitation.role,
    'active',
    invitation.invited_by_member_id,
    now()
  )
  on conflict (company_id, user_id) do update
  set role = excluded.role,
      status = 'active',
      invited_by_member_id = excluded.invited_by_member_id,
      joined_at = coalesce(public.company_members.joined_at, now())
  where public.company_members.status in ('invited', 'suspended', 'removed')
  returning id into accepted_member_id;

  if accepted_member_id is null then
    raise exception 'invitation could not be accepted'
      using errcode = '23505';
  end if;

  update public.company_invitations
  set status = 'accepted',
      accepted_by_user_id = (select auth.uid()),
      accepted_at = now()
  where id = invitation.id;

  insert into public.membership_audit (
    company_id,
    actor_member_id,
    target_member_id,
    invitation_id,
    action,
    metadata
  )
  values (
    invitation.company_id,
    accepted_member_id,
    accepted_member_id,
    invitation.id,
    'invitation_accepted',
    jsonb_build_object('role', invitation.role)
  );

  return invitation.company_id;
end;
$$;

revoke all on function public.list_my_tenants() from public, anon;
revoke all on function public.list_company_members(uuid) from public, anon;
revoke all on function public.list_company_invitations(uuid) from public, anon;
revoke all on function public.create_company_invitation(uuid, text, public.member_role, text, timestamptz) from public, anon;
revoke all on function public.rotate_company_invitation(uuid, uuid, text, timestamptz) from public, anon;
revoke all on function public.revoke_company_invitation(uuid, uuid) from public, anon;
revoke all on function public.manage_company_member(uuid, uuid, text, public.member_role) from public, anon;
revoke all on function public.accept_company_invitation(text) from public, anon;
revoke all on function public.inspect_company_invitation(text) from public;

grant execute on function public.list_my_tenants() to authenticated;
grant execute on function public.list_company_members(uuid) to authenticated;
grant execute on function public.list_company_invitations(uuid) to authenticated;
grant execute on function public.create_company_invitation(uuid, text, public.member_role, text, timestamptz) to authenticated;
grant execute on function public.rotate_company_invitation(uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.revoke_company_invitation(uuid, uuid) to authenticated;
grant execute on function public.manage_company_member(uuid, uuid, text, public.member_role) to authenticated;
grant execute on function public.accept_company_invitation(text) to authenticated;
grant execute on function public.inspect_company_invitation(text) to anon, authenticated;
