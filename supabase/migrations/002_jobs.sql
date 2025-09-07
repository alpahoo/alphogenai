create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  status text check (status in ('queued','running','done','error')) default 'queued',
  progress int default 0,
  result_r2_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jobs enable row level security;

create policy "Users can view their own jobs"
on public.jobs for select
using (auth.uid() = user_id);

create policy "Users can insert their own jobs"
on public.jobs for insert
with check (auth.uid() = user_id);

create index if not exists idx_jobs_user_id on public.jobs(user_id);
create index if not exists idx_jobs_status on public.jobs(status);
create index if not exists idx_jobs_created_at on public.jobs(created_at desc);
