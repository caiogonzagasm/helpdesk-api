'use strict';

const $ = (id) => document.getElementById(id);

const TOKEN_KEY = 'helpdesk-token';

const state = {
  token: null,
  user: null,
  all: [],
  filtered: [],
  ticket: null,
  messages: [],
  listVersion: 0,
  detailVersion: 0,
  detailBusy: false
};


const escapeHTML = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );


const statusClass = {
  'Aberto': 'status-open',
  'Em andamento': 'status-progress',
  'Fechado': 'status-closed'
};


const priorityClass = {
  'Baixa': 'priority-low',
  'Média': 'priority-medium',
  'Alta': 'priority-high'
};


const badge = (value, classes) =>
  `<span class="badge ${classes[value] || ''}">
    ${escapeHTML(value)}
  </span>`;


const number = (id) =>
  `#${String(id).padStart(4, '0')}`;


function date(value, withTime = false) {

  if (!value) {
    return 'Data não informada';
  }

  const parsed = new Date(
    /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)
      ? value.replace(' ', 'T') + 'Z'
      : value
  );

  if (Number.isNaN(parsed.getTime())) {
    return 'Data não informada';
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    withTime
      ? {
          dateStyle: 'short',
          timeStyle: 'short'
        }
      : {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }
  ).format(parsed);

}


function errorAt(id, message = '') {

  $(id).textContent = message;

  $(id).hidden = !message;

}


let toastTimer;


function toast(message) {

  clearTimeout(toastTimer);

  $('toast').textContent = message;

  $('toast').hidden = false;

  toastTimer = setTimeout(() => {

    $('toast').hidden = true;

  }, 4000);

}


function decodeToken(token) {

  try {

    const part = token.split('.')[1];

    const normalized = part
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded = normalized.padEnd(
      Math.ceil(normalized.length / 4) * 4,
      '='
    );

    const payload = JSON.parse(
      decodeURIComponent(
        Array.from(
          atob(padded),
          c =>
            `%${c
              .charCodeAt(0)
              .toString(16)
              .padStart(2, '0')}`
        ).join('')
      )
    );


    if (
      payload.exp &&
      payload.exp * 1000 <= Date.now()
    ) {
      return null;
    }


    return payload;

  } catch {

    return null;

  }

}


function saveSession(token) {

  const user = decodeToken(token);


  if (!user) {
    throw new Error(
      'O token recebido é inválido.'
    );
  }


  state.token = token;

  state.user = user;


  localStorage.setItem(
    TOKEN_KEY,
    token
  );

}


function clearSession() {

  state.token = null;

  state.user = null;

  state.all = [];

  state.filtered = [];


  localStorage.removeItem(
    TOKEN_KEY
  );

}


function showAuth(message = '') {

  $('app-shell').hidden = true;

  $('auth-view').hidden = false;


  if (message) {
    errorAt(
      'login-error',
      message
    );
  }

}


function showApp() {

  $('auth-view').hidden = true;

  $('app-shell').hidden = false;


  $('current-user').textContent =
    state.user.username;


  $('current-role').textContent =
    state.user.role === 'admin'
      ? 'Admin'
      : 'Usuário';


  $('message-user').textContent =
    state.user.username;


  $('page-subtitle').textContent =
    state.user.role === 'admin'
      ? 'Você está visualizando os chamados de todos os usuários.'
      : 'Consulte e acompanhe suas solicitações de atendimento.';

}


async function api(path, options = {}) {

  const {
    auth = true,
    ...fetchOptions
  } = options;


  const controller =
    new AbortController();


  const timer = setTimeout(
    () => controller.abort(),
    15000
  );


  const headers = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers || {})
  };


  if (
    auth &&
    state.token
  ) {

    headers.Authorization =
      `Bearer ${state.token}`;

  }


  try {

    const response =
      await fetch(
        path,
        {
          ...fetchOptions,
          headers,
          signal: controller.signal
        }
      );


    if (response.status === 204) {
      return null;
    }


    const body =
      await response
        .json()
        .catch(() => null);


    if (!response.ok) {

      if (
        auth &&
        (
          response.status === 401 ||
          (
            response.status === 403 &&
            body?.error === 'Token inválido'
          )
        )
      ) {

        clearSession();

        showAuth(
          'Sua sessão expirou. Entre novamente.'
        );

      }


      throw new Error(
        body?.error ||
        `Não foi possível concluir a operação (${response.status}).`
      );

    }


    if (body === null) {

      throw new Error(
        'A API retornou uma resposta inesperada.'
      );

    }


    return body;

  } catch (error) {


    if (
      error.name === 'AbortError'
    ) {

      throw new Error(
        'A conexão demorou demais. Tente novamente.'
      );

    }


    if (
      error instanceof TypeError
    ) {

      throw new Error(
        'Não foi possível conectar à API. Verifique se o servidor está em execução.'
      );

    }


    throw error;

  } finally {

    clearTimeout(timer);

  }

}


