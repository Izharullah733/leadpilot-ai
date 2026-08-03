begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(38);

create or replace function pg_temp.capture_sqlstate(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return null;
exception
  when others then
    return sqlstate;
end;
$$;

-- Keep this transactional suite repeatable after browser invitation tests.
delete from public.membership_audit
where company_id = '10000000-0000-0000-0000-000000000001';
delete from public.company_invitations
where company_id = '10000000-0000-0000-0000-000000000001'
  and email = 'invitee.seed@leadpilot.local';
delete from public.company_members
where company_id = '10000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-000000000008';

select extensions.is(
  has_function_privilege('anon', 'public.list_my_tenants()', 'execute'),
  false,
  'anonymous users cannot enumerate tenants'
);
select extensions.is(
  has_table_privilege('authenticated', 'public.company_members', 'insert'),
  false,
  'authenticated clients cannot write memberships directly'
);
select extensions.is(
  has_table_privilege('authenticated', 'public.company_invitations', 'select'),
  false,
  'authenticated clients cannot read token hashes'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select extensions.is(
  (select count(*)::integer from public.list_my_tenants()),
  2,
  'multi-company owner resolves both active tenants'
);
select extensions.is(
  (select count(*)::integer from public.list_company_members('10000000-0000-0000-0000-000000000001')),
  4,
  'owner sees all four Prime Build members'
);
select extensions.is(
  (select count(*)::integer from public.list_company_invitations('10000000-0000-0000-0000-000000000001')),
  0,
  'invitation history starts empty'
);
select extensions.ok(
  public.create_company_invitation(
    '10000000-0000-0000-0000-000000000001',
    'invitee.seed@leadpilot.local',
    'sales_representative',
    encode(extensions.digest('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'sha256'), 'hex'),
    now() + interval '1 day'
  ) is not null,
  'owner creates a hashed invitation'
);
select extensions.is(
  pg_temp.capture_sqlstate($command$
    select public.create_company_invitation(
      '10000000-0000-0000-0000-000000000001',
      'invitee.seed@leadpilot.local',
      'sales_representative',
      repeat('d', 64),
      now() + interval '1 day'
    )
  $command$),
  '23505',
  'a second pending invitation for the same company and email is blocked'
);
select extensions.is(
  (select count(*)::integer from public.list_company_invitations('10000000-0000-0000-0000-000000000001')),
  1,
  'owner sees the pending invitation without token material'
);
select extensions.lives_ok(
  $$ select public.manage_company_member(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000004',
    'change_role',
    'sales_manager'
  ) $$,
  'owner can change a representative role'
);
select extensions.is(
  (select role::text from public.list_company_members('10000000-0000-0000-0000-000000000001') where member_id = '20000000-0000-0000-0000-000000000004'),
  'sales_manager',
  'role changes are immediately visible'
);
select extensions.lives_ok(
  $$ select public.manage_company_member(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000004',
    'change_role',
    'sales_representative'
  ) $$,
  'owner can restore the representative role'
);
select extensions.lives_ok(
  $$ select public.manage_company_member(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000004',
    'suspend'
  ) $$,
  'owner can suspend a representative'
);
select extensions.is(
  (select membership_status::text from public.list_company_members('10000000-0000-0000-0000-000000000001') where member_id = '20000000-0000-0000-0000-000000000004'),
  'suspended',
  'suspension is immediately visible'
);
select extensions.lives_ok(
  $$ select public.manage_company_member(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000004',
    'reactivate'
  ) $$,
  'owner can reactivate a suspended representative'
);
select extensions.is(
  (select membership_status::text from public.list_company_members('10000000-0000-0000-0000-000000000001') where member_id = '20000000-0000-0000-0000-000000000004'),
  'active',
  'reactivation restores active access'
);
select extensions.ok(
  public.create_company_invitation(
    '10000000-0000-0000-0000-000000000001',
    'revocation.qa@leadpilot.local',
    'sales_representative',
    repeat('e', 64),
    now() + interval '1 day'
  ) is not null,
  'owner creates a second invitation for lifecycle testing'
);
select extensions.lives_ok(
  $$ select public.rotate_company_invitation(
    '10000000-0000-0000-0000-000000000001',
    (select invitation_id from public.list_company_invitations('10000000-0000-0000-0000-000000000001') where email = 'revocation.qa@leadpilot.local'),
    repeat('f', 64),
    now() + interval '2 days'
  ) $$,
  'resend rotates the token hash and expiry'
);
select extensions.lives_ok(
  $$ select public.revoke_company_invitation(
    '10000000-0000-0000-0000-000000000001',
    (select invitation_id from public.list_company_invitations('10000000-0000-0000-0000-000000000001') where email = 'revocation.qa@leadpilot.local')
  ) $$,
  'owner can revoke a pending invitation'
);
select extensions.is(
  (select invitation_status::text from public.list_company_invitations('10000000-0000-0000-0000-000000000001') where email = 'revocation.qa@leadpilot.local'),
  'revoked',
  'revoked invitations are immediately invalid'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  $$ select public.create_company_invitation(
    '10000000-0000-0000-0000-000000000001',
    'another@example.com',
    'sales_representative',
    repeat('a', 64),
    now() + interval '1 day'
  ) $$,
  '42501',
  'invitation action is not permitted',
  'sales manager cannot create invitations'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select extensions.is(
  (select count(*)::integer from public.list_company_members('10000000-0000-0000-0000-000000000001')),
  1,
  'representative sees only their own membership'
);
select extensions.throws_ok(
  $$ select * from public.list_company_invitations('10000000-0000-0000-0000-000000000001') $$,
  '42501',
  'membership action is not permitted',
  'representative cannot view invitations'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select extensions.throws_ok(
  $$ select public.create_company_invitation(
    '10000000-0000-0000-0000-000000000001',
    'owner@example.com',
    'owner',
    repeat('b', 64),
    now() + interval '1 day'
  ) $$,
  '42501',
  'invitation role is not permitted',
  'admin cannot invite an owner'
);

reset role;
insert into public.company_invitations (
  id, company_id, email, role, token_hash, status,
  invited_by_member_id, expires_at, created_at
)
values
  (
    '70000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'invitee.seed@leadpilot.local',
    'sales_representative',
    encode(extensions.digest('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'sha256'), 'hex'),
    'expired',
    '20000000-0000-0000-0000-000000000001',
    now() - interval '1 day',
    now() - interval '2 days'
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'invitee.seed@leadpilot.local',
    'sales_representative',
    encode(extensions.digest('yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy', 'sha256'), 'hex'),
    'revoked',
    '20000000-0000-0000-0000-000000000001',
    now() + interval '1 day',
    now()
  );
select extensions.is(
  (select is_valid from public.inspect_company_invitation('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')),
  true,
  'a valid raw token resolves without exposing its stored hash'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select extensions.throws_ok(
  $$ select public.accept_company_invitation('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') $$,
  '42501',
  'invitation email does not match the authenticated account',
  'a different authenticated email cannot accept'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000008', true);
select extensions.throws_ok(
  $$ select public.accept_company_invitation('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') $$,
  '22023',
  'invitation is invalid or unavailable',
  'an expired invitation cannot be accepted'
);
select extensions.throws_ok(
  $$ select public.accept_company_invitation('yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy') $$,
  '22023',
  'invitation is invalid or unavailable',
  'a revoked invitation cannot be accepted'
);
select extensions.is(
  public.accept_company_invitation('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'the invited account accepts atomically'
);
select extensions.throws_ok(
  $$ select public.accept_company_invitation('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') $$,
  '22023',
  'invitation is invalid or unavailable',
  'an accepted token cannot be reused'
);

reset role;
select extensions.is(
  (select count(*)::integer from public.membership_audit where action = 'invitation_accepted'),
  1,
  'invitation acceptance creates append-only audit history'
);
select extensions.is(
  has_table_privilege('authenticated', 'public.membership_audit', 'update'),
  false,
  'normal authenticated users cannot edit audit history'
);
select extensions.is(
  (select count(*)::integer from public.inspect_company_invitation('malformed')),
  0,
  'malformed invitation tokens reveal no invitation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  $$ select public.manage_company_member(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000004',
    'suspend'
  ) $$,
  '42501',
  'member action is not permitted',
  'manager cannot mutate a membership'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select extensions.throws_ok(
  $$ select public.manage_company_member(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'suspend'
  ) $$,
  '42501',
  'admins cannot manage owners or admins',
  'admin cannot manage an owner'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select extensions.throws_ok(
  $$ select public.manage_company_member(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000005',
    'suspend'
  ) $$,
  'P0002',
  'company member was not found',
  'cross-company member IDs are rejected'
);
select extensions.throws_ok(
  $$ select public.create_company_invitation(
    '10000000-0000-0000-0000-000000000001',
    'ahmed.seed@leadpilot.local',
    'sales_representative',
    repeat('c', 64),
    now() + interval '1 day'
  ) $$,
  '23505',
  'user is already an active company member',
  'an active member cannot be invited again'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', true);
select extensions.is(
  (select count(*)::integer from public.list_my_tenants()),
  0,
  'a suspended member cannot select the tenant'
);

reset role;
select extensions.finish();
rollback;
