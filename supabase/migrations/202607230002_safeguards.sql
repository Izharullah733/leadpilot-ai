create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.prevent_company_id_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'company_id is immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_membership_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.company_id is distinct from old.company_id then
    raise exception 'company_id is immutable'
      using errcode = '23514';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'company membership user_id is immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.protect_final_active_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  removes_active_owner boolean;
begin
  removes_active_owner :=
    old.role = 'owner'
    and old.status = 'active'
    and (
      tg_op = 'DELETE'
      or new.role <> 'owner'
      or new.status <> 'active'
      or new.company_id <> old.company_id
    );

  if not removes_active_owner then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- Serialize owner changes for this company so concurrent demotions cannot
  -- both observe another owner and leave the company ownerless.
  perform 1
  from public.companies
  where id = old.company_id
  for update;

  if not exists (
    select 1
    from public.company_members
    where company_id = old.company_id
      and id <> old.id
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'cannot remove or demote the final active company owner'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger companies_set_updated_at
before update on public.companies
for each row execute function private.set_updated_at();

create trigger company_members_set_updated_at
before update on public.company_members
for each row execute function private.set_updated_at();

create trigger company_invitations_set_updated_at
before update on public.company_invitations
for each row execute function private.set_updated_at();

create trigger leads_set_updated_at
before update on public.leads
for each row execute function private.set_updated_at();

create trigger lead_activities_set_updated_at
before update on public.lead_activities
for each row execute function private.set_updated_at();

create trigger follow_ups_set_updated_at
before update on public.follow_ups
for each row execute function private.set_updated_at();

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function private.set_updated_at();

create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function private.set_updated_at();

create trigger company_settings_set_updated_at
before update on public.company_settings
for each row execute function private.set_updated_at();

create trigger company_members_identity_immutable
before update on public.company_members
for each row execute function private.prevent_membership_identity_change();

create trigger company_members_protect_final_owner
before update or delete on public.company_members
for each row execute function private.protect_final_active_owner();

create trigger company_invitations_company_immutable
before update on public.company_invitations
for each row execute function private.prevent_company_id_change();

create trigger leads_company_immutable
before update on public.leads
for each row execute function private.prevent_company_id_change();

create trigger lead_activities_company_immutable
before update on public.lead_activities
for each row execute function private.prevent_company_id_change();

create trigger follow_ups_company_immutable
before update on public.follow_ups
for each row execute function private.prevent_company_id_change();

create trigger appointments_company_immutable
before update on public.appointments
for each row execute function private.prevent_company_id_change();

create trigger notifications_company_immutable
before update on public.notifications
for each row execute function private.prevent_company_id_change();

revoke all on function private.set_updated_at() from public;
revoke all on function private.prevent_company_id_change() from public;
revoke all on function private.prevent_membership_identity_change() from public;
revoke all on function private.protect_final_active_owner() from public;