async function login(
  username,
  senha
) {

  const result =
    await api(
      '/login',
      {
        auth: false,
        method: 'POST',
        body: JSON.stringify({
          username,
          senha
        })
      }
    );


  saveSession(
    result.token
  );


  showApp();


  await loadList();

}


function setAuthTab(tab) {

  const login =
    tab === 'login';


  $('login-form').hidden =
    !login;


  $('register-form').hidden =
    login;


  $('show-login').classList.toggle(
    'active',
    login
  );


  $('show-register').classList.toggle(
    'active',
    !login
  );


  errorAt('login-error');

  errorAt('register-error');

}


$('show-login')
  .addEventListener(
    'click',
    () => setAuthTab('login')
  );


$('show-register')
  .addEventListener(
    'click',
    () => setAuthTab('register')
  );


$('login-form')
  .addEventListener(
    'submit',
    async (e) => {

      e.preventDefault();


      const form =
        e.currentTarget;


      const values =
        Object.fromEntries(
          new FormData(form)
        );


      errorAt(
        'login-error'
      );


      busyForm(
        form,
        true
      );


      try {

        await login(
          values.username.trim(),
          values.senha
        );


        form.reset();

      } catch (error) {

        errorAt(
          'login-error',
          error.message
        );

      } finally {

        busyForm(
          form,
          false
        );

      }

    }
  );


$('register-form')
  .addEventListener(
    'submit',
    async (e) => {

      e.preventDefault();


      const form =
        e.currentTarget;


      const values =
        Object.fromEntries(
          new FormData(form)
        );


      values.nome =
        values.nome.trim();


      values.username =
        values.username.trim();


      values.email =
        values.email.trim();


      errorAt(
        'register-error'
      );


      busyForm(
        form,
        true
      );


      try {

        await api(
          '/usuarios',
          {
            auth: false,
            method: 'POST',
            body: JSON.stringify(
              values
            )
          }
        );


        await login(
          values.username,
          values.senha
        );


        form.reset();


        toast(
          'Conta criada com sucesso.'
        );

      } catch (error) {

        errorAt(
          'register-error',
          error.message
        );

      } finally {

        busyForm(
          form,
          false
        );

      }

    }
  );


$('logout')
  .addEventListener(
    'click',
    () => {

      clearSession();

      showAuth();

      setAuthTab(
        'login'
      );

    }
  );


function hasFilters() {

  return Boolean(
    $('filter-status').value ||
    $('filter-priority').value ||
    $('search').value.trim()
  );

}


function renderList() {

  const term =
    $('search')
      .value
      .trim()
      .toLocaleLowerCase('pt-BR');


  const items =
    state.filtered
      .filter(
        t =>
          `${number(t.id)} ${t.titulo} ${t.descricao}`
            .toLocaleLowerCase('pt-BR')
            .includes(term)
      )
      .sort(
        (a, b) =>
          b.id - a.id
      );


  $('clear-filters').hidden =
    !hasFilters();


  $('result-count').textContent =
    items.length;


  $('list-summary').textContent =
    `${items.length} ${
      items.length === 1
        ? 'chamado exibido'
        : 'chamados exibidos'
    } de ${state.all.length}`;


  $('empty-state').hidden =
    items.length > 0;


  $('table-wrap').hidden =
    !items.length;


  $('empty-title').textContent =
    hasFilters()
      ? 'Nenhum chamado encontrado'
      : 'Nenhum chamado cadastrado';


  $('empty-description').textContent =
    hasFilters()
      ? 'Experimente outro termo ou limpe os filtros.'
      : 'Use Novo chamado para registrar uma solicitação.';


  $('empty-action').textContent =
    hasFilters()
      ? 'Limpar filtros'
      : 'Novo chamado';


  $('ticket-list').innerHTML =
    items.map(
      t => `
        <tr>

          <td>

            <button
              class="ticket-link"
              data-ticket="${Number(t.id)}"
            >

              <strong>
                ${escapeHTML(t.titulo)}
              </strong>

              <span class="ticket-meta">

                <span class="ticket-id">
                  ${number(t.id)}
                </span>

                <span class="excerpt">
                  ${escapeHTML(t.descricao)}
                </span>

              </span>

            </button>

          </td>

          <td>
            ${badge(
              t.status,
              statusClass
            )}
          </td>

          <td>
            ${badge(
              t.prioridade,
              priorityClass
            )}
          </td>

          <td class="date">
            ${date(t.criado_em)}
          </td>

        </tr>
      `
    ).join('');

}


