-- Create enums
create type severity_level as enum ('low', 'medium', 'high', 'critical');
create type scan_status as enum ('pending', 'scanning', 'completed', 'failed');
create type finding_category as enum ('data_exfiltration', 'behavior_mismatch', 'privilege_escalation', 'other');

-- Skills table
create table skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name varchar(255) not null,
  description text,
  content text not null,
  file_path varchar(1024),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Scans table
create table scans (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid references skills on delete cascade not null,
  status scan_status default 'pending' not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone,
  error_message text
);

-- Findings table
create table findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references scans on delete cascade not null,
  skill_id uuid references skills on delete cascade not null,
  category finding_category not null,
  severity severity_level not null,
  title varchar(255) not null,
  description text not null,
  line_number integer,
  code_snippet text,
  confidence float check (confidence >= 0 and confidence <= 1),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes
create index idx_skills_user_id on skills(user_id);
create index idx_scans_skill_id on scans(skill_id);
create index idx_findings_scan_id on findings(scan_id);
create index idx_findings_skill_id on findings(skill_id);
create index idx_findings_severity on findings(severity);
create index idx_findings_category on findings(category);

-- Enable Row Level Security
alter table skills enable row level security;
alter table scans enable row level security;
alter table findings enable row level security;

-- RLS Policies

-- Skills: Users can only see their own skills
create policy "Users can view own skills" on skills
  for select using (auth.uid() = user_id);

create policy "Users can insert own skills" on skills
  for insert with check (auth.uid() = user_id);

create policy "Users can update own skills" on skills
  for update using (auth.uid() = user_id);

create policy "Users can delete own skills" on skills
  for delete using (auth.uid() = user_id);

-- Scans: Users can only see scans for their own skills
create policy "Users can view scans for own skills" on scans
  for select using (
    exists (
      select 1 from skills
      where skills.id = scans.skill_id
      and skills.user_id = auth.uid()
    )
  );

create policy "Users can insert scans for own skills" on scans
  for insert with check (
    exists (
      select 1 from skills
      where skills.id = scans.skill_id
      and skills.user_id = auth.uid()
    )
  );

-- Note: Users should not update scans; scans are system-managed.
-- The system (service role) updates scan status.

-- Findings: Users can only see findings for scans of their own skills
create policy "Users can view findings for own skills" on findings
  for select using (
    exists (
      select 1 from scans
      join skills on skills.id = scans.skill_id
      where scans.id = findings.scan_id
      and skills.user_id = auth.uid()
    )
  );

-- Note: Findings are typically inserted by the system (service role), so we don't need insert policy for users.
-- Users should not be able to update or delete findings as they are analysis results.
