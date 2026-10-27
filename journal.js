(function () {
  'use strict';
  var SB = 'https://fdiitxhgfytvlbtokbok.supabase.co';
  var KEY = 'sb_publishable_JQMFDaTz5g-2ZlitosUTeA_C9B48-Lc';
  var slug = (location.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
  var LS = 'tmbj:' + slug;
  var $ = function (id) { return document.getElementById(id); };
  var state = null, timers = {}, flushing = false;

  function read() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }
  function write() { try { localStorage.setItem(LS, JSON.stringify(state)); return true; } catch (e) { return false; } }
  function clear() { try { localStorage.removeItem(LS); } catch (e) {} }

  function rpc(name, args) {
    return fetch(SB + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) { var e = new Error((j && j.message) || 'server'); e.server = true; throw e; }
        return j;
      });
    });
  }

  function status(text, warn) {
    var s = $('status');
    if (!text) { s.hidden = true; return; }
    s.textContent = text; s.className = 'syncpill' + (warn ? ' warn' : ''); s.hidden = false;
  }

  function when(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function canWrite(id) {
    return state.role === 'client' ? !/^coach-/.test(id) : /^coach-/.test(id);
  }

  function showGate(msg) {
    $('book').innerHTML = ''; $('toolbar').hidden = true; $('nobook').hidden = true;
    $('gate').hidden = false; $('gateerr').textContent = msg || '';
    status('');
    setTimeout(function () { $('code').focus(); }, 50);
  }

  function render() {
    $('gate').hidden = true; $('nobook').hidden = true;
    document.title = state.title + ' · Coaching Journal';
    $('book').innerHTML = state.content_html;
    $('toolbar').hidden = false;
    var poss = state.name + (/s$/i.test(state.name) ? "'" : "'s");
    $('whoami').textContent = state.role === 'coach' ? 'Coach view: reading ' + poss + ' coaching journal' : poss + ' coaching journal';
    var fields = $('book').querySelectorAll('textarea[id]');
    Array.prototype.forEach.call(fields, function (t) {
      var id = t.id, e = state.entries[id];
      t.value = state.pending[id] != null ? state.pending[id] : (e ? e.body : '');
      var note = $('book').querySelector('.saved[data-for="' + id + '"]');
      if (!canWrite(id)) {
        t.readOnly = true;
        if (note) note.textContent = e && e.body ? 'Last written ' + when(e.updated_at) : 'Nothing written yet';
        return;
      }
      if (note && e && e.updated_at) note.textContent = 'Saved ' + when(e.updated_at);
      t.addEventListener('input', function () {
        state.pending[id] = t.value; write();
        if (note) note.textContent = 'Saving…';
        clearTimeout(timers[id]);
        timers[id] = setTimeout(flush, 900);
      });
    });
  }

  function noteFor(id, text) {
    var n = $('book').querySelector('.saved[data-for="' + id + '"]');
    if (n) n.textContent = text;
  }

  function flush() {
    if (flushing || !state) return;
    var ids = Object.keys(state.pending);
    if (!ids.length) return;
    if (!navigator.onLine) { status('Offline. Saved on this device. It syncs when you are back online.', true); ids.forEach(function (id) { noteFor(id, 'Saved on this device'); }); return; }
    flushing = true;
    var id = ids[0], body = state.pending[id];
    rpc('coaching_save', { p_slug: slug, p_code: state.code, p_field: id, p_body: body }).then(function (res) {
      flushing = false;
      if (res && res.ok) {
        state.entries[id] = { body: body, updated_at: res.updated_at };
        if (state.pending[id] === body) delete state.pending[id];
        write(); noteFor(id, 'Saved ' + when(res.updated_at));
        if (Object.keys(state.pending).length) flush(); else status('All changes saved');
        setTimeout(function () { if (!Object.keys(state.pending).length) status(''); }, 2500);
      } else if (res && res.error === 'denied') {
        status('Your access code no longer works. Your notes are kept on this device.', true);
      } else {
        delete state.pending[id]; write(); noteFor(id, 'This space is read-only');
      }
    }).catch(function () {
      flushing = false;
      status('Could not reach the server. Saved on this device. Trying again soon.', true);
      ids.forEach(function (i) { noteFor(i, 'Saved on this device'); });
      setTimeout(flush, 15000);
    });
  }

  function open(code, remember) {
    return rpc('coaching_open', { p_slug: slug, p_code: code }).then(function (res) {
      if (!res || !res.ok) return false;
      var prev = state && state.code === code ? state : null;
      var entries = {};
      (res.entries || []).forEach(function (e) { entries[e.field_id] = { body: e.body, updated_at: e.updated_at, updated_by: e.updated_by }; });
      state = {
        code: code, remember: remember, role: res.role, name: res.name, title: res.title,
        content_html: res.content_html, entries: entries, pending: prev ? prev.pending : {}
      };
      if (remember) write(); else clear();
      render(); flush();
      return true;
    });
  }

  function refresh() {
    if (!state || !navigator.onLine || flushing) return;
    if (Object.keys(state.pending).length) { flush(); return; }
    var active = document.activeElement && document.activeElement.tagName === 'TEXTAREA';
    if (active) return;
    open(state.code, state.remember).then(function (ok) { if (!ok) { clear(); state = null; showGate('Your access code has changed. Ask Jim for the new one.'); } }).catch(function () {});
  }

  $('gateform').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var code = $('code').value.trim().toUpperCase();
    if (!code) { $('gateerr').textContent = 'Enter your access code.'; return; }
    $('open').disabled = true; $('gateerr').textContent = '';
    open(code, $('remember').checked).then(function (ok) {
      $('open').disabled = false;
      if (!ok) $('gateerr').textContent = 'That code does not match. Check it and try again.';
    }).catch(function (e) {
      $('open').disabled = false;
      $('gateerr').textContent = e && e.server && /too_many/.test(e.message) ? 'Too many attempts. Wait fifteen minutes and try again.' : 'Could not reach the server. Check your connection and try again.';
    });
  });

  $('signout').addEventListener('click', function () {
    if (state && Object.keys(state.pending).length && !confirmSignout()) return;
    clear(); state = null; showGate('');
  });
  function confirmSignout() {
    status('You have unsynced notes. Go online first, then sign out.', true);
    return false;
  }

  var pop = null, popFrom = null;
  function closePop() { if (pop) { pop.remove(); pop = null; if (popFrom) popFrom.focus(); popFrom = null; } }
  function openPop(btn) {
    closePop();
    var def = document.getElementById('def-' + btn.getAttribute('data-term'));
    if (!def) return;
    pop = document.createElement('div');
    pop.className = 'pop'; pop.setAttribute('role', 'dialog');
    var title = def.querySelector('dt').textContent;
    pop.setAttribute('aria-label', title);
    var b = document.createElement('b'); b.textContent = title; pop.appendChild(b);
    var body = def.querySelector('dd').cloneNode(true);
    while (body.firstChild) pop.appendChild(body.firstChild);
    var x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.setAttribute('aria-label', 'Close'); x.textContent = '\u00d7';
    x.addEventListener('click', closePop); pop.appendChild(x);
    document.body.appendChild(pop);
    var r = btn.getBoundingClientRect(), w = pop.offsetWidth;
    var left = Math.min(Math.max(16, r.left + window.scrollX), window.scrollX + document.documentElement.clientWidth - w - 16);
    pop.style.left = left + 'px'; pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
    popFrom = btn; x.focus();
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('.term');
    if (t) { ev.preventDefault(); if (popFrom === t) closePop(); else openPop(t); return; }
    if (pop && !pop.contains(ev.target)) closePop();
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closePop(); });

  window.addEventListener('online', function () { status('Back online. Syncing…'); flush(); });
  window.addEventListener('offline', function () { status('Offline. Your writing saves on this device.', true); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refresh(); });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }

  if (!slug) { $('nobook').hidden = false; return; }
  state = read();
  if (state && state.code && state.content_html) {
    state.pending = state.pending || {};
    render();
    if (navigator.onLine) refresh(); else status('Offline. Your writing saves on this device.', true);
  } else {
    state = null; showGate('');
  }
})();