async function loadList() {

  if (!state.token) {
    return;
  }


  const version =
    ++state.listVersion;


  errorAt(
    'list-error'
  );


  $('list-loading').hidden =
    false;


  $('table-wrap').hidden =
    true;


  $('empty-state').hidden =
    true;


  $('refresh').disabled =
    true;


  const params =
    new URLSearchParams();


  if (
    $('filter-status').value
  ) {

    params.set(
      'status',
      $('filter-status').value
    );

  }


  if (
    $('filter-priority').value
  ) {

    params.set(
      'prioridade',
      $('filter-priority').value
    );

  }


  try {

    const [
      all,
      filtered
    ] = await Promise.all([
      api('/chamados'),

      params.size
        ? api(
            `/chamados?${params}`
          )
        : Promise.resolve(null)
    ]);


    if (
      version !==
      state.listVersion
    ) {

      return;

    }


    if (
      !Array.isArray(all) ||
      (
        filtered &&
        !Array.isArray(filtered)
      )
    ) {

      throw new Error(
        'A lista recebida da API é inválida.'
      );

    }


    state.all =
      all;


    state.filtered =
      filtered || all;


    $('total-count').textContent =
      all.length;


    $('open-count').textContent =
      all.filter(
        t => t.status === 'Aberto'
      ).length;


    $('progress-count').textContent =
      all.filter(
        t =>
          t.status ===
          'Em andamento'
      ).length;


    $('closed-count').textContent =
      all.filter(
        t => t.status === 'Fechado'
      ).length;


    $('connection').className =
      'connection online';


    $('connection').textContent =
      'Conectado';


    renderList();

  } catch (error) {


    if (
      version !==
      state.listVersion
    ) {
      return;
    }


    if (!state.token) {
      return;
    }


    errorAt(
      'list-error',
      `${error.message} Use Atualizar para tentar novamente.`
    );


    $('list-summary').textContent =
      'Não foi possível atualizar a lista';


    $('connection').className =
      'connection offline';


    $('connection').textContent =
      'Sem conexão';

  } finally {


    if (
      version ===
      state.listVersion
    ) {

      $('list-loading').hidden =
        true;


      $('refresh').disabled =
        false;

    }

  }

}


function clearFilters() {

  $('search').value =
    '';


  $('filter-status').value =
    '';


  $('filter-priority').value =
    '';


  loadList();

}


function openCreate() {

  $('create-form').reset();


  errorAt(
    'create-error'
  );


  $('create-dialog').showModal();

}


function busyForm(
  form,
  busy
) {

  for (
    const element
    of form.elements
  ) {

    element.disabled =
      busy;

  }

}


function setDetailBusy(busy) {

  state.detailBusy =
    busy;


  $('detail-status').disabled =
    busy;


  $('delete-ticket').disabled =
    busy;


  busyForm(
    $('message-form'),
    busy
  );


  document.querySelector(
    '[data-close="detail-dialog"]'
  ).disabled = busy;

}


function renderTicket() {

  const t =
    state.ticket;


  $('detail-number').textContent =
    `CHAMADO ${number(t.id)}`;


  $('detail-title').textContent =
    t.titulo;


  $('detail-description').textContent =
    t.descricao;


  $('detail-date').textContent =
    `Criado em ${date(
      t.criado_em,
      true
    )}`;


  $('detail-badges').innerHTML =
    badge(
      t.status,
      statusClass
    ) +
    badge(
      t.prioridade,
      priorityClass
    );


  $('detail-status').value =
    t.status;

}


