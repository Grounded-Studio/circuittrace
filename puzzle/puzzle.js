/* Play a shared Circuit Trace puzzle code in the browser. The code is decoded
   right here (ctboard.js): nothing is sent to a server, and a code only
   describes the board — no names, no player data. */
(function () {
  'use strict';
  var EXAMPLE = 'CT-D04B5-2Y9G0-C2EGT-V0000-00000-0000B';
  var PLAY = 'https://play.google.com/store/apps/details?id=com.game.circuittrace';
  function $(id) { return document.getElementById(id); }
  var board = null, code = '', startedAt = 0, solvedSecs = null, timer = null;

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
  function status() { $('pStatus').textContent = board.solved ? 'Solved ✓' : board.connected() + ' / ' + board.pairCount + ' connected'; }

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
    $('pResult').hidden = true; $('pReset').hidden = false;
    $('pGame').hidden = false;
    $('pInfo').textContent = describe(p);
    $('pAppCode').textContent = code;
    $('pExample').hidden = code !== EXAMPLE;
    tick();
    // fresh canvas so old listeners go away
    var old = $('pBoard'), c = old.cloneNode(false);
    old.parentNode.replaceChild(c, old);
    board = new CTBoard.Board(c, p, {
      onStart: function () { if (!startedAt) { startedAt = Date.now(); timer = setInterval(tick, 500); } },
      onChange: status,
      onSolved: function () {
        clearInterval(timer);
        solvedSecs = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        tick(); status();
        $('pResTime').textContent = fmt(solvedSecs);
        $('pResExtra').textContent = (board.full() ? 'Perfect: every cell filled. ' : '') + board.moves + ' moves.';
        $('pResult').hidden = false; $('pReset').hidden = true;
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
  $('pShare').addEventListener('click', function () {
    share('I solved this Circuit Trace puzzle in ' + fmt(solvedSecs) + ' ⚡ Can you beat it? ' + link(), $('pShareMsg'));
  });
  $('pCopyLink').addEventListener('click', function () { share('Try this Circuit Trace puzzle: ' + link(), $('pLinkMsg')); });

  var q = new URLSearchParams(location.search).get('c') || (location.hash.length > 3 ? decodeURIComponent(location.hash.slice(1)) : '');
  open(q || EXAMPLE, false);
})();
