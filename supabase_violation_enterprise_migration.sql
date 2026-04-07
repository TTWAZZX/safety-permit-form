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
    add column if not exists repeat_window_days integer default 30;

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

alter table public.violation_reports enable row level security;
alter table public.employees_list enable row level security;

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
end $$;

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
