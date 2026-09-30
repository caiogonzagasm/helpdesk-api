'use strict';
const $ = (id) => document.getElementById(id);
const state = { all: [], filtered: [], ticket: null, messages: [], listVersion: 0, detailVersion: 0, detailBusy: false };
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const statusClass = { 'Aberto': 'status-open', 'Em andamento': 'status-progress', 'Fechado': 'status-closed' };
const priorityClass = { 'Baixa': 'priority-low', 'Média': 'priority-medium', 'Alta': 'priority-high' };
const badge = (value, classes) => `<span class="badge ${classes[value] || ''}">${escapeHTML(value)}</span>`;
const number = (id) => `#${String(id).padStart(4, '0')}`;
function date(value, withTime = false) {
  if (!value) return 'Data não informada';
  // SQLite CURRENT_TIMESTAMP is UTC, without a timezone suffix.
  const parsed = new Date(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value) ? value.replace(' ', 'T') + 'Z' : value);
  if (Number.isNaN(parsed.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', withTime ? { dateStyle: 'short', timeStyle: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}
function errorAt(id, message = '') { $(id).textContent = message; $(id).hidden = !message; }
let toastTimer;
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500); }
async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...options.headers } });
    if (response.status === 204) return null;
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || `Não foi possível concluir a operação (${response.status}).`);
    if (body === null) throw new Error('A API retornou uma resposta inesperada.');
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('A conexão demorou demais. Atualize os dados antes de tentar novamente.');
    if (error instanceof TypeError) throw new Error('Não foi possível conectar à API. Verifique se o servidor está em execução e tente novamente.');
    throw error;
  } finally { clearTimeout(timer); }
}
function hasFilters() { return Boolean($('filter-status').value || $('filter-priority').value || $('search').value.trim()); }
function renderList() {
  const term = $('search').value.trim().toLocaleLowerCase('pt-BR');
  const items = state.filtered.filter(t => `${number(t.id)} ${t.titulo} ${t.descricao}`.toLocaleLowerCase('pt-BR').includes(term)).sort((a, b) => b.id - a.id);
  $('clear-filters').hidden = !hasFilters();
  $('result-count').textContent = items.length;
  $('list-summary').textContent = `${items.length} ${items.length === 1 ? 'chamado exibido' : 'chamados exibidos'} de ${state.all.length}`;
  $('empty-state').hidden = items.length > 0;
  $('table-wrap').hidden = !items.length;
  $('empty-title').textContent = hasFilters() ? 'Nenhum chamado encontrado' : 'Nenhum chamado cadastrado';
  $('empty-description').textContent = hasFilters() ? 'Experimente outro termo ou limpe os filtros para ver todos os chamados.' : 'Use Novo chamado para registrar uma solicitação.';
  $('empty-action').textContent = hasFilters() ? 'Limpar filtros' : 'Novo chamado';
  $('ticket-list').innerHTML = items.map(t => `<tr><td><button class="ticket-link" data-ticket="${Number(t.id)}" aria-label="Abrir chamado ${number(t.id)}: ${escapeHTML(t.titulo)}"><strong>${escapeHTML(t.titulo)}</strong><span class="ticket-meta"><span class="ticket-id">${number(t.id)}</span><span class="excerpt">${escapeHTML(t.descricao)}</span></span></button></td><td>${badge(t.status, statusClass)}</td><td>${badge(t.prioridade, priorityClass)}</td><td class="date">${date(t.criado_em)}</td></tr>`).join('');
}
async function loadList() {
  const version = ++state.listVersion;
  errorAt('list-error'); $('list-loading').hidden = false; $('table-wrap').hidden = true; $('empty-state').hidden = true; $('refresh').disabled = true;
  const params = new URLSearchParams();
  if ($('filter-status').value) params.set('status', $('filter-status').value);
  if ($('filter-priority').value) params.set('prioridade', $('filter-priority').value);
  try {
    const [all, filtered] = await Promise.all([api('/chamados'), params.size ? api(`/chamados?${params}`) : Promise.resolve(null)]);
    if (version !== state.listVersion) return;
    if (!Array.isArray(all) || (filtered && !Array.isArray(filtered))) throw new Error('A lista recebida da API é inválida.');
    state.all = all; state.filtered = filtered || all;
    $('total-count').textContent = all.length;
    for (const [id, status] of [['open-count', 'Aberto'], ['progress-count', 'Em andamento'], ['closed-count', 'Fechado']]) $(id).textContent = all.filter(t => t.status === status).length;
    $('connection').className = 'connection online'; $('connection').textContent = 'Conectado';
    renderList();
  } catch (error) {
    if (version !== state.listVersion) return;
    errorAt('list-error', error.message + ' Use Atualizar para tentar novamente.');
    $('list-summary').textContent = 'Não foi possível atualizar a lista';
    $('connection').className = 'connection offline'; $('connection').textContent = 'Sem conexão';
  } finally { if (version === state.listVersion) { $('list-loading').hidden = true; $('refresh').disabled = false; } }
}
function clearFilters() { $('search').value = ''; $('filter-status').value = ''; $('filter-priority').value = ''; loadList(); }
function openCreate() { $('create-form').reset(); errorAt('create-error'); $('create-dialog').showModal(); }
function busyForm(form, busy) { for (const element of form.elements) element.disabled = busy; }
function setDetailBusy(busy) {
  state.detailBusy = busy;
  $('detail-status').disabled = busy; $('delete-ticket').disabled = busy;
  busyForm($('message-form'), busy);
  document.querySelector('[data-close="detail-dialog"]').disabled = busy;
}
function renderTicket() {
  const t = state.ticket;
  $('detail-number').textContent = `CHAMADO ${number(t.id)}`;
  $('detail-title').textContent = t.titulo;
  $('detail-description').textContent = t.descricao;
  $('detail-date').textContent = `Criado em ${date(t.criado_em, true)}`;
  $('detail-badges').innerHTML = badge(t.status, statusClass) + badge(t.prioridade, priorityClass);
  $('detail-status').value = t.status;
}
function renderMessages() {
  let author = $('message-author').value.trim();
  $('message-count').textContent = state.messages.length;
  $('messages').innerHTML = state.messages.length ? state.messages.map(m => `<article class="message${m.autor === author ? ' mine' : ''}"><div class="message-header"><strong>${escapeHTML(m.autor)}</strong><time>${date(m.criado_em, true)}</time></div><p class="message-body">${escapeHTML(m.mensagem)}</p></article>`).join('') : '<p class="messages-empty">Nenhuma mensagem neste chamado.</p>';
}
async function openDetail(id) {
  const version = ++state.detailVersion;
  state.ticket = null; state.messages = [];
  $('detail-content').hidden = true; $('detail-loading').hidden = false;
  $('detail-title').textContent = 'Detalhes do chamado';
  $('detail-number').textContent = `CHAMADO ${number(id)}`;
  for (const key of ['detail-load-error', 'detail-action-error', 'message-error']) errorAt(key);
  $('message-form').reset();
  try { $('message-author').value = localStorage.getItem('helpdesk-author') || ''; } catch { /* Storage is optional. */ }
  if (!$('detail-dialog').open) $('detail-dialog').showModal();
  try {
    const [ticket, messages] = await Promise.all([api(`/chamados/${id}`), api(`/chamados/${id}/mensagens`)]);
    if (version !== state.detailVersion) return;
    state.ticket = ticket; state.messages = messages;
    renderTicket(); renderMessages(); $('detail-content').hidden = false;
  } catch (error) { if (version === state.detailVersion) errorAt('detail-load-error', error.message + ' Feche e abra o chamado para tentar novamente.'); }
  finally { if (version === state.detailVersion) $('detail-loading').hidden = true; }
}
$('new-ticket').addEventListener('click', openCreate);
$('empty-action').addEventListener('click', () => hasFilters() ? clearFilters() : openCreate());
$('refresh').addEventListener('click', loadList);
$('clear-filters').addEventListener('click', clearFilters);
$('filter-status').addEventListener('change', loadList);
$('filter-priority').addEventListener('change', loadList);
$('search').addEventListener('input', () => { if ($('list-loading').hidden && $('list-error').hidden) renderList(); });
$('ticket-list').addEventListener('click', e => { const button = e.target.closest('[data-ticket]'); if (button) openDetail(Number(button.dataset.ticket)); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
$('detail-dialog').addEventListener('close', () => { state.detailVersion++; state.ticket = null; });
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('cancel', e => { if ((dialog.id === 'detail-dialog' && state.detailBusy) || dialog.querySelector('button[type="submit"]:disabled') || (dialog.id === 'delete-dialog' && $('confirm-delete').disabled)) e.preventDefault(); }));
$('create-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  values.titulo = values.titulo.trim(); values.descricao = values.descricao.trim();
  if (!values.titulo || !values.descricao) return errorAt('create-error', 'Preencha o título e a descrição com algum texto.');
  errorAt('create-error'); busyForm(form, true); document.querySelector('[aria-label="Fechar criação"]').disabled = true;
  try {
    const ticket = await api('/chamados', { method: 'POST', body: JSON.stringify(values) });
    $('create-dialog').close(); $('search').value = ''; $('filter-status').value = ''; $('filter-priority').value = '';
    toast('Chamado criado com sucesso.'); loadList(); await openDetail(ticket.id);
  } catch (error) { errorAt('create-error', error.message); }
  finally { busyForm(form, false); document.querySelector('[aria-label="Fechar criação"]').disabled = false; }
});
$('detail-status').addEventListener('change', async () => {
  if (!state.ticket || state.detailBusy) return;
  const previous = state.ticket.status;
  const status = $('detail-status').value;
  setDetailBusy(true); errorAt('detail-action-error');
  try { state.ticket = await api(`/chamados/${state.ticket.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); renderTicket(); toast('Status atualizado.'); loadList(); }
  catch (error) { $('detail-status').value = previous; errorAt('detail-action-error', error.message); }
  finally { setDetailBusy(false); }
});
$('reply-button').addEventListener('click', () => { $('message-text').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); $('message-text').focus({ preventScroll: true }); });
$('message-author').addEventListener('change', renderMessages);
$('message-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (!state.ticket || state.detailBusy) return;
  const autor = $('message-author').value.trim(), mensagem = $('message-text').value.trim();
  if (!autor || !mensagem) return errorAt('message-error', 'Informe seu nome e escreva uma mensagem.');
  setDetailBusy(true); errorAt('message-error');
  try {
    const message = await api(`/chamados/${state.ticket.id}/mensagens`, { method: 'POST', body: JSON.stringify({ autor, mensagem }) });
    state.messages.push(message); $('message-text').value = ''; $('message-author').value = autor;
    try { localStorage.setItem('helpdesk-author', autor); } catch { /* Storage is optional. */ }
    renderMessages(); $('messages').lastElementChild?.scrollIntoView({ block: 'nearest' }); toast('Mensagem enviada.');
  } catch (error) { errorAt('message-error', error.message); }
  finally { setDetailBusy(false); $('message-text').focus({ preventScroll: true }); }
});
$('delete-ticket').addEventListener('click', () => {
  if (!state.ticket) return;
  errorAt('delete-error'); $('delete-description').textContent = `O chamado ${number(state.ticket.id)} será removido da central. Esta ação não pode ser desfeita.`;
  $('delete-dialog').showModal();
});
$('confirm-delete').addEventListener('click', async () => {
  if (!state.ticket || state.detailBusy) return;
  setDetailBusy(true); $('confirm-delete').disabled = true; document.querySelector('[data-close="delete-dialog"]').disabled = true; errorAt('delete-error');
  try { await api(`/chamados/${state.ticket.id}`, { method: 'DELETE' }); $('delete-dialog').close(); $('detail-dialog').close(); toast('Chamado excluído.'); loadList(); }
  catch (error) { errorAt('delete-error', error.message); }
  finally { setDetailBusy(false); $('confirm-delete').disabled = false; document.querySelector('[data-close="delete-dialog"]').disabled = false; }
});
loadList();
