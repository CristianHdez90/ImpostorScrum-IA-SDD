/*
 * Farsante Scrum — interfaz del juego completo.
 * Reglas, roles y resultados los decide el servidor; aquí solo se valida para
 * orientar y se proyecta el estado recibido. Todo texto de usuarios se inserta
 * con APIs de texto (nunca innerHTML). La actualización es localizada para no
 * interrumpir la escritura ni los lectores de pantalla.
 */
(function () {
  'use strict';

  /* Límites de formulario: deben coincidir con lib/config.js (tests/unit/room.test.js). */
  /* LIMITS:begin */
  var LIMITS = Object.freeze({"codeAlphabet":"ABCDEFGHJKLMNPQRSTUVWXYZ","codeLength":5,"nameMin":2,"nameMax":26,"pollIntervalMs":1500,"clueMax":160,"guessMax":55,"wordMin":2,"wordMax":55,"wordsMin":3,"wordsMax":100,"settingsOptions":{"rounds":[1,2,3,4,5,6,7,8,9,10],"turnSeconds":[30,45,60,90,120],"voteSeconds":[45,60,75,90,120]}});
  /* LIMITS:end */

  var STORAGE_KEY = 'farsante.currentRoom';
  var DRAFT_KEY = 'farsante.wordsDraft.';
  var BACKOFF_MS = [1500, 3000, 6000, 10000];
  var REQUEST_TIMEOUT_MS = 8000;
  var CODE_RE = new RegExp('^[' + LIMITS.codeAlphabet + ']{' + LIMITS.codeLength + '}$');
  var ACTIVE_PHASES = ['roles', 'clues', 'discussion', 'vote', 'reveal', 'guess'];
  var PHASE_ICONS = {
    roles: 'i-card', clues: 'i-chat', discussion: 'i-users', vote: 'i-vote',
    reveal: 'i-eye', guess: 'i-question', finished: 'i-trophy',
  };
  var TURN_STATE_LABELS = { current: 'En turno', done: 'Pista dada', skipped: 'Sin pista', pending: 'Esperando' };
  var AVATAR_TONES = 6;
  var PHASE_LABELS = {
    roles: 'Preparación', clues: 'Pistas', discussion: 'Debate', vote: 'Votación',
    reveal: 'Resultado', guess: 'Adivinanza', finished: 'Final',
  };
  var PHASE_MESSAGES = {
    lobby: 'Todos están en la sala de espera.',
    roles: 'La partida comenzó. Mira tu carta en privado.',
    clues: 'Comienza la ronda de pistas.',
    discussion: 'Terminaron las pistas. Comienza el debate.',
    vote: 'La votación está abierta.',
    reveal: 'Nadie fue señalado. Habrá otra ronda.',
    guess: 'El equipo descubrió al impostor.',
    finished: 'La partida terminó.',
  };

  var segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('es', { granularity: 'grapheme' }) : null;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    code: null,
    generation: 0,
    lastVersion: -1,
    lastDto: null,
    phase: null,
    gameId: null,
    me: null,
    playersKey: '',
    knownIds: null,
    syncMode: null,
    pollTimer: null,
    controller: null,
    eventSource: null,
    failures: 0,
    qrText: null,
    connected: true,
    cardVisible: false,
    clockOffset: 0,
    deadline: null,
    timerInterval: null,
    actionBusy: 0, // acciones en curso (los botones se bloquean uno a uno)
    leaving: false,
    turnKey: null,
    warnedTurnKey: null,
    cluesKey: '',
    voteKey: '',
    voteSelection: null,
    wordsSaved: null,
    wordsDirty: false,
    settingsSaved: null,
    settingsDirty: false,
    tableKey: '',
    podiumKey: '',
    seriesAnnounced: null,
    kickTarget: null, // participante que el anfitrión está por quitar (confirmación)
    cardSeen: false, // la carta se abrió al menos una vez en esta partida
  };

  /* ---------- Utilidades ---------- */

  function graphemes(text) {
    if (!segmenter) return Array.from(text).length;
    var count = 0;
    var iterator = segmenter.segment(text)[Symbol.iterator]();
    while (!iterator.next().done) count += 1;
    return count;
  }

  function normalizeSpaces(text) {
    return String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  }

  function normalizeCode(text) {
    return String(text || '').toUpperCase().replace(/\s+/g, '');
  }

  function isValidCode(code) {
    return CODE_RE.test(code);
  }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (e) { /* almacenamiento bloqueado: solo se pierde la recuperación automática */ }
  }

  function readStorage() {
    var value = storageGet(STORAGE_KEY);
    return value && isValidCode(value) ? value : null;
  }

  function writeStorage(code) {
    storageSet(STORAGE_KEY, code);
  }

  function sessionGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function sessionSet(key, value) {
    try {
      if (value === null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, value);
    } catch (e) { /* sin borrador persistente */ }
  }

  function newActionId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  var announceTimer = null;
  function announce(message) {
    if (!message) return;
    var region = $('status');
    clearTimeout(announceTimer);
    region.textContent = '';
    announceTimer = setTimeout(function () { region.textContent = message; }, 50);
  }

  function isLocalhost() {
    var h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function votesText(n) {
    return n === 1 ? '1 voto' : n + ' votos';
  }

  /* ---------- Red ---------- */

  function request(method, path, body, signal) {
    var options = { method: method, credentials: 'same-origin', headers: {}, signal: signal };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    return fetch(path, options).then(function (response) {
      return response.json().catch(function () { return null; }).then(function (data) {
        return { ok: response.ok, status: response.status, data: data };
      });
    });
  }

  function withTimeout(factory) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
    return { controller: controller, promise: factory(controller.signal).finally(function () { clearTimeout(timer); }) };
  }

  /** Clasifica la respuesta de estado: ok, session, gone o unavailable. */
  function fetchState(code, signal) {
    return request('GET', '/api/state?code=' + encodeURIComponent(code), undefined, signal).then(
      function (r) {
        if (r.ok && r.data) return { kind: 'ok', dto: r.data };
        if (r.status === 401) return { kind: 'session' };
        if (r.status === 404) return { kind: 'gone' };
        return { kind: 'unavailable' };
      },
      function () { return { kind: 'unavailable' }; }
    );
  }

  /* ---------- Vistas ---------- */

  var VIEWS = ['home', 'invite', 'lobby', 'roles', 'clues', 'discussion', 'vote', 'reveal', 'guess', 'finished', 'fatal'];
  var ROOM_VIEWS = ['lobby', 'roles', 'clues', 'discussion', 'vote', 'reveal', 'guess', 'finished'];

  function showView(name, focusTitle) {
    VIEWS.forEach(function (v) { $('view-' + v).hidden = v !== name; });
    var inRoom = ROOM_VIEWS.indexOf(name) !== -1;
    $('connection').hidden = !inRoom;
    $('identity').hidden = !inRoom || !$('identity-name').textContent;
    if (!inRoom) {
      ['host-controls', 'secret-panel', 'clues-panel', 'phase-bar', 'table-panel', 'room-chip'].forEach(function (id) { $(id).hidden = true; });
      setFormAlert('action-error', null);
    }
    if (focusTitle !== false) {
      var title = $('view-' + name).querySelector('h1');
      if (title) title.focus();
    }
  }

  function setFieldError(inputId, message) {
    var input = $(inputId);
    var error = $(inputId + '-error');
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      error.textContent = message;
      error.hidden = false;
    } else {
      input.removeAttribute('aria-invalid');
      error.textContent = '';
      error.hidden = true;
    }
  }

  function setFormAlert(id, message) {
    var node = $(id);
    node.textContent = message || '';
    node.hidden = !message;
  }

  function setBusy(form, busy) {
    var button = form.querySelector('button[type="submit"]');
    button.disabled = busy;
    if (busy) button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
  }

  function validateNameField(inputId) {
    var name = normalizeSpaces($(inputId).value);
    var length = graphemes(name);
    if (length < LIMITS.nameMin || length > LIMITS.nameMax) {
      setFieldError(inputId, 'El nombre debe tener entre ' + LIMITS.nameMin + ' y ' + LIMITS.nameMax + ' caracteres.');
      return null;
    }
    setFieldError(inputId, null);
    return name;
  }

  function validateCodeField(inputId) {
    var code = normalizeCode($(inputId).value);
    if (!isValidCode(code)) {
      setFieldError(inputId, 'El código tiene cinco letras (sin I ni O).');
      return null;
    }
    setFieldError(inputId, null);
    return code;
  }

  function showServerError(prefix, result) {
    var error = result && result.data && result.data.error;
    var code = error ? error.code : null;
    var message = error ? error.message : 'No pudimos contactar con el servidor. Tus datos siguen aquí; inténtalo de nuevo.';
    if ((code === 'INVALID_NAME' || code === 'NAME_TAKEN') && $(prefix + '-name')) {
      setFieldError(prefix + '-name', message);
      $(prefix + '-name').focus();
    } else if ((code === 'INVALID_CODE' || code === 'ROOM_NOT_FOUND' || code === 'ROOM_FULL' || code === 'ROOM_STARTED') && $(prefix + '-code')) {
      setFieldError(prefix + '-code', message);
      $(prefix + '-code').focus();
    } else {
      setFormAlert(prefix + '-error', message);
    }
  }

  /* ---------- Crear y unirse ---------- */

  function submitCreate(event) {
    event.preventDefault();
    var form = event.currentTarget;
    setFormAlert('create-error', null);
    var name = validateNameField('create-name');
    if (!name) { $('create-name').focus(); return; }
    setBusy(form, true);
    request('POST', '/api/create', { name: name, groupId: $('create-group').value, settings: readSettings('create') })
      .then(function (r) {
        if (r.ok && r.data) {
          enterRoom(r.data);
          announce('Sala ' + r.data.code + ' creada. Comparte el código con tu equipo.');
        } else {
          showServerError('create', r);
        }
      }, function () { showServerError('create', null); })
      .finally(function () { setBusy(form, false); });
  }

  function submitJoin(prefix) {
    return function (event) {
      event.preventDefault();
      var form = event.currentTarget;
      setFormAlert(prefix + '-error', null);
      var code = validateCodeField(prefix + '-code');
      var name = validateNameField(prefix + '-name');
      if (!code) { $(prefix + '-code').focus(); return; }
      if (!name) { $(prefix + '-name').focus(); return; }
      setBusy(form, true);
      request('POST', '/api/join', { code: code, name: name })
        .then(function (r) {
          if (r.ok && r.data) {
            enterRoom(r.data);
            announce('Entraste a la sala ' + r.data.code + '.');
          } else {
            showServerError(prefix, r);
          }
        }, function () { showServerError(prefix, null); })
        .finally(function () { setBusy(form, false); });
    };
  }

  /* ---------- Sala ---------- */

  function viewForPhase(phase) {
    return VIEWS.indexOf(phase) !== -1 ? phase : 'lobby';
  }

  function enterRoom(dto) {
    stopSync();
    state.generation += 1;
    state.code = dto.code;
    state.lastVersion = -1;
    state.playersKey = '';
    state.knownIds = null;
    state.failures = 0;
    state.phase = null;
    state.gameId = null;
    state.cluesKey = '';
    state.voteKey = '';
    state.turnKey = null;
    state.wordsSaved = null;
    state.wordsDirty = false;
    state.settingsSaved = null;
    state.settingsDirty = false;
    state.tableKey = '';
    state.podiumKey = '';
    writeStorage(dto.code);
    if (window.history && window.history.replaceState) window.history.replaceState(null, '', '/?sala=' + dto.code);
    setConnection(true);
    applyRoom(dto);
    showView(viewForPhase(dto.phase));
    renderPanels(dto);
    startSync(dto.sync && dto.sync.mode);
  }

  /** Sala conocida pero sin respuesta del servidor: mostrar la sala y reintentar. */
  function enterRoomPending(code) {
    stopSync();
    state.generation += 1;
    state.code = code;
    state.lastVersion = -1;
    renderCode(code);
    showView('lobby');
    setConnection(false);
    state.syncMode = 'poll';
    schedulePoll(BACKOFF_MS[0]);
  }

  function leaveRoomLocally(message) {
    state.leaving = false;
    stopSync();
    clearInterval(state.timerInterval);
    state.generation += 1;
    if (state.code) sessionSet(DRAFT_KEY + state.code, null);
    writeStorage(null);
    $('identity-name').textContent = '';
    state.code = null;
    state.phase = null;
    if (window.history && window.history.replaceState) window.history.replaceState(null, '', '/');
    showView('home');
    announce(message);
  }

  /** Cada participante ve siempre con qué nombre juega. */
  function renderIdentity(me) {
    if (!me) return;
    if ($('identity-name').textContent !== me.name) {
      $('identity-name').textContent = me.name;
      $('card-owner-name').textContent = me.name;
      var holder = $('identity-avatar');
      holder.textContent = '';
      holder.appendChild(avatar({ name: me.name }));
    }
    $('identity').hidden = false;
  }

  function renderCode(code) {
    var node = $('room-code');
    node.textContent = '';
    var visible = el('span', null, code);
    visible.setAttribute('aria-hidden', 'true');
    node.appendChild(visible);
    node.appendChild(el('span', 'visually-hidden', code.split('').join(' ')));
    node.setAttribute('data-code', code);
  }

  function applyRoom(dto) {
    if (!dto || dto.code !== state.code) return; // respuesta de otra sala
    if (typeof dto.version === 'number' && dto.version < state.lastVersion) return; // respuesta obsoleta
    state.lastVersion = dto.version;
    state.lastDto = dto;
    state.me = dto.me;

    if ($('room-code').getAttribute('data-code') !== dto.code) renderCode(dto.code);
    renderIdentity(dto.me);
    var link = window.location.origin + dto.invite.path;
    if ($('invite-link').value !== link) $('invite-link').value = link;
    if (state.qrText !== link) drawQr(link, dto.code);
    $('localhost-warning').hidden = !isLocalhost();

    if (dto.gameId !== state.gameId) {
      state.gameId = dto.gameId;
      state.cardSeen = false;
      hideCard(); // nueva partida o reinicio: la carta vuelve a estar oculta
      state.voteSelection = null;
    }
    state.clockOffset = dto.serverNow - Date.now();
    state.deadline = dto.deadline;

    renderLobby(dto);
    renderRoles(dto);
    renderClues(dto);
    renderDiscussion(dto);
    renderVote(dto);
    renderReveal(dto);
    renderGuess(dto);
    renderFinished(dto);
    updateTimer();

    var previous = state.phase;
    state.phase = dto.phase;
    if (previous !== null && previous !== dto.phase) {
      setFormAlert('action-error', null);
      showView(viewForPhase(dto.phase));
      announce(PHASE_MESSAGES[dto.phase]);
      if (dto.phase === 'clues' && dto.turn && dto.turn.isMine) $('clue-text').focus();
    }
    renderPanels(dto);
  }

  /* ---------- Sala de espera y palabras ---------- */

  function renderLobby(dto) {
    $('player-count').textContent = '(' + dto.capacity.count + ' de ' + dto.capacity.max + ')';
    $('words-label').textContent = dto.words.label;
    $('words-count').textContent = String(dto.words.count);
    renderPlayers(dto.players, dto.me.isHost && dto.phase === 'lobby');
    renderRequirement(dto);
    var isHost = dto.me.isHost;
    var start = $('start-game');
    start.hidden = !isHost;
    $('waiting-host').hidden = isHost;
    start.disabled = !dto.canStart.ok || state.actionBusy;
    renderWordsEditor(dto);
    renderSettings(dto);
  }

  function renderPlayers(players, canKick) {
    if (state.kickTarget && !players.some(function (p) { return p.id === state.kickTarget; })) state.kickTarget = null;
    var key = JSON.stringify([players, canKick, state.kickTarget]);
    if (key === state.playersKey) return; // actualización localizada
    state.playersKey = key;
    var list = $('player-list');
    list.textContent = '';
    players.forEach(function (p) {
      var li = el('li', 'player');
      li.setAttribute('data-testid', 'player');
      li.appendChild(avatar(p));
      li.appendChild(el('span', 'player-name', p.name));
      if (p.isHost) li.appendChild(badge('badge-host', '★', 'Anfitrión'));
      if (p.isMe) li.appendChild(badge('badge-me', '', 'Tú'));
      li.appendChild(p.connected ? badge('badge-online', '●', 'Conectado') : badge('badge-offline', '○', 'Desconectado'));
      if (canKick && !p.isMe) li.appendChild(kickControls(p));
      list.appendChild(li);
    });
    var ids = players.map(function (p) { return p.id; });
    if (state.knownIds) {
      players.forEach(function (p) {
        if (state.knownIds.indexOf(p.id) === -1 && !p.isMe) announce(p.name + ' entró a la sala.');
      });
    }
    state.knownIds = ids;
  }

  /** «Quitar» con confirmación en un paso; el foco se mantiene en el control (RF-001.22). */
  function kickControls(p) {
    var box = el('span', 'kick');
    if (state.kickTarget !== p.id) {
      var ask = el('button', 'btn btn-ghost btn-small kick-ask' + (p.connected ? '' : ' is-offline'), 'Quitar');
      ask.type = 'button';
      ask.setAttribute('aria-label', 'Quitar a ' + p.name + ' de la sala');
      ask.setAttribute('data-kick', p.id);
      ask.addEventListener('click', function () {
        state.kickTarget = p.id;
        state.playersKey = '';
        renderPlayers(state.lastDto.players, true);
        var yes = document.querySelector('[data-kick-confirm="' + p.id + '"]');
        if (yes) yes.focus();
      });
      box.appendChild(ask);
      return box;
    }
    box.appendChild(el('span', 'kick-question', '¿Quitar a ' + p.name + '?'));
    var yes = el('button', 'btn btn-danger btn-small', 'Sí, quitar');
    yes.type = 'button';
    yes.setAttribute('data-kick-confirm', p.id);
    yes.addEventListener('click', function () {
      sendAction('kick', { playerId: p.id }, {
        button: yes,
        onSuccess: function () { state.kickTarget = null; announce(p.name + ' ya no está en la sala.'); },
      });
    });
    var no = el('button', 'btn btn-secondary btn-small', 'Cancelar');
    no.type = 'button';
    no.addEventListener('click', function () {
      state.kickTarget = null;
      state.playersKey = '';
      renderPlayers(state.lastDto.players, true);
      var again = document.querySelector('[data-kick="' + p.id + '"]');
      if (again) again.focus();
    });
    box.appendChild(yes);
    box.appendChild(no);
    return box;
  }

  function badge(className, icon, text) {
    var span = el('span', 'badge ' + className);
    if (icon) {
      var i = el('span', null, icon);
      i.setAttribute('aria-hidden', 'true');
      span.appendChild(i);
    }
    span.appendChild(document.createTextNode(text));
    return span;
  }

  /* ---------- Configuración, avatares e iconos (SPEC-FEAT-009/010) ---------- */

  var SETTING_FIELDS = [
    { key: 'rounds', suffix: 'rounds' },
    { key: 'turnSeconds', suffix: 'turn' },
    { key: 'voteSeconds', suffix: 'vote' },
  ];

  function durationText(seconds) {
    if (seconds < 60) return seconds + ' segundos';
    var min = Math.floor(seconds / 60);
    var rest = seconds % 60;
    var text = min === 1 ? '1 minuto' : min + ' minutos';
    return rest ? text + ' ' + rest + ' s' : text;
  }

  function settingOptionText(key, value) {
    if (key === 'rounds') return value === 1 ? '1 ronda' : value + ' rondas';
    return durationText(value);
  }

  function fillSettingSelects(prefix, values) {
    SETTING_FIELDS.forEach(function (f) {
      var select = $(prefix + '-' + f.suffix);
      if (select.options.length === 0) {
        LIMITS.settingsOptions[f.key].forEach(function (v) {
          var option = el('option', null, settingOptionText(f.key, v));
          option.value = String(v);
          select.appendChild(option);
        });
      }
      select.value = String(values[f.key]);
    });
  }

  function readSettings(prefix) {
    var out = {};
    SETTING_FIELDS.forEach(function (f) { out[f.key] = Number($(prefix + '-' + f.suffix).value); });
    return out;
  }

  function settingsSummary(settings) {
    return settingOptionText('rounds', settings.rounds) + ', ' + durationText(settings.turnSeconds) + ' por turno y '
      + durationText(settings.voteSeconds) + ' para votar.';
  }

  function renderSettings(dto) {
    var settings = dto.settings;
    if (!settings) return;
    var summary = settingsSummary(settings);
    if ($('settings-summary').textContent !== summary) $('settings-summary').textContent = summary;
    var editable = dto.me.isHost && dto.phase === 'lobby';
    $('settings-form').hidden = !editable;
    if (!editable) { state.settingsSaved = null; state.settingsDirty = false; return; }
    var key = JSON.stringify(settings);
    // El borrador del anfitrión no se pisa con las actualizaciones.
    if (state.settingsSaved === null || (key !== state.settingsSaved && !state.settingsDirty)) fillSettingSelects('settings', settings);
    state.settingsSaved = key;
  }

  function setSettingsDirty(dirty) {
    state.settingsDirty = dirty;
    $('settings-draft').hidden = !dirty;
  }

  function submitSettings(event) {
    event.preventDefault();
    sendAction('settings', readSettings('settings'), {
      button: $('settings-form').querySelector('button[type="submit"]'),
      onSuccess: function (dto) {
        setSettingsDirty(false);
        state.settingsSaved = null;
        renderSettings(dto);
        announce('Configuración guardada: ' + settingsSummary(dto.settings));
      },
    });
  }

  function initials(name) {
    var words = String(name).trim().split(/\s+/).filter(Boolean);
    var first = function (w) {
      if (segmenter) { var it = segmenter.segment(w)[Symbol.iterator]().next(); return it.done ? '' : it.value.segment; }
      return w.charAt(0);
    };
    var text = words.length > 1 ? first(words[0]) + first(words[1]) : first(words[0] || '?');
    return text.toLocaleUpperCase('es');
  }

  function avatar(player) {
    var hash = 0;
    var source = String(player.name); // mismo color en la mesa y en el podio
    for (var i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
    var span = el('span', 'avatar avatar-' + (hash % AVATAR_TONES), initials(player.name));
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function icon(id, className) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'icon' + (className ? ' ' + className : ''));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  function pointsText(n) {
    return n === 1 ? '1 punto' : n + ' puntos';
  }

  function renderRequirement(dto) {
    var c = dto.canStart;
    var text;
    if (c.missingPlayers > 0) {
      text = c.missingPlayers === 1
        ? 'Falta 1 participante para iniciar (mínimo ' + dto.capacity.min + ').'
        : 'Faltan ' + c.missingPlayers + ' participantes para iniciar (mínimo ' + dto.capacity.min + ').';
    } else if (c.disconnected.length > 0) {
      text = 'Esperando la conexión de: ' + c.disconnected.join(', ') + '.'
        + (dto.me.isHost ? ' Si no va a volver, usa «Quitar» junto a su nombre.' : '');
    } else {
      text = dto.me.isHost ? 'Todo listo: ya puedes iniciar la partida.' : 'Hay suficientes participantes conectados para jugar.';
    }
    if ($('lobby-requirement').textContent !== text) $('lobby-requirement').textContent = text;
  }

  /** Editor del anfitrión: el borrador no se pisa con las actualizaciones (RF-002.05). */
  function renderWordsEditor(dto) {
    var form = $('words-form');
    var editable = dto.me.isHost && dto.phase === 'lobby' && Array.isArray(dto.words.items);
    form.hidden = !editable;
    if (!editable) return;
    var saved = dto.words.groupId + '\n' + dto.words.items.join('\n');
    if (state.wordsSaved === null) {
      var draft = parseDraft(sessionGet(DRAFT_KEY + state.code));
      if (draft && draft.groupId + '\n' + draft.text !== saved) {
        setEditor(draft.groupId, draft.text);
        setWordsDirty(true);
      } else {
        setEditor(dto.words.groupId, dto.words.items.join('\n'));
      }
    } else if (saved !== state.wordsSaved && !state.wordsDirty) {
      setEditor(dto.words.groupId, dto.words.items.join('\n'));
    }
    state.wordsSaved = saved;
  }

  function parseDraft(raw) {
    try {
      var value = raw ? JSON.parse(raw) : null;
      return value && typeof value.groupId === 'string' && typeof value.text === 'string' ? value : null;
    } catch (e) { return null; }
  }

  function setEditor(groupId, text) {
    $('words-group').value = groupId;
    $('words-text').value = text;
  }

  function setWordsDirty(dirty) {
    state.wordsDirty = dirty;
    $('words-draft').hidden = !dirty;
    if (dirty) sessionSet(DRAFT_KEY + state.code, JSON.stringify({ groupId: $('words-group').value, text: $('words-text').value }));
    else sessionSet(DRAFT_KEY + state.code, null);
  }

  function onGroupChange() {
    var id = $('words-group').value;
    var themes = window.FarsanteWordThemes;
    var group = themes && themes.getGroup(id);
    if (group) $('words-text').value = group.words.join('\n');
    setFieldError('words-text', null);
    setWordsDirty(true);
  }

  function submitWords(event) {
    event.preventDefault();
    var lines = $('words-text').value.split('\n').map(normalizeSpaces).filter(Boolean);
    var bad = lines.filter(function (w) { var n = graphemes(w); return n < LIMITS.wordMin || n > LIMITS.wordMax; });
    if (bad.length) {
      setFieldError('words-text', 'Cada palabra debe tener entre ' + LIMITS.wordMin + ' y ' + LIMITS.wordMax + ' caracteres. Revisa: ' + bad.slice(0, 5).join(', ') + '.');
      $('words-text').focus();
      return;
    }
    if (lines.length < LIMITS.wordsMin) {
      setFieldError('words-text', 'Se necesitan al menos ' + LIMITS.wordsMin + ' palabras distintas.');
      $('words-text').focus();
      return;
    }
    setFieldError('words-text', null);
    sendAction('words', { groupId: $('words-group').value, items: lines }, {
      button: $('words-form').querySelector('button[type="submit"]'),
      onSuccess: function () {
        setWordsDirty(false);
        state.wordsSaved = null; // vuelve a cargar lo guardado
        renderWordsEditor(state.lastDto);
        announce('Palabras guardadas.');
      },
      onError: function (error) {
        if (error && error.code === 'INVALID_WORDS') { setFieldError('words-text', error.message); $('words-text').focus(); return true; }
        return false;
      },
    });
  }

  /* ---------- Carta secreta ---------- */

  function showCard() {
    var me = state.me;
    if (!me || !me.role) return;
    var content = $('card-content');
    content.textContent = '';
    if (me.role === 'impostor') {
      content.appendChild(icon('i-mask', 'secret-icon'));
      content.appendChild(el('p', 'secret-impostor', 'Eres el impostor'));
      content.appendChild(el('p', 'secret-label', 'No conoces la palabra: escucha las pistas y disimula.'));
    } else {
      content.appendChild(el('p', 'secret-label', 'La palabra secreta es'));
      content.appendChild(el('p', 'secret-word', me.word));
    }
    content.setAttribute('data-role', me.role);
    state.cardVisible = true;
    $('card-hint').textContent = me.role === 'impostor'
      ? 'Deduce la palabra por las pistas y pasa desapercibido.'
      : 'Da pistas sin revelar la palabra al impostor.';
    if (!state.cardSeen) { state.cardSeen = true; if (state.lastDto) renderRoles(state.lastDto); }
    $('playing-card').setAttribute('data-flipped', 'true');
    $('toggle-card-text').textContent = 'Ocultar mi carta';
    $('toggle-card').setAttribute('aria-expanded', 'true');
  }

  function hideCard() {
    $('card-content').textContent = ''; // la palabra no queda en el DOM mientras está oculta
    $('card-content').removeAttribute('data-role');
    state.cardVisible = false;
    $('card-hint').textContent = 'Toca «Ver mi carta» cuando nadie esté mirando tu pantalla.';
    $('playing-card').setAttribute('data-flipped', 'false');
    $('toggle-card-text').textContent = 'Ver mi carta';
    $('toggle-card').setAttribute('aria-expanded', 'false');
  }

  /* ---------- Fases ---------- */

  function renderRoles(dto) {
    if (!dto.ready) return;
    $('ready-count').textContent = 'Preparados: ' + dto.ready.count + ' de ' + dto.ready.total + '.';
    $('ready-num').textContent = String(dto.ready.count);
    $('ready-total').textContent = String(dto.ready.total);
    var button = $('ready-btn');
    var help = $('ready-help');
    if (dto.ready.mine) {
      button.hidden = true;
      help.className = 'listen-box';
      help.textContent = 'Ya estás listo. Esperando al resto del equipo…';
    } else {
      button.hidden = false;
      button.disabled = !state.cardSeen || state.actionBusy > 0;
      help.className = 'help';
      help.textContent = state.cardSeen ? 'Cuando confirmes, espera a que el resto del equipo esté listo.' : 'Primero abre tu carta para confirmar.';
    }
  }

  function renderClues(dto) {
    var turn = dto.turn;
    $('clue-form').hidden = !(turn && turn.isMine);
    $('skip-turn').hidden = !(turn && dto.me.isHost);
    if (!turn) { state.turnKey = null; return; }
    $('spotlight-name').textContent = turn.isMine ? 'Tú' : turn.name;
    $('clue-listen').hidden = turn.isMine;
    var chips = $('turn-chips');
    var chipsKey = JSON.stringify([turn.order, turn.index]);
    if (chips.getAttribute('data-key') !== chipsKey) {
      chips.setAttribute('data-key', chipsKey);
      chips.textContent = '';
      turn.order.forEach(function (name, i) {
        var position = i + 1;
        var li = el('li', 'turn-chip' + (position === turn.index ? ' is-current' : position < turn.index ? ' is-done' : ''), position + '. ' + name);
        if (position === turn.index) li.setAttribute('aria-current', 'step');
        chips.appendChild(li);
      });
    }
    var key = dto.gameId + ':' + dto.round + ':' + turn.index;
    $('turn-info').textContent = turn.isMine
      ? 'Es tu turno (' + turn.index + ' de ' + turn.total + ').'
      : 'Turno de ' + turn.name + ' (' + turn.index + ' de ' + turn.total + ').';
    $('turn-order').textContent = 'Orden de la vuelta ' + dto.round + ': ' + turn.order.join(' → ');
    if (key !== state.turnKey) {
      var changedWithinPhase = state.turnKey !== null && state.phase === 'clues';
      state.turnKey = key;
      $('clue-text').value = '';
      setFieldError('clue-text', null);
      updateClueCounter();
      if (changedWithinPhase) {
        announce(turn.isMine ? 'Es tu turno de dar una pista.' : 'Turno de ' + turn.name + '.');
        if (turn.isMine) $('clue-text').focus();
      }
    }
  }

  function updateClueCounter() {
    $('clue-counter').textContent = '(' + graphemes(normalizeSpaces($('clue-text').value)) + ' de ' + LIMITS.clueMax + ')';
  }

  function submitClue(event) {
    event.preventDefault();
    var text = normalizeSpaces($('clue-text').value);
    var length = graphemes(text);
    if (length === 0 || length > LIMITS.clueMax) {
      setFieldError('clue-text', length === 0 ? 'Escribe una palabra o frase.' : 'La pista admite hasta ' + LIMITS.clueMax + ' caracteres.');
      $('clue-text').focus();
      return;
    }
    setFieldError('clue-text', null);
    sendAction('clue', { text: text }, {
      button: $('clue-form').querySelector('button[type="submit"]'),
      onError: function (error) {
        if (error && error.code === 'INVALID_CLUE') { setFieldError('clue-text', error.message); $('clue-text').focus(); return true; }
        return false;
      },
    });
  }

  function renderDiscussion(dto) {
    $('open-voting').hidden = !(dto.me.isHost && dto.phase === 'discussion');
    $('discussion-wait').hidden = dto.me.isHost;
  }

  function renderVote(dto) {
    var vote = dto.vote;
    if (!vote) { state.voteKey = ''; return; }
    $('vote-progress').textContent = vote.participation + ' de ' + vote.eligible + ' votaron (se necesitan ' + vote.quorum + ' para señalar a alguien).';
    $('vote-num').textContent = String(vote.participation);
    $('vote-total').textContent = String(vote.eligible);
    $('vote-bar').style.width = (vote.eligible ? Math.round((vote.participation / vote.eligible) * 100) : 0) + '%';
    var voted = vote.myVote !== null;
    $('vote-form').hidden = voted || !vote.canVote;
    $('vote-done').hidden = !voted;
    var key = dto.gameId + ':' + dto.round + ':' + JSON.stringify(vote.candidates);
    if (key !== state.voteKey) {
      state.voteKey = key;
      var box = $('vote-options');
      box.textContent = '';
      vote.candidates.forEach(function (c) {
        var label = el('label', 'vote-option');
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = 'vote-target';
        input.value = c.id;
        input.checked = state.voteSelection === c.id;
        input.addEventListener('change', function () { state.voteSelection = c.id; $('vote-form-error').hidden = true; });
        label.appendChild(input);
        label.appendChild(avatar({ name: c.name }));
        label.appendChild(el('span', 'vote-name', c.name));
        box.appendChild(label);
      });
    }
    var host = dto.me.isHost;
    $('close-vote').hidden = !host;
    $('close-vote-help').hidden = !host;
    $('close-vote').disabled = vote.participation < vote.quorum || state.actionBusy;
    $('close-vote-help').textContent = vote.participation < vote.quorum
      ? 'Podrás cerrar antes cuando voten al menos ' + vote.quorum + '.'
      : 'Ya hay participación suficiente para cerrar.';
  }

  function submitVote(event) {
    event.preventDefault();
    if (!state.voteSelection) {
      $('vote-form-error').textContent = 'Elige a una persona antes de confirmar.';
      $('vote-form-error').hidden = false;
      return;
    }
    $('vote-form-error').hidden = true;
    sendAction('vote', { targetId: state.voteSelection }, { button: $('vote-form').querySelector('button[type="submit"]') });
  }

  function renderTally(listId, tally, highlightName) {
    var list = $(listId);
    list.textContent = '';
    if (!tally || tally.length === 0) { list.appendChild(el('li', null, 'Nadie votó.')); return; }
    var max = tally.reduce(function (m, t) { return Math.max(m, t.votes); }, 0) || 1;
    tally.forEach(function (t) {
      var li = el('li', 'tally-row' + (highlightName && t.name === highlightName ? ' is-accused' : ''));
      li.appendChild(el('span', 'tally-name', t.name));
      var track = el('span', 'tally-track');
      track.setAttribute('aria-hidden', 'true');
      var bar = el('span', 'tally-bar');
      bar.style.width = Math.round((t.votes / max) * 100) + '%';
      track.appendChild(bar);
      li.appendChild(track);
      li.appendChild(el('span', 'tally-votes', votesText(t.votes)));
      list.appendChild(li);
    });
  }

  function renderReveal(dto) {
    if (dto.phase !== 'reveal' || !dto.outcome) return;
    var o = dto.outcome;
    $('reveal-reason').textContent = o.kind === 'tie'
      ? 'Hubo un empate entre los más votados.'
      : 'Votaron ' + o.participation + ' de ' + o.eligible + '; se necesitaban ' + o.quorum + '.';
    renderTally('reveal-tally', o.tally);
    $('next-round').hidden = !dto.me.isHost;
  }

  function renderGuess(dto) {
    if (dto.phase !== 'guess' || !dto.outcome) return;
    var o = dto.outcome;
    $('guess-info').textContent = o.canGuess
      ? 'Te descubrieron con ' + votesText(o.votesFor) + '. Adivina la palabra secreta para ganar.'
      : 'El equipo señaló a ' + o.accusedName + ' (' + votesText(o.votesFor) + ') y era el impostor. Tiene 45 segundos para adivinar la palabra.';
    $('guess-form').hidden = !o.canGuess;
    $('guess-wait').hidden = o.canGuess;
    $('guess-wait').textContent = 'Esperando la respuesta de ' + o.accusedName + '…';
  }

  function submitGuess(event) {
    event.preventDefault();
    var text = normalizeSpaces($('guess-text').value);
    if (!text || graphemes(text) > LIMITS.guessMax) {
      setFieldError('guess-text', 'Escribe tu respuesta (hasta ' + LIMITS.guessMax + ' caracteres).');
      $('guess-text').focus();
      return;
    }
    setFieldError('guess-text', null);
    sendAction('guess', { text: text }, { button: $('guess-form').querySelector('button[type="submit"]') });
  }

  function renderFinished(dto) {
    if (dto.phase !== 'finished' || !dto.result) return;
    var o = dto.outcome;
    var r = dto.result;
    var teamWon = r.winner === 'team';
    $('finished-title').textContent = teamWon ? '¡Ganó el equipo!' : 'Ganó el impostor';
    $('result-banner').setAttribute('data-winner', teamWon ? 'team' : 'impostor');
    $('result-icon-use').setAttribute('href', teamWon ? '#i-trophy' : '#i-mask');
    var lead;
    if (o.kind === 'innocentAccused') lead = 'El equipo señaló a una persona inocente y el impostor se salvó.';
    else if (r.guessCorrect) lead = 'Lo descubrieron, pero adivinó la palabra secreta.';
    else lead = 'Descubrieron al impostor y no adivinó la palabra.';
    $('result-lead').textContent = lead;
    var iWon = dto.me.role === 'impostor' ? !teamWon : teamWon;
    $('result-personal').textContent = iWon ? 'Ganaste esta ronda' : 'Esta vez perdiste';
    $('result-personal').className = 'result-personal ' + (iWon ? 'is-win' : 'is-loss');

    // Revelación: quién era y cuál era la palabra.
    $('reveal-impostor-name').textContent = r.impostorName + (dto.me.role === 'impostor' ? ' (tú)' : '');
    var holder = $('reveal-impostor-avatar');
    holder.textContent = '';
    holder.appendChild(avatar({ name: r.impostorName }));
    $('reveal-word').textContent = r.word;

    // Pasos: votación y, si lo descubrieron, la adivinanza.
    var steps = $('result-steps');
    steps.textContent = '';
    var step = function (title, parts, verdict, good) {
      var li = el('li', 'result-step');
      var body = el('div', 'result-step-body');
      body.appendChild(el('span', 'result-step-title', title));
      var p = el('p', 'result-step-text');
      parts.forEach(function (part) { p.appendChild(typeof part === 'string' ? document.createTextNode(part) : part); });
      body.appendChild(p);
      li.appendChild(body);
      var tag = el('span', 'verdict ' + (good ? 'is-good' : 'is-bad'));
      tag.appendChild(icon(good ? 'i-check' : 'i-x'));
      tag.appendChild(document.createTextNode(verdict));
      li.appendChild(tag);
      steps.appendChild(li);
    };
    var accused = el('strong', null, o.accusedName);
    if (o.kind === 'innocentAccused') {
      step('Votación', ['El equipo señaló a ', accused, ' con ' + votesText(o.votesFor) + '.'], 'Era inocente', false);
    } else {
      step('Votación', ['El equipo señaló a ', accused, ' con ' + votesText(o.votesFor) + '.'], 'Era el impostor', true);
      if (r.guess === null) step('Adivinanza', ['No respondió a tiempo.'], 'Sin respuesta', true);
      else if (r.guessCorrect) step('Adivinanza', ['Respondió «', el('strong', null, r.guess), '».'], 'Acertó', false);
      else step('Adivinanza', ['Respondió «', el('strong', null, r.guess), '».'], 'No era la palabra', true);
    }
    renderTally('finished-tally', o.tally, o.accusedName);

    // Quién sumó punto en esta ronda (RF-009.05).
    var box = $('round-points');
    box.textContent = '';
    box.hidden = !dto.series;
    if (dto.series) {
      var winners = dto.players.filter(function (p) { return (p.name === r.impostorName) !== teamWon; });
      box.appendChild(el('span', 'round-points-label', 'Suman 1 punto:'));
      winners.forEach(function (p) {
        var chip = el('span', 'point-chip' + (p.isMe ? ' is-me' : ''));
        chip.appendChild(avatar(p));
        chip.appendChild(document.createTextNode(p.name + (p.isMe ? ' (tú)' : '')));
        box.appendChild(chip);
      });
    }
    $('reflection-text').textContent = r.reflection.text;
    $('reflection-question').textContent = r.reflection.question;
    renderSeriesEnd(dto);
  }

  /** Pausa entre rondas o podio final de la serie (RF-009.04, RF-009.06). */
  function renderSeriesEnd(dto) {
    var series = dto.series;
    var complete = !series || series.complete;
    $('finished-round').textContent = series ? 'Ronda ' + series.current + ' de ' + series.total : '';
    $('finished-round').hidden = !series || series.total === 1;
    var waiting = Boolean(dto.result && dto.result.hasNextRound);
    $('next-round-area').hidden = !waiting;
    $('next-game').hidden = !(waiting && dto.me.isHost);
    $('podium-area').hidden = !(complete && series);
    $('play-again').hidden = !(complete && dto.me.isHost);
    if (complete && series) {
      renderPodium(series.scores);
      var key = dto.gameId;
      if (state.seriesAnnounced !== key) {
        state.seriesAnnounced = key;
        var winners = series.scores.filter(function (s) { return s.rank === 1; }).map(function (s) { return s.name; });
        announce('Terminó la serie. Primer puesto: ' + winners.join(' y ') + '.');
      }
    }
  }

  function renderPodium(scores) {
    var key = JSON.stringify(scores);
    if (key === state.podiumKey) return;
    state.podiumKey = key;
    var podium = $('podium');
    podium.textContent = '';
    var places = { 1: 'Primer puesto', 2: 'Segundo puesto', 3: 'Tercer puesto' };
    [1, 2, 3].forEach(function (rank) {
      var group = scores.filter(function (s) { return s.rank === rank; });
      if (group.length === 0) return;
      var li = el('li', 'podium-step podium-' + rank);
      li.setAttribute('data-rank', String(rank));
      li.appendChild(el('span', 'visually-hidden', places[rank] + ': '));
      var names = el('div', 'podium-names');
      group.forEach(function (s) {
        var who = el('span', 'podium-name' + (s.isMe ? ' is-me' : ''));
        who.appendChild(avatar({ name: s.name }));
        who.appendChild(el('span', null, s.name + (s.isMe ? ' (tú)' : '')));
        names.appendChild(who);
      });
      li.appendChild(names);
      li.appendChild(el('span', 'podium-points', pointsText(group[0].points)));
      var block = el('span', 'podium-block', String(rank));
      block.setAttribute('aria-hidden', 'true');
      li.appendChild(block);
      podium.appendChild(li);
    });
    var ranking = $('ranking');
    ranking.textContent = '';
    scores.forEach(function (s) {
      var li = el('li', 'ranking-row' + (s.isMe ? ' is-me' : ''));
      li.appendChild(el('span', 'ranking-rank', s.rank + '.º'));
      li.appendChild(el('span', 'ranking-name', s.name + (s.isMe ? ' (tú)' : '')));
      li.appendChild(el('span', 'ranking-points', pointsText(s.points)));
      ranking.appendChild(li);
    });
  }

  /** Mesa: quién está en turno, quién ya dio pista y los puntos (RF-010.04). */
  function renderTable(dto) {
    var key = JSON.stringify(dto.players.map(function (p) { return [p.id, p.name, p.connected, p.points, p.turnState, p.isHost]; }));
    if (key === state.tableKey) return;
    state.tableKey = key;
    var list = $('table-list');
    list.textContent = '';
    dto.players.forEach(function (p) {
      var li = el('li', 'seat' + (p.turnState === 'current' ? ' is-current' : '') + (p.connected ? '' : ' is-offline'));
      li.setAttribute('data-testid', 'seat');
      if (p.turnState === 'current') li.setAttribute('aria-current', 'step');
      li.appendChild(avatar(p));
      var info = el('span', 'seat-info');
      var name = el('span', 'seat-name', p.name);
      if (p.isMe) name.appendChild(el('span', 'seat-me', ' (tú)'));
      info.appendChild(name);
      var meta = [];
      if (p.isHost) meta.push('Anfitrión');
      if (!p.connected) meta.push('Desconectado');
      if (meta.length) info.appendChild(el('span', 'seat-meta', meta.join(', ')));
      li.appendChild(info);
      if (p.turnState) {
        var status = el('span', 'seat-status seat-' + p.turnState);
        if (p.turnState === 'current') status.appendChild(icon('i-clock'));
        else if (p.turnState === 'done') status.appendChild(icon('i-check'));
        status.appendChild(document.createTextNode(TURN_STATE_LABELS[p.turnState]));
        li.appendChild(status);
      }
      if (typeof p.points === 'number') li.appendChild(el('span', 'seat-points', pointsText(p.points)));
      list.appendChild(li);
    });
  }

  /** Paneles compartidos: barra de fase, carta, pistas y controles del anfitrión. */
  function renderPanels(dto) {
    if (!dto || !state.code) return;
    var phase = dto.phase;
    var active = ACTIVE_PHASES.indexOf(phase) !== -1;
    $('phase-bar').hidden = !(active || phase === 'finished');
    $('phase-label').textContent = PHASE_LABELS[phase] || '';
    if (PHASE_ICONS[phase]) $('phase-icon').setAttribute('href', '#' + PHASE_ICONS[phase]);
    var series = dto.series;
    $('round-label').textContent = series ? 'Ronda ' + series.current + ' de ' + series.total : '';
    $('lap-label').textContent = dto.round && phase !== 'finished' ? 'Vuelta ' + dto.round : '';
    $('lap-label').hidden = !$('lap-label').textContent;
    $('timer-wrap').hidden = !dto.deadline;
    $('secret-panel').hidden = !active;
    $('table-panel').hidden = !(active || phase === 'finished');
    if (!$('table-panel').hidden) renderTable(dto);
    $('game-layout').setAttribute('data-active', active || phase === 'finished' ? 'true' : 'false');
    var showClues = ['clues', 'discussion', 'vote', 'reveal', 'guess', 'finished'].indexOf(phase) !== -1;
    $('clues-panel').hidden = !showClues;
    if (showClues) renderClueHistory(dto.clues);
    if (showClues) {
      var lap = dto.round ? dto.clues.filter(function (c) { return c.round === dto.round; }).length : 0;
      var total = dto.turn ? dto.turn.total : dto.players.length;
      var badgeText = phase === 'finished' ? '' : lap + '/' + total;
      $('clue-count').textContent = badgeText;
      $('clue-count').hidden = !badgeText;
      $('clue-count').setAttribute('aria-label', lap + ' de ' + total + ' pistas en esta vuelta');
    }
    var showChip = (active || phase === 'finished') && Boolean(dto.code);
    $('room-chip').hidden = !showChip;
    if ($('room-chip-code').textContent !== dto.code) $('room-chip-code').textContent = dto.code;
    var hostActive = dto.me.isHost && active;
    $('host-controls').hidden = !hostActive;
    if (!hostActive) $('reset-confirm').hidden = true;
  }

  function renderClueHistory(clues) {
    var key = JSON.stringify(clues);
    if (key === state.cluesKey) return;
    state.cluesKey = key;
    var box = $('clue-history');
    box.textContent = '';
    if (clues.length === 0) { box.appendChild(el('p', 'help', 'Todavía no hay pistas.')); return; }
    var rounds = {};
    clues.forEach(function (c) { (rounds[c.round] = rounds[c.round] || []).push(c); });
    Object.keys(rounds).forEach(function (round) {
      box.appendChild(el('h3', null, 'Vuelta ' + round));
      var list = el('ol');
      rounds[round].forEach(function (c) {
        var li = el('li');
        li.appendChild(el('span', 'clue-name', c.name + ': '));
        li.appendChild(c.skipped ? el('span', 'clue-skipped', 'Sin pista') : el('span', null, c.text));
        list.appendChild(li);
      });
      box.appendChild(list);
    });
  }

  function updateTimer() {
    clearInterval(state.timerInterval);
    if (!state.deadline) return;
    var tick = function () {
      var remaining = Math.max(0, state.deadline - (Date.now() + state.clockOffset));
      var seconds = Math.ceil(remaining / 1000);
      var text = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
      if ($('phase-timer').textContent !== text) $('phase-timer').textContent = text;
      if ($('next-round-timer').textContent !== text) $('next-round-timer').textContent = text;
      var short = seconds + ' s';
      var counters = document.querySelectorAll('[data-countdown]');
      for (var c = 0; c < counters.length; c += 1) if (counters[c].textContent !== short) counters[c].textContent = short;
      $('phase-timer').classList.toggle('is-urgent', seconds <= 10 && seconds > 0);
      var dto = state.lastDto;
      if (dto && dto.turn && dto.turn.isMine && seconds <= 10 && seconds > 0 && state.warnedTurnKey !== state.turnKey) {
        state.warnedTurnKey = state.turnKey;
        announce('Quedan 10 segundos para tu pista.');
      }
      if (remaining === 0) clearInterval(state.timerInterval);
    };
    tick();
    state.timerInterval = setInterval(tick, 1000);
  }

  /* ---------- Acciones ---------- */

  function sendAction(type, payload, options) {
    var opts = options || {};
    var button = opts.button;
    if (!state.code || (button && button.getAttribute('aria-busy') === 'true')) return;
    state.actionBusy += 1;
    if (type === 'leave') state.leaving = true;
    setFormAlert('action-error', null);
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    var body = { code: state.code, type: type, actionId: newActionId() };
    if (payload) body.payload = payload;
    if (state.gameId) body.gameId = state.gameId;
    var generation = state.generation;
    request('POST', '/api/action', body)
      .then(function (r) {
        if (type === 'leave' && r.ok) { leaveRoomLocally('Saliste de la sala.'); return; }
        if (generation !== state.generation) return;
        if (r.ok && r.data) {
          applyRoom(r.data);
          if (opts.onSuccess) opts.onSuccess(r.data);
        } else if (r.status === 401 || r.status === 404) {
          fatal(r.status === 401 ? 'session' : 'gone');
        } else {
          var error = r.data && r.data.error;
          if (!(opts.onError && opts.onError(error))) {
            setFormAlert('action-error', error ? error.message : 'No pudimos completar la acción. Inténtalo de nuevo.');
          }
        }
      }, function () {
        if (type === 'leave') state.leaving = false;
        setFormAlert('action-error', 'No pudimos contactar con el servidor. Inténtalo de nuevo.');
      })
      .finally(function () {
        state.actionBusy = Math.max(0, state.actionBusy - 1);
        if (button) { button.removeAttribute('aria-busy'); button.disabled = false; }
        if (state.lastDto && state.code) {
          renderLobby(state.lastDto); // recalcula los botones con el último estado
          renderRoles(state.lastDto);
          renderVote(state.lastDto);
        }
      });
  }

  function drawQr(text, code) {
    var canvas = $('qr-canvas');
    state.qrText = text;
    try {
      if (typeof window.qrcode !== 'function') throw new Error('qr_unavailable');
      var qr = window.qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      var modules = qr.getModuleCount();
      var quiet = 4;
      var scale = 8;
      var size = (modules + quiet * 2) * scale;
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#000000';
      for (var r = 0; r < modules; r += 1) {
        for (var c = 0; c < modules; c += 1) {
          if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
      canvas.setAttribute('aria-label', 'Código QR con el enlace de invitación a la sala ' + code);
      canvas.hidden = false;
      $('qr-error').hidden = true;
    } catch (e) {
      canvas.hidden = true;
      $('qr-error').hidden = false;
    }
  }

  function copyLink() {
    var input = $('invite-link');
    var feedback = $('copy-feedback');
    function failed() {
      feedback.textContent = 'No se pudo copiar. Selecciona el enlace y cópialo manualmente.';
      feedback.hidden = false;
      input.focus();
      input.select();
      announce(feedback.textContent);
    }
    if (!navigator.clipboard || !navigator.clipboard.writeText) { failed(); return; }
    navigator.clipboard.writeText(input.value).then(function () {
      feedback.textContent = 'Enlace copiado.';
      feedback.hidden = false;
      announce('Enlace copiado.');
    }, failed);
  }

  /** Compartir la invitación durante la partida: menú del sistema o copia al portapapeles. */
  function shareRoom() {
    var url = $('invite-link').value || (window.location.origin + '/?sala=' + state.code);
    var label = $('share-room-text');
    var done = function (text) {
      label.textContent = text;
      announce(text === 'Copiado' ? 'Enlace de invitación copiado.' : text);
      setTimeout(function () { label.textContent = 'Compartir'; }, 2000);
    };
    if (navigator.share) {
      navigator.share({ title: 'Farsante Scrum', text: 'Únete a la sala ' + state.code, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { done('Copiado'); }, function () { done('No se pudo copiar'); });
    } else {
      done('No se pudo copiar');
    }
  }

  /* ---------- Sincronización (ADR-0003) ---------- */

  function setConnection(ok) {
    if (state.connected === ok) return;
    state.connected = ok;
    $('connection').classList.toggle('is-reconnecting', !ok);
    $('connection-text').textContent = ok ? 'Conectado' : 'Reconectando…';
    announce(ok ? 'Conexión recuperada.' : 'Reconectando…');
  }

  function stopSync() {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
    if (state.controller) state.controller.abort();
    state.controller = null;
    if (state.eventSource) state.eventSource.close();
    state.eventSource = null;
  }

  function startSync(mode) {
    state.syncMode = mode === 'sse' && typeof window.EventSource === 'function' ? 'sse' : 'poll';
    if (state.syncMode === 'sse') startSse();
    else schedulePoll(LIMITS.pollIntervalMs);
  }

  function schedulePoll(delay) {
    clearTimeout(state.pollTimer);
    state.pollTimer = setTimeout(poll, delay);
  }

  function backoffDelay() {
    return BACKOFF_MS[Math.min(state.failures - 1, BACKOFF_MS.length - 1)];
  }

  function poll() {
    if (!state.code || state.controller) return;
    var generation = state.generation;
    var code = state.code;
    var call = withTimeout(function (signal) { return fetchState(code, signal); });
    state.controller = call.controller;
    call.promise.then(function (result) {
      if (generation !== state.generation) return; // cambió la sala: descartar
      state.controller = null;
      if (result.kind === 'ok') {
        state.failures = 0;
        setConnection(true);
        var wasPending = state.lastVersion === -1;
        applyRoom(result.dto);
        if (wasPending) { showView(viewForPhase(result.dto.phase)); renderPanels(result.dto); }
        if (result.dto.sync && result.dto.sync.mode === 'sse' && state.syncMode !== 'sse') { startSync('sse'); return; }
        schedulePoll(LIMITS.pollIntervalMs);
      } else if (result.kind === 'session' || result.kind === 'gone') {
        fatal(result.kind);
      } else {
        state.failures += 1;
        setConnection(false); // 5xx o red: nunca se borra la sesión
        schedulePoll(backoffDelay());
      }
    });
  }

  function startSse() {
    var generation = state.generation;
    var es = new EventSource('/api/events?code=' + encodeURIComponent(state.code));
    state.eventSource = es;
    es.onmessage = function (event) {
      if (generation !== state.generation) return;
      state.failures = 0;
      setConnection(true);
      try { applyRoom(JSON.parse(event.data)); } catch (e) { /* mensaje ilegible: se ignora */ }
    };
    es.addEventListener('gone', function () {
      if (generation !== state.generation) return;
      // La sala puede seguir existiendo (el anfitrión nos quitó): preguntar para explicar bien.
      var code = state.code;
      stopSync();
      fetchState(code).then(function (r) {
        if (generation !== state.generation) return;
        if (r.kind === 'ok') { enterRoom(r.dto); return; }
        if (r.kind === 'unavailable') { startSse(); return; }
        fatal(r.kind === 'session' ? 'session' : 'gone');
      });
    });
    es.onerror = function () {
      if (generation !== state.generation) return;
      setConnection(false);
      if (es.readyState === EventSource.CLOSED) {
        state.eventSource = null;
        state.failures += 1;
        fetchState(state.code).then(function (result) {
          if (generation !== state.generation) return;
          if (result.kind === 'session' || result.kind === 'gone') fatal(result.kind);
          else setTimeout(function () { if (generation === state.generation) startSse(); }, backoffDelay());
        });
      }
    };
  }

  function fatal(kind) {
    if (state.leaving) { leaveRoomLocally('Saliste de la sala.'); return; } // el servidor ya nos quitó de la sala
    stopSync();
    clearInterval(state.timerInterval);
    state.generation += 1;
    if (readStorage() === state.code) writeStorage(null);
    state.code = null;
    state.phase = null;
    $('fatal-message').textContent = kind === 'session'
      ? 'Tu sesión ya no pertenece a esta sala: saliste, se borraron los datos del navegador o el anfitrión te quitó. Puedes volver a unirte con el código.'
      : 'Esta sala expiró o ya no existe. Crea una sala nueva o pide un código nuevo.';
    showView('fatal');
  }

  /* ---------- Arranque ---------- */

  function showInvite(code, otherRoom) {
    $('invite-code-label').textContent = code;
    $('invite-code').value = code;
    var notice = $('invite-other-room');
    if (otherRoom) {
      $('invite-other-code').textContent = otherRoom;
      $('invite-other-code-2').textContent = otherRoom;
      notice.hidden = false;
    } else {
      notice.hidden = true;
    }
    showView('invite', false);
    $('invite-name').focus();
  }

  function bind(id, type, handler) {
    $(id).addEventListener(type, handler);
  }

  function boot() {
    bind('create-form', 'submit', submitCreate);
    bind('join-form', 'submit', submitJoin('join'));
    bind('invite-form', 'submit', submitJoin('invite'));
    bind('copy-link', 'click', copyLink);
    bind('start-game', 'click', function () { sendAction('start', null, { button: $('start-game') }); });
    bind('ready-btn', 'click', function () { sendAction('ready', null, { button: $('ready-btn') }); });
    bind('toggle-card', 'click', function () { if (state.cardVisible) hideCard(); else showCard(); });
    bind('words-form', 'submit', submitWords);
    bind('words-group', 'change', onGroupChange);
    bind('words-text', 'input', function () { setWordsDirty(true); });
    bind('clue-form', 'submit', submitClue);
    bind('clue-text', 'input', updateClueCounter);
    bind('skip-turn', 'click', function () { sendAction('skip', null, { button: $('skip-turn') }); });
    bind('open-voting', 'click', function () { sendAction('voting', null, { button: $('open-voting') }); });
    bind('vote-form', 'submit', submitVote);
    bind('close-vote', 'click', function () { sendAction('closeVote', null, { button: $('close-vote') }); });
    bind('next-round', 'click', function () { sendAction('next', null, { button: $('next-round') }); });
    bind('guess-form', 'submit', submitGuess);
    bind('share-room', 'click', shareRoom);
    bind('next-game', 'click', function () { sendAction('nextGame', null, { button: $('next-game') }); });
    bind('settings-form', 'submit', submitSettings);
    bind('settings-form', 'change', function () { setSettingsDirty(true); });
    fillSettingSelects('create', { rounds: 1, turnSeconds: 60, voteSeconds: 75 });
    bind('play-again', 'click', function () { sendAction('playAgain', null, { button: $('play-again') }); });
    bind('leave-lobby', 'click', function () { sendAction('leave', null, { button: $('leave-lobby') }); });
    bind('leave-finished', 'click', function () { sendAction('leave', null, { button: $('leave-finished') }); });
    bind('reset-game', 'click', function () { $('reset-confirm').hidden = false; $('reset-confirm-no').focus(); });
    bind('reset-confirm-no', 'click', function () { $('reset-confirm').hidden = true; $('reset-game').focus(); });
    bind('reset-confirm-yes', 'click', function () {
      $('reset-confirm').hidden = true;
      sendAction('reset', null, { button: $('reset-confirm-yes') });
    });
    bind('fatal-home', 'click', function () {
      if (window.history && window.history.replaceState) window.history.replaceState(null, '', '/');
      showView('home');
    });
    bind('back-to-room', 'click', function () {
      var other = $('invite-other-code').textContent;
      fetchState(other).then(function (r) {
        state.code = other;
        if (r.kind === 'ok') enterRoom(r.dto);
        else fatal(r.kind === 'session' ? 'session' : 'gone');
      });
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && state.code && state.syncMode === 'poll' && !state.controller) schedulePoll(0);
    });

    var params = new URLSearchParams(window.location.search);
    var invitedRaw = params.get('sala');
    var stored = readStorage();

    if (invitedRaw !== null) {
      var invited = normalizeCode(invitedRaw);
      if (!isValidCode(invited)) { showInvite(invited, null); return; }
      // Si ya hay sesión en esa sala (cookie), se recupera aunque falle el almacenamiento local.
      fetchState(invited).then(function (r) {
        if (r.kind === 'ok') { state.code = invited; enterRoom(r.dto); return; }
        if (!stored || stored === invited) { showInvite(invited, null); return; }
        fetchState(stored).then(function (other) { showInvite(invited, other.kind === 'ok' ? stored : null); });
      });
      return;
    }

    if (stored) {
      fetchState(stored).then(function (r) {
        state.code = stored;
        if (r.kind === 'ok') enterRoom(r.dto);
        else if (r.kind === 'unavailable') enterRoomPending(stored);
        else fatal(r.kind);
      });
      return;
    }

    showView('home', false);
  }

  boot();
})();
