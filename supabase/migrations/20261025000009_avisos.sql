-- =============================================================================
-- Aula Virtual · 9. Avisos del profesor por sección
-- =============================================================================
-- El profesor publica avisos breves en una sección; solo los estudiantes matriculados en ella los ven.
-- Migración ADITIVA.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  body text not null default '' check (char_length(body) <= 4000),
  pinned boolean not null default false,
  visible_until timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists announcements_class_idx on public.announcements (class_id, created_at desc);
alter table public.announcements enable row level security;

create trigger announcements_created_by before insert on public.announcements for each row execute function public.set_created_by();

create policy announcements_select on public.announcements for select to authenticated
  using (public.is_class_teacher(class_id) or public.is_enrolled_class(class_id));
create policy announcements_write on public.announcements for all to authenticated
  using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
grant select, insert, update, delete on public.announcements to authenticated;

-- Avisos vigentes para el estudiante (todas sus secciones), los fijados primero
create or replace function public.my_announcements()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'class_id', c.id, 'class_name', c.name, 'course_title', co.title,
      'title', a.title, 'body', a.body, 'pinned', a.pinned, 'created_at', a.created_at,
      'author', (select p.full_name from public.profiles p where p.id = a.created_by)
    ) order by a.pinned desc, a.created_at desc), '[]'::jsonb)
  from public.announcements a
  join public.classes c on c.id = a.class_id
  join public.courses co on co.id = c.course_id
  where public.is_enrolled_class(a.class_id)
    and (a.visible_until is null or a.visible_until > now())
    and a.created_at > now() - interval '120 days'
$$;

revoke execute on function public.my_announcements() from public, anon;
grant execute on function public.my_announcements() to authenticated;