function renderMessages() {

  const username =
    state.user?.username;


  $('message-count').textContent =
    state.messages.length;


  $('messages').innerHTML =
    state.messages.length

      ? state.messages
          .map(
            m => `

              <article
                class="message${
                  m.autor === username
                    ? ' mine'
                    : ''
                }"
              >

                <div class="message-header">

                  <strong>
                    ${escapeHTML(m.autor)}
                  </strong>

                  <time>
                    ${date(
                      m.criado_em,
                      true
                    )}
                  </time>

                </div>

                <p class="message-body">
                  ${escapeHTML(m.mensagem)}
                </p>

              </article>

            `
          )
          .join('')

      : `
          <p class="messages-empty">
            Nenhuma mensagem neste chamado.
          </p>
        `;

}


async function openDetail(id) {

  const version =
    ++state.detailVersion;


  state.ticket =
    null;


  state.messages =
    [];


  $('detail-content').hidden =
    true;


  $('detail-loading').hidden =
    false;


  $('detail-title').textContent =
    'Detalhes do chamado';


  $('detail-number').textContent =
    `CHAMADO ${number(id)}`;


  [
    'detail-load-error',
    'detail-action-error',
    'message-error'
  ].forEach(
    key =>
      errorAt(key)
  );


  $('message-form').reset();


  if (
    !$('detail-dialog').open
  ) {

    $('detail-dialog').showModal();

  }


  try {

    const [
      ticket,
      messages
    ] = await Promise.all([

      api(
        `/chamados/${id}`
      ),

      api(
        `/chamados/${id}/mensagens`
      )

    ]);


    if (
      version !==
      state.detailVersion
    ) {

      return;

    }


    state.ticket =
      ticket;


    state.messages =
      messages;


    renderTicket();

    renderMessages();


    $('detail-content').hidden =
      false;

  } catch (error) {


    if (
      version ===
      state.detailVersion
    ) {

      errorAt(
        'detail-load-error',
        error.message
      );

    }

  } finally {


    if (
      version ===
      state.detailVersion
    ) {

      $('detail-loading').hidden =
        true;

    }

  }

}


$('new-ticket')
  .addEventListener(
    'click',
    openCreate
  );


$('empty-action')
  .addEventListener(
    'click',
    () =>
      hasFilters()
        ? clearFilters()
        : openCreate()
  );


$('refresh')
  .addEventListener(
    'click',
    loadList
  );


$('clear-filters')
  .addEventListener(
    'click',
    clearFilters
  );


$('filter-status')
  .addEventListener(
    'change',
    loadList
  );


$('filter-priority')
  .addEventListener(
    'change',
    loadList
  );


$('search')
  .addEventListener(
    'input',
    () => {

      if (
        $('list-loading').hidden &&
        $('list-error').hidden
      ) {

        renderList();

      }

    }
  );


$('ticket-list')
  .addEventListener(
    'click',
    e => {

      const button =
        e.target.closest(
          '[data-ticket]'
        );


      if (button) {

        openDetail(
          Number(
            button.dataset.ticket
          )
        );

      }

    }
  );


document
  .querySelectorAll(
    '[data-close]'
  )
  .forEach(
    button =>
      button.addEventListener(
        'click',
        () =>
          $(
            button.dataset.close
          ).close()
      )
  );


$('detail-dialog')
  .addEventListener(
    'close',
    () => {

      state.detailVersion++;

      state.ticket =
        null;

    }
  );


document
  .querySelectorAll(
    'dialog'
  )
  .forEach(
    dialog =>
      dialog.addEventListener(
        'cancel',
        e => {

          if (
            (
              dialog.id ===
                'detail-dialog' &&
              state.detailBusy
            ) ||
            dialog.querySelector(
              'button[type="submit"]:disabled'
            ) ||
            (
              dialog.id ===
                'delete-dialog' &&
              $('confirm-delete').disabled
            )
          ) {

            e.preventDefault();

          }

        }
      )
  );


$('create-form')
  .addEventListener(
    'submit',
    async e => {

      e.preventDefault();


      const form =
        e.currentTarget;


      const values =
        Object.fromEntries(
          new FormData(form)
        );


      values.titulo =
        values.titulo.trim();


      values.descricao =
        values.descricao.trim();


      if (
        !values.titulo ||
        !values.descricao
      ) {

        return errorAt(
          'create-error',
          'Preencha o título e a descrição.'
        );

      }


      errorAt(
        'create-error'
      );


      busyForm(
        form,
        true
      );


      try {

        const ticket =
          await api(
            '/chamados',
            {
              method: 'POST',
              body:
                JSON.stringify(
                  values
                )
            }
          );


        $('create-dialog').close();


        clearFilters();


        toast(
          'Chamado criado com sucesso.'
        );


        await openDetail(
          ticket.id
        );

      } catch (error) {

        errorAt(
          'create-error',
          error.message
        );

      } finally {

        busyForm(
          form,
          false
        );

      }

    }
  );


