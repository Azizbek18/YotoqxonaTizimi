-- KV-talaba (kvartirada turuvchi) ijara shartnomasi: viza/propiska bilan bir xil
-- muddat nazorati va eslatma tizimi. Uy egasining ismi va telefoni ham saqlanadi.
alter table public.foreign_student_documents
  drop constraint if exists foreign_student_documents_doc_type_check;
alter table public.foreign_student_documents
  add constraint foreign_student_documents_doc_type_check
  check (doc_type in ('visa', 'registration', 'lease'));

alter table public.foreign_student_documents
  add column if not exists landlord_name text,
  add column if not exists landlord_phone text;
