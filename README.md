# Dentsu Conversational Analytics

Single page site, three tabs: Home, Christmas Trendspotter, Ecommerce Analytics Agent.
Crucial note: this is an internal tool used to experiment with Trends MCP and Claude effort to research trends, used to test key features and overall insights. This serves as a demo. 

## Structure

```
index.html              the whole site, three tabs
css/style.css            all styling
js/tabs.js                tab switching, clipboard copy, prompt library builder
js/trendspotter.js        Christmas Trendspotter logic, calls trends-proxy
js/ecommerce.js           Ecommerce Analytics Agent logic, calls your existing ca-proxy
trends-proxy/             small server, deploy separately, holds your Anthropic key
```

## Why two backends

The ecommerce tab already has a working backend, ca-proxy, sitting in front of
BigQuery Conversational Analytics. Keep using that, nothing to change there.

The Trendspotter tab needs its own small backend, trends-proxy, because a
browser cannot safely call the Anthropic API directly. Any API key placed in
client side JavaScript is visible to anyone who views page source, so it has
to sit on a server. trends-proxy is that server, deploy it the same way you
deployed ca-proxy.

## Keys and setup you need

1. **Anthropic API key**, for trends-proxy.
   Get one from the Anthropic Console, set it as `ANTHROPIC_API_KEY` when you
   deploy trends-proxy. This is the only new key this project needs.

2. **ca-proxy**, already exists, nothing new required.
   Just confirm its CORS setting allows your GitHub Pages domain, and that
   js/ecommerce.js has the right `PROXY_URL` (already set to your existing
   Cloud Run URL).

3. **GitHub Pages**, no key needed, just a repo setting.

## Deploy steps, fastest path

### A. Push the frontend

```bash
cd repo
git init
git add .
git commit -m "Conversational analytics: home, trendspotter, ecommerce tabs"
git branch -M main
git remote add origin https://github.com/deborahtan/YOUR-REPO-NAME.git
git push -u origin main
```

Then in GitHub: Settings, Pages, set source to the main branch, root folder.
Your site will be live at https://deborahtan.github.io/YOUR-REPO-NAME/ or at
the root domain if this is your deborahtan.github.io repo itself.

### B. Deploy trends-proxy to Cloud Run

```bash
cd trends-proxy
gcloud run deploy trends-proxy \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars ANTHROPIC_API_KEY=YOUR_KEY_HERE,ALLOWED_ORIGIN=https://deborahtan.github.io
```

Copy the resulting Cloud Run URL, paste it into `TRENDS_PROXY_URL` near the
top of `js/trendspotter.js`, commit, push again.

### C. Confirm ca-proxy CORS

Your ca-proxy already exists at the URL hardcoded in `js/ecommerce.js`. Check
its CORS allowed origin includes your GitHub Pages domain, update if it does
not, redeploy ca-proxy if you change it.

## Notes

- No session persistence anywhere on purpose. Both tabs keep memory only in a
  JavaScript variable in the browser tab, conversation history resets on
  page refresh. Nothing is written to a database or localStorage.
- The word cloud on the Trendspotter tab is built entirely client side from
  the same JSON the dashboard already renders, no extra API call.
- Trends MCP is not connected yet. The code has a clearly marked hook,
  search `TRENDS MCP HOOK` in both `trends-proxy/server.js` and
  `js/trendspotter.js`, so wiring one in later is a small, contained change.
- No prompt library on the Trendspotter tab on purpose, the Question Bank
  chips cover that job. Prompt library still exists on the Ecommerce tab,
  now inside an expandable section so the tab stays short by default.
