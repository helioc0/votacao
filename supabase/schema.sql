-- Execute este ficheiro no SQL Editor do seu projeto Supabase.
create table if not exists public.voting_sessions (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(trim(subject)) between 1 and 80),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  session_id uuid not null references public.voting_sessions(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  choice text not null check (choice in ('yes', 'no')),
  updated_at timestamptz not null default now(),
  primary key (session_id, voter_id)
);

alter table public.voting_sessions enable row level security;
alter table public.votes enable row level security;
revoke all on public.voting_sessions, public.votes from anon, authenticated;

-- A área pública recebe apenas a votação ativa e os totais, nunca a lista de votos.
create or replace function public.public_voting_state()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'id', s.id, 'subject', s.subject, 'startedAt', s.started_at,
      'endsAt', s.ends_at,
      'myVote', (select v.choice from public.votes v where v.session_id = s.id and v.voter_id = auth.uid()),
      'metrics', jsonb_build_object(
        'total', (select count(*) from public.votes v where v.session_id = s.id),
        'yes', (select count(*) from public.votes v where v.session_id = s.id and v.choice = 'yes')
      )
    )
    from public.voting_sessions s
    where s.ended_at is null and s.ends_at > now()
    order by s.started_at desc limit 1
  ), '{}'::jsonb);
$$;

create or replace function public.cast_vote(target_session uuid, selected_choice text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'É necessário identificar o votante.'; end if;
  if selected_choice not in ('yes', 'no') then raise exception 'Voto inválido.'; end if;
  if not exists (select 1 from public.voting_sessions where id = target_session and ended_at is null and ends_at > now()) then
    raise exception 'Esta votação já terminou.';
  end if;
  insert into public.votes (session_id, voter_id, choice) values (target_session, auth.uid(), selected_choice)
  on conflict (session_id, voter_id) do update set choice = excluded.choice, updated_at = now();
  return public.public_voting_state();
end;
$$;

grant execute on function public.public_voting_state(), public.cast_vote(uuid, text) to authenticated;
