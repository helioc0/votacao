import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-manager-pin', 'Content-Type': 'application/json' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Método inválido.' }, 405);
  if (request.headers.get('x-manager-pin') !== Deno.env.get('MANAGER_PIN')) return reply({ error: 'Acesso não autorizado.' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { action, subject, minutes } = await request.json();
  if (action === 'verify') return reply({ ok: true });
  if (action === 'start') {
    if (!String(subject || '').trim() || !Number.isFinite(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 120) return reply({ error: 'Dados de votação inválidos.' }, 400);
    await admin.from('voting_sessions').update({ ended_at: new Date().toISOString() }).is('ended_at', null);
    const { error } = await admin.from('voting_sessions').insert({ subject: String(subject).trim(), ends_at: new Date(Date.now() + Number(minutes) * 60000).toISOString() });
    if (error) return reply({ error: error.message }, 500);
  } else if (action === 'end') {
    const { error } = await admin.from('voting_sessions').update({ ended_at: new Date().toISOString() }).is('ended_at', null);
    if (error) return reply({ error: error.message }, 500);
  } else if (action !== 'state') return reply({ error: 'Ação inválida.' }, 400);
  const { data: sessions, error } = await admin.from('voting_sessions').select('*').order('started_at', { ascending: false });
  if (error) return reply({ error: error.message }, 500);
  const ids = sessions.map(s => s.id); const { data: votes } = ids.length ? await admin.from('votes').select('session_id,voter_id,choice').in('session_id', ids) : { data: [] };
  const result = sessions.map(s => ({ id: s.id, subject: s.subject, startedAt: new Date(s.started_at).getTime(), endsAt: new Date(s.ends_at).getTime(), endedAt: s.ended_at ? new Date(s.ended_at).getTime() : null, votes: Object.fromEntries((votes || []).filter(v => v.session_id === s.id).map(v => [v.voter_id, v.choice])) }));
  return reply({ active: result.find(s => !s.endedAt && s.endsAt > Date.now()) || null, history: result.filter(s => s.endedAt || s.endsAt <= Date.now()) });
});
