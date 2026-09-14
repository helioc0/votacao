const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PORT = Number(process.env.PORT || 3000);
const MANAGER_PIN = process.env.MANAGER_PIN || '4826';
const dataPath = path.join(__dirname, 'votacoes.json');
let clients = [];
let data; try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch { data = { active: null, history: [] }; }
const save = () => fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
function closeExpired() { if (data.active && data.active.endsAt <= Date.now()) { data.history.unshift({ ...data.active, endedAt: data.active.endsAt }); data.active = null; save(); return true; } return false; }
function current() { closeExpired(); return { active: data.active, history: data.history }; }
function voteStats(item) { const values = Object.values(item?.votes || {}); const yes = values.filter(v => v === 'yes').length; return { total: values.length, yes, percent: values.length ? Math.round(yes / values.length * 100) : 0 }; }
function publicState(voterId) { closeExpired(); if (!data.active) return { active: null, history: [] }; const { id, subject, startedAt, endsAt } = data.active; return { active: { id, subject, startedAt, endsAt, metrics: voteStats(data.active), myVote: voterId ? data.active.votes[voterId] || null : null }, history: [] }; }
function send(res, code, item) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(item)); }
function broadcast() { const message = `data: ${JSON.stringify(publicState())}\n\n`; clients = clients.filter(c => !c.destroyed); clients.forEach(c => c.write(message)); }
function readBody(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', c => raw += c); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Pedido inválido')); } }); }); }
function serve(res, name, type) { fs.readFile(path.join(__dirname, name), (err, file) => { if (err) { res.writeHead(404); return res.end('Não encontrado'); } res.writeHead(200, { 'Content-Type': type }); res.end(file); }); }
http.createServer(async (req, res) => { const url = new URL(req.url, `http://${req.headers.host}`); const manager = req.headers['x-manager-pin'] === MANAGER_PIN; try {
  if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, publicState(url.searchParams.get('voterId')));
  if (req.method === 'GET' && url.pathname === '/api/events') { res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.write(`data: ${JSON.stringify(publicState())}\n\n`); clients.push(res); return req.on('close', () => clients = clients.filter(c => c !== res)); }
  if (req.method === 'POST' && url.pathname === '/api/vote') { const { voterId, choice } = await readBody(req); closeExpired(); if (!data.active) return send(res, 409, { error: 'Não existe uma votação ativa.' }); if (!voterId || !['yes', 'no'].includes(choice)) return send(res, 400, { error: 'Voto inválido.' }); data.active.votes[voterId] = choice; save(); broadcast(); return send(res, 200, publicState(voterId)); }
  if (req.method === 'GET' && url.pathname === '/api/manage/state') { if (!manager) return send(res, 401, { error: 'Acesso não autorizado.' }); return send(res, 200, current()); }
  if (req.method === 'POST' && url.pathname === '/api/manage/verify') { if (!manager) return send(res, 401, { error: 'Acesso não autorizado.' }); return send(res, 200, { ok: true }); }
  if (req.method === 'POST' && url.pathname === '/api/manage/start') { if (!manager) return send(res, 401, { error: 'Acesso não autorizado.' }); const { subject, minutes } = await readBody(req); if (!subject?.trim() || !Number.isFinite(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 120) return send(res, 400, { error: 'Dados de votação inválidos.' }); if (data.active) data.history.unshift({ ...data.active, endedAt: Date.now() }); data.active = { id: crypto.randomUUID(), subject: subject.trim(), startedAt: Date.now(), endsAt: Date.now() + Number(minutes) * 60000, votes: {} }; save(); broadcast(); return send(res, 200, current()); }
  if (req.method === 'POST' && url.pathname === '/api/manage/end') { if (!manager) return send(res, 401, { error: 'Acesso não autorizado.' }); if (data.active) { data.history.unshift({ ...data.active, endedAt: Date.now() }); data.active = null; save(); broadcast(); } return send(res, 200, current()); }
  if (req.method === 'GET' && url.pathname === '/') return serve(res, 'index.html', 'text/html; charset=utf-8'); if (req.method === 'GET' && url.pathname === '/style.css') return serve(res, 'style.css', 'text/css; charset=utf-8'); if (req.method === 'GET' && url.pathname === '/script..js') return serve(res, 'script..js', 'application/javascript; charset=utf-8'); res.writeHead(404); res.end('Não encontrado');
} catch (error) { send(res, 500, { error: error.message || 'Erro no servidor.' }); } }).listen(PORT, '0.0.0.0', () => console.log(`Vota disponível em http://localhost:${PORT}`));
setInterval(() => { if (closeExpired()) broadcast(); }, 1000);
