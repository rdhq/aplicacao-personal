-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text,
  role text not null default 'personal' check (role in ('admin', 'personal')),
  avatar_url text,
  phone text,
  cref text,
  specialty text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Enable Row Level Security
alter table public.profiles enable row level security;

-- 3. Policies: users can read all profiles, but only edit their own
create policy "Anyone can view profiles"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 4. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'personal'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. After running this SQL, create the admin user:
-- Go to Authentication > Users > Add user
-- Email: zilmar@teamzq.com / Password: (your choice)
-- Then run this to make them admin:
-- UPDATE public.profiles SET role = 'admin', name = 'Zilmar Quadros' WHERE email = 'zilmar@teamzq.com';
