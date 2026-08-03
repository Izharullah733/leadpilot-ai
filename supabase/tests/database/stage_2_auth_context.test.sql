begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(5);

select extensions.is(
  has_function_privilege('anon', 'public.get_my_auth_context()', 'execute'),
  false,
  'anonymous users cannot execute the auth-context resolver'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select extensions.is(
  (select concat(role, '|', membership_status, '|', company_name) from public.get_my_auth_context()),
  'owner|active|Prime Build & Properties',
  'owner auth context resolves from database membership'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select extensions.is(
  (select concat(role, '|', membership_status, '|', company_name) from public.get_my_auth_context()),
  'sales_representative|active|Prime Build & Properties',
  'representative auth context resolves from database membership'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', true);
select extensions.is(
  (select membership_status::text from public.get_my_auth_context()),
  null,
  'a user without membership resolves no membership'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', true);
select extensions.is(
  (select membership_status::text from public.get_my_auth_context()),
  'suspended',
  'a suspended membership remains suspended in auth context'
);

reset role;

select extensions.finish();

rollback;
