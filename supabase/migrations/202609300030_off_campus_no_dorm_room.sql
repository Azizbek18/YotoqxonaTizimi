-- KV-talaba (is_off_campus) hech qachon yotoqxona xonasiga ega bo'lmasligi kerak.
-- Ilova kodi allaqachon ularni joylashtirish ro'yxatidan chiqaradi va serverda
-- rad etadi; bu trigger har qanday boshqa yo'l (SQL, RPC, skript) uchun ham
-- bazada to'siq qo'yadi. Xonasi yo'q KV-talabalarga ta'sir qilmaydi.
create or replace function public.users_block_off_campus_room()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'talaba'
     and new.is_off_campus is true
     and (new.room_number is not null or new.dorm_id is not null) then
    raise exception 'Off-campus (KV) student cannot be placed in a dorm room'
      using errcode = 'P0008';
  end if;
  return new;
end;
$$;

drop trigger if exists users_block_off_campus_room on public.users;
create trigger users_block_off_campus_room
  before insert or update of room_number, dorm_id, is_off_campus on public.users
  for each row execute function public.users_block_off_campus_room();
