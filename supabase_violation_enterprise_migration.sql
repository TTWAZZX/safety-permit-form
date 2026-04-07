-- Enterprise upgrade for guard_violation.html and admin_guard_violation.html.
-- Safe to run multiple times in Supabase SQL Editor.

create table if not exists public.violation_reports (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    emp_id text not null,
    fullname text not null,
    section text,
    violation_type text not null,
    location_ref text not null,
    action_taken text not null,
    reported_by text default 'Guard Patrol'
);

create table if not exists public.employees_list (
    emp_id text primary key,
    fullname text not null,
    section text default 'ไม่ระบุ',
    created_at timestamptz not null default now(),
    updated_at timestamptz
);

create table if not exists public.violation_case_timeline (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    case_id text not null,
    report_id bigint references public.violation_reports(id) on delete cascade,
    event_type text not null,
    from_status text,
    to_status text,
    actor_role text not null default 'System',
    actor_name text,
    note text,
    event_payload jsonb not null default '{}'::jsonb
);

create table if not exists public.violation_notification_queue (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    processed_at timestamptz,
    case_id text not null,
    report_id bigint references public.violation_reports(id) on delete cascade,
    channel text not null default 'LINE',
    notification_type text not null,
    title text not null,
    message text not null,
    status text not null default 'pending',
    error_message text,
    event_payload jsonb not null default '{}'::jsonb
);

alter table public.violation_reports
    add column if not exists case_id text,
    add column if not exists guard_shift text,
    add column if not exists severity_level text default 'Medium',
    add column if not exists workflow_status text default 'Pending Safety Review',
    add column if not exists review_owner text,
    add column if not exists client_reported_at timestamptz,
    add column if not exists source_page text,
    add column if not exists device_user_agent text,
    add column if not exists gps_latitude numeric(10,7),
    add column if not exists gps_longitude numeric(10,7),
    add column if not exists gps_accuracy_meter numeric,
    add column if not exists sync_status text default 'Online',
    add column if not exists offline_created boolean default false,
    add column if not exists synced_at timestamptz,
    add column if not exists evidence_url text,
    add column if not exists evidence_file_name text,
    add column if not exists evidence_file_size bigint,
    add column if not exists evidence_file_type text,
    add column if not exists evidence_upload_error text,
    add column if not exists repeat_offender boolean default false,
    add column if not exists recent_violation_count_30d integer default 1,
    add column if not exists repeat_window_days integer default 30,
    add column if not exists admin_seen_at timestamptz,
    add column if not exists admin_remark text,
    add column if not exists closed_reason text,
    add column if not exists reviewed_at timestamptz,
    add column if not exists closed_at timestamptz,
    add column if not exists last_status_changed_at timestamptz,
    add column if not exists last_status_changed_by text,
    add column if not exists server_received_at timestamptz not null default now(),
    add column if not exists device_id text,
    add column if not exists device_label text,
    add column if not exists evidence_retention_until timestamptz default (now() + interval '365 days');

alter table public.employees_list
    add column if not exists emp_id text,
    add column if not exists fullname text,
    add column if not exists section text default 'ไม่ระบุ',
    add column if not exists created_at timestamptz not null default now(),
    add column if not exists updated_at timestamptz;

create unique index if not exists violation_reports_case_id_idx
    on public.violation_reports(case_id)
    where case_id is not null;

create index if not exists violation_reports_created_at_idx
    on public.violation_reports(created_at desc);

create index if not exists violation_reports_workflow_status_idx
    on public.violation_reports(workflow_status);

create index if not exists violation_reports_severity_level_idx
    on public.violation_reports(severity_level);

create index if not exists violation_reports_client_reported_at_idx
    on public.violation_reports(client_reported_at desc);

create index if not exists violation_reports_repeat_offender_idx
    on public.violation_reports(repeat_offender)
    where repeat_offender = true;

create unique index if not exists employees_list_emp_id_idx
    on public.employees_list(emp_id);

create index if not exists employees_list_fullname_idx
    on public.employees_list(fullname);

create index if not exists employees_list_section_idx
    on public.employees_list(section);

create index if not exists violation_case_timeline_case_id_idx
    on public.violation_case_timeline(case_id, created_at);

create index if not exists violation_case_timeline_report_id_idx
    on public.violation_case_timeline(report_id, created_at);

create index if not exists violation_reports_device_id_idx
    on public.violation_reports(device_id);

create index if not exists violation_reports_evidence_retention_until_idx
    on public.violation_reports(evidence_retention_until)
    where evidence_url is not null;

create index if not exists violation_notification_queue_status_idx
    on public.violation_notification_queue(status, created_at);

