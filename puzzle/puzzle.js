/* Play a shared Circuit Trace puzzle code in the browser. The code is decoded
   right here (ctboard.js): nothing is sent to a server, and a code only
   describes the board — no names, no player data. */
(function () {
  'use strict';
  var EXAMPLE = 'CT-D04B5-2Y9G0-C2EGT-V0000-00000-0000B';
  var PLAY = 'https://play.google.com/store/apps/details?id=com.game.circuittrace';
  function $(id) { return document.getElementById(id); }
  var board = null, code = '', startedAt = 0, solvedSecs = null, timer = null, bonusLabel = null;
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + pad(s % 60); }
  function tidy(c) {
    var s = String(c || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (s.indexOf('CT') === 0) s = s.slice(2);
    var parts = ['CT'];
    for (var i = 0; i < s.length; i += 5) parts.push(s.slice(i, i + 5));
    return parts.join('-');
  }
  function link() { return 'https://circuittrace.app/puzzle/?c=' + code; }
  function tick() { $('pTime').textContent = fmt(solvedSecs !== null ? solvedSecs : (startedAt ? (Date.now() - startedAt) / 1000 : 0)); }
  function status() {
    $('pStatus').textContent = board.solved ? 'Solved ✓' : board.connected() + ' / ' + board.pairCount + ' connected';
    var full = board.full(), bonus = $('pBonus'), cov = board.covered();
    if (bonusLabel === null) bonusLabel = bonus.textContent;
    bonus.classList.toggle('on', full);
    bonus.textContent = full ? '★ Bonus done!' : cov ? '★ ' + cov + ' / ' + board.size * board.size + ' cells' : bonusLabel;
    $('pUndo').disabled = !board.canUndo();
    $('pReset').disabled = board.solved;
  }
  function chip(text, cls) {
    var e = document.createElement('span');
    e.className = 'dn-chip' + (cls ? ' ' + cls : '');
    e.textContent = text;
    return e;
  }

  function describe(p) {
    var bits = [p.size + '×' + p.size, p.pairs.length + ' pairs'];
    if (p.diodes.length) bits.push(p.diodes.length + (p.diodes.length > 1 ? ' diodes' : ' diode'));
    if (p.portals.length) bits.push(p.portals.length + (p.portals.length > 1 ? ' portal pairs' : ' portal pair'));
    if (p.stars.length) bits.push(p.stars.length + (p.stars.length > 1 ? ' stars' : ' star'));
    if (p.checkpoints.length) bits.push(p.checkpoints.length + (p.checkpoints.length > 1 ? ' checkpoints' : ' checkpoint'));
    return bits.join(' · ');
  }

  function open(raw, push) {
    var p = CTBoard.decode(raw);
    $('pError').textContent = '';
    if (!p.ok) { $('pError').textContent = p.error; return; }
    code = tidy(raw);
    $('pCode').value = code;
    if (push) { try { history.replaceState(null, '', '?c=' + code); } catch (e) {} }
    clearInterval(timer); startedAt = 0; solvedSecs = null;
    $('pResult').hidden = true; $('pControls').hidden = false;
    $('pGame').hidden = false;
    $('pInfo').textContent = describe(p);
    $('pAppCode').textContent = code;
    $('pExample').hidden = code !== EXAMPLE;
    tick();
    // fresh canvas so old listeners go away
    var old = $('pBoard'), c = old.cloneNode(false);
    old.parentNode.replaceChild(c, old);
    if (board) board.destroy();
    board = new CTBoard.Board(c, p, {
      theme: 'neon', keyboard: true,
      onStart: function () { if (!startedAt) { startedAt = Date.now(); timer = setInterval(tick, 500); } },
      onChange: status,
      onSolved: function () {
        clearInterval(timer);
        solvedSecs = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        tick(); status();
        var frame = $('pFrame');
        if (!RM) { frame.classList.remove('won'); void frame.offsetWidth; frame.classList.add('won'); }
        setTimeout(function () {
          var chips = $('pChips');
          chips.textContent = '';
          chips.appendChild(board.full() ? chip('★ Perfect: every cell filled', 'gold') : chip('Tip: fill every cell for ★ Perfect'));
          chips.appendChild(chip(board.moves + ' moves'));
          $('pControls').hidden = true;
          $('pResult').hidden = false;
          var big = $('pResTime');
          if (!RM) {
            var t0 = performance.now();
            (function step() {
              var u = Math.min(1, (performance.now() - t0) / 700);
              big.textContent = fmt(solvedSecs * (1 - Math.pow(1 - u, 3)));
              if (u < 1) requestAnimationFrame(step);
            })();
            $('pResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else big.textContent = fmt(solvedSecs);
        }, board.celebrationMs);
      }
    });
    status();
  }

  function share(text, msgEl) {
    if (navigator.share && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
      navigator.share({ text: text }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { msgEl.textContent = 'Copied to clipboard!'; },
                                               function () { msgEl.textContent = text; });
    } else msgEl.textContent = text;
  }

  $('pForm').addEventListener('submit', function (e) { e.preventDefault(); open($('pCode').value, true); });
  $('pReset').addEventListener('click', function () { if (board) board.clear(); });
  $('pUndo').addEventListener('click', function () { if (board) board.undo(); });
  $('pShare').addEventListener('click', function () {
    share('I solved this Circuit Trace puzzle in ' + fmt(solvedSecs) + (board && board.full() ? ' · Perfect' : '') + ' ⚡ Can you beat it? ' + link(), $('pShareMsg'));
  });
  $('pCopyLink').addEventListener('click', function () { share('Try this Circuit Trace puzzle: ' + link(), $('pLinkMsg')); });

  var q = new URLSearchParams(location.search).get('c') || (location.hash.length > 3 ? decodeURIComponent(location.hash.slice(1)) : '');
  open(q || EXAMPLE, false);
})();
