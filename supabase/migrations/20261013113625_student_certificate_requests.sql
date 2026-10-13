-- Kvartirada turuvchi (KV) talaba "talabalik ma'lumotnomasi" so'raydi
-- (ijara, migratsiya, bank uchun); fakultet dekani tasdiqlaydi yoki rad etadi.
-- Kirish faqat server (API route + guard) orqali — RLS yoqilgan, siyosat yo'q.
create table if not exists public.student_certificate_requests (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.users(id) on delete cascade,
  purpose       text not null check (purpose in ('ijara', 'migratsiya', 'bank', 'boshqa')),
  purpose_note  text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  number        text,
  decided_by    uuid references public.staff(id) on delete set null,
  decided_by_name text,
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now()
);

create index if not exists student_certificate_requests_student_idx
  on public.student_certificate_requests (student_id, created_at desc);
create index if not exists student_certificate_requests_status_idx
  on public.student_certificate_requests (status, created_at desc);

alter table public.student_certificate_requests enable row level security;
alter table public.student_certificate_requests force row level security;
