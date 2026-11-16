/* Circuit Trace Daily — one free flow puzzle per day, the same board as the
   in-app Daily Challenge. No account, no cookies: progress lives only in this
   browser's localStorage. Puzzles come from puzzles.json, exported with the
   game's own generator (same date seed as the app). Board rules: ctboard.js. */
(function () {
  'use strict';

  var FIRST_DAY = Date.UTC(2026, 10, 16);   // Daily #1 = 16 Nov 2026
  var STORE = 'ctDaily';
  function $(id) { return document.getElementById(id); }
  var canvas = $('dBoard');

  var board = null, key = '', num = 0, startedAt = 0, solvedSecs = null, timer = null;

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
    $('dStatus').textContent = board.solved ? 'Solved ✓' : board.connected() + ' / ' + board.pairCount + ' connected';
  }
  function tick() {
    var secs = solvedSecs !== null ? solvedSecs : (startedAt ? (Date.now() - startedAt) / 1000 : 0);
    $('dTime').textContent = fmt(secs);
    var now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var left = Math.floor((mid - now) / 1000);
    $('dNext').textContent = Math.floor(left / 3600) + 'h ' + pad(Math.floor(left % 3600 / 60)) + 'm';
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
    showResult(d.solved[key]);
  }
  function showResult(r) {
    solvedSecs = r.t;
    $('dResTime').textContent = fmt(r.t);
    $('dResExtra').textContent = (r.full ? 'Perfect: every cell filled. ' : 'Tip: fill every cell for a perfect solve. ') + r.m + ' moves.';
    var st = streak();
    $('dStreak').textContent = st > 1 ? '🔥 ' + st + '-day streak' : '';
    $('dResult').hidden = false;
    $('dReset').hidden = true;
    status(); tick();
    clearInterval(timer); timer = setInterval(tick, 1000);
  }
  function shareText() { return 'Circuit Trace Daily #' + num + ' ⚡ ' + fmt(solvedSecs) + ' – circuittrace.app/daily'; }
  $('dShare').addEventListener('click', function () {
    var text = shareText();
    function copied(ok) { $('dShareMsg').textContent = ok ? 'Copied to clipboard!' : text; }
    if (navigator.share && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
      navigator.share({ text: text }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { copied(true); }, function () { copied(false); });
    } else copied(false);
  });
  $('dReset').addEventListener('click', function () { if (board) { board.clear(); } });

  function init(data) {
    key = todayKey();
    num = Math.round((keyToUTC(key) - FIRST_DAY) / 86400000) + 1;
    var raw = data.puzzles[key];
    if (!raw) {
      $('dStatus').textContent = 'Today’s puzzle is waiting in the app.';
      $('dMissing').hidden = false;
      return;
    }
    $('dNum').textContent = '#' + num;
    var puzzle = { size: data.size, pairs: raw.map(function (r) { return { c: r[0], a: [r[1], r[2]], b: [r[3], r[4]] }; }) };
    board = new CTBoard.Board(canvas, puzzle, {
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
    if (d.solved && d.solved[key]) { showResult(d.solved[key]); return; }
    if (startedAt) { tick(); timer = setInterval(tick, 500); }
  }
  fetch('puzzles.json?v=1').then(function (r) { return r.json(); }).then(init).catch(function () {
    $('dStatus').textContent = 'Could not load today’s puzzle. Please reload the page.';
  });
})();
