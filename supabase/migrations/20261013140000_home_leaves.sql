-- Talaba uyga (yoki qarindoshinikiga) ketish arizasi. Faol ariza davomida
-- yo'qlamada talaba "Uyda" holatida (excused + source='leave') ko'rinadi.
-- Kirish faqat server (API route) orqali — RLS yoqilgan, siyosat yo'q.
create table if not exists public.home_leaves (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.users(id) on delete cascade,
  destination_kind    text not null check (destination_kind in ('uy', 'qarindosh', 'boshqa')),
  destination_address text not null,
  destination_lat     double precision,
  destination_lng     double precision,
  contact_name        text not null,
  contact_phone       text not null,
  reason              text,
  starts_on           date not null,
  ends_on             date not null,
  -- pending: dekan ko'radi (uzoq muddat / oldingi shubhali holat); active: amalda;
  -- returned/cancelled/rejected: tugagan.
  status              text not null default 'active'
    check (status in ('pending', 'active', 'returned', 'cancelled', 'rejected')),
  consented_at        timestamptz not null default now(),
  -- Ixtiyoriy joylashuv tasdig'i (taxminiy, 2 xona aniqlikda saqlanadi).
  loc_status          text not null default 'none' check (loc_status in ('none', 'near', 'far', 'shared')),
  loc_lat             double precision,
  loc_lng             double precision,
  loc_at              timestamptz,
  -- Xodimning qo'ng'iroq natijasi (aloqa shaxsiga).
  call_result         text not null default 'none' check (call_result in ('none', 'ok', 'no_answer', 'denied')),
  call_by_name        text,
  call_at             timestamptz,
  decided_by          uuid references public.staff(id) on delete set null,
  decided_by_name     text,
  decided_at          timestamptz,
  decision_note       text,
  returned_at         timestamptz,
  created_at          timestamptz not null default now(),
  constraint home_leaves_dates_check check (ends_on >= starts_on)
);

create index if not exists home_leaves_student_idx on public.home_leaves (student_id, created_at desc);
create index if not exists home_leaves_active_idx on public.home_leaves (status, starts_on, ends_on)
  where status in ('pending', 'active');

alter table public.home_leaves enable row level security;
alter table public.home_leaves force row level security;
