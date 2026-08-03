create or replace function public.get_my_auth_context()
returns table (
  profile_id uuid,
  full_name text,
  avatar_url text,
  member_id uuid,
  company_id uuid,
  company_name text,
  role public.member_role,
  membership_status public.membership_status,
  company_status public.company_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.full_name,
    profile.avatar_url,
    membership.id,
    membership.company_id,
    company.name,
    membership.role,
    membership.status,
    company.status
  from public.profiles profile
  left join lateral (
    select member.*
    from public.company_members member
    where member.user_id = (select auth.uid())
    order by
      case member.status
        when 'active' then 0
        when 'suspended' then 1
        when 'invited' then 2
        else 3
      end,
      member.created_at
    limit 1
  ) membership on true
  left join public.companies company on company.id = membership.company_id
  where profile.id = (select auth.uid())
  limit 1;
$$;

revoke all on function public.get_my_auth_context() from public, anon;
grant execute on function public.get_my_auth_context() to authenticated;
