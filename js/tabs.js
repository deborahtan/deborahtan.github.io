/* ============================================================
   Shared UI helpers: tab switching, clipboard copy, prompt library
   builder. Loaded first, both trendspotter.js and ecommerce.js
   depend on window.CA_SHARED below.
   ============================================================ */
(function () {
  'use strict';

  function activateTab(name) {
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
    var btn = document.querySelector('.tab-btn[data-tab="' + name + '"]');
    var panel = document.getElementById('panel-' + name);
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');
  }

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { activateTab(btn.dataset.tab); });
  });

  // Home tab CTA buttons jump straight to the other two tabs
  document.querySelectorAll('[data-goto]').forEach(function (btn) {
    btn.addEventListener('click', function () { activateTab(btn.dataset.goto); });
  });

  function copyText(text, btn) {
    function showCopied() {
      var original = btn.textContent;
      btn.textContent = 'Copied';
      btn.classList.add('copied');
      setTimeout(function () { btn.textContent = original; btn.classList.remove('copied'); }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopied).catch(function () { fallbackCopy(text, showCopied); });
    } else {
      fallbackCopy(text, showCopied);
    }
  }
  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    cb();
  }

  function buildLibrary(containerId, questions) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = questions.map(function (q, i) {
      return '<div class="library-item"><span>' + q + '</span><button class="copy-btn" data-copy-idx="' + i + '">Copy</button></div>';
    }).join('');
    container.querySelectorAll('[data-copy-idx]').forEach(function (btn, i) {
      btn.addEventListener('click', function () { copyText(questions[i], btn); });
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // Exposed so trendspotter.js and ecommerce.js can reuse without duplicating
  window.CA_SHARED = { copyText: copyText, buildLibrary: buildLibrary, escapeHtml: escapeHtml, activateTab: activateTab };
}());
