-- =====================================================================
--  ระบบเรียนรู้การออกเสียงด้วย AI — สคริปต์สร้างฐานข้อมูล (Supabase / PostgreSQL)
--  รันใน Supabase: Dashboard > SQL Editor > วางทั้งไฟล์ > Run
--
--  ประกอบด้วย
--    1) ตาราง: role, words, practice, activity
--    2) ฟังก์ชันช่วย is_specialist()
--    3) เปิด Row Level Security + policy สำหรับ SELECT/INSERT/UPDATE/DELETE ทุกตาราง
--    4) Storage bucket "recordings" + policy
--
--  หมายเหตุ: การยืนยันตัวตนผูกกับ auth.users (อีเมล) โดยไม่ต้องยืนยันอีเมล
--           (ตั้งค่าที่ Authentication > Providers > Email > ปิด "Confirm email")
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ตาราง role : สิทธิ์ผู้ใช้ (user = ผู้ฝึกออกเสียง, specialist = ผู้เชี่ยวชาญ)
-- ---------------------------------------------------------------------
create table if not exists public.role (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text,
  role        text not null default 'user' check (role in ('user','specialist')),
  description text,
  created_at  timestamptz not null default now(),
  unique (user_id)
);

-- ---------------------------------------------------------------------
-- 2) ตาราง words : คลังคำฝึกออกเสียง แบ่งตามตัวอักษรและช่วงอายุ
--    exercise_code = รหัสแบบฝึกหัด เช่น EX-4-ก (อายุ 4 ปี หมวด ก)
-- ---------------------------------------------------------------------
create table if not exists public.words (
  id            uuid primary key default gen_random_uuid(),
  exercise_code text not null,                 -- รหัสแบบฝึกหัด
  word          text not null,                 -- คำฝึกออกเสียง
  reading       text,                          -- คำอ่าน
  letter        text not null,                 -- หมวดตัวอักษร (ก..ฮ)
  letter_name   text,                          -- ชื่อหมวด เช่น "ก ไก่"
  age_level     int  not null check (age_level between 4 and 7),  -- ระดับอายุ
  emoji         text,                          -- อิโมจิประกอบคำ
  order_index   int  default 0,                -- ลำดับคำในแบบฝึกหัด
  created_at    timestamptz not null default now()
);
create index if not exists idx_words_age      on public.words(age_level);
create index if not exists idx_words_exercise on public.words(exercise_code);

-- ---------------------------------------------------------------------
-- 3) ตาราง practice : บันทึกการฝึกออกเสียงของผู้ใช้
-- ---------------------------------------------------------------------
create table if not exists public.practice (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,  -- ผู้ฝึก
  word_id       uuid references public.words(id) on delete set null,        -- FK -> words
  word_text     text,                          -- สำเนาคำ (เผื่อคำถูกลบภายหลัง)
  exercise_code text,                          -- รหัสแบบฝึกหัด
  file_path     text,                          -- path ไฟล์เสียงใน storage
  score         int check (score between 0 and 100),  -- คะแนนจากผู้เชี่ยวชาญ
  scored_by     uuid references auth.users(id),       -- ผู้ให้คะแนน
  scored_at     timestamptz,                          -- เวลาให้คะแนน
  practiced_at  timestamptz not null default now(),   -- วันเวลาที่ฝึก
  created_at    timestamptz not null default now()
);
create index if not exists idx_practice_user on public.practice(user_id);
create index if not exists idx_practice_word on public.practice(word_id);

-- ---------------------------------------------------------------------
-- 4) ตาราง activity : log กิจกรรมผู้ใช้ (login/logout/page)
-- ---------------------------------------------------------------------
create table if not exists public.activity (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  activity   jsonb not null,                   -- { "type":"login|logout|page", "page":"app.html" }
  created_at timestamptz not null default now()  -- วันเวลาของกิจกรรม
);
create index if not exists idx_activity_user on public.activity(user_id);

-- =====================================================================
--  ฟังก์ชันช่วย: ตรวจว่าผู้ใช้ปัจจุบันเป็น specialist หรือไม่
--  ใช้ SECURITY DEFINER เพื่อข้าม RLS ของตาราง role (กัน recursion)
-- =====================================================================
create or replace function public.is_specialist()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.role r
    where r.user_id = auth.uid() and r.role = 'specialist'
  );
