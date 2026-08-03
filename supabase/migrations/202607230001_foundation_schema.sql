create schema if not exists extensions;
create schema if not exists private;

create extension if not exists pgcrypto with schema extensions;

create type public.company_status as enum ('active', 'suspended');
create type public.member_role as enum ('owner', 'admin', 'sales_manager', 'sales_representative');
create type public.membership_status as enum ('invited', 'active', 'suspended', 'removed');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.lead_temperature as enum ('hot', 'warm', 'cold');
create type public.lead_stage as enum (
  'new_inquiry',
  'contacted',
  'qualified',
  'proposal_sent',
  'negotiation',
  'site_visit',
  'converted',
  'lost'
);
create type public.lead_activity_type as enum (
  'created',
  'updated',
  'assignment_changed',
  'stage_changed',
  'note_added',
  'follow_up_scheduled',
  'follow_up_completed',
  'appointment_scheduled',
  'converted'
);
create type public.follow_up_status as enum ('pending', 'completed', 'cancelled');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.appointment_type as enum ('site_visit', 'consultation', 'meeting');
create type public.appointment_status as enum ('pending', 'confirmed', 'completed', 'cancelled');
create type public.notification_type as enum (
  'lead_assigned',
  'follow_up_due',
  'appointment_reminder',
  'invitation',
  'system'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  phone text,
  avatar_url text,
  timezone text not null default 'Asia/Karachi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  business_email text,
  phone text,
  city text,
  address text,
  status public.company_status not null default 'active',
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint companies_slug_key unique (slug)
);

create table public.company_members (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  role public.member_role not null,
  status public.membership_status not null default 'invited',
  invited_by_member_id uuid,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_members_company_user_key unique (company_id, user_id),
  constraint company_members_company_id_id_key unique (company_id, id),
  constraint company_members_active_joined_check check (
    status <> 'active' or joined_at is not null
  ),
  constraint company_members_inviter_fkey foreign key (company_id, invited_by_member_id)
    references public.company_members (company_id, id) on delete restrict
);

create table public.company_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.member_role not null check (role <> 'owner'),
  token_hash text not null unique,
  status public.invitation_status not null default 'pending',
  invited_by_member_id uuid not null,
  expires_at timestamptz not null,
  accepted_by_user_id uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_invitations_expiry_check check (expires_at > created_at),
  constraint company_invitations_acceptance_check check (
    (status = 'accepted' and accepted_by_user_id is not null and accepted_at is not null)
    or
    (status <> 'accepted' and accepted_by_user_id is null and accepted_at is null)
  ),
  constraint company_invitations_inviter_fkey foreign key (company_id, invited_by_member_id)
    references public.company_members (company_id, id) on delete restrict
);

create table public.leads (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_number text not null check (length(btrim(lead_number)) between 1 and 40),
  full_name text not null check (length(btrim(full_name)) between 2 and 160),
  phone text not null check (length(btrim(phone)) between 7 and 30),
  email text,
  service_required text not null check (length(btrim(service_required)) between 2 and 160),
  location text not null check (length(btrim(location)) between 2 and 240),
  property_size text,
  budget_pkr bigint not null default 0 check (budget_pkr >= 0),
  expected_timeline text,
  source text not null check (length(btrim(source)) between 2 and 100),
  assigned_member_id uuid,
  score smallint not null default 0 check (score between 0 and 100),
  temperature public.lead_temperature not null,
  stage public.lead_stage not null default 'new_inquiry',
  notes text,
  converted_at timestamptz,
  created_by_member_id uuid not null,
  updated_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint leads_company_lead_number_key unique (company_id, lead_number),
  constraint leads_company_id_id_key unique (company_id, id),
  constraint leads_conversion_check check (
    (stage = 'converted' and converted_at is not null)
    or
    (stage <> 'converted' and converted_at is null)
  ),
  constraint leads_assigned_member_fkey foreign key (company_id, assigned_member_id)
    references public.company_members (company_id, id) on delete restrict,
  constraint leads_created_by_member_fkey foreign key (company_id, created_by_member_id)
    references public.company_members (company_id, id) on delete restrict,
  constraint leads_updated_by_member_fkey foreign key (company_id, updated_by_member_id)
    references public.company_members (company_id, id) on delete restrict
);

create table public.lead_activities (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_id uuid not null,
  actor_member_id uuid,
  activity_type public.lead_activity_type not null,
  description text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_activities_lead_fkey foreign key (company_id, lead_id)
    references public.leads (company_id, id) on delete cascade,
  constraint lead_activities_actor_fkey foreign key (company_id, actor_member_id)
    references public.company_members (company_id, id) on delete restrict
);

