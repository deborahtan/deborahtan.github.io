/* ============================================================
   TAB 2: CHRISTMAS TRENDSPOTTER
   ------------------------------------------------------------
   IMPORTANT: this calls a small proxy (trends-proxy/) instead of
   api.anthropic.com directly. A browser cannot call the Anthropic
   API directly with a real API key, the key would be exposed to
   anyone viewing page source. Deploy trends-proxy (same pattern as
   your existing ca-proxy) and put its URL below.
   ============================================================ */
(function () {
  'use strict';

  // CONFIG: set this to your deployed trends-proxy URL once it is live.
  // Until then this tab will show a connection error, same as the
  // ecommerce tab does when previewed off-domain.
  var TRENDS_PROXY_URL = 'https://trends-proxy-507101719517.us-central1.run.app';

  // TRENDS MCP HOOK
  // When a real Trends MCP connector is ready, it plugs in on the SERVER
  // side, inside trends-proxy/server.js, not here. Add it to the
  // mcp_servers array in that file's Anthropic API call. This flag just
  // controls the disclaimer text shown to the user.
  var TRENDS_MCP_CONNECTED = false;

  var dashboardEl = document.getElementById('dashboard');
  var inputEl = document.getElementById('chat-input-trendspotter');
  var sendBtn = document.getElementById('chat-send-trendspotter');
  var statusEl = document.getElementById('status-line-trendspotter');
  var dateTagEl = document.getElementById('date-tag');
  var wordcloudBody = document.getElementById('wordcloud-body');

  var isThinking = false;
  var lastGoodData = null;
  // In-session memory only. This array lives in a browser tab and resets
  // on refresh, no database or localStorage involved, matches the brief:
  // memory from one round to the next in a single session, nothing more.
  var conversationHistory = [];

  var todayStr = new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  dateTagEl.textContent = 'Snapshot: ' + todayStr + ' (NZ)';

  // Question Bank chips fill the input AND immediately ask, so clicking
  // one gives a real answer straight away.
  document.querySelectorAll('[data-fill="trendspotter"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      inputEl.value = btn.textContent.trim();
      handleTrendspotterAsk();
    });
  });

  async function askProxy(userMessage) {
    conversationHistory.push({ role: 'user', content: userMessage });

    var response = await fetch(TRENDS_PROXY_URL + '/trend-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversationHistory })
    });

    if (!response.ok) {
      var errText = await response.text();
      conversationHistory.pop();
      throw new Error('Trends proxy error (' + response.status + '): ' + errText);
    }

    var body = await response.json();
    // Server returns { data: {...parsed json...}, sources: [...], assistantText: "..." }
    conversationHistory.push({ role: 'assistant', content: body.assistantText || JSON.stringify(body.data) });
    return { data: body.data, sources: body.sources || [] };
  }

  var esc = window.CA_SHARED.escapeHtml;

  function buildGaugeSvg(score) {
    var pct = Math.max(0, Math.min(100, score)) / 100;
    var angle = Math.PI * (1 - pct);
    var cx = 110, cy = 110, r = 90;
    var x = cx + r * Math.cos(angle);
    var y = cy - r * Math.sin(angle);
    var largeArc = pct > 0.5 ? 1 : 0;
    return (
      '<svg class="gauge-svg" viewBox="0 0 220 120">' +
        '<path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="#322f29" stroke-width="16" stroke-linecap="round"/>' +
        '<path d="M 20 110 A 90 90 0 ' + largeArc + ' 1 ' + x.toFixed(1) + ' ' + y.toFixed(1) + '" fill="none" stroke="#e0b78a" stroke-width="16" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  function buildSentimentSplit(split) {
    split = split || { positive: 34, mixed: 33, negative: 33 };
    var total = (split.positive || 0) + (split.mixed || 0) + (split.negative || 0) || 1;
    var pos = Math.round((split.positive || 0) / total * 100);
    var mix = Math.round((split.mixed || 0) / total * 100);
    var neg = Math.max(0, 100 - pos - mix);
    return (
      '<div class="split-bar">' +
        '<div class="split-seg" style="width:' + pos + '%;background:#a8b89c;">' + (pos >= 10 ? pos + '%' : '') + '</div>' +
        '<div class="split-seg" style="width:' + mix + '%;background:#e0b78a;">' + (mix >= 10 ? mix + '%' : '') + '</div>' +
        '<div class="split-seg" style="width:' + neg + '%;background:#d9a8b3;">' + (neg >= 10 ? neg + '%' : '') + '</div>' +
      '</div>' +
      '<div class="split-legend">' +
        '<span><span class="dot" style="background:#a8b89c;"></span>Positive, ' + pos + '%</span>' +
        '<span><span class="dot" style="background:#e0b78a;"></span>Mixed, ' + mix + '%</span>' +
        '<span><span class="dot" style="background:#d9a8b3;"></span>Negative, ' + neg + '%</span>' +
      '</div>'
    );
  }

  function buildSourcesCard(sources) {
    var mcpNote = TRENDS_MCP_CONNECTED
      ? 'Trends MCP data sources'
      : 'Research sources (Trends MCP not connected yet, this is Claude web research)';
    if (!sources || !sources.length) {
      return (
        '<details class="expand-card">' +
          '<summary>' + mcpNote + '</summary>' +
          '<div class="source-empty">No specific sources were captured for this answer.</div>' +
        '</details>'
      );
    }
    var items = sources.map(function (s) {
      return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a></li>';
    }).join('');
    return '<details class="expand-card"><summary>' + mcpNote + ' (' + sources.length + ')</summary><ul class="source-list">' + items + '</ul></details>';
  }

  // ── Word cloud ──────────────────────────────────────────────────────
  // Built entirely client side from the same JSON the dashboard renders.
  // No extra API call, no extra key needed for this part.
  var STOPWORDS = ['the','a','an','and','or','but','to','of','in','on','for','with','is','are','was','were','be','this','that','it','as','at','by','from','their','they','has','have','had','not','no','so','if','than','then','into','about','more','most','over','under','out','up','down','you','your','we','our','can','will','just','like','get','all','also','which','who','what','how','why','when','where','still','some','only','while','each'];

  function buildWordCloud(d) {
    var textPieces = [];
    if (d.mood_headline) textPieces.push(d.mood_headline);
    if (d.mood_description) textPieces.push(d.mood_description);
    if (d.competitor_snapshot_headline) textPieces.push(d.competitor_snapshot_headline);
    if (d.competitor_snapshot_description) textPieces.push(d.competitor_snapshot_description);
    if (d.value_prop_headline) textPieces.push(d.value_prop_headline);
    if (d.value_prop_description) textPieces.push(d.value_prop_description);
    (d.what_people_want || []).forEach(function (w) { textPieces.push(w); });
    (d.resonant_lines || []).forEach(function (l) { textPieces.push(l); });
    (d.metrics || []).forEach(function (m) { if (m.label) textPieces.push(m.label); if (m.note) textPieces.push(m.note); });

    var counts = {};
    textPieces.join(' ').toLowerCase().split(/[^a-z']+/).forEach(function (w) {
      w = w.trim();
      if (w.length < 3) return;
      if (STOPWORDS.indexOf(w) !== -1) return;
      counts[w] = (counts[w] || 0) + 1;
    });

    var entries = Object.keys(counts).map(function (w) { return { word: w, count: counts[w] }; });
    entries.sort(function (a, b) { return b.count - a.count; });
    entries = entries.slice(0, 30);

    if (!entries.length) {
      wordcloudBody.innerHTML = '<span class="wc-empty">Not enough words yet, ask a question first.</span>';
      return;
    }

    var maxCount = entries[0].count;
    var colorClasses = ['c1', 'c2', 'c3'];
    wordcloudBody.innerHTML = entries.map(function (e, i) {
      var scale = e.count / maxCount; // 0 to 1
      var fontSize = 12 + Math.round(scale * 26); // 12px to 38px
      var cls = colorClasses[i % colorClasses.length];
      return '<span class="wc-word ' + cls + '" style="font-size:' + fontSize + 'px;">' + esc(e.word) + '</span>';
    }).join('');
  }

  function renderDashboard(result) {
    var d = result.data;
    lastGoodData = result;

    var wantItems = (d.what_people_want || []).map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('');
    var lineItems = (d.resonant_lines || []).map(function (line) { return '<div class="resonant-line">"' + esc(line) + '"</div>'; }).join('');
    var metricTiles = (d.metrics || []).map(function (m) {
      var val = Math.max(0, Math.min(100, m.value || 0));
      return (
        '<div class="metric-tile">' +
          '<div class="metric-label">' + esc(m.label) + '</div>' +
          '<div class="metric-bar-bg"><div class="metric-bar-fill" style="width:' + val + '%"></div></div>' +
          '<div class="metric-value">' + val + ' / 100</div>' +
          '<div class="metric-note">' + esc(m.note || '') + '</div>' +
        '</div>'
      );
    }).join('');

    dashboardEl.innerHTML =
      '<div class="gauge-card">' +
        '<div class="gauge-wrap">' + buildGaugeSvg(d.barometer_score || 0) + '<div class="gauge-score">' + Math.round(d.barometer_score || 0) + '</div></div>' +
        '<div class="gauge-mood">' + esc(d.mood_headline || '') + '</div>' +
        '<div class="gauge-desc">' + esc(d.mood_description || '') + '</div>' +
        '<div class="gauge-label">Christmas Spirit Barometer</div>' +
      '</div>' +
      '<div class="split-card"><div class="card-label">Sentiment Split</div>' + buildSentimentSplit(d.sentiment_split) + '</div>' +
      buildSourcesCard(result.sources) +
      '<div class="card competitor-card">' +
        '<div class="card-label">What Competitors Are Doing</div>' +
        '<div class="headline">' + esc(d.competitor_snapshot_headline || '') + '</div>' +
        '<p class="desc">' + esc(d.competitor_snapshot_description || '') + '</p>' +
      '</div>' +
      '<div class="card value-card">' +
        '<div class="card-label">Where Brands Can Help</div>' +
        '<div class="headline">' + esc(d.value_prop_headline || '') + '</div>' +
        '<p class="desc">' + esc(d.value_prop_description || '') + '</p>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-label">What People Actually Want This Christmas</div>' +
        '<ul class="want-list">' + wantItems + '</ul>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-label">Emotionally Resonant Lines</div>' +
        '<div class="lines-grid">' + lineItems + '</div>' +
      '</div>' +
      '<div class="card-label" style="margin: 4px 0 10px;">Barometer Metrics</div>' +
      '<div class="metrics-grid">' + metricTiles + '</div>';

    buildWordCloud(d);
  }

  async function runInitialResearch() {
    statusEl.textContent = 'Researching...';
    try {
      var result = await askProxy('Research the current emotional mood around Christmas grocery shopping for New Zealand households, including what named grocery competitors are doing, and build the initial Christmas Trendspotter dashboard.');
      renderDashboard(result);
      statusEl.textContent = '';
    } catch (err) {
      dashboardEl.innerHTML = '<div class="error-box">Something went wrong: ' + esc(err.message) + '. If TRENDS_PROXY_URL in js/trendspotter.js is still a placeholder, deploy trends-proxy first, see README.md.</div>';
      statusEl.textContent = '';
      console.error(err);
    }
  }

  async function handleTrendspotterAsk() {
    var question = inputEl.value.trim();
    if (!question || isThinking) return;
    isThinking = true;
    sendBtn.disabled = true;
    inputEl.value = '';
    statusEl.textContent = 'Updating the dashboard...';
    try {
      var result = await askProxy(question);
      renderDashboard(result);
      statusEl.textContent = 'Updated.';
    } catch (err) {
      statusEl.textContent = 'Something went wrong: ' + err.message;
      console.error(err);
      if (lastGoodData) renderDashboard(lastGoodData);
    }
    isThinking = false;
    sendBtn.disabled = false;
  }

  sendBtn.addEventListener('click', handleTrendspotterAsk);
  inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleTrendspotterAsk(); });
  runInitialResearch();
}());
