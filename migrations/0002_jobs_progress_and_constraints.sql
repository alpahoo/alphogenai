
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  prompt text,
  status text default 'PENDING',
  progress integer default 0,
  output jsonb,
  runpod_job_id text,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.jobs
  add column if not exists progress integer default 0;

create index if not exists idx_jobs_user_id on public.jobs(user_id);
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_jobs_runpod_job_id on public.jobs(runpod_job_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_jobs_updated on public.jobs;
create trigger trg_jobs_updated
  before update on public.jobs
  for each row execute procedure set_updated_at();

alter table public.jobs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'jobs' and policyname = 'Users can view own jobs'
  ) then
    create policy "Users can view own jobs" on public.jobs
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies 
    where tablename = 'jobs' and policyname = 'Users can insert own jobs'
  ) then
    create policy "Users can insert own jobs" on public.jobs
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies 
    where tablename = 'jobs' and policyname = 'Users can update own jobs'
  ) then
    create policy "Users can update own jobs" on public.jobs
      for update using (auth.uid() = user_id);
  end if;
end $$;