create table public.follow_ups (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_id uuid not null,
  assigned_member_id uuid not null,
  due_at timestamptz not null,
  status public.follow_up_status not null default 'pending',
  priority public.task_priority not null default 'normal',
  notes text,
  completed_at timestamptz,
  completed_by_member_id uuid,
  cancelled_at timestamptz,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint follow_ups_company_id_id_key unique (company_id, id),
  constraint follow_ups_completion_check check (
    (status = 'completed' and completed_at is not null and completed_by_member_id is not null)
    or
    (status <> 'completed' and completed_at is null and completed_by_member_id is null)
  ),
  constraint follow_ups_cancellation_check check (
    (status = 'cancelled' and cancelled_at is not null)
    or
    (status <> 'cancelled' and cancelled_at is null)
  ),
  constraint follow_ups_lead_fkey foreign key (company_id, lead_id)
    references public.leads (company_id, id) on delete cascade,
  constraint follow_ups_assigned_member_fkey foreign key (company_id, assigned_member_id)
    references public.company_members (company_id, id) on delete restrict,
  constraint follow_ups_completed_by_member_fkey foreign key (company_id, completed_by_member_id)
    references public.company_members (company_id, id) on delete restrict,
  constraint follow_ups_created_by_member_fkey foreign key (company_id, created_by_member_id)
    references public.company_members (company_id, id) on delete restrict
);

create table public.appointments (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  lead_id uuid,
  customer_name text not null check (length(btrim(customer_name)) between 2 and 160),
  appointment_type public.appointment_type not null,
  status public.appointment_status not null default 'pending',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  assigned_member_id uuid not null,
  created_by_member_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint appointments_company_id_id_key unique (company_id, id),
  constraint appointments_time_order_check check (ends_at is null or ends_at > starts_at),
  constraint appointments_lead_fkey foreign key (company_id, lead_id)
    references public.leads (company_id, id) on delete restrict,
  constraint appointments_assigned_member_fkey foreign key (company_id, assigned_member_id)
    references public.company_members (company_id, id) on delete restrict,
  constraint appointments_created_by_member_fkey foreign key (company_id, created_by_member_id)
    references public.company_members (company_id, id) on delete restrict
);

create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  recipient_member_id uuid not null,
  notification_type public.notification_type not null,
  title text not null check (length(btrim(title)) between 2 and 160),
  body text not null,
  lead_id uuid,
  follow_up_id uuid,
  appointment_id uuid,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_recipient_fkey foreign key (company_id, recipient_member_id)
    references public.company_members (company_id, id) on delete cascade,
  constraint notifications_lead_fkey foreign key (company_id, lead_id)
    references public.leads (company_id, id) on delete cascade,
  constraint notifications_follow_up_fkey foreign key (company_id, follow_up_id)
    references public.follow_ups (company_id, id) on delete cascade,
  constraint notifications_appointment_fkey foreign key (company_id, appointment_id)
    references public.appointments (company_id, id) on delete cascade
);

create table public.company_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  timezone text not null default 'Asia/Karachi',
  currency text not null default 'PKR' check (currency ~ '^[A-Z]{3}$'),
  services text[] not null default '{}'::text[],
  lead_sources text[] not null default '{}'::text[],
  lead_scoring_rules jsonb not null default '{}'::jsonb check (jsonb_typeof(lead_scoring_rules) = 'object'),
  notification_defaults jsonb not null default '{}'::jsonb check (jsonb_typeof(notification_defaults) = 'object'),
  updated_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_settings_updated_by_member_fkey foreign key (company_id, updated_by_member_id)
    references public.company_members (company_id, id) on delete restrict
);

create index profiles_full_name_idx on public.profiles (full_name);
create index companies_active_slug_idx on public.companies (slug) where deleted_at is null;
create index company_members_user_status_idx on public.company_members (user_id, status);
create index company_members_company_role_status_idx on public.company_members (company_id, role, status);
create index company_invitations_company_status_idx on public.company_invitations (company_id, status, expires_at);
create unique index company_invitations_pending_email_key
  on public.company_invitations (company_id, lower(email))
  where status = 'pending';

create index leads_company_created_idx on public.leads (company_id, created_at desc) where deleted_at is null;
create index leads_company_stage_idx on public.leads (company_id, stage) where deleted_at is null;
create index leads_company_temperature_idx on public.leads (company_id, temperature) where deleted_at is null;
create index leads_company_source_idx on public.leads (company_id, source) where deleted_at is null;
create index leads_company_assigned_idx on public.leads (company_id, assigned_member_id) where deleted_at is null;
create index lead_activities_lead_occurred_idx on public.lead_activities (company_id, lead_id, occurred_at desc);
create index follow_ups_company_due_idx on public.follow_ups (company_id, status, due_at) where deleted_at is null;
create index follow_ups_assignee_due_idx on public.follow_ups (company_id, assigned_member_id, status, due_at)
  where deleted_at is null;
create index follow_ups_lead_idx on public.follow_ups (company_id, lead_id) where deleted_at is null;
create index appointments_company_start_idx on public.appointments (company_id, starts_at) where deleted_at is null;
create index appointments_assignee_start_idx on public.appointments (company_id, assigned_member_id, starts_at)
  where deleted_at is null;
create index appointments_company_status_idx on public.appointments (company_id, status, starts_at)
  where deleted_at is null;
create index appointments_lead_idx on public.appointments (company_id, lead_id) where deleted_at is null;
create index notifications_recipient_unread_idx on public.notifications (company_id, recipient_member_id, created_at desc)
  where read_at is null;

comment on column public.leads.deleted_at is
  'Soft-delete marker. Runtime reads and aggregate queries must explicitly filter deleted_at is null.';
comment on column public.follow_ups.deleted_at is
  'Soft-delete marker. Runtime reads and due-task counts must explicitly filter deleted_at is null.';
comment on column public.appointments.deleted_at is
  'Soft-delete marker. Runtime reads and appointment counts must explicitly filter deleted_at is null.';
