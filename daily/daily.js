/* Circuit Trace Daily — one free flow puzzle per day, the same board as the
   in-app Daily Challenge. No account, no cookies: progress lives only in this
   browser's localStorage. Puzzles come from puzzles.json, exported with the
   game's own generator (same date seed as the app). Board rules + neon look:
   ctboard.js. */
(function () {
  'use strict';

  var FIRST_DAY = Date.UTC(2026, 10, 16);   // Daily #1 = 16 Nov 2026
  var STORE = 'ctDaily';
  var LANG = (document.documentElement.lang || 'en').slice(0, 2);
  var STR = {
    en: { solved: 'Solved ✓', connected: ' connected', cells: ' cells', perfect: '★ Perfect', perfectLong: '★ Perfect: every cell filled',
          tip: 'Tip: fill every cell for ★ Perfect', bonusDone: '★ Bonus done!', day: 'day', days: 'days', streak: '-day streak',
          moves: ' moves', copied: 'Copied to clipboard!', waiting: 'Today’s puzzle is waiting in the app.',
          error: 'Could not load today’s puzzle. Please reload the page.', url: 'circuittrace.app/daily/',
          diodes: 'Diodes', portals: 'Portals' },
    nl: { solved: 'Opgelost ✓', connected: ' verbonden', cells: ' vakjes', perfect: '★ Perfect', perfectLong: '★ Perfect: elk vakje gevuld',
          tip: 'Tip: vul elk vakje voor ★ Perfect', bonusDone: '★ Bonus gehaald!', day: 'dag', days: 'dagen', streak: ' dagen op rij',
          moves: ' zetten', copied: 'Gekopieerd!', waiting: 'De puzzel van vandaag wacht op je in de app.',
          error: 'De puzzel van vandaag kon niet laden. Herlaad de pagina.', url: 'circuittrace.app/nl/daily/',
          diodes: 'Diodes', portals: 'Portals' },
    de: { solved: 'Gelöst ✓', connected: ' verbunden', cells: ' Felder', perfect: '★ Perfekt', perfectLong: '★ Perfekt: jedes Feld gefüllt',
          tip: 'Tipp: Fülle jedes Feld für ★ Perfekt', bonusDone: '★ Bonus geschafft!', day: 'Tag', days: 'Tage', streak: ' Tage in Folge',
          moves: ' Züge', copied: 'Kopiert!', waiting: 'Das heutige Rätsel wartet in der App auf dich.',
          error: 'Das heutige Rätsel konnte nicht geladen werden. Bitte lade die Seite neu.', url: 'circuittrace.app/de/daily/',
          diodes: 'Dioden', portals: 'Portale' }
  };
  var S = STR[LANG] || STR.en;
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function $(id) { return document.getElementById(id); }
  var canvas = $('dBoard');

  var board = null, key = '', num = 0, startedAt = 0, solvedSecs = null, timer = null, result = null, bonusLabel = null;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function keyToUTC(k) { var p = k.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + pad(s % 60); }

  // ---- storage (all optional: the page works without it)
  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) {} }
  function saveProgress() {
    var d = load();
    d.today = { key: key, startedAt: startedAt, state: board.state() };
    save(d);
  }
  function streak() {
    var solved = load().solved || {}, n = 0, t = keyToUTC(key);
    if (!solved[key]) t -= 86400000;           // today not solved yet: count up to yesterday
    for (;;) {
      var dt = new Date(t);
      var k = dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
      if (!solved[k]) break;
      n++; t -= 86400000;
    }
    return n;
  }

  function status() {
    $('dStatus').textContent = board.solved ? S.solved : board.connected() + ' / ' + board.pairCount + S.connected;
    var full = board.full(), bonus = $('dBonus'), cov = board.covered();
    if (bonusLabel === null) bonusLabel = bonus.textContent;
    bonus.classList.toggle('on', full);
    bonus.textContent = full ? S.bonusDone : cov ? '★ ' + cov + ' / ' + board.size * board.size + S.cells : bonusLabel;
    $('dUndo').disabled = !board.canUndo();
    $('dReset').disabled = board.solved;
  }
  function tick() {
    var secs = solvedSecs !== null ? solvedSecs : (startedAt ? (Date.now() - startedAt) / 1000 : 0);
    $('dTime').textContent = fmt(secs);
    var now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var left = Math.floor((mid - now) / 1000);
    $('dNext').textContent = pad(Math.floor(left / 3600)) + ':' + pad(Math.floor(left % 3600 / 60)) + ':' + pad(left % 60);
    if (key && todayKey() !== key) location.reload();
  }
  function startClock() {
    if (startedAt) return;
    startedAt = Date.now();
    tick(); timer = setInterval(tick, 500);
  }
  function win() {
    clearInterval(timer);
    solvedSecs = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    var d = load();
    d.solved = d.solved || {};
    d.solved[key] = { t: solvedSecs, m: board.moves, full: board.full() };
    d.today = { key: key, startedAt: startedAt, state: board.state() };
    save(d);
    tick(); status();
    var frame = $('dFrame');
    if (!RM) { frame.classList.remove('won'); void frame.offsetWidth; frame.classList.add('won'); }
    setTimeout(function () { showResult(d.solved[key], true); }, board.celebrationMs);
  }
  function chip(text, cls) {
    var s = document.createElement('span');
    s.className = 'dn-chip' + (cls ? ' ' + cls : '');
    s.textContent = text;
    return s;
  }
  function showResult(r, fresh) {
    result = r;
    solvedSecs = r.t;
    var chips = $('dChips');
    chips.textContent = '';
    chips.appendChild(r.full ? chip(S.perfectLong, 'gold') : chip(S.tip));
    var st = streak();
    if (st >= 1) chips.appendChild(chip('🔥 ' + st + ' ' + (st === 1 ? S.day : S.days), 'fire'));
    chips.appendChild(chip(r.m + S.moves));
    $('dControls').hidden = true;
    $('dResult').hidden = false;
    var big = $('dResTime');
    if (fresh && !RM) {                         // short count-up, then settle
      var t0 = performance.now(), dur = 700;
      (function step() {
        var u = Math.min(1, (performance.now() - t0) / dur);
        big.textContent = fmt(r.t * (1 - Math.pow(1 - u, 3)));
        if (u < 1) requestAnimationFrame(step);
      })();
      setTimeout(function () { $('dResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 120);
    } else big.textContent = fmt(r.t);
    status(); tick();
    clearInterval(timer); timer = setInterval(tick, 1000);
  }
  function shareText() {
    var st = streak(), parts = ['Circuit Trace Daily #' + num + ' ⚡ ' + fmt(solvedSecs)];
    if (result && result.full) parts.push(S.perfect.replace('★ ', ''));
    if (st >= 1) parts.push('🔥 ' + st + ' ' + (st === 1 ? S.day : S.days));
    return parts.join(' · ') + '  ' + S.url;
  }
  $('dShare').addEventListener('click', function () {
    var text = shareText();
    function copied(ok) { $('dShareMsg').textContent = ok ? S.copied : text; }
    if (navigator.share && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
      navigator.share({ text: text }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { copied(true); }, function () { copied(false); });
    } else copied(false);
  });
  $('dReset').addEventListener('click', function () { if (board) board.clear(); });
  $('dUndo').addEventListener('click', function () { if (board) board.undo(); });

  function init(data) {
    key = todayKey();
    num = Math.round((keyToUTC(key) - FIRST_DAY) / 86400000) + 1;
    var raw = data.puzzles[key];
    if (!raw) {
      $('dStatus').textContent = S.waiting;
      $('dMissing').hidden = false;
      return;
    }
    $('dNum').textContent = '#' + num;
    var puzzle = { size: data.size, pairs: raw.map(function (r) { return { c: r[0], a: [r[1], r[2]], b: [r[3], r[4]] }; }) };
    board = new CTBoard.Board(canvas, puzzle, {
      theme: 'neon', keyboard: true,
      onStart: startClock,
      onChange: function () { status(); if (!board.solved) saveProgress(); },
      onSolved: win
    });
    var d = load();
    if (d.today && d.today.key === key) {
      startedAt = d.today.startedAt || 0;
      board.load(d.today.state);
    }
    status();
    if (d.solved && d.solved[key]) { showResult(d.solved[key], false); return; }
    if (startedAt) { tick(); timer = setInterval(tick, 500); }
  }
  fetch('/daily/puzzles.json?v=1').then(function (r) { return r.json(); }).then(init).catch(function () {
    $('dStatus').textContent = S.error;
  });

  // ---- teaser: a diode and a portal puzzle from the app solving themselves
  var TEASER = [
    { tag: 'diodes', size: 6, pairs: [[0, 0, 0, 2, 4], [1, 4, 2, 0, 5], [2, 4, 4, 2, 5], [3, 3, 2, 1, 2]],
      diodes: [[1, 5, 0, 0], [2, 1, 1, 1], [2, 3, 4, 0]], portals: [],
      walks: [[[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [4, 5], [3, 5], [3, 4], [2, 4]],
              [[4, 2], [4, 1], [3, 1], [2, 1], [1, 1], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
              [[4, 4], [4, 3], [3, 3], [2, 3], [1, 3], [1, 4], [1, 5], [2, 5]], [[3, 2], [2, 2], [1, 2]]] },
    { tag: 'portals', size: 6, pairs: [[0, 0, 0, 2, 2], [1, 0, 1, 2, 3], [2, 1, 1, 4, 1], [3, 0, 5, 5, 3]],
      diodes: [], portals: [[5, 2, 0, 4]],
      walks: [[[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
              [[0, 1], [0, 2], [0, 3], [0, 4], [5, 2], [5, 1], [5, 0], [4, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3]],
              [[1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1]],
              [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [5, 4], [5, 3]]] }
  ];
  function teaser() {
    var cv = $('dTeaser');
    if (!cv || !window.CTBoard) return;
    var which = 0, tb = null, steps = [], si = 0, hold = 0;
    function setup() {
      var t = TEASER[which];
      $('dTeaserTag').textContent = S[t.tag];
      if (tb) tb.destroy();
      tb = new CTBoard.Board(cv, {
        size: t.size,
        pairs: t.pairs.map(function (r) { return { c: r[0], a: [r[1], r[2]], b: [r[3], r[4]] }; }),
        diodes: t.diodes.map(function (r) { return { dir: r[0], cell: [r[1], r[2]], color: r[3] }; }),
        portals: t.portals.map(function (r) { return { a: [r[0], r[1]], b: [r[2], r[3]] }; })
      }, { theme: 'neon', readonly: true });
      steps = [];
      t.walks.forEach(function (w, i) {
        for (var k = 2; k <= w.length; k++) steps.push({ c: t.pairs[i][0], n: k, w: w });
      });
      si = 0; hold = 0;
      if (RM) { show(steps.length); }
    }
    function show(upto) {
      var t = TEASER[which], paths = {}, locked = {};
      for (var i = 0; i < upto; i++) {
        var st = steps[i];
        paths[st.c] = st.w.slice(0, st.n).map(function (p) { return p[1] * t.size + p[0]; });
        if (st.n === st.w.length) locked[st.c] = true;
      }
      tb.show(paths, locked);
      var last = steps[upto - 1];
      if (last && last.n === last.w.length) tb.pulse(last.c);
    }
    setup();
    if (RM) return;
    setInterval(function () {
      if (document.hidden) return;
      if (si < steps.length) { si++; show(si); return; }
      if (++hold > 14) { which = (which + 1) % TEASER.length; setup(); }
    }, 160);
  }
  teaser();
})();
