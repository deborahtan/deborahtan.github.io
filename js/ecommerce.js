/* ============================================================
   TAB 3: ECOMMERCE ANALYTICS AGENT
   ------------------------------------------------------------
   Calls the existing ca-proxy Cloud Run service that already sits
   in front of the BigQuery Conversational Analytics API. No key
   lives in this file, ca-proxy holds the service account
   credentials server side. This tab only works from an origin
   ca-proxy's CORS setting allows, i.e. your deployed GitHub Pages
   domain.
   ============================================================ */
(function () {
  'use strict';

  var ECOMMERCE_QUESTIONS = [
    'What was total revenue last month?',
    'Which channel drove the most sessions last week?',
    'Show me conversion rate by device type',
    'What are the top 5 products by revenue this quarter?',
    'How does this month compare to last month for orders?',
    'What is the average order value by channel?',
    'Which product category has the highest return rate?',
    "What is our cart abandonment rate this week?"
  ];
  window.CA_SHARED.buildLibrary('library-ecommerce', ECOMMERCE_QUESTIONS);

  // CONFIG: your live ca-proxy URL. Keep this, it already exists.
  var PROXY_URL = 'https://ca-proxy-507101719517.us-central1.run.app';
  var ecomConversationName = null;

  var ecomMessagesEl = document.getElementById('chat-messages-ecommerce');
  var ecomInputEl = document.getElementById('chat-input-ecommerce');
  var ecomSendBtn = document.getElementById('chat-send-ecommerce');
  var ecomStatusEl = document.getElementById('status-line-ecommerce');
  var ecomThinking = false;

  // Question Bank chips fill and immediately ask, same pattern as tab 2
  document.querySelectorAll('[data-fill="ecommerce"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ecomInputEl.value = btn.textContent.trim();
      handleEcomAsk();
    });
  });

  function appendEcomMessage(role, text) {
    var wrap = document.createElement('div');
    wrap.className = 'msg msg-' + role;
    var bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    ecomMessagesEl.appendChild(wrap);
    ecomMessagesEl.scrollTop = ecomMessagesEl.scrollHeight;
    return bubble;
  }

  async function ensureEcomConversation() {
    // In-session memory only: conversationName is kept in a JS variable,
    // not stored anywhere, so it resets on page reload. This matches the
    // brief, memory across rounds within one session, no persistence.
    if (ecomConversationName) return;
    var r = await fetch(PROXY_URL + '/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!r.ok) throw new Error('Could not create conversation (' + r.status + ')');
    var body = await r.json();
    ecomConversationName = body.conversationName;
  }

  async function handleEcomAsk() {
    var question = ecomInputEl.value.trim();
    if (!question || ecomThinking) return;
    ecomThinking = true;
    ecomSendBtn.disabled = true;
    ecomInputEl.value = '';
    appendEcomMessage('user', question);
    ecomStatusEl.textContent = 'Thinking...';

    try {
      await ensureEcomConversation();
      var r = await fetch(PROXY_URL + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationName: ecomConversationName, message: question })
      });
      if (!r.ok) throw new Error(await r.text());

      var reader = r.body.getReader();
      var decoder = new TextDecoder();
      var raw = '';
      var bubble = appendEcomMessage('agent', 'Thinking...');

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        raw += decoder.decode(chunk.value, { stream: true });
      }

      // The API returns one big JSON array of message objects, not
      // newline-delimited JSON, so parse it whole rather than line by line.
      var answer = '';
      try {
        var messages = JSON.parse(raw);
        messages.forEach(function (item) {
          var sm = item.systemMessage;
          if (sm && sm.text && sm.text.textType === 'FINAL_RESPONSE' && Array.isArray(sm.text.parts)) {
            answer += sm.text.parts.join(' ') + '\n\n';
          }
        });
      } catch (parseErr) {
        console.error('Could not parse ca-proxy response as JSON', parseErr);
      }

      bubble.textContent = answer.trim() || 'No answer text was returned, check the raw response in the console.';
      if (!answer.trim()) console.log('Raw ca-proxy response:', raw);
      ecomStatusEl.textContent = '';
    } catch (err) {
      appendEcomMessage('agent', 'Connection error: ' + err.message + '. Expected if this is not running on your approved GitHub Pages domain.');
      ecomStatusEl.textContent = '';
    }

    ecomThinking = false;
    ecomSendBtn.disabled = false;
  }

  ecomSendBtn.addEventListener('click', handleEcomAsk);
  ecomInputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleEcomAsk(); });
}());
