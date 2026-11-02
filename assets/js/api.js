/* Talks to the Apps Script web app (or the demo backend when no URL is set). */
window.AV_API = (function () {
  const url = (window.AV_CONFIG && window.AV_CONFIG.API_URL) || '';
  const demo = !url;
  let token = '';
  try { token = sessionStorage.getItem('av_token') || ''; } catch (e) { /* storage blocked */ }

  async function call(action, payload) {
    const body = Object.assign({ action, token }, payload || {});
    if (demo) return window.AV_DEMO.handle(action, body);
    let res;
    try {
      // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    } catch (e) {
      throw new Error('Can’t reach the billing server. Check your internet connection and try again.');
    }
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Something went wrong.');
    return json.data;
  }
  function setToken(t) {
    token = t || '';
    try { t ? sessionStorage.setItem('av_token', t) : sessionStorage.removeItem('av_token'); } catch (e) { /* ignore */ }
  }
  return { call, setToken, get demo() { return demo; }, get token() { return token; } };
})();