$$;

-- =====================================================================
--  เปิด Row Level Security ทุกตาราง
-- =====================================================================
alter table public.role     enable row level security;
alter table public.words    enable row level security;
alter table public.practice enable row level security;
alter table public.activity enable row level security;

-- ---------------------------------------------------------------------
--  POLICY: role
-- ---------------------------------------------------------------------
drop policy if exists role_select on public.role;
create policy role_select on public.role for select
  using (user_id = auth.uid() or public.is_specialist());

drop policy if exists role_insert on public.role;
create policy role_insert on public.role for insert
  with check (user_id = auth.uid());

drop policy if exists role_update on public.role;
create policy role_update on public.role for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists role_delete on public.role;
create policy role_delete on public.role for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
--  POLICY: words  (ทุกคนอ่านได้ / เฉพาะ specialist แก้ไขได้)
-- ---------------------------------------------------------------------
drop policy if exists words_select on public.words;
create policy words_select on public.words for select
  using (true);

drop policy if exists words_insert on public.words;
create policy words_insert on public.words for insert
  with check (public.is_specialist());

drop policy if exists words_update on public.words;
create policy words_update on public.words for update
  using (public.is_specialist())
  with check (public.is_specialist());

drop policy if exists words_delete on public.words;
create policy words_delete on public.words for delete
  using (public.is_specialist());

-- ---------------------------------------------------------------------
--  POLICY: practice  (เจ้าของเห็น/แก้ของตน, specialist เห็น/ให้คะแนนได้ทุกคน)
-- ---------------------------------------------------------------------
drop policy if exists practice_select on public.practice;
create policy practice_select on public.practice for select
  using (user_id = auth.uid() or public.is_specialist());

drop policy if exists practice_insert on public.practice;
create policy practice_insert on public.practice for insert
  with check (user_id = auth.uid());

drop policy if exists practice_update on public.practice;
create policy practice_update on public.practice for update
  using (user_id = auth.uid() or public.is_specialist())
  with check (user_id = auth.uid() or public.is_specialist());

drop policy if exists practice_delete on public.practice;
create policy practice_delete on public.practice for delete
  using (user_id = auth.uid() or public.is_specialist());

-- ---------------------------------------------------------------------
--  POLICY: activity  (เจ้าของและ specialist อ่านได้, เจ้าของเขียน log ตัวเอง)
-- ---------------------------------------------------------------------
drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity for select
  using (user_id = auth.uid() or public.is_specialist());

drop policy if exists activity_insert on public.activity;
create policy activity_insert on public.activity for insert
  with check (user_id = auth.uid());

drop policy if exists activity_update on public.activity;
create policy activity_update on public.activity for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists activity_delete on public.activity;
create policy activity_delete on public.activity for delete
  using (user_id = auth.uid() or public.is_specialist());

-- =====================================================================
--  STORAGE: bucket "recordings" สำหรับไฟล์เสียง (private)
--  โครงสร้าง path: <user_id>/<word>-<timestamp>.webm
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

-- ผู้ใช้อัปโหลดไฟล์ในโฟลเดอร์ของตัวเองได้
drop policy if exists rec_insert on storage.objects;
create policy rec_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- เจ้าของอ่านไฟล์ตัวเอง / specialist อ่านได้ทุกไฟล์ (เพื่อให้คะแนน)
drop policy if exists rec_select on storage.objects;
create policy rec_select on storage.objects for select to authenticated
  using (
    bucket_id = 'recordings'
    and ( auth.uid()::text = (storage.foldername(name))[1] or public.is_specialist() )
  );

-- เจ้าของอัปเดต/ลบไฟล์ตัวเอง
drop policy if exists rec_update on storage.objects;
create policy rec_update on storage.objects for update to authenticated
  using (bucket_id = 'recordings' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists rec_delete on storage.objects;
create policy rec_delete on storage.objects for delete to authenticated
  using (bucket_id = 'recordings' and auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================================
--  เสร็จสิ้น — ขั้นตอนถัดไป: import db/data.csv เข้าตาราง words
--  (Table Editor > words > Import data > เลือก data.csv)
-- =====================================================================
