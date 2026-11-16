/* Circuit Trace Daily — one free flow puzzle per day, the same board as the
   in-app Daily Challenge. No account, no cookies: progress lives only in this
   browser's localStorage. Puzzles come from puzzles.json, exported with the
   game's own generator (same date seed as the app). */
(function () {
  'use strict';

  var COLORS = ['#FF4747', '#4D8CFF', '#59F259', '#FFE640', '#FF8C26', '#D959FF',
                '#59F2E6', '#FF8CBF', '#A66633', '#BFF266', '#F2F2F2', '#8C8CB3'];
  var FIRST_DAY = Date.UTC(2026, 10, 16);   // Daily #1 = 16 Nov 2026
  var STORE = 'ctDaily';

  var canvas = document.getElementById('dBoard');
  var ctx = canvas.getContext('2d');
  var elNum = document.getElementById('dNum');
  var elTime = document.getElementById('dTime');
  var elStatus = document.getElementById('dStatus');
  var elResult = document.getElementById('dResult');
  var elResTime = document.getElementById('dResTime');
  var elResExtra = document.getElementById('dResExtra');
  var elStreak = document.getElementById('dStreak');
  var elNext = document.getElementById('dNext');
  var elShare = document.getElementById('dShare');
  var elShareMsg = document.getElementById('dShareMsg');
  var elReset = document.getElementById('dReset');

  var N = 6, pairs = [], ends = {}, paths = {}, active = null;
  var key = '', num = 0, startedAt = 0, solvedSecs = null, moves = 0, timer = null;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function keyToUTC(k) { var p = k.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + pad(s % 60); }

  // ---- storage (all optional: the page works without it)
  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) {} }
  function saveProgress() {
    var d = load();
    d.today = { key: key, startedAt: startedAt, moves: moves, paths: paths };
    save(d);
  }
  function streak() {
    var d = load(), solved = d.solved || {}, n = 0;
    var t = keyToUTC(key);
    if (!solved[key]) t -= 86400000;           // today not solved yet: count up to yesterday
    for (;;) {
      var dt = new Date(t);
      var k = dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
      if (!solved[k]) break;
      n++; t -= 86400000;
    }
    return n;
  }

  // ---- board model
  function idx(x, y) { return y * N + x; }
  function owner(cell) {
    for (var c in paths) if (paths[c].indexOf(cell) >= 0) return +c;
    return -1;
  }
  function complete(c) {
    var p = paths[c];
    return !!p && p.length >= 2 && ends[p[p.length - 1]] === c && p[p.length - 1] !== p[0];
  }
  function allComplete() {
    for (var i = 0; i < pairs.length; i++) if (!complete(pairs[i].c)) return false;
    return true;
  }
  function filled() {
    var n = 0;
    for (var c in paths) n += paths[c].length;
    return n;
  }

  function extend(next) {
    var p = paths[active], i = p.indexOf(next);
    if (i >= 0) { p.length = i + 1; return true; }          // drag back = undo
    if (complete(active)) return false;
    var last = p[p.length - 1];
    var dx = Math.abs(next % N - last % N), dy = Math.abs(Math.floor(next / N) - Math.floor(last / N));
    if (dx + dy !== 1) return false;
    if (ends[next] !== undefined && ends[next] !== active) return false;   // another colour's dot
    var o = owner(next);
    if (o >= 0 && o !== active) {                                       // cut the line you cross
      var q = paths[o]; q.length = q.indexOf(next);
      if (q.length === 0) delete paths[o];
    }
    p.push(next);
    return true;
  }

  // ---- input
  function cellAt(e) {
    var r = canvas.getBoundingClientRect();
    var x = Math.floor((e.clientX - r.left) / r.width * N), y = Math.floor((e.clientY - r.top) / r.height * N);
    if (x < 0 || y < 0 || x >= N || y >= N) return null;
    return idx(x, y);
  }
  var changed = false;
  function down(e) {
    if (solvedSecs !== null) return;
    var cell = cellAt(e);
    if (cell === null) return;
    if (ends[cell] !== undefined) {
      active = ends[cell]; paths[active] = [cell];
    } else {
      var o = owner(cell);
      if (o < 0) return;
      active = o; paths[o].length = paths[o].indexOf(cell) + 1;
    }
    e.preventDefault();
    if (!startedAt) { startedAt = Date.now(); tick(); timer = setInterval(tick, 500); }
    changed = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    draw();
  }
  function move(e) {
    if (active === null) return;
    e.preventDefault();
    var cell = cellAt(e);
    if (cell === null) return;
    var p = paths[active], guard = 0;
    while (p[p.length - 1] !== cell && guard++ < 20) {
      var last = p[p.length - 1], lx = last % N, ly = Math.floor(last / N);
      var tx = cell % N, ty = Math.floor(cell / N);
      var next = Math.abs(tx - lx) >= Math.abs(ty - ly) ? idx(lx + Math.sign(tx - lx), ly) : idx(lx, ly + Math.sign(ty - ly));
      if (p.indexOf(cell) >= 0) next = cell;                 // jump straight back along the own line
      if (!extend(next)) break;
    }
    draw();
  }
  function up() {
    if (active === null) return;
    if (paths[active] && paths[active].length < 2 && ends[paths[active][0]] !== undefined) delete paths[active];
    active = null;
    if (changed) { moves++; changed = false; }
    draw();
    if (allComplete()) win(); else saveProgress();
  }

  // ---- drawing
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function resize() {
    var w = canvas.clientWidth, dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr);
    draw();
  }
  function draw() {
    var W = canvas.width, s = W / N;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#0B1022'; ctx.fillRect(0, 0, W, W);
    for (var c in paths) {                       // tinted cells under each line
      ctx.fillStyle = rgba(COLORS[c % COLORS.length], complete(+c) ? 0.22 : 0.12);
      paths[c].forEach(function (cell) { ctx.fillRect(cell % N * s, Math.floor(cell / N) * s, s, s); });
    }
    ctx.strokeStyle = 'rgba(120,150,220,0.22)'; ctx.lineWidth = Math.max(1, s * 0.02);
    for (var i = 1; i < N; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(W, i * s); ctx.stroke();
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (c in paths) {
      var p = paths[c], col = COLORS[c % COLORS.length];
      if (p.length < 2) continue;
      ctx.strokeStyle = col; ctx.lineWidth = s * 0.3;
      ctx.shadowColor = col; ctx.shadowBlur = s * 0.25;
      ctx.beginPath();
      p.forEach(function (cell, k) {
        var x = (cell % N + 0.5) * s, y = (Math.floor(cell / N) + 0.5) * s;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    pairs.forEach(function (pr) {
      var col = COLORS[pr.c % COLORS.length];
      [pr.a, pr.b].forEach(function (cell) {
        var x = (cell % N + 0.5) * s, y = (Math.floor(cell / N) + 0.5) * s;
        ctx.shadowColor = col; ctx.shadowBlur = s * 0.35;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, s * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(x - s * 0.08, y - s * 0.08, s * 0.08, 0, Math.PI * 2); ctx.fill();
      });
    });
    ctx.shadowBlur = 0;
    var done = pairs.filter(function (pr) { return complete(pr.c); }).length;
    elStatus.textContent = solvedSecs !== null ? 'Solved ✓' : done + ' / ' + pairs.length + ' connected';
  }

  // ---- timer, win, share
  function tick() {
    var secs = solvedSecs !== null ? solvedSecs : (startedAt ? (Date.now() - startedAt) / 1000 : 0);
    elTime.textContent = fmt(secs);
    if (elNext) {
      var now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      var left = Math.floor((mid - now) / 1000);
      elNext.textContent = Math.floor(left / 3600) + 'h ' + pad(Math.floor(left % 3600 / 60)) + 'm';
      if (left <= 0 || todayKey() !== key) location.reload();
    }
  }
  function win() {
    clearInterval(timer);
    solvedSecs = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    var d = load();
    d.solved = d.solved || {};
    d.solved[key] = { t: solvedSecs, m: moves, full: filled() === N * N };
    d.today = { key: key, startedAt: startedAt, moves: moves, paths: paths };
    save(d);
    showResult(d.solved[key]);
  }
  function showResult(r) {
    solvedSecs = r.t;
    elResTime.textContent = fmt(r.t);
    elResExtra.textContent = (r.full ? 'Perfect: every cell filled. ' : 'Tip: fill every cell for a perfect solve. ') + r.m + ' moves.';
    var st = streak();
    elStreak.textContent = st > 1 ? '🔥 ' + st + '-day streak' : '';
    elResult.hidden = false;
    elReset.hidden = true;
    tick(); draw();
    timer = setInterval(tick, 1000);
  }
  function shareText() { return 'Circuit Trace Daily #' + num + ' ⚡ ' + fmt(solvedSecs) + ' – circuittrace.app/daily'; }
  elShare.addEventListener('click', function () {
    var text = shareText();
    function copied(ok) { elShareMsg.textContent = ok ? 'Copied to clipboard!' : text; }
    if (navigator.share && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
      navigator.share({ text: text }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { copied(true); }, function () { copied(false); });
    } else copied(false);
  });
  elReset.addEventListener('click', function () { paths = {}; moves++; draw(); saveProgress(); });

  // ---- start
  function init(data) {
    N = data.size;
    key = todayKey();
    num = Math.round((keyToUTC(key) - FIRST_DAY) / 86400000) + 1;
    var raw = data.puzzles[key];
    if (!raw) {
      elStatus.textContent = 'Today’s puzzle is waiting in the app.';
      document.getElementById('dMissing').hidden = false;
      return;
    }
    elNum.textContent = '#' + num;
    pairs = raw.map(function (r) { return { c: r[0], a: idx(r[1], r[2]), b: idx(r[3], r[4]) }; });
    pairs.forEach(function (p) { ends[p.a] = p.c; ends[p.b] = p.c; });
    var d = load();
    if (d.today && d.today.key === key) {
      paths = d.today.paths || {}; moves = d.today.moves || 0; startedAt = d.today.startedAt || 0;
    }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    window.addEventListener('resize', resize);
    resize();
    if (d.solved && d.solved[key]) { showResult(d.solved[key]); return; }
    if (startedAt) { tick(); timer = setInterval(tick, 500); }
  }
  fetch('puzzles.json?v=1').then(function (r) { return r.json(); }).then(init).catch(function () {
    elStatus.textContent = 'Could not load today’s puzzle. Please reload the page.';
  });
})();
