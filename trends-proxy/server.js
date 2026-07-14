/* ============================================================
   trends-proxy
   ------------------------------------------------------------
   Small Express server that holds the real ANTHROPIC_API_KEY and
   forwards Christmas Trendspotter requests to the Anthropic API
   with web search turned on. The browser never sees the key.

   Deploy this the same way you deployed ca-proxy, e.g. Google
   Cloud Run. See README.md at the repo root for exact steps.

   Required environment variable:
     ANTHROPIC_API_KEY   your real Anthropic API key
     ALLOWED_ORIGIN       your GitHub Pages URL, e.g.
                           https://deborahtan.github.io
   ============================================================ */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '1mb' }));

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://deborahtan.github.io';
app.use(cors({ origin: ALLOWED_ORIGIN }));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT =
  'You are researching the emotional mood around Christmas grocery shopping ' +
  'specifically for NEW ZEALAND households, for a Dentsu tool called the ' +
  'Christmas Trendspotter, used by a grocery retail client. This is a ' +
  'Southern Hemisphere, mid summer Christmas, beach, BBQs, summer holidays ' +
  'starting, not the Northern Hemisphere winter version, so search for and ' +
  'reflect genuinely NZ specific context such as NZ Herald, Stuff, RNZ, and ' +
  'NZ social discussion, rather than generic global Christmas content.\n\n' +
  'Also search for what named NZ grocery competitors, specifically ' +
  'Woolworths NZ, Countdown, Pak n Save, New World, and Foodstuffs, are ' +
  'visibly doing for Christmas this year: campaigns, offers, meal deals, ' +
  'click and collect, delivery promotions. Name them specifically if you ' +
  'find real information, and be honest if search results are thin rather ' +
  'than inventing detail.\n\n' +
  'Write in a warm, family and household friendly, relatable tone. Still be ' +
  'honest about real pressure points like cost of living, meal planning ' +
  'stress, and time pressure, do not sanitize those away, but frame them ' +
  'with empathy rather than clinical distance.\n\n' +
  'Write everything in short, punchy headlines with one plain descriptive ' +
  'sentence underneath. Never use an em dash character anywhere in your ' +
  'output, use a period or comma instead.\n\n' +
  'You must respond with ONLY a single JSON object, no other text before or ' +
  'after it, in exactly this shape:\n' +
  '{\n' +
  '  "barometer_score": number 0 to 100,\n' +
  '  "mood_headline": short punchy 3 to 6 word headline,\n' +
  '  "mood_description": one plain warm sentence, no em dash,\n' +
  '  "sentiment_split": positive, mixed, negative as numbers 0 to 100,\n' +
  '  "what_people_want": four short phrases,\n' +
  '  "resonant_lines": three short emotionally resonant lines, no em dash,\n' +
  '  "metrics": four to six items each with label, value 0 to 100, note, no em dash,\n' +
  '  "competitor_snapshot_headline": short headline,\n' +
  '  "competitor_snapshot_description": one sentence, no em dash,\n' +
  '  "value_prop_headline": short headline,\n' +
  '  "value_prop_description": one sentence, no em dash\n' +
  '}\n' +
  'sentiment_split values must sum to approximately 100. On follow up ' +
  'questions, adjust this same JSON structure to reflect what was asked, ' +
  'and again respond with ONLY the JSON object, no em dashes anywhere.';

app.post('/trend-research', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server.' });
    }
    const messages = req.body.messages || [];

    // ── TRENDS MCP HOOK ──────────────────────────────────────────────
    // When a real Trends MCP connector is ready, add it here, e.g.
    // mcp_servers: [{ type: 'url', url: 'https://<your-trends-mcp>', name: 'trends-mcp' }]
    // alongside or instead of the web_search tool below. Everything else
    // in this file stays the same.
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1800,
        system: SYSTEM_PROMPT,
        messages: messages,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      return res.status(anthropicResponse.status).send(errText);
    }

    const data = await anthropicResponse.json();
    const textBlocks = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const sources = [];
    (data.content || []).forEach((block) => {
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        block.content.forEach((item) => {
          if (item.url) sources.push({ title: item.title || item.url, url: item.url });
        });
      }
    });

    const noEmDash = textBlocks.split(String.fromCharCode(8212)).join(',');
    const jsonMatch = noEmDash.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'Could not find a JSON object in the model response.' });
    }

    res.json({
      data: JSON.parse(jsonMatch[0]),
      sources: sources,
      assistantText: textBlocks
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.send('trends-proxy is running'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('trends-proxy listening on ' + PORT));