$('detail-status')
  .addEventListener(
    'change',
    async () => {

      if (
        !state.ticket ||
        state.detailBusy
      ) {
        return;
      }


      const previous =
        state.ticket.status;


      const status =
        $('detail-status').value;


      setDetailBusy(
        true
      );


      errorAt(
        'detail-action-error'
      );


      try {

        state.ticket =
          await api(
            `/chamados/${state.ticket.id}`,
            {
              method: 'PATCH',
              body:
                JSON.stringify({
                  status
                })
            }
          );


        renderTicket();


        toast(
          'Status atualizado.'
        );


        loadList();

      } catch (error) {

        $('detail-status').value =
          previous;


        errorAt(
          'detail-action-error',
          error.message
        );

      } finally {

        setDetailBusy(
          false
        );

      }

    }
  );


$('reply-button')
  .addEventListener(
    'click',
    () => {

      $('message-text')
        .scrollIntoView({
          behavior:
            matchMedia(
              '(prefers-reduced-motion: reduce)'
            ).matches
              ? 'auto'
              : 'smooth',

          block: 'center'
        });


      $('message-text')
        .focus({
          preventScroll: true
        });

    }
  );


$('message-form')
  .addEventListener(
    'submit',
    async e => {

      e.preventDefault();


      if (
        !state.ticket ||
        state.detailBusy
      ) {
        return;
      }


      const mensagem =
        $('message-text')
          .value
          .trim();


      if (!mensagem) {

        return errorAt(
          'message-error',
          'Escreva uma mensagem.'
        );

      }


      setDetailBusy(
        true
      );


      errorAt(
        'message-error'
      );


      try {

        const message =
          await api(
            `/chamados/${state.ticket.id}/mensagens`,
            {
              method: 'POST',
              body:
                JSON.stringify({
                  mensagem
                })
            }
          );


        state.messages.push(
          message
        );


        $('message-text').value =
          '';


        renderMessages();


        $('messages')
          .lastElementChild
          ?.scrollIntoView({
            block: 'nearest'
          });


        toast(
          'Mensagem enviada.'
        );

      } catch (error) {

        errorAt(
          'message-error',
          error.message
        );

      } finally {

        setDetailBusy(
          false
        );


        $('message-text')
          .focus({
            preventScroll: true
          });

      }

    }
  );


$('delete-ticket')
  .addEventListener(
    'click',
    () => {

      if (!state.ticket) {
        return;
      }


      errorAt(
        'delete-error'
      );


      $('delete-description').textContent =
        `O chamado ${number(
          state.ticket.id
        )} será removido da central. Esta ação não pode ser desfeita.`;


      $('delete-dialog')
        .showModal();

    }
  );


$('confirm-delete')
  .addEventListener(
    'click',
    async () => {

      if (
        !state.ticket ||
        state.detailBusy
      ) {
        return;
      }


      setDetailBusy(
        true
      );


      $('confirm-delete').disabled =
        true;


      document.querySelector(
        '[data-close="delete-dialog"]'
      ).disabled = true;


      errorAt(
        'delete-error'
      );


      try {

        await api(
          `/chamados/${state.ticket.id}`,
          {
            method: 'DELETE'
          }
        );


        $('delete-dialog').close();

        $('detail-dialog').close();


        toast(
          'Chamado excluído.'
        );


        loadList();

      } catch (error) {

        errorAt(
          'delete-error',
          error.message
        );

      } finally {

        setDetailBusy(
          false
        );


        $('confirm-delete').disabled =
          false;


        document.querySelector(
          '[data-close="delete-dialog"]'
        ).disabled = false;

      }

    }
  );


(function start() {

  const token =
    localStorage.getItem(
      TOKEN_KEY
    );


  const user =
    token
      ? decodeToken(token)
      : null;


  if (
    !token ||
    !user
  ) {

    clearSession();

    showAuth();

    return;

  }


  state.token =
    token;


  state.user =
    user;


  showApp();

  loadList();

})();