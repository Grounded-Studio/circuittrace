/* Circuit Trace board engine for the website: share-code decoder (v2 + v3,
   ported from globals/puzzle_code.gd) and a playable board with the same
   drawing rules as scenes/grid_board.gd (diodes, portals, stars,
   checkpoints; lines can't cross; connect every pair to solve). */
(function (root) {
  'use strict';

  var ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  var COLORS = ['#FF4747', '#4D8CFF', '#59F259', '#FFE640', '#FF8C26', '#D959FF',
                '#59F2E6', '#FF8CBF', '#A66633', '#BFF266', '#F2F2F2', '#8C8CB3'];
  var DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // 0 right 1 down 2 left 3 up

  // ------------------------------------------------------------- decoder
  function toBits(str) {
    var bits = [];
    for (var i = 0; i < str.length; i++) {
      var ch = str[i], v = ALPHA.indexOf(ch);
      if (ch === 'O') v = 0;
      if (ch === 'I' || ch === 'L') v = 1;
      if (v < 0) return null;
      for (var k = 4; k >= 0; k--) bits.push((v >> k) & 1);
    }
    return bits;
  }
  function reader(bits) {
    var r = { pos: 0 };
    r.pop = function (n) { var v = 0; for (var i = 0; i < n; i++) v = (v << 1) | bits[r.pos + i]; r.pos += n; return v; };
    r.has = function (n) { return r.pos + n <= bits.length; };
    return r;
  }
  function groupsSum(bits, end, weighted, mod) {
    var sum = 0, k = 1;
    for (var i = 0; i < end; i += 5) {
      var g = 0;
      for (var j = 0; j < 5; j++) if (i + j < end) g = (g << 1) | bits[i + j];
      sum = (sum + g * (weighted ? k : 1)) % mod;
      k = k % 7 + 1;
    }
    return sum;
  }
  function decode(code) {
    var s = String(code || '').replace(/[\s-]/g, '').toUpperCase();
    if (s.indexOf('CT') !== 0) return { ok: false, error: 'A Circuit Trace code starts with CT-' };
    s = s.slice(2);
    if (s.length < 5) return { ok: false, error: 'This code is too short.' };
    var bits = toBits(s);
    if (!bits) return { ok: false, error: 'This code contains a character that is not used in codes.' };
    var bad = { ok: false, error: 'This code does not describe a valid puzzle.' };
    var r = reader(bits), out = { ok: true, pairs: [], diodes: [], portals: [], stars: [], checkpoints: [] };
    var size, cells;
    function cell(i) { return [i % size, Math.floor(i / size)]; }
    if (s.length === 30) {                     // v2: fixed 150 bits
      size = 5 + r.pop(2); cells = size * size;
      var n = r.pop(3);
      if (n > 5) return bad;
      for (var i = 0; i < n; i++) {
        var c = r.pop(3), a = r.pop(6), b = r.pop(6);
        if (a >= cells || b >= cells || a === b) return bad;
        out.pairs.push({ c: c, a: cell(a), b: cell(b) });
      }
      r.pos = 2 + 3 + 5 * 15;
      n = r.pop(3);
      if (n > 5) return bad;
      for (i = 0; i < n; i++) {
        var dc = r.pop(3), dir = r.pop(2), d = r.pop(6);
        if (d >= cells) return bad;
        out.diodes.push({ dir: dir, cell: cell(d), color: dc === 7 ? -1 : dc });
      }
      if (groupsSum(bits, 146, false, 16) !== (r.pos = 146, r.pop(4))) return { ok: false, error: 'This code looks damaged (checksum mismatch). Check it for typos.' };
    } else {                                   // v3: variable length
      if (!r.has(6)) return bad;
      size = 5 + r.pop(2); cells = size * size;
      n = r.pop(4);
      if (n > 8 || !r.has(n * 16 + 3)) return bad;
      for (i = 0; i < n; i++) {
        c = r.pop(4); a = r.pop(6); b = r.pop(6);
        if (a >= cells || b >= cells || a === b) return bad;
        out.pairs.push({ c: c, a: cell(a), b: cell(b) });
      }
      n = r.pop(3);
      if (n > 6 || !r.has(n * 12 + 2)) return bad;
      for (i = 0; i < n; i++) {
        dc = r.pop(4); dir = r.pop(2); d = r.pop(6);
        if (d >= cells) return bad;
        out.diodes.push({ dir: dir, cell: cell(d), color: dc === 15 ? -1 : dc });
      }
      n = r.pop(2);
      if (n > 2 || !r.has(n * 12 + 3)) return bad;
      for (i = 0; i < n; i++) {
        a = r.pop(6); b = r.pop(6);
        if (a >= cells || b >= cells || a === b) return bad;
        out.portals.push({ a: cell(a), b: cell(b) });
      }
      n = r.pop(3);
      if (n > 5 || !r.has(n * 6 + 3)) return bad;
      for (i = 0; i < n; i++) { a = r.pop(6); if (a >= cells) return bad; out.stars.push(cell(a)); }
      n = r.pop(3);
      if (n > 4 || !r.has(n * 10)) return bad;
      for (i = 0; i < n; i++) {
        c = r.pop(4); a = r.pop(6);
        if (a >= cells) return bad;
        out.checkpoints.push({ cell: cell(a), color: c === 15 ? -1 : c });
      }
      r.pos += (5 - (r.pos + 8) % 5) % 5;
      if (!r.has(8)) return bad;
      var end = r.pos;
      if (groupsSum(bits, end, true, 256) !== r.pop(8)) return { ok: false, error: 'This code looks damaged (checksum mismatch). Check it for typos.' };
    }
    if (!out.pairs.length) return bad;
    out.size = size;
    return out;
  }

  // ------------------------------------------------------------- board
  function Board(canvas, puzzle, opts) {
    opts = opts || {};
    var self = this, N = puzzle.size, ctx = canvas.getContext('2d');
    function idx(p) { return p[1] * N + p[0]; }
    var pairs = puzzle.pairs.map(function (p) { return { c: p.c, a: idx(p.a), b: idx(p.b) }; });
    var ends = {}, diodes = {}, portals = {}, stars = {}, cpColor = {}, cpAny = [];
    pairs.forEach(function (p) { ends[p.a] = p.c; ends[p.b] = p.c; });
    (puzzle.diodes || []).forEach(function (d) { diodes[idx(d.cell)] = { v: DIRS[d.dir], color: d.color }; });
    (puzzle.portals || []).forEach(function (p) { portals[idx(p.a)] = idx(p.b); portals[idx(p.b)] = idx(p.a); });
    (puzzle.stars || []).forEach(function (s) { stars[idx(s)] = true; });
    (puzzle.checkpoints || []).forEach(function (cp) {
      if (cp.color >= 0) cpColor[idx(cp.cell)] = cp.color; else cpAny.push(idx(cp.cell));
    });

    var paths = {}, locked = {}, active = -1, activePath = [], moved = false, snap = null;
    self.moves = 0; self.solved = false; self.size = N; self.pairCount = pairs.length;

    function adjacent(a, b) { return Math.abs(a % N - b % N) + Math.abs(Math.floor(a / N) - Math.floor(b / N)) === 1; }
    function owner(cell) {
      if (active >= 0 && activePath.indexOf(cell) >= 0) return active;
      for (var c in paths) if (paths[c].indexOf(cell) >= 0) return +c;
      return -1;
    }
    function otherEnd(c, start) {
      for (var i = 0; i < pairs.length; i++) if (pairs[i].c === c) {
        if (pairs[i].a === start) return pairs[i].b;
        if (pairs[i].b === start) return pairs[i].a;
      }
      return -1;
    }
    function connects(c, path) {
      if (path.length < 2) return false;
      for (var i = 0; i < pairs.length; i++) if (pairs[i].c === c) {
        var p = pairs[i], h = path[0], t = path[path.length - 1];
        if (!((h === p.a && t === p.b) || (h === p.b && t === p.a))) return false;
        for (var cell in cpColor) if (cpColor[cell] === c && path.indexOf(+cell) < 0) return false;
        return true;
      }
      return false;
    }
    function snapshot() { return JSON.stringify([paths, locked]); }
    function restore(s) { var v = JSON.parse(s); paths = v[0]; locked = v[1]; }

    function start(cell) {
      if (self.solved || active >= 0) return;
      snap = snapshot();
      if (ends[cell] !== undefined) {
        var c = ends[cell], ex = paths[c];
        if (ex && ex.length && adjacent(ex[ex.length - 1], cell) && ex[0] !== cell && ex.indexOf(cell) < 0 && !locked[c]) {
          active = c; activePath = ex.concat([cell]); delete paths[c]; moved = true; return;
        }
        delete paths[c]; delete locked[c];
        active = c; activePath = [cell]; moved = false; return;
      }
      for (var k in paths) {
        var p = paths[k];
        if (!locked[k] && p.length && p[p.length - 1] === cell) {
          active = +k; activePath = p.slice(); delete paths[k]; moved = false; return;
        }
      }
      if (portals[cell] !== undefined) {
        var twin = portals[cell];
        for (k in paths) {
          p = paths[k];
          if (locked[k] || !p.length || p[p.length - 1] !== twin) continue;
          c = +k;
          if (owner(cell) >= 0 && owner(cell) !== c) return;
          if (ends[cell] !== undefined && ends[cell] !== c) return;
          if (cpColor[cell] !== undefined && cpColor[cell] !== c) return;
          if (diodes[cell] && diodes[cell].color >= 0 && diodes[cell].color !== c) return;
          active = c; activePath = p.concat([cell]); delete paths[k]; moved = true; return;
        }
      }
    }
    function step(cell) {
      var last = activePath[activePath.length - 1];
      if (cell === last) return false;
      var back = activePath.indexOf(cell);
      if (back >= 0) { activePath.length = back + 1; moved = true; return true; }
      if (ends[last] === active && last !== activePath[0]) return false;     // reached the other dot
      var viaPortal = portals[last] === cell;
      if (!adjacent(last, cell) && !viaPortal) return false;
      if (ends[cell] !== undefined && (ends[cell] !== active || cell === activePath[0])) return false;
      if (diodes[last] && !viaPortal) {
        var v = diodes[last].v;
        if (cell % N - last % N !== v[0] || Math.floor(cell / N) - Math.floor(last / N) !== v[1]) return false;
      }
      if (diodes[cell] && diodes[cell].color >= 0 && diodes[cell].color !== active) return false;
      if (cpColor[cell] !== undefined && cpColor[cell] !== active) return false;
      if (owner(cell) >= 0) return false;                                      // lines can't cross
      activePath.push(cell); moved = true; return true;
    }
    function moveTo(cell) {
      if (active < 0) return;
      for (var guard = 0; guard < 2 * N; guard++) {
        var last = activePath[activePath.length - 1];
        if (last === cell) break;
        var next;
        if (activePath.indexOf(cell) >= 0 || portals[last] === cell) next = cell;
        else {
          var lx = last % N, ly = Math.floor(last / N), tx = cell % N, ty = Math.floor(cell / N);
          next = Math.abs(tx - lx) >= Math.abs(ty - ly) ? ly * N + lx + Math.sign(tx - lx) : (ly + Math.sign(ty - ly)) * N + lx;
        }
        if (!step(next)) break;
      }
    }
    function end() {
      if (active < 0) return;
      var c = active, path = activePath;
      active = -1; activePath = [];
      if (!moved) { restore(snap); return; }
      if (path.length && !connects(c, path)) {
        var last = path[path.length - 1], target = otherEnd(c, path[0]);
        var dOk = !diodes[last] || (target % N - last % N === diodes[last].v[0] && Math.floor(target / N) - Math.floor(last / N) === diodes[last].v[1]);
        if (target >= 0 && adjacent(last, target) && path.indexOf(target) < 0 && dOk) path.push(target);
      }
      if (path.length < 2) { delete paths[c]; delete locked[c]; }
      else { paths[c] = path; if (connects(c, path)) locked[c] = true; else delete locked[c]; }
      if (snapshot() !== snap) self.moves++;
      checkSolved();
    }
    function checkSolved() {
      for (var i = 0; i < pairs.length; i++) if (!locked[pairs[i].c]) return;
      for (i = 0; i < cpAny.length; i++) if (owner(cpAny[i]) < 0) return;
      self.solved = true;
    }

    self.connected = function () { return pairs.filter(function (p) { return locked[p.c]; }).length; };
    self.covered = function () { var n = 0; for (var c in paths) n += paths[c].length; return n; };
    self.full = function () { return self.covered() >= N * N; };
    self.state = function () { return { paths: paths, locked: locked, moves: self.moves }; };
    self.load = function (st) {
      if (!st || !st.paths) return;
      paths = st.paths; locked = st.locked || {}; self.moves = st.moves || 0;
      checkSolved(); draw();
    };
    self.clear = function () {
      if (self.solved) return;
      if (Object.keys(paths).length) self.moves++;
      paths = {}; locked = {}; draw(); if (opts.onChange) opts.onChange(self);
    };

    // ---- input
    function cellAt(e) {
      var r = canvas.getBoundingClientRect();
      var x = Math.floor((e.clientX - r.left) / r.width * N), y = Math.floor((e.clientY - r.top) / r.height * N);
      return (x < 0 || y < 0 || x >= N || y >= N) ? -1 : y * N + x;
    }
    canvas.addEventListener('pointerdown', function (e) {
      var cell = cellAt(e);
      if (cell < 0) return;
      start(cell);
      if (active < 0) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      if (opts.onStart) opts.onStart(self);
      draw();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (active < 0) return;
      e.preventDefault();
      var cell = cellAt(e);
      if (cell >= 0) { moveTo(cell); draw(); }
    });
    function up() {
      if (active < 0) return;
      end(); draw();
      if (opts.onChange) opts.onChange(self);
      if (self.solved && opts.onSolved) opts.onSolved(self);
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    // ---- drawing
    function rgba(hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function col(c) { return COLORS[c % COLORS.length]; }
    function center(cell, s) { return [(cell % N + 0.5) * s, (Math.floor(cell / N) + 0.5) * s]; }
    function drawPath(c, p, s) {
      if (p.length < 2) return;
      ctx.strokeStyle = col(c); ctx.lineWidth = s * 0.3;
      ctx.shadowColor = col(c); ctx.shadowBlur = s * 0.25;
      ctx.beginPath();
      for (var k = 0; k < p.length; k++) {
        var q = center(p[k], s);
        if (k && adjacent(p[k - 1], p[k])) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);   // portal jump = gap
      }
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    function draw() {
      var W = canvas.width, s = W / N;
      ctx.clearRect(0, 0, W, W);
      ctx.fillStyle = '#0B1022'; ctx.fillRect(0, 0, W, W);
      var all = {}; for (var c in paths) all[c] = paths[c];
      if (active >= 0) all[active] = activePath;
      for (c in all) {
        ctx.fillStyle = rgba(col(+c), locked[c] ? 0.22 : 0.12);
        all[c].forEach(function (cell) { ctx.fillRect(cell % N * s, Math.floor(cell / N) * s, s, s); });
      }
      ctx.strokeStyle = 'rgba(120,150,220,0.22)'; ctx.lineWidth = Math.max(1, s * 0.02);
      for (var i = 1; i < N; i++) {
        ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, W); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(W, i * s); ctx.stroke();
      }
      // components under the lines
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (var k in portals) {
        var q = center(+k, s);
        ctx.strokeStyle = 'rgba(217,235,255,0.85)'; ctx.lineWidth = s * 0.05;
        ctx.beginPath(); ctx.arc(q[0], q[1], s * 0.36, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(q[0], q[1], s * 0.22, 0, Math.PI * 2); ctx.stroke();
      }
      for (c in all) drawPath(+c, all[c], s);
      for (k in cpColor) cpMark(+k, s, col(cpColor[k]));
      cpAny.forEach(function (cell) { cpMark(cell, s, '#D9EBFF'); });
      for (k in stars) {
        q = center(+k, s);
        ctx.fillStyle = 'rgba(217,235,255,0.95)'; ctx.beginPath();
        for (i = 0; i < 10; i++) {
          var ang = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 0.12 : 0.28) * s;
          ctx.lineTo(q[0] + Math.cos(ang) * rr, q[1] + Math.sin(ang) * rr);
        }
        ctx.closePath(); ctx.fill();
      }
      for (k in diodes) {
        var d = diodes[k]; q = center(+k, s);
        var dcol = d.color >= 0 ? col(d.color) : '#FFFFFF';
        ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(Math.atan2(d.v[1], d.v[0]));
        ctx.fillStyle = 'rgba(11,16,34,0.85)'; ctx.beginPath(); ctx.arc(0, 0, s * 0.27, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = dcol; ctx.lineWidth = s * 0.08;
        ctx.beginPath(); ctx.moveTo(-s * 0.08, -s * 0.15); ctx.lineTo(s * 0.1, 0); ctx.lineTo(-s * 0.08, s * 0.15); ctx.stroke();
        ctx.restore();
      }
      pairs.forEach(function (p) {
        [p.a, p.b].forEach(function (cell) {
          var q2 = center(cell, s), cc = col(p.c);
          ctx.shadowColor = cc; ctx.shadowBlur = s * 0.35;
          ctx.fillStyle = cc; ctx.beginPath(); ctx.arc(q2[0], q2[1], s * 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.beginPath(); ctx.arc(q2[0] - s * 0.08, q2[1] - s * 0.08, s * 0.08, 0, Math.PI * 2); ctx.fill();
        });
      });
    }
    function cpMark(cell, s, color) {
      var q = center(cell, s), r = s * 0.2;
      ctx.fillStyle = 'rgba(11,16,34,0.75)';
      ctx.beginPath(); ctx.moveTo(q[0], q[1] - r); ctx.lineTo(q[0] + r, q[1]); ctx.lineTo(q[0], q[1] + r); ctx.lineTo(q[0] - r, q[1]); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = s * 0.06;
      ctx.beginPath(); ctx.moveTo(q[0], q[1] - r); ctx.lineTo(q[0] + r, q[1]); ctx.lineTo(q[0], q[1] + r); ctx.lineTo(q[0] - r, q[1]); ctx.closePath(); ctx.stroke();
    }
    function resize() {
      var w = canvas.clientWidth || canvas.width, dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr);
      draw();
    }
    window.addEventListener('resize', resize);
    self.draw = draw;
    resize();
  }

  root.CTBoard = { decode: decode, Board: Board, COLORS: COLORS };
})(window);