create index if not exists violation_notification_queue_case_id_idx
    on public.violation_notification_queue(case_id);

create or replace function public.apply_violation_repeat_offender()
returns trigger
language plpgsql
as $$
declare
    recent_count integer;
begin
    if new.emp_id is null or new.emp_id in ('MANUAL', 'VISITOR') then
        return new;
    end if;

    select count(*)::integer
    into recent_count
    from public.violation_reports
    where emp_id = new.emp_id
      and created_at >= now() - interval '30 days';

    recent_count := coalesce(recent_count, 0) + 1;
    new.recent_violation_count_30d := greatest(coalesce(new.recent_violation_count_30d, 1), recent_count);
    new.repeat_window_days := coalesce(new.repeat_window_days, 30);

    if recent_count >= 2 then
        new.repeat_offender := true;
        new.workflow_status := 'Repeat Offender Review';
        new.review_owner := 'Safety Manager';
        if coalesce(new.severity_level, 'Medium') = 'Medium' then
            new.severity_level := 'High';
        end if;
    else
        new.repeat_offender := coalesce(new.repeat_offender, false);
        new.workflow_status := coalesce(new.workflow_status, 'Pending Safety Review');
        new.review_owner := coalesce(new.review_owner, 'Safety Officer');
    end if;

    return new;
end;
$$;

drop trigger if exists violation_repeat_offender_before_insert
    on public.violation_reports;

create trigger violation_repeat_offender_before_insert
before insert on public.violation_reports
for each row
execute function public.apply_violation_repeat_offender();

alter table public.violation_reports enable row level security;
alter table public.employees_list enable row level security;
alter table public.violation_case_timeline enable row level security;
alter table public.violation_notification_queue enable row level security;

do $$
begin
    alter publication supabase_realtime add table public.violation_reports;
exception
    when duplicate_object then null;
    when undefined_object then null;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'violation_reports'
          and policyname = 'guard violation public insert'
    ) then
        create policy "guard violation public insert"
        on public.violation_reports
        for insert
        to anon, authenticated
        with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'violation_reports'
          and policyname = 'guard violation admin read'
    ) then
        create policy "guard violation admin read"
        on public.violation_reports
        for select
        to anon, authenticated
        using (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'violation_reports'
          and policyname = 'guard violation admin update'
    ) then
        create policy "guard violation admin update"
        on public.violation_reports
        for update
        to anon, authenticated
        using (true)
        with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'employees_list'
          and policyname = 'employees list public read'
    ) then
        create policy "employees list public read"
        on public.employees_list
        for select
        to anon, authenticated
        using (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'employees_list'
          and policyname = 'employees list admin insert'
    ) then
        create policy "employees list admin insert"
        on public.employees_list
        for insert
        to anon, authenticated
        with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'employees_list'
          and policyname = 'employees list admin update'
    ) then
        create policy "employees list admin update"
        on public.employees_list
        for update
        to anon, authenticated
        using (true)
        with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'violation_case_timeline'
          and policyname = 'violation timeline public read'
    ) then
        create policy "violation timeline public read"
        on public.violation_case_timeline
        for select
        to anon, authenticated
        using (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'violation_case_timeline'
          and policyname = 'violation timeline public insert'
    ) then
        create policy "violation timeline public insert"
        on public.violation_case_timeline
        for insert
        to anon, authenticated
        with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'violation_notification_queue'
          and policyname = 'violation notification public insert'
    ) then
        create policy "violation notification public insert"
        on public.violation_notification_queue
        for insert
        to anon, authenticated
        with check (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'violation_notification_queue'
          and policyname = 'violation notification admin read'
    ) then
        create policy "violation notification admin read"
        on public.violation_notification_queue
        for select
        to anon, authenticated
        using (true);
    end if;
end $$;

-- Enterprise hardening notes:
-- 1) Supabase Auth/LINE LIFF: Replace broad anon policies with role-based policies for Guard/Admin/HR before public rollout.
-- 2) LINE/Push: Process public.violation_notification_queue from an Edge Function or backend only. Do not put LINE tokens in frontend HTML.
-- 3) Retention: evidence_retention_until defaults to 365 days. Use a scheduled backend job to delete expired storage objects and mask old rows if required by company policy.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'violation-evidence',
    'violation-evidence',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'violation evidence public read'
    ) then
        create policy "violation evidence public read"
        on storage.objects
        for select
        to anon, authenticated
        using (bucket_id = 'violation-evidence');
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'violation evidence public upload'
    ) then
        create policy "violation evidence public upload"
        on storage.objects
        for insert
        to anon, authenticated
        with check (bucket_id = 'violation-evidence');
    end if;
end $$;
