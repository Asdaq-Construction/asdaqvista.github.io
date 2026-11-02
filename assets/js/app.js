/* Asdaq Vista — single-page app (no framework). */
(function () {
  const api = window.AV_API;
  const app = document.getElementById('app');
  const navEl = document.getElementById('navlinks');
  const menuBtn = document.getElementById('menu-btn');
  let siteSettings = null;
  const sheet = document.getElementById('sheet');
  // every pop-up gets a close (×) button at the top, so nobody has to scroll down to Cancel
  const showSheet = sheet.showModal.bind(sheet);
  sheet.showModal = () => {
    if (!sheet.querySelector(':scope > .sheet-x')) {
      sheet.insertAdjacentHTML('afterbegin', '<div class="sheet-x"><button type="button" aria-label="Close" title="Close"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>');
      sheet.querySelector(':scope > .sheet-x button').onclick = () => sheet.close();
    }
    showSheet(); sheet.scrollTop = 0;
  };
  const FLATS = ['N1', 'N2', 'N3', 'N4', 'N5', 'S1', 'S2', 'S3', 'S4', 'S5'];

  // ---------- small helpers ----------
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n = (v) => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);
  const inr = (v, dp = 2) => n(v) == null ? '—' : '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const inr0 = (v) => inr(v, 0);
  const monthLabel = (k) => { if (!k) return ''; const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); };
  const monthShort = (k) => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short' }); };
  const dateLabel = (iso) => { if (!iso) return '—'; const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? esc(iso) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }
  const loading = (msg) => { app.innerHTML = `<div class="loading">${esc(msg || 'Loading…')}</div>`; };
  const chevron = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const backArrow = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function busy(btn, on, label) { if (!btn) return; btn.disabled = on; if (label) { btn.dataset.l = btn.dataset.l || btn.textContent; btn.textContent = on ? label : btn.dataset.l; } }
  // When the server says "wait", show a countdown and keep the button disabled until it ends.
  function lockCountdown(form, err, btn, label) {
    const m = /\[wait:(\d+)\]/.exec(err.message || '');
    const clean = (err.message || '').replace(/\s*\[wait:\d+\]/, '');
    if (!m) { formError(form, clean); busy(btn, false, label); return; }
    let left = Number(m[1]);
    const fmt = (s) => s < 60 ? `${s} seconds` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const tick = () => {
      if (!document.body.contains(form)) return;
      if (left <= 0) { formError(form, 'You can try again now.'); busy(btn, false, label); return; }
      formError(form, `Too many wrong attempts. Please wait ${fmt(left)} and try again.`);
      btn.disabled = true; btn.textContent = `Wait ${fmt(left)}`;
      left -= 1; setTimeout(tick, 1000);
    };
    btn.dataset.l = btn.dataset.l || label;
    tick();
  }
  function formError(form, msg) {
    let box = form.querySelector('.form-error');
    if (!msg) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.className = 'form-error'; box.setAttribute('role', 'alert'); form.prepend(box); }
    box.textContent = msg;
    const r = box.getBoundingClientRect();
    if (r.top < 70 || r.bottom > window.innerHeight) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const normaliseSecret = (s) => {
    s = String(s || '').trim();
    const m = s.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
  };

  // ---------- session ----------
  function who() { return store.get('av_who'); }
  function setWho(w, token) { store.set('av_who', w); api.setToken(token || ''); renderNav(); }
  function renderNav() {
    const w = who();
    const key = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'home';
    const cur = (k) => (k === key ? ' aria-current="page"' : '');
    const help = `<a href="#contact"${cur('contact')}>Contact</a>`;
    if (!w) {
      navEl.innerHTML = `<a href="#home"${cur('home')}>Home</a><a href="#tenant"${cur('tenant')}>Residents</a><a href="#staff"${cur('staff')}>Owner</a>${help}<a class="nav-cta" href="#tenant">See my bill</a>`;
    } else {
      const main = w.kind === 'tenant' ? `<a href="#bill"${cur('bill')}>My bill</a><a href="#events"${cur('events')}>Event permission</a>` : `<a href="#admin"${cur('admin')}>Dashboard</a>`;
      navEl.innerHTML = `${main}${help}<div class="nav-who"><strong>${esc(w.kind === 'tenant' ? 'Flat ' + w.flat : w.name)}</strong>${esc(w.kind === 'tenant' ? w.name : w.role)}</div><button class="navlink" id="logout">Log out</button>`;
      document.getElementById('logout').onclick = async () => { try { await api.call('logout'); } catch (e) { /* ignore */ } setWho(null); location.hash = '#home'; };
    }
    if (!isStandalone()) navEl.insertAdjacentHTML('beforeend', '<button class="navlink nav-install" data-install><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Install app</button>');
    navEl.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
  }
  function closeMenu() { navEl.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  menuBtn.onclick = () => { const open = !navEl.classList.contains('open'); navEl.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  // ---------- drawing of Asdaq Vista: two blocks, five floors; the given flat's window is lit ----------
  function buildingSVG(litFlat) {
    const W = 260, H = 236, ground = 222, fh = 36, bw = 92;
    const blocks = [{ name: 'NORTH', x: 26, p: 'N' }, { name: 'SOUTH', x: 142, p: 'S' }];
    let g = '';
    blocks.forEach((bk) => {
      const top = ground - 5 * fh;
      g += `<rect class="roof" x="${bk.x - 6}" y="${top - 6}" width="${bw + 12}" height="6" rx="1"/>`;
      g += `<rect class="shell" x="${bk.x}" y="${top}" width="${bw}" height="${5 * fh}"/>`;
      for (let f = 5; f >= 1; f--) {
        const y = ground - f * fh, flat = bk.p + f, lit = flat === litFlat;
        if (f < 5) g += `<line class="floor" x1="${bk.x}" y1="${y}" x2="${bk.x + bw}" y2="${y}"/>`;
        g += `<rect class="win${lit ? ' lit' : ''}" x="${bk.x + 10}" y="${y + 8}" width="34" height="20" rx="1.5"/>`;
        g += `<rect class="win${lit ? ' lit' : ''}" x="${bk.x + 50}" y="${y + 8}" width="32" height="20" rx="1.5"/>`;
        g += `<line class="rail" x1="${bk.x + 48}" y1="${y + 31}" x2="${bk.x + bw + 6}" y2="${y + 31}"/>`;
        g += `<text class="${lit ? 'lit' : ''}" x="${bk.x - 5}" y="${y + 22}" text-anchor="end">${flat}</text>`;
      }
      g += `<text class="block" x="${bk.x + bw / 2}" y="${top - 12}" text-anchor="middle">${bk.name}</text>`;
    });
    g += `<line class="ground" x1="4" y1="${ground}" x2="${W - 4}" y2="${ground}"/>`;
    return `<svg class="bldg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${litFlat ? 'Asdaq Vista — flat ' + litFlat + ' highlighted' : 'Asdaq Vista — North and South blocks'}">${g}</svg>`;
  }

  function sessionEnded(e) {
    if (/session has ended|not allowed/i.test(e.message)) { setWho(null); location.hash = '#home'; toast(e.message); return true; }
    return false;
  }

  // ---------- router ----------
  const routes = { '': home, home, tenant: tenantLogin, staff: staffLogin, setup: staffSetup, contact: contactPage, bill: billView, events: eventsView, admin: staffView };
  function route() {
    const key = (location.hash.replace(/^#\/?/, '').split('?')[0]) || '';
    const w = who();
    if (((key === 'bill' || key === 'events') && (!w || w.kind !== 'tenant')) || (key === 'admin' && (!w || w.kind !== 'staff'))) { location.hash = '#home'; return; }
    if ((key === '' || key === 'home') && w) { location.hash = w.kind === 'tenant' ? '#bill' : '#admin'; return; }
    if (!(key in routes)) return;
    app.classList.toggle('flush', key === '' || key === 'home');
    closeMenu(); renderNav();
    routes[key]();
    app.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // ---------- home ----------
  const icHome = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  const icKey = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M11 12.5 20 4m-3 3 2.5 2.5M14.5 9.5 17 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  function home() {
    app.innerHTML = `
      <section class="hero">
        <div class="hero-inner">
          <div>
            <p class="hero-kicker">ASDAQ VISTA · HULIMAVU</p>
            <h1>Your monthly bill, clear and private.</h1>
            <p class="lede">Rent, electricity and maintenance for your flat, with exactly who to pay and how much. Only you can see your flat\u2019s bill.</p>
            <div class="doors">
              <button class="door" data-go="#tenant"><span class="ic">${icHome}</span><div><strong>I live here</strong><span class="sub">See your bill with your phone number and date of birth</span></div><span class="chev">${chevron}</span></button>
              <button class="door" data-go="#staff"><span class="ic">${icKey}</span><div><strong>Owner</strong><span class="sub">Readings, tenants, payments and requests</span></div><span class="chev">${chevron}</span></button>
            </div>
          </div>
          <div class="hero-visual">
            <figure class="photo-frame">
              <div class="photo"><img src="assets/img/building.jpg" alt="Asdaq Vista building in Hulimavu" width="420" height="1080"></div>
              <figcaption><b>ASDAQ VISTA</b><span>Hulimavu, Bengaluru</span></figcaption>
            </figure>
          </div>
        </div>
      </section>
      <section class="section">
        <figure class="blocks-figure">
          ${buildingSVG(null)}
          <figcaption>
            <h2>Ten homes, two blocks</h2>
            <p class="sub">North block N1–N5 and South block S1–S5. Each flat has its own electricity meter, read at the end of every month.</p>
            <ol class="steps" style="grid-template-columns:1fr">
              <li><strong>Log in</strong><span>Your phone number and date of birth.</span></li>
              <li><strong>See your bill</strong><span>Meter reading, electricity, maintenance and rent, line by line.</span></li>
              <li><strong>Pay via UPI</strong><span>Rent to your flat\u2019s owner; electricity and maintenance to Arshad.</span></li>
            </ol>
          </figcaption>
        </figure>
      </section>`;
    app.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { location.hash = b.dataset.go; }; });
  }
  function authAside(kind) {
    return `<aside class="auth-aside" aria-hidden="true">${buildingSVG(null)}
      <h2>${kind === 'tenant' ? 'Private to your flat' : 'For the owner of Asdaq Vista'}</h2>
      <p>${kind === 'tenant' ? 'Your bill is only shown after your phone number and date of birth are checked. Other residents can\u2019t see it.' : 'Readings, tenants, payments and event requests in one place. Every change is recorded in the sheet.'}</p></aside>`;
  }

  // ---------- contact: one owner, two ways ----------
  const icChat = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5 5.6 16A7.5 7.5 0 1 1 8.4 18.6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.2 9.3c.3 1.9 1.6 3.4 3.6 4.2l1.1-1.1 1.7.8-.4 1.6c-3.4.2-6.6-3-6.6-6.4l1.6-.4.8 1.7z" fill="currentColor"/></svg>';
  const icMail = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  async function contactPage() {
    const draw = (st) => {
      const w = who();
      const intro = w && w.kind === 'tenant' ? `Hello, this is flat ${w.flat}. ` : 'Hello, ';
      const wa = st.whatsapp ? waLink(st.whatsapp, intro + 'I have a question about Asdaq Vista.') : '';
      // Gmail's own compose window in a new tab: a blank email addressed to the owner (mailto: can leave a white screen when no mail app is set up)
      const mail = st.email ? 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(st.email) : '';
      app.innerHTML = `
        <div class="auth-wrap"><section class="auth contact">
          <a class="back" href="${w ? (w.kind === 'tenant' ? '#bill' : '#admin') : '#home'}">${backArrow} Back</a>
          <p class="hero-kicker">CONTACT</p>
          <h1>Contact the owner</h1>
          <p class="lede">Questions about your flat, bill, payments or the building${st.contactName ? ` go to <b>${esc(st.contactName)}</b>, owner of Asdaq Vista` : ' go to the owner of Asdaq Vista'}. Choose how you\u2019d like to reach him.</p>
          <div class="doors contact-doors">
            ${wa ? `<a class="door" href="${wa}" target="_blank" rel="noopener"><span class="ic">${icChat}</span><div><strong>Contact via WhatsApp</strong><span class="sub">Opens WhatsApp with a message ready</span></div><span class="chev">${chevron}</span></a>` : ''}
            ${mail ? `<a class="door" href="${mail}" target="_blank" rel="noopener"><span class="ic">${icMail}</span><div><strong>Contact via Gmail</strong><span class="sub">Opens a new email to ${esc(st.email)}</span></div><span class="chev">${chevron}</span></a>
            <p class="mail-alt">Use another email app? Write to <b>${esc(st.email)}</b> <button type="button" class="btn ghost small" id="copyMail">Copy address</button></p>` : ''}
            ${!wa && !mail ? '<p class="notice info">Contact details will appear here soon.</p>' : ''}
          </div>
          <p class="sub" style="margin-top:18px;font-size:14px">${w && w.kind === 'tenant' ? 'Planning a function or anything that may disturb neighbours? Ask in <a href="#events">Event permission</a>.' : 'Residents asking permission for an event can log in and use Event permission.'}</p>
        </section>
        <aside class="auth-aside contact-aside" aria-hidden="true">${buildingSVG(w && w.kind === 'tenant' ? w.flat : null)}
          <h2>Asdaq Vista</h2><p>${esc(st.address || 'Hulimavu, Bengaluru, Karnataka 560076')}</p></aside></div>`;
      const cb = document.getElementById('copyMail'); if (cb) cb.onclick = () => copyMail(cb, st.email);
    };
    const copyMail = (b, addr) => {
      const done = () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy address'; }, 1800); };
      const fallback = () => { const t = document.createElement('textarea'); t.value = addr; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (x) { toast(addr); } t.remove(); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(addr).then(done, fallback); else fallback();
    };
    draw(siteSettings || {});
    if (!siteSettings || !('email' in siteSettings)) {
      try { siteSettings = await api.call('settings') || {}; if ((location.hash.replace(/^#\/?/, '').split('?')[0]) === 'contact') draw(siteSettings); } catch (e) { /* keep what we have */ }
    }
  }

  // ---------- tenant login ----------
  function tenantLogin() {
    app.innerHTML = `
      <div class="auth-wrap"><section class="auth">
        <a class="back" href="#home">${backArrow} Back</a>
        <h1>See your bill</h1>
        <p class="lede">Use the phone number and date of birth of the person named on the rental agreement.</p>
        <form id="f" novalidate>
          <div class="field"><label for="phone">Phone number</label><input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="98765 43210" required></div>
          <div class="field"><label for="dob">Date of birth</label><input id="dob" name="dob" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="DDMMYYYY" required><span class="hint">8 digits, day-month-year, no dashes. Example: 1 October 1985 → 01101985</span></div>
          <button class="btn block" type="submit">See my bill</button>
          <p style="margin-top:16px;font-size:14px" id="forgot">Can\u2019t log in? Ask the building admin to check your phone number and date of birth.</p>
          ${api.demo ? `<p class="hint" style="margin-top:14px;color:var(--stone);font-size:13px">${esc(window.AV_DEMO.hints.tenant)}</p>` : ''}
        </form>
      </section>${authAside('tenant')}</div>`;
    api.call('settings').then((st) => {
      const el = document.getElementById('forgot');
      if (el && st && st.whatsapp) el.innerHTML = `Can\u2019t log in? <a href="${waLink(st.whatsapp, 'Hello, I cannot log in to the Asdaq Vista bills website. My flat is ')}" target="_blank" rel="noopener">Message the admin on WhatsApp</a>.`;
    }).catch(() => {});
    const f = document.getElementById('f');
    f.dob.oninput = () => { f.dob.value = f.dob.value.replace(/\D/g, '').slice(0, 8); };
    f.onsubmit = async (e) => {
      e.preventDefault(); formError(f);
      if (f.phone.value.replace(/\D/g, '').length < 10) return formError(f, 'Type your 10-digit phone number.');
      if (f.dob.value.length !== 8) return formError(f, 'Type your date of birth as 8 digits: day, month, year (e.g. 01101985).');
      const btn = f.querySelector('button[type=submit]'); busy(btn, true, 'Checking…');
      try {
        const r = await api.call('tenantLogin', { phone: f.phone.value, dob: f.dob.value });
        setWho({ kind: 'tenant', flat: r.tenant.flat, name: r.tenant.name, id: r.tenant.id }, r.token);
        location.hash = '#bill';
      } catch (err) { lockCountdown(f, err, btn, 'See my bill'); }
    };
  }

  // ---------- staff login & setup ----------
  function staffLogin() {
    app.innerHTML = `
      <div class="auth-wrap"><section class="auth">
        <a class="back" href="#home">${backArrow} Back</a>
        <h1>Owner login</h1>
        <p class="lede">For the owner of Asdaq Vista: phone number, date of birth and password.</p>
        <form id="f" novalidate>
          <div class="field"><label for="phone">Phone number</label><input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="username" required></div>
          <div class="field"><label for="dob">Date of birth</label><input id="dob" name="dob" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="DDMMYYYY" required><span class="hint">8 digits, day-month-year, no dashes. Example: 1 October 1985 → 01101985</span></div>
          <div class="field"><label for="pw">Password</label><input id="pw" name="pw" type="password" autocomplete="current-password" required></div>
          <button class="btn block" type="submit">Log in</button>
          <p style="margin-top:16px;font-size:14px" id="ownerhelp">Forgot your password? Ask the developer for a setup code.</p>
          <p style="font-size:14px">Have a setup code? <a href="#setup">Set a new password</a>.</p>
          ${api.demo ? `<p class="hint" style="color:var(--stone);font-size:13px">${esc(window.AV_DEMO.hints.staff)}</p>` : ''}
        </form>
      </section>${authAside('staff')}</div>`;
    api.call('settings').then((st) => {
      const el = document.getElementById('ownerhelp');
      if (el && st && st.ownerHelp) el.innerHTML = `Forgot your password? <a href="${waLink(st.ownerHelp, 'Hello, I need a setup code to reset my Asdaq Vista owner password.')}" target="_blank" rel="noopener">Message the developer on WhatsApp</a> for a setup code.`;
    }).catch(() => {});
    const f = document.getElementById('f');
    f.dob.oninput = () => { f.dob.value = f.dob.value.replace(/\D/g, '').slice(0, 8); };
    f.onsubmit = async (e) => {
      e.preventDefault(); formError(f);
      const btn = f.querySelector('button[type=submit]'); busy(btn, true, 'Logging in…');
      try {
        if (f.dob.value.length !== 8) { formError(f, 'Type the date of birth as 8 digits: day, month, year (e.g. 01101985).'); busy(btn, false, 'Logging in…'); return; }
        const r = await api.call('staffLogin', { phone: f.phone.value, dob: f.dob.value, password: f.pw.value });
        setWho({ kind: 'staff', name: r.person.name, role: r.person.role, id: r.person.id }, r.token);
        location.hash = '#admin';
      } catch (err) { lockCountdown(f, err, btn, 'Log in'); }
    };
  }
  function staffSetup() {
    app.innerHTML = `
      <div class="auth-wrap"><section class="auth">
        <a class="back" href="#staff">${backArrow} Back to login</a>
        <h1>Set the owner password</h1>
        <p class="lede">Type the one-time setup code the developer sent you on WhatsApp. Choose a password of at least 16 characters — a short sentence you'll remember works well.</p>
        <form id="f" novalidate>
          <div class="field"><label for="phone">Phone number</label><input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="username" required></div>
          <div class="field"><label for="dob">Date of birth</label><input id="dob" name="dob" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="DDMMYYYY" required><span class="hint">8 digits, day-month-year, no dashes. Example: 1 October 1985 → 01101985</span></div>
          <div class="field"><label for="code">Setup code</label><input id="code" name="code" autocomplete="one-time-code" required></div>
          <div class="field"><label for="pw">New password</label><input id="pw" name="pw" type="password" autocomplete="new-password" minlength="16" required><span class="hint" id="pwcount">0 of 16 characters</span></div>
          <div class="field"><label for="pw2">Type it again</label><input id="pw2" name="pw2" type="password" autocomplete="new-password" required></div>
          <button class="btn block" type="submit">Set password</button>
        </form>
      </section>${authAside('staff')}</div>`;
    const f = document.getElementById('f');
    f.pw.oninput = () => { document.getElementById('pwcount').textContent = `${f.pw.value.length} of 16 characters`; };
    f.onsubmit = async (e) => {
      e.preventDefault(); formError(f);
      if (f.pw.value.length < 16) return formError(f, 'The password needs at least 16 characters.');
      if (f.pw.value !== f.pw2.value) return formError(f, 'The two passwords are different. Type them again.');
      const btn = f.querySelector('button[type=submit]'); busy(btn, true, 'Saving…');
      try {
        await api.call('staffSetup', { phone: f.phone.value, dob: f.dob.value, setupCode: f.code.value.trim(), newPassword: f.pw.value });
        toast('Password set. You can log in now.'); location.hash = '#staff';
      } catch (err) { lockCountdown(f, err, btn, 'Set password'); }
    };
  }

  // ---------- tenant: agreement ending — continue or move out? (shown in the last 2 months) ----------
  async function agreementPrompt(t) {
    if (!t || !t.reminder || todayIso() < t.reminder) return;
    const key = 'av_agree_' + t.id + '_' + t.ends;
    if (store.get(key)) return;
    let mine = [];
    try { mine = await api.call('myRequests'); } catch (e) { return; }
    if (mine.some((x) => /^Agreement/.test(x.event) && x.date === t.ends)) { store.set(key, 1); return; }
    sheet.innerHTML = `<div class="sheet-inner">
      <h2 id="sheet-title">Your agreement ends on ${dateLabel(t.ends)}</h2>
      <p class="sub">Would you like to continue living at Asdaq Vista? The new rent would be ${inr0(t.afterRenewal)} a month; the owner will confirm the details.</p>
      <div style="display:grid;gap:10px">
        <button class="btn block" id="agCont">Yes, I want to continue</button>
        <button class="btn ghost block" id="agEnd">No, I will move out when it ends</button>
        <button class="btn ghost block" id="agLater">Ask me later</button>
      </div></div>`;
    sheet.showModal();
    const send = async (choice) => {
      try { await api.call('requestEvent', { kind: 'agreement', choice }); store.set(key, 1); sheet.close(); toast('Thank you — the owner has been told.'); }
      catch (e) { if (!sessionEnded(e)) toast(e.message); }
    };
    document.getElementById('agCont').onclick = () => send('continue');
    document.getElementById('agEnd').onclick = () => send('end');
    document.getElementById('agLater').onclick = () => { sheet.close(); };
  }

  // ---------- tenant: ask permission for an event ----------
  async function eventsView() {
    loading('Loading…');
    let list = [];
    try { list = await api.call('myRequests'); } catch (e) { if (sessionEnded(e)) return; }
    let st = siteSettings || {};
    if (!('terraceCharge' in st)) { try { st = siteSettings = await api.call('settings') || {}; } catch (e) { /* use defaults */ } }
    const tc = Number(st.terraceCharge) || 500;
    const NEEDS = [['Use of the terrace', `A small cleaning charge of \u20b9${tc}, paid to the owner`], ['Outside / terrace lighting', 'Runs on the common meter \u2014 the lighting charge is told when approved'],
      ['Music or sound system', ''], ['Extra guests / parking', ''], ['Decorations on the building', '']];
    app.innerHTML = `
      <div class="auth-wrap"><section class="auth">
        <h1>Ask for event permission</h1>
        <p class="lede">Any function or anything out of the ordinary that may affect other residents — a wedding, a pooja, a party, lights outside, use of the terrace, extra guests — needs the owner's permission first. Tell us the date and the time. You'll see the answer here.</p>
        <div class="rules"><h2>Before you ask</h2><ul>
          <li><b>Terrace:</b> using the terrace (roof) has a small <b>cleaning charge of \u20b9${tc}</b>, paid to the owner.</li>
          <li><b>Outside or terrace lighting</b> runs on the common meter, so a <b>lighting charge</b> applies. The owner tells you the amount when approving.</li>
          <li><b>Night and noise:</b> there are no fixed quiet hours, but anything at night, or anything that may disturb neighbours (music, speakers, a crowd, a late finish), must be mentioned here. Events that weren\u2019t asked for, or didn\u2019t mention this, may be stopped.</li>
        </ul></div>
        <p class="notice info" style="margin:0 0 18px">This page is only for permissions. For anything else, use <a href="#contact">Contact</a>.</p>
        <form id="f" novalidate>
          ${fld('event', 'Event', 'Wedding / marriage function', { select: ['Wedding / marriage function', 'Religious function', 'Birthday or family party', 'House-warming', 'Other event'] })}
          ${fld('date', 'Date of the event', '', { type: 'date' })}
          <div class="grid-2">${fld('from', 'From (time)', '', { type: 'time' })}${fld('to', 'To (time)', '', { type: 'time' })}</div>
          <fieldset class="needs timing"><legend>When is it? <span class="req">required</span></legend>${['Day', 'Night', 'Day and night'].map((x) => `<label><input type="radio" name="timing" value="${x}"> ${x}</label>`).join('')}<span class="hint" id="nightHint" hidden>These times run into the night (after 10 pm or before 6 am).</span></fieldset>
          <fieldset class="needs"><legend>What will you need?</legend>${NEEDS.map(([x, note]) => `<label><input type="checkbox" name="need" value="${esc(x)}"> <span>${esc(x)}${note ? `<small>${esc(note)}</small>` : ''}</span></label>`).join('')}</fieldset>
          <fieldset class="needs timing"><legend>Could it disturb neighbours? <span class="req">required</span></legend><label><input type="radio" name="disturb" value="No"> No</label><label><input type="radio" name="disturb" value="Yes"> Yes \u2014 noise, music, a crowd or a late finish</label></fieldset>
          <div class="charges-box" id="chargesBox" hidden></div>
          <div class="field"><label for="details">Reason and details</label><textarea id="details" name="details" rows="4" placeholder="e.g. Daughter's wedding reception, about 40 guests, lights on the terrace from 6 pm to 11 pm."></textarea></div>
          <button class="btn block" type="submit">Send request</button>
        </form>
      </section>
      <aside class="auth-aside contact-aside"><h2>Your requests</h2>
        ${list.length ? list.map((x) => `<div class="panel" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${esc(x.event)}</b><span class="pill ${x.status === 'Approved' ? 'ok' : x.status === 'Declined' ? 'no' : 'off'}">${esc(x.status === 'Pending' ? 'Waiting for answer' : x.status)}</span></div>
          <div class="sub" style="margin:4px 0 0">${dateLabel(x.date)}${x.from ? `, ${esc(x.from)}–${esc(x.to)}` : ''}${x.timing ? ` (${esc(x.timing.toLowerCase())})` : ''}${x.needs ? ' · ' + esc(x.needs) : ''}</div>${x.charges ? `<p class="charge-line">Charges: ${esc(x.charges)}</p>` : ''}${x.reply ? `<p style="margin:8px 0 0;font-size:14px">${esc(x.reply)}</p>` : ''}</div>`).join('') : '<p>No requests yet.</p>'}
      </aside></div>`;
    const f = document.getElementById('f');
    const mins = (t) => { const p = String(t).split(':'); return Number(p[0]) * 60 + Number(p[1]); };
    const atNight = () => { if (!f.from.value || !f.to.value) return false; const a = mins(f.from.value), b = mins(f.to.value); return b <= a || a < 360 || a >= 1320 || b > 1320; };
    const picked = (name) => { const x = f.querySelector(`input[name=${name}]:checked`); return x ? x.value : ''; };
    const refresh = () => {
      const night = atNight(); document.getElementById('nightHint').hidden = !night;
      if (night && picked('timing') === 'Day') f.querySelector('input[name=timing][value="Day and night"]').checked = true;
      const needs = Array.from(f.querySelectorAll('input[name=need]:checked')).map((x) => x.value);
      const lines = [];
      if (needs.includes('Use of the terrace')) lines.push(`Terrace cleaning: <b>\u20b9${tc}</b> \u2014 payable to the owner`);
      if (needs.includes('Outside / terrace lighting')) lines.push('Lighting (common meter): the owner will tell you the amount');
      const box = document.getElementById('chargesBox'); box.hidden = !lines.length; box.innerHTML = lines.length ? `<b>Charges for this request</b><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>` : '';
    };
    f.addEventListener('change', refresh); f.from.addEventListener('input', refresh); f.to.addEventListener('input', refresh);
    f.onsubmit = async (e) => {
      e.preventDefault(); formError(f);
      const needs = Array.from(f.querySelectorAll('input[name=need]:checked')).map((x) => x.value);
      if (!f.date.value || !f.from.value || !f.to.value || f.details.value.trim().length < 5) return formError(f, 'Choose the date, the start and end time, and write the reason for the event.');
      const timing = picked('timing'), disturb = picked('disturb');
      if (!timing) return formError(f, 'Choose whether the event is in the day, at night, or both.');
      if (timing === 'Day' && atNight()) return formError(f, 'These times run into the night (after 10 pm or before 6 am). Choose \u201cNight\u201d or \u201cDay and night\u201d.');
      if (!disturb) return formError(f, 'Tell us whether it could disturb neighbours.');
      if (disturb === 'Yes' && f.details.value.trim().length < 15) return formError(f, 'Please explain in the details what may disturb neighbours (for example music until 11 pm).');
      if (disturb === 'Yes') needs.push('May disturb neighbours');
      const btn = f.querySelector('button[type=submit]'); busy(btn, true, 'Sending…');
      try { await api.call('requestEvent', { event: f.event.value, date: f.date.value, from: f.from.value, to: f.to.value, timing, needs, details: f.details.value.trim() }); toast('Request sent. The owner has been told.'); eventsView(); }
      catch (err) { if (!sessionEnded(err)) formError(f, err.message); busy(btn, false, 'Sending…'); }
    };
  }

  // ---------- tenant bill ----------
  let billMonth = null;
  async function billView() {
    loading('Getting your bill…');
    try {
      const [months, history] = await Promise.all([api.call('months'), api.call('history')]);
      if (!months.length) { app.innerHTML = '<div class="empty"><h2>No bills yet</h2><p>Your first bill will appear here once the month’s meter reading is added.</p></div>'; return; }
      const wanted = billMonth;
      const month = months.includes(wanted) ? wanted : months[0];
      const bill = await api.call('bill', { month });
      renderBill(bill, months, history, month);
    } catch (e) { if (!sessionEnded(e)) app.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; }
  }

  function sumRows(rows, k) { return rows.reduce((a, r) => a + (Number(r[k]) || 0), 0); }

  function renderBill(b, months, history, month) {
    const rows = b.rows, r0 = rows[0], t = b.tenant || {}, m = b.meta;
    const elec = sumRows(rows, 'electricity'), maint = sumRows(rows, 'maintenance'), rent = sumRows(rows, 'rent');
    const util = elec + maint, total = elec + maint + rent;
    const gov = m.electricityMode === 'BESCOM meters'; const bz = b.bescom || {};
    const payLink = (b.settings && b.settings.bescomPayLink) || '';
    const owner = r0.payee || t.owner || 'Owner';
    const pRent = total ? (rent / total) * 100 : 0;
    const partDays = rows.some((r) => Number(r.days) < Number(m.days));
    const due = '';
    const wa = b.settings && b.settings.whatsapp ? waLink(b.settings.whatsapp, `Hello, this is flat ${t.flat} (${monthLabel(month)} bill).`) : '';
    const showRenew = t.reminder && todayIso() >= t.reminder;
    const nextRent = n(t.afterRenewal) != null ? Number(t.afterRenewal) : Math.round(Number(t.currentRent || t.rent) * (1 + (Number(b.renewalPercent) || 5) / 100));

    app.innerHTML = `
      <div class="bill-head">
        <div><h1>${esc(monthLabel(month))} bill</h1><div class="sub">${m.electricityMode === 'BESCOM meters' ? 'Electricity is paid to BESCOM directly' : `Meter read on ${esc(m.takenOn || '—')}`}</div></div>
        <label class="no-print"><span class="sr" hidden>Month</span>
          <select class="month-select" id="msel" aria-label="Choose month">${months.map((k) => `<option value="${k}" ${k === month ? 'selected' : ''}>${esc(monthLabel(k))}</option>`).join('')}</select>
        </label>
      </div>
      <div class="bill-layout">
        <section class="slip enter" aria-label="Amount to pay">
          <div class="slip-top">
            <div>
              <div class="flatcode">${esc(t.flat || r0.flat)}</div>
              <div class="slip-meta"><strong>${esc(t.name || r0.tenant)}</strong>${esc(monthLabel(month))}</div>
            </div>
            <div aria-hidden="true">${buildingSVG(t.flat || r0.flat)}</div>
          </div>
          <div class="slip-total"><div class="label">Total for the month</div><div class="amount">${inr(total)}</div>${due ? `<div class="slip-due">${esc(due)}</div>` : ''}</div>
          <div class="split" aria-hidden="true"><div class="split-bar"><i class="s-rent" style="width:${pRent}%"></i><i class="s-util" style="width:${100 - pRent}%"></i></div></div>
          <div class="split-key">
            <div class="payto"><span class="dot" style="background:#C79A90"></span><div><div class="who-pay">${esc(owner)}</div><div class="what">Rent${rent === 0 ? ' — none this month' : ''}</div>${r0.rentDue && rent ? `<div class="due-line">Due ${dateLabel(r0.rentDue)} ${tenantChip(r0.rentStatus, r0.rentBalance)}</div>` : ''}</div><div class="amt">${inr0(rent)}</div></div>
            <div class="payto"><span class="dot" style="background:#8FA6CC"></span><div><div class="who-pay">${esc((b.payTo && b.payTo.utilities) || 'Arshad')}</div><div class="what">${gov ? `Maintenance ${inr(maint)}` : `Electricity ${inr(elec)} + maintenance ${inr(maint)}`}</div>${r0.utilDue ? `<div class="due-line">Due ${dateLabel(r0.utilDue)} ${tenantChip(r0.utilStatus, r0.utilBalance)}</div>` : ''}</div><div class="amt">${inr(util)}</div></div>
            ${gov ? `<div class="payto"><span class="dot" style="background:#E8C2B1"></span><div><div class="who-pay">BESCOM</div><div class="what">Electricity \u2014 your own BESCOM bill, paid directly</div></div><div class="amt">\u2014</div></div>` : ''}
          </div>
          <p class="upi-note">Pay each person separately via UPI. Need bank details instead? Ask us on WhatsApp.</p>
          <div class="slip-actions">
            <button class="btn small light" id="print">Print or save PDF</button>
            ${wa ? `<a class="btn small outline-light" href="${wa}" target="_blank" rel="noopener">Message on WhatsApp</a>` : ''}
          </div>
        </section>

        <div>
          ${gov ? `<section class="panel bescom-card">
            <h2>Electricity \u2014 pay BESCOM directly</h2>
            <p class="sub">Your flat has its own BESCOM meter. Electricity is not part of this bill: pay BESCOM\u2019s bill on their website, the BESCOM Mithra app, or any UPI app (Bill payments \u2192 Electricity \u2192 BESCOM).</p>
            <dl class="facts"><div><dt>BESCOM account ID</dt><dd>${esc(bz.account || 'Ask the owner')}</dd></div><div><dt>RR / meter number</dt><dd>${esc(bz.meter || 'Ask the owner')}</dd></div></dl>
            ${payLink ? `<a class="btn small" href="${esc(payLink)}" target="_blank" rel="noopener">Open the BESCOM website</a>` : ''}
          </section>` : `<section class="panel">
            <h2>Electricity</h2>
            <p class="sub">${partDays ? `Billed for ${rows.map((r) => r.days).join(' + ')} of ${m.days} days in this month.` : 'Your flat’s own meter.'}</p>
            ${rows.map((r) => `
              <div class="meter"><div><small>Previous reading</small><b>${esc(fmt1(r.prev))}</b></div><span class="arrow">${chevron}</span><div><small>This month</small><b>${esc(fmt1(r.cur))}</b></div></div>
              <div class="units-line"><span>Units used</span><b>${esc(fmt1(r.units))}</b></div>
              <table class="lines">
                <tr><td>Fixed charge<small>3 kW supply${Number(r.days) < Number(m.days) ? `, ${r.days} days` : ''}</small></td><td>${inr(r.fixed)}</td></tr>
                <tr><td>Energy<small>${esc(fmt1(r.units))} units × ₹${m.rates.energy}</small></td><td>${inr(r.energy)}</td></tr>
                <tr><td>Fuel adjustment (FPPCA)<small>${esc(fmt1(r.units))} units × ₹${m.rates.fppca}</small></td><td>${inr(r.fppca)}</td></tr>
                <tr><td>P&amp;G surcharge<small>${esc(fmt1(r.units))} units × ₹${m.rates.pg}</small></td><td>${inr(r.pg)}</td></tr>
                <tr class="sub"><td>Subtotal</td><td>${inr(r.subtotal)}</td></tr>
                <tr><td>Tax<small>${m.rates.tax}% on subtotal</small></td><td>${inr(r.tax)}</td></tr>
                <tr class="sum"><td>Electricity total</td><td>${inr(r.electricity)}</td></tr>
              </table>`).join('')}
            <p class="sub" style="margin:12px 0 0">Rates as per KERC/BESCOM tariff. ${r0.note ? esc(r0.note) : ''}</p>
          </section>`}

          <section class="panel">
            <h2>Rent and maintenance</h2>
            <table class="lines">
              <tr><td>Rent<small>Paid to ${esc(owner)}</small></td><td>${inr0(rent)}</td></tr>
              <tr><td>Common maintenance<small>Your equal share of common electricity, water, lift, security and upkeep</small></td><td>${inr(maint)}</td></tr>
              ${gov ? '<tr><td>Electricity<small>Paid to BESCOM directly</small></td><td>\u2014</td></tr>' : `<tr><td>Electricity<small>From the section above</small></td><td>${inr(elec)}</td></tr>`}
              <tr class="sum"><td>Total</td><td>${inr(total)}</td></tr>
            </table>
          </section>

          ${history.length > 1 ? `<section class="panel"><h2>Your electricity use</h2><p class="sub">Units per month</p>${usageChart(history, month)}</section>` : ''}

          <section class="panel">
            <h2>Your agreement</h2>
            <dl class="facts">
              <div><dt>Monthly rent now</dt><dd>${inr0(t.currentRent)}</dd></div>
              <div><dt>Agreement runs until</dt><dd>${dateLabel(t.ends)}</dd></div>
              <div><dt>Security deposit</dt><dd>${inr0(t.deposit)}</dd></div>
            </dl>
            ${showRenew ? `<div class="notice renew">Your agreement ends on ${dateLabel(t.ends)}. To continue, a new agreement is needed. The new rent would be ${inr0(nextRent)} a month — the owner will confirm the final amount.</div>` : ''}
          </section>
        </div>
      </div>`;
    document.getElementById('msel').onchange = (e) => { billMonth = e.target.value; billView(); };
    document.getElementById('print').onclick = () => window.print();
    agreementPrompt(t);
    requestAnswers();
  }
  // tenant: show answers to their requests once, at the top of the bill page, until they close it
  async function requestAnswers() {
    let mine = [];
    try { mine = await api.call('myRequests'); } catch (e) { return; }
    const fresh = mine.filter((x) => !/^Agreement/.test(x.event) && (x.status === 'Approved' || x.status === 'Declined') && !store.get('av_seen_' + x.id + '_' + x.status));
    if (!fresh.length || !document.querySelector('.bill-head')) return;
    const box = document.createElement('div'); box.className = 'answers';
    box.innerHTML = fresh.map((x) => `<div class="answer ${x.status === 'Approved' ? 'ok' : 'no'}"><div><b>Your request was ${x.status.toLowerCase()}:</b> ${esc(x.event)} on ${dateLabel(x.date)}${x.from ? `, ${esc(x.from)}\u2013${esc(x.to)}` : ''}.
      ${x.charges && x.status === 'Approved' ? `<div class="charge-line">Charges: ${esc(x.charges)}</div>` : ''}${x.reply ? `<div style="margin-top:4px">\u201c${esc(x.reply)}\u201d</div>` : ''}</div>
      <button type="button" class="ans-x" aria-label="Close" data-seen="${esc(x.id + '_' + x.status)}"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>`).join('');
    document.querySelector('.bill-head').before(box);
    box.querySelectorAll('[data-seen]').forEach((b) => { b.onclick = () => { store.set('av_seen_' + b.dataset.seen, 1); b.closest('.answer').remove(); if (!box.children.length) box.remove(); }; });
  }
  // payment status chip: Paid / Due / Overdue (Upcoming and Not tracked show nothing)
  const stChip = (st) => ({ Paid: '<span class="st paid">Paid</span>', Due: '<span class="st due">Due</span>', Overdue: '<span class="st over">Overdue</span>' }[st] || '');
  const tenantChip = (st, bal) => ({ Paid: '<span class="st paid">Paid</span>', 'Paid (rest waived)': '<span class="st paid">Paid</span>',
    Overpaid: `<span class="st info">You paid ${inr0(-Number(bal) || 0)} more</span>`, Due: '<span class="st due">Due</span>', Overdue: '<span class="st over">Overdue</span>',
    'Part paid': `<span class="st due">${inr0(bal)} still to pay</span>`, 'Part paid — overdue': `<span class="st over">${inr0(bal)} overdue</span>` }[st] || '');
  const fmt1 = (v) => n(v) == null ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 1 });
  const ordinal = (d) => { d = Number(d); const s = ['th', 'st', 'nd', 'rd'], v = d % 100; return d + (s[(v - 20) % 10] || s[v] || s[0]); };
  const waLink = (num, text) => { let d = String(num).replace(/\D/g, ''); if (d.length === 10) d = '91' + d; return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text); };

  function usageChart(h, current) {
    const data = h.slice(-8), W = Math.max(320, data.length * 80), H = 190, pad = 26, bw = Math.min(48, (W - pad * 2) / data.length - 14);
    const max = Math.max(...data.map((d) => d.units), 1);
    const step = (W - pad * 2) / data.length;
    const bars = data.map((d, i) => {
      const bh = Math.max(2, (d.units / max) * (H - 60)), x = pad + i * step + (step - bw) / 2, y = H - 26 - bh;
      return `<g><rect class="bar ${d.month === current ? 'now' : ''}" x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4"></rect>
        <text class="val" x="${x + bw / 2}" y="${y - 6}" text-anchor="middle">${Math.round(d.units)}</text>
        <text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${monthShort(d.month)}</text></g>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Units used per month">${bars}<line x1="${pad}" x2="${W - pad}" y1="${H - 26}" y2="${H - 26}" stroke="#DCE1E8"/></svg>`;
  }

  // ---------- staff ----------
  let staffTab = 'overview', staffMonth = null, ownersCache = null, pendingCount = 0;
  function staffView() {
    const w = who();
    const tabs = [['overview', 'Overview'], ['month', 'Monthly bills'], ['tenants', 'Tenants'], ['requests', `Requests${pendingCount ? ` (${pendingCount})` : ''}`], ['costs', 'Maintenance costs']]
      .concat(w.role === 'Admin' ? [['arshad', 'Arshad\u2019s account'], ['add', 'Add month'], ['settings', 'Settings'], ['people', 'People']] : []);
    if (!tabs.some((t) => t[0] === staffTab)) staffTab = 'overview';
    app.innerHTML = `<nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-t="${k}" aria-selected="${k === staffTab}">${l}</button>`).join('')}</nav><div id="pane"></div>`;
    app.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { staffTab = b.dataset.t; staffView(); }; });
    ({ overview: paneOverview, month: paneMonth, tenants: paneTenants, requests: paneRequests, costs: paneCosts, add: paneAdd, settings: paneSettings, arshad: paneArshad, people: panePeople })[staffTab]();
  }
  const pane = () => document.getElementById('pane');

  async function paneMonth() {
    pane().innerHTML = '<div class="loading">Loading the month…</div>';
    let o;
    try { o = await api.call('overview', { month: staffMonth }); } catch (e) { if (!sessionEnded(e)) pane().innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    staffMonth = o.meta.month;
    const admin = o.role === 'Admin';
    const owners = Object.keys(o.byOwner).sort();
    pane().innerHTML = `
      <div class="toolbar">
        <h1>${esc(monthLabel(o.meta.month))}</h1>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <span class="pill ${o.meta.published ? 'ok' : 'off'}">${o.meta.published ? 'Published — tenants can see it' : 'Not published yet'}</span>
          ${admin ? `<button class="btn small ${o.meta.published ? 'ghost' : ''}" id="pub">${o.meta.published ? 'Unpublish' : 'Publish'}</button>` : ''}
          <select class="month-select" id="msel" aria-label="Choose month">${o.months.map((k) => `<option value="${k}" ${k === o.meta.month ? 'selected' : ''}>${esc(monthLabel(k))}</option>`).join('')}</select>
        </div>
      </div>
      <p style="color:var(--stone);font-size:14px;margin:-6px 0 18px">Meter read on ${esc(o.meta.takenOn || '—')} · Maintenance ${inr(o.meta.maintenance)} per flat · ${o.meta.days} days</p>
      <div class="payees">
        ${admin ? `<div class="payee arshad"><small>To Arshad (electricity + maintenance)</small><b>${inr(o.toArshad)}</b></div>` : ''}
        ${owners.map((k) => `<div class="payee"><small>Rent to ${esc(k)}</small><b>${inr0(o.byOwner[k])}</b></div>`).join('')}
      </div>
      ${o.warnings.length ? `<ul class="issues">${o.warnings.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${o.renewals.length ? `<div class="notice renew" style="margin:0 0 18px"><strong>Renewals coming up:</strong> ${o.renewals.map((r) => `${esc(r.flat)} (${esc(r.tenant)}) — ends ${dateLabel(r.ends)}, standard new rent ${inr0(r.nextRent)}`).join('; ')}</div>` : ''}
      <div class="tablewrap cards-on-phone"><table class="data">
        <thead><tr><th>Flat</th><th class="l">Tenant</th><th>Units</th><th>Days</th><th>Electricity</th><th>Maintenance</th><th>Rent</th><th>Total bill</th><th class="l">Rent goes to</th><th class="l">Rent paid</th><th class="l">Elec. + maint. paid</th></tr></thead>
        <tbody>${o.rows.map((r) => {
          const ov = r.overrides || {};
          const mark = (k) => ov[k] !== '' && ov[k] != null ? '<span class="ovr-mark" title="Changed by admin">*</span>' : '';
          return `<tr class="${r.billed ? '' : 'muted'} ${admin ? 'clickable' : ''}" data-row="${r.sheetRow || ''}" ${admin ? 'tabindex="0"' : ''}>
            <td class="flat" data-label="Flat">${esc(r.flat)}</td><td class="l" data-label="Tenant">${esc(r.tenant || '—')}</td><td data-label="Units">${fmt1(r.units)}</td><td data-label="Days">${esc(r.days)}</td>
            <td data-label="Electricity">${inr(r.electricity)}${mark('fixed')}</td><td data-label="Maintenance">${r.flat === 'Common' ? '—' : inr(r.maintenance)}${mark('maintenance')}</td>
            <td data-label="Rent">${r.flat === 'Common' ? '—' : inr0(r.rent)}${mark('rent')}</td><td data-label="Total bill"><strong>${r.billed ? inr(r.total) : 'Not billed'}</strong></td><td class="l" data-label="Rent goes to">${esc(r.payee || '')}</td>
            <td class="l" data-label="Rent paid">${payCell(r, 'rent', admin || r.payee === o.name)}</td>
            <td class="l" data-label="Elec. + maint. paid">${payCell(r, 'util', admin)}</td></tr>`;
        }).join('')}</tbody>
        <tfoot><tr><td colspan="4">Total (billed flats)</td><td data-label="Electricity">${inr(o.totals.electricity)}</td><td data-label="Maintenance">${inr(o.totals.maintenance)}</td><td data-label="Rent">${inr0(o.totals.rent)}</td><td data-label="Total bill">${inr(o.totals.total)}</td><td></td><td></td><td></td></tr></tfoot>
      </table></div>
      <p style="font-size:13px;color:var(--stone);margin-top:10px">Press <b>Paid</b> when the money arrives — today's date is saved.${admin ? ' Tap a flat to correct a reading, change the days billed, or set a different amount for that flat. * = amount changed by admin.' : ''}</p>`;
    pane().querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const [rowId, what] = b.dataset.pay.split('|');
      payDialog(o, o.rows.find((x) => String(x.sheetRow) === rowId), what, paneMonth);
    }));
    document.getElementById('msel').onchange = (e) => { staffMonth = e.target.value; paneMonth(); };
    if (admin) {
      document.getElementById('pub').onclick = async (e) => {
        busy(e.target, true);
        try { await api.call('publishMonth', { month: o.meta.month, published: !o.meta.published }); toast(o.meta.published ? 'Unpublished.' : 'Published. Tenants can now see this month.'); paneMonth(); }
        catch (err) { toast(err.message); busy(e.target, false); }
      };
      pane().querySelectorAll('tr.clickable').forEach((tr) => {
        const open = () => editRow(o, o.rows.find((r) => String(r.sheetRow) === tr.dataset.row));
        tr.onclick = (e) => { if (!e.target.closest('[data-pay]')) open(); }; tr.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
      });
    }
  }

  function openSheet(html, onSubmit) {
    sheet.innerHTML = `<form class="sheet-inner" method="dialog" novalidate>${html}
      <div class="sheet-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button type="submit" class="btn" data-save>Save changes</button></div></form>`;
    const f = sheet.querySelector('form');
    f.querySelector('[data-close]').onclick = () => sheet.close();
    f.onsubmit = async (e) => {
      e.preventDefault(); formError(f);
      const btn = f.querySelector('[data-save]'); busy(btn, true, 'Saving…');
      try { const msg = await onSubmit(f); sheet.close(); if (msg) toast(msg); }
      catch (err) { if (!sessionEnded(err)) formError(f, err.message.replace(/\s*\[wait:\d+\]/, '')); busy(btn, false, 'Saving…'); }
    };
    sheet.showModal();
    const first = f.querySelector('input, select'); if (first) first.focus();
    return f;
  }
  const fld = (id, label, val, opt = {}) => `<div class="field ${opt.cls || ''}"><label for="${id}">${label}</label>
    ${opt.select ? `<select id="${id}" name="${id}">${opt.select.map((o) => `<option ${String(o) === String(val) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : `<input id="${id}" name="${id}" type="${opt.type || 'text'}" ${opt.step ? `step="${opt.step}"` : ''} inputmode="${opt.mode || 'text'}" value="${esc(val == null ? '' : val)}" ${opt.ph ? `placeholder="${esc(opt.ph)}"` : ''}>`}
    ${opt.hint ? `<span class="hint">${opt.hint}</span>` : ''}</div>`;
  function changed(f, initial) {
    const out = {};
    Object.keys(initial).forEach((k) => { const el = f.elements[k]; if (el && String(el.value) !== String(initial[k] == null ? '' : initial[k])) out[k] = el.value; });
    return out;
  }

  function editRow(o, r) {
    if (!r || r.sheetRow == null) return;
    const ov = r.overrides || {};
    const init = { tenantId: r.tenantId, prev: r.prev, cur: r.cur, days: Number(r.days) === Number(o.meta.days) ? '' : r.days,
      fixedOverride: ov.fixed, maintenanceOverride: ov.maintenance, rentOverride: ov.rent, bill: r.billed ? 'Yes' : 'No', note: r.note };
    openSheet(`
      <h2 id="sheet-title">${esc(r.flat)} — ${esc(monthLabel(o.meta.month))}</h2>
      <p class="sub">${esc(r.tenant || 'No tenant')} · current total ${r.billed ? inr(r.total) : 'not billed'}</p>
      <div class="grid-2">
        ${fld('prev', 'Previous reading', init.prev, { type: 'number', step: '0.1', mode: 'decimal' })}
        ${fld('cur', 'Current reading', init.cur, { type: 'number', step: '0.1', mode: 'decimal' })}
        ${fld('days', 'Days billed', init.days, { type: 'number', mode: 'numeric', ph: `${o.meta.days} (full month)`, hint: 'Leave empty for the full month. Type fewer days if the tenant moved in or out.' })}
        ${fld('tenantId', 'Tenant ID', init.tenantId, { hint: 'From the Tenants list, e.g. T-S2-02' })}
      </div>
      <p style="font-size:14px;margin:4px 0 10px"><strong>Different amount for this flat?</strong> Leave empty to use the automatic amount.</p>
      <div class="grid-2">
        ${fld('fixedOverride', 'Fixed charge (₹)', init.fixedOverride, { type: 'number', step: '0.01', mode: 'decimal', cls: 'override', ph: `Automatic: ${inr(r.fixed)}` })}
        ${fld('maintenanceOverride', 'Maintenance (₹)', init.maintenanceOverride, { type: 'number', step: '0.01', mode: 'decimal', cls: 'override', ph: 'Automatic' })}
        ${fld('rentOverride', 'Rent (₹)', init.rentOverride, { type: 'number', step: '1', mode: 'numeric', cls: 'override', ph: 'Automatic' })}
        ${fld('bill', 'Bill this flat?', init.bill, { select: ['Yes', 'No'] })}
      </div>
      ${fld('note', 'Note (shown to the tenant)', init.note)}`,
    async (f) => {
      const ch = changed(f, init);
      if (!Object.keys(ch).length) return 'Nothing changed.';
      await api.call('updateMonthRow', { month: o.meta.month, sheetRow: r.sheetRow, changes: ch });
      paneMonth(); return 'Saved. The bill is updated.';
    });
  }

  async function loadOwners() {
    if (ownersCache) return ownersCache;
    try { ownersCache = (await api.call('people')).filter((p) => p.role === 'Owner' || p.role === 'Admin').map((p) => p.name); }
    catch (e) { ownersCache = []; }
    return ownersCache;
  }

  async function paneTenants() {
    pane().innerHTML = '<div class="loading">Loading tenants…</div>';
    const w = who(); const admin = w.role === 'Admin';
    let list;
    try { list = await api.call('tenants'); } catch (e) { if (!sessionEnded(e)) pane().innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const active = list.filter((t) => t.status === 'Active').sort((a, b) => a.flat.localeCompare(b.flat));
    const past = list.filter((t) => t.status !== 'Active');
    pane().innerHTML = `
      <div class="toolbar"><h1>Tenants</h1>${admin ? '<button class="btn small" id="addT">Add new tenant</button>' : ''}</div>
      <div class="list-cards">${active.map((t) => `
        <article class="tcard">
          <div class="top"><span class="flat">${esc(t.flat)}</span><span class="pill ${todayIso() >= t.reminder ? 'off' : 'ok'}">${todayIso() >= t.reminder ? 'Renewal due' : 'Active'}</span></div>
          <div class="name">${esc(t.name)}</div>
          <div class="meta">Rent ${inr0(t.currentRent)} → ${esc(t.owner)}</div>
          <div class="meta">Agreement from ${dateLabel(t.start)} · next renewal ${dateLabel(t.renewal)} at ${inr0(t.afterRenewal)}</div>
          ${admin ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost small" data-edit="${esc(t.id)}">Edit</button>${todayIso() >= t.reminder ? `<button class="btn ghost small" data-renew="${esc(t.id)}">Renew agreement</button>` : ''}<button class="btn ghost small" data-vacate="${esc(t.id)}">Mark vacated</button></div>` : ''}
        </article>`).join('')}</div>
      ${past.length ? `<h2 style="font-size:16px;margin:28px 0 10px">Past tenants</h2><p style="color:var(--stone);font-size:14px">${past.map((t) => `${esc(t.flat)} — ${esc(t.name)}`).join(' · ')}</p>` : ''}`;
    if (!admin) return;
    const owners = await loadOwners();
    pane().querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => editTenant(list.find((t) => t.id === b.dataset.edit), owners); });
    pane().querySelectorAll('[data-renew]').forEach((b) => { b.onclick = () => renewTenant(list.find((t) => t.id === b.dataset.renew)); });
    pane().querySelectorAll('[data-vacate]').forEach((b) => { b.onclick = () => {
      const t = list.find((x) => x.id === b.dataset.vacate);
      openSheet(`<h2 id="sheet-title">${esc(t.flat)} — ${esc(t.name)} is moving out</h2>
        <p class="sub">The tenant is kept in the sheet as 'Vacated' (history is not deleted) and can no longer log in. Then use 'Add new tenant' for the next person.</p>
        ${fld('movedOut', 'Moved out on', todayIso(), { type: 'date' })}
        <p class="sub" style="margin:0">In the month they leave, open Monthly bills, tap the flat and set 'Days billed' to the days they stayed.</p>`,
        async (f) => { await api.call('updateTenant', { tenantId: t.id, changes: { status: 'Vacated', movedOut: f.movedOut.value } }); paneTenants(); return `${t.flat} marked as vacated.`; });
    }; });
    document.getElementById('addT').onclick = () => addTenant(owners);
  }

  const approveBox = () => '';

  function editTenant(t, owners) {
    const init = { name: t.name, phone: t.phone, secret: '', owner: t.owner, status: t.status, movedIn: t.movedIn, movedOut: t.movedOut,
      rent: t.rent, deposit: t.deposit, start: t.start, agreed: '' };
    const ownerList = Array.from(new Set([t.owner].concat(owners)));
    const f = openSheet(`
      <h2 id="sheet-title">${esc(t.flat)} — ${esc(t.name)}</h2>
      <p class="sub">Change only what is different. Changes go straight into the Google Sheet and are listed in Change_Log.</p>
      ${fld('name', 'Tenant name', init.name)}
      <div class="grid-2">
        ${fld('phone', 'Phone (used to log in)', init.phone, { type: 'tel', mode: 'tel' })}
        ${fld('secret', 'New date of birth (login)', '', { mode: 'numeric', ph: 'Leave empty to keep', hint: '8 digits DDMMYYYY, e.g. 01101985' })}
        ${fld('owner', 'Owner (rent goes to)', init.owner, { select: ownerList })}
        ${fld('status', 'Status', init.status, { select: ['Active', 'Vacated'] })}
        ${fld('movedIn', 'Moved in (handover)', init.movedIn, { type: 'date' })}
        ${fld('movedOut', 'Moved out', init.movedOut, { type: 'date' })}
        ${fld('rent', 'Current rent (₹)', init.rent, { type: 'number', mode: 'numeric' })}
        ${fld('deposit', 'Security deposit (₹)', init.deposit, { type: 'number', mode: 'numeric' })}
        ${fld('start', 'Current agreement start', init.start, { type: 'date', hint: `Next renewal is 11 months later (now ${dateLabel(t.renewal)})` })}
      </div>
      ${fld('agreed', 'Agreed next renewal rent (₹) — only if not the standard 5%', '', { type: 'number', mode: 'numeric', cls: 'override', ph: `Now ${inr0(t.afterRenewal)}`, hint: 'Example: the tenant agreed ₹1,000 extra instead of 5%.' })}
      ${approveBox(t.owner)}`,
    async (form) => {
      const ch = changed(form, init);
      if (ch.secret) { ch.secret = ch.secret.replace(/\D/g, ''); if (ch.secret.length !== 8) throw new Error('Date of birth must be 8 digits: DDMMYYYY.'); }
      if (!Object.keys(ch).length) return 'Nothing changed.';
      await api.call('updateTenant', { tenantId: t.id, changes: ch, ownerDob: '' });
      paneTenants(); return 'Tenant updated.';
    });
  }

  function addTenant(owners) {
    const f = openSheet(`
      <h2 id="sheet-title">Add a new tenant</h2>
      <p class="sub">The flat's current tenant is marked as moved out automatically. In the month they swap, set 'Days billed' for each tenant on the Monthly bills tab.</p>
      <div class="grid-2">
        ${fld('flat', 'Flat', 'N1', { select: FLATS })}
        ${fld('owner', 'Owner (rent goes to)', owners[0] || '', { select: owners.length ? owners : [''] })}
      </div>
      ${fld('name', 'Tenant name', '')}
      <div class="grid-2">
        ${fld('phone', 'Phone (used to log in)', '', { type: 'tel', mode: 'tel' })}
        ${fld('secret', 'Date of birth of the person on the agreement', '', { mode: 'numeric', ph: 'DDMMYYYY', hint: '8 digits, e.g. 01101985. Used to log in.' })}
        ${fld('movedIn', 'Moved in (handover)', '', { type: 'date' })}
        ${fld('previousMovedOut', 'Previous tenant moved out', '', { type: 'date' })}
        ${fld('rent', 'Monthly rent (₹)', '', { type: 'number', mode: 'numeric' })}
        ${fld('deposit', 'Security deposit (₹)', '', { type: 'number', mode: 'numeric' })}
        ${fld('start', 'Agreement start', '', { type: 'date', hint: 'First renewal is worked out: 11 months later' })}
      </div>
      ${fld('notes', 'Notes', '')}
      <div id="approveWrap"></div>`,
    async (form) => {
      const d = {}; ['flat', 'owner', 'name', 'phone', 'secret', 'movedIn', 'previousMovedOut', 'rent', 'deposit', 'start', 'notes'].forEach((k) => { d[k] = form.elements[k].value; });
      if (!d.name || !d.rent || !d.start) throw new Error('Fill in at least the name, rent and agreement start.');
      d.secret = d.secret.replace(/\D/g, ''); if (d.secret && d.secret.length !== 8) throw new Error('Date of birth must be 8 digits: DDMMYYYY.');
      const r = await api.call('addTenant', { tenant: d, ownerDob: '' });
      paneTenants(); return `Added ${d.name} (${r.id}).`;
    });
  }

  function renewTenant(t) {
    openSheet(`
      <h2 id="sheet-title">Renew ${esc(t.flat)} — ${esc(t.name)}</h2>
      <p class="sub">Current rent ${inr0(t.currentRent)} from ${dateLabel(t.start)}. After saving, this becomes the previous agreement and the new one starts.</p>
      <div class="grid-2">
        ${fld('newStart', 'New agreement starts', t.renewal, { type: 'date' })}
        ${fld('newRent', 'New monthly rent (₹)', t.afterRenewal, { type: 'number', mode: 'numeric', hint: 'Standard is +5%. Type a different amount if agreed.' })}
      </div>
      ${approveBox(t.owner)}`,
    async (f) => {
      await api.call('renewAgreement', { tenantId: t.id, newStart: f.newStart.value, newRent: f.newRent.value, ownerDob: '' });
      paneTenants(); return `Renewed. New rent ${inr0(f.newRent.value)} from ${dateLabel(f.newStart.value)}.`;
    });
  }

  async function paneAdd() {
    pane().innerHTML = '<div class="loading">Loading…</div>';
    let o, costs, cfg;
    try { [o, costs, cfg] = await Promise.all([api.call('overview', {}), api.call('costs'), api.call('adminSettings')]); } catch (e) { if (!sessionEnded(e)) pane().innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const sv = cfg.values || {};
    const gov = sv.electricity_mode === 'BESCOM meters';
    const R = { fixed: Number(sv.fixed_charge) || 0, energy: Number(sv.energy_rate) || 0, fppca: Number(sv.fppca_rate) || 0, pg: Number(sv.pg_surcharge_rate) || 0, tax: Number(sv.tax_percent) || 0 };
    const last = o.meta.month; const [y, m] = last.split('-').map(Number);
    const next = new Date(y, m, 1); const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    const lastRead = {}; o.rows.forEach((r) => { lastRead[r.flat] = n(r.cur); });
    const METERS = FLATS.concat(['Common']);
    const needPrev = gov ? [] : METERS.filter((fl) => lastRead[fl] == null);   // first month on private meters (or the first common reading)
    const fixed = costs.filter((c) => c.type === 'Fixed'), varies = costs.filter((c) => c.type === 'Varies');
    const fixedSum = fixed.reduce((a, c) => a + (Number(c.amount) || 0), 0);
    pane().innerHTML = `
      <div class="toolbar"><h1>Add a new month</h1></div>
      <form id="f" class="panel" novalidate style="max-width:900px">
        ${gov ? `<div class="notice info" style="margin:0 0 14px"><b>BESCOM meters are on.</b> Each flat pays BESCOM directly, so no meter readings are needed and no electricity is billed here. Tenants see their BESCOM account ID and meter number on the bill. (Change this in Settings.)</div>`
          : `<p class="sub">Type this month's readings: the 10 flat meters and the <b>main meter</b> (the whole building). Common units = main meter units − all 10 flats’ units. Everything else is worked out: electricity and each flat's maintenance share. The month stays hidden from tenants until you publish it.</p>`}
        <div class="grid-2">
          ${fld('month', 'Month', nextKey, { type: 'month' })}
          ${gov ? '' : fld('takenOn', 'Readings taken on', '', { ph: 'e.g. 30/11/2026 10:00 PM' })}
        </div>
        ${gov ? '' : `<h2 style="font-size:16px;margin:8px 0 12px">Meter readings (10 flats + main meter)</h2>
        <div class="readings">${METERS.map((fl) => fld('r_' + fl, fl === 'Common' ? 'Main meter' : fl, '', { type: 'number', step: '0.1', mode: 'decimal', hint: lastRead[fl] != null ? `Last: ${fmt1(lastRead[fl])}` : (fl === 'Common' ? 'Whole building' : 'First reading') })).join('')}</div>
        ${needPrev.length ? `<h2 style="font-size:15px;margin:4px 0 6px">Last month’s readings (needed once)</h2><p class="sub" style="margin-bottom:10px">These meters have no earlier reading on the website${o.meta.electricityMode === 'BESCOM meters' ? ' (last month was on BESCOM meters)' : ''}. Type the reading at the start of this month; after this it fills itself.</p>
          <div class="readings">${needPrev.map((fl) => fld('p_' + fl, (fl === 'Common' ? 'Main meter' : fl) + ' — start', '', { type: 'number', step: '0.1', mode: 'decimal' })).join('')}</div>` : ''}
        <div class="notice info" id="calc" style="margin:0 0 18px">Type the readings to see the units used.</div>
        <p class="sub" style="margin:-8px 0 16px">Tariff used: fixed ${inr0(R.fixed)} a month, ₹${R.energy} + ₹${R.fppca} + ₹${R.pg} per unit, tax ${R.tax}% (change it in Settings).</p>`}
        <h2 style="font-size:16px;margin:8px 0 6px">Maintenance this month</h2>
        <p class="sub" style="margin-bottom:12px">Fixed costs come from <b>Maintenance costs</b>: ${fixed.map((c) => `${esc(c.name)} ${inr0(c.amount)}`).join(', ')} = ${inr0(fixedSum)}. ${gov ? 'Type the common area’s BESCOM bill below.' : 'Common electricity is added automatically.'}</p>
        <div class="grid-2">${gov ? fld('commonBill', 'Common area electricity — BESCOM bill (₹)', '', { type: 'number', step: '0.01', mode: 'decimal', hint: 'Lift, lobbies and lights' }) : ''}${varies.map((c, i) => fld('v_' + i, `${esc(c.name)} (₹)`, c.amount, { type: 'number', step: '0.01', mode: 'decimal', hint: 'Changes every month' })).join('')}</div>
        <div id="extras"></div>
        <button type="button" class="btn ghost small" id="addExtra" style="margin-bottom:16px">Add another item (e.g. a repair)</button>
        <div class="notice renew" id="mcalc" style="margin:0 0 18px"></div>
        <button class="btn" type="submit">Add ${esc(monthLabel(nextKey))}</button>
      </form>`;
    const f = document.getElementById('f');
    let nExtra = 0;
    document.getElementById('addExtra').onclick = () => {
      const i = nExtra++; const d = document.createElement('div'); d.className = 'grid-2';
      d.innerHTML = fld('xn_' + i, 'Item', '', { ph: 'e.g. Borewell starter repair' }) + fld('xa_' + i, 'Amount (₹)', '', { type: 'number', step: '0.01', mode: 'decimal' });
      document.getElementById('extras').appendChild(d); f.elements['xn_' + i].focus();
    };
    const RATE = R.energy + R.fppca + R.pg;
    const prevOf = (fl) => (lastRead[fl] != null ? lastRead[fl] : (f.elements['p_' + fl] && f.elements['p_' + fl].value !== '' ? Number(f.elements['p_' + fl].value) : null));
    const calc = () => {
      let total = fixedSum, commonElec = 0;
      if (!gov) {
        let flatUnits = 0, ok = true;
        FLATS.forEach((fl) => { const v = f.elements['r_' + fl].value, p0 = prevOf(fl); if (v === '' || p0 == null) ok = false; else flatUnits += Number(v) - p0; });
        const cPrev = prevOf('Common');
        const mainUnits = f.r_Common.value !== '' && cPrev != null ? Math.round((Number(f.r_Common.value) - cPrev) * 10) / 10 : null;
        const common = ok && mainUnits != null ? Math.round((mainUnits - flatUnits) * 10) / 10 : null;
        document.getElementById('calc').innerHTML = (ok ? `The 10 flats used ${fmt1(flatUnits)} units. ` : 'Type all 10 flat readings. ')
          + (mainUnits == null ? 'Type the main meter reading to see the common units.' : `Main meter: ${fmt1(mainUnits)} units` + (common == null ? '.' : ` − flats ${fmt1(flatUnits)} = <b>common ${fmt1(common)} units</b>.`))
          + (common != null && common < 0 ? ' <b>Check the readings: the flats used more than the main meter.</b>' : '');
        commonElec = common == null ? 0 : (R.fixed + common * RATE) * (1 + R.tax / 100);
        total += commonElec;
      } else total += Number(f.commonBill.value) || 0;
      varies.forEach((c, i) => { total += Number(f.elements['v_' + i].value) || 0; });
      for (let i = 0; i < nExtra; i++) total += Number(f.elements['xa_' + i].value) || 0;
      document.getElementById('mcalc').innerHTML = `${gov ? '' : `Common electricity about ${inr(commonElec)} · `}total common cost ${inr(total)} · <b>maintenance per flat about ${inr0(Math.round(total / 10))}</b>`;
    };
    f.addEventListener('input', calc); calc();
    f.month.onchange = () => { f.querySelector('button[type=submit]').textContent = 'Add ' + monthLabel(f.month.value); };
    f.onsubmit = async (e) => {
      e.preventDefault(); formError(f);
      if (!f.month.value) return formError(f, 'Choose the month.');
      const readings = {}, prevReadings = {}; const low = [];
      if (!gov) {
        METERS.forEach((fl) => { const v = f.elements['r_' + fl].value; readings[fl] = v; const p0 = prevOf(fl); if (v !== '' && p0 != null && Number(v) < p0) low.push(fl); });
        needPrev.forEach((fl) => { prevReadings[fl] = f.elements['p_' + fl].value; });
        if (needPrev.some((fl) => prevReadings[fl] === '' && readings[fl] !== '')) return formError(f, 'Type last month’s reading for: ' + needPrev.filter((fl) => prevReadings[fl] === '').join(', ') + '.');
        if (low.length && !confirmLow(f, low)) return;
      } else if (f.commonBill.value === '') return formError(f, 'Type the common area’s BESCOM bill amount (it can be 0).');
      const items = varies.map((c, i) => ({ name: c.name, amount: f.elements['v_' + i].value }));
      for (let i = 0; i < nExtra; i++) if (f.elements['xn_' + i].value.trim()) items.push({ name: f.elements['xn_' + i].value.trim(), amount: f.elements['xa_' + i].value });
      const btn = f.querySelector('button[type=submit]'); busy(btn, true, 'Adding…');
      try {
        await api.call('addMonth', { month: f.month.value, takenOn: gov ? 'BESCOM meters' : f.takenOn.value, readings, prevReadings, commonBill: gov ? f.commonBill.value : '', items });
        staffMonth = f.month.value; staffTab = 'month'; toast(`Added ${monthLabel(f.month.value)}. Check the bills, then publish.`); staffView();
      } catch (err) { if (!sessionEnded(err)) formError(f, err.message); busy(btn, false, 'Adding…'); }
    };
  }


  // ---------- payments ----------
  const PAY_LABEL = { rent: 'Rent', util: 'Electricity + maintenance' };
  function payCell(r, what, canMark) {
    const due = what === 'rent' ? r.rentDue : r.utilDue;
    if (!due || !r.billed) return '';
    const st = what === 'rent' ? r.rentStatus : r.utilStatus;
    const bal = what === 'rent' ? r.rentBalance : r.utilBalance;
    const chip = { Paid: '<span class="st paid">Paid</span>', 'Paid (rest waived)': '<span class="st paid">Paid · rest waived</span>',
      Overpaid: `<span class="st info">Overpaid ${inr0(-Number(bal) || 0)}</span>`, Due: '<span class="st due">Due</span>', Overdue: '<span class="st over">Overdue</span>',
      'Part paid': `<span class="st due">Part paid · ${inr0(bal)} left</span>`, 'Part paid — overdue': `<span class="st over">${inr0(bal)} overdue</span>`,
      Upcoming: '<span class="st">Upcoming</span>', 'Not tracked': '' }[st] || '';
    const done = /^Paid|Overpaid/.test(st);
    const btn = canMark && st !== 'Not tracked' ? `<button type="button" class="paybtn ${done ? 'done' : ''}" data-pay="${r.sheetRow}|${what}">${done ? 'Change' : 'Paid'}</button>` : '';
    return `<div class="paycell"><span>${dateLabel(due)}</span>${chip}${btn}</div>`;
  }
  function payDialog(o, r, what, after) {
    if (!r) return;
    const amount = what === 'rent' ? Number(r.rent) || 0 : Math.round(((Number(r.electricity) || 0) + (Number(r.maintenance) || 0)) * 100) / 100;
    const st = what === 'rent' ? r.rentStatus : r.utilStatus;
    const part = /Part paid/.test(st), done = /^Paid|Overpaid/.test(st);
    const call = async (mode, extra) => {
      await api.call('markPaid', Object.assign({ month: o.meta.month, sheetRow: r.sheetRow, what, mode }, extra || {}));
      sheet.close(); toast(mode === 'undo' ? 'Payment cleared.' : mode === 'waive' ? 'Rest waived.' : 'Saved as paid today.'); after();
    };
    sheet.innerHTML = `<div class="sheet-inner">
      <h2 id="sheet-title">${esc(r.flat)} — ${PAY_LABEL[what]}</h2>
      <p class="sub">${esc(r.tenant)} · ${esc(monthLabel(o.meta.month))} · amount ${inr(amount)}${(what === 'rent' ? r.rentPaid : r.utilPaid) ? ` · marked on ${dateLabel(what === 'rent' ? r.rentPaid : r.utilPaid)}` : ''}</p>
      <div style="display:grid;gap:10px">
        <button class="btn block" id="pFull">Paid in full today</button>
        <form id="pAmt" class="approve" style="padding-bottom:12px" novalidate>
          <p><strong>Paid a different amount?</strong> Less shows the balance still due; more shows "Overpaid".</p>
          <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">
            <div class="field" style="margin:0;flex:1;min-width:150px"><label for="amt">Amount received (₹)</label><input id="amt" type="number" step="0.01" inputmode="decimal"></div>
            <button class="btn ghost" type="submit">Save amount</button>
          </div>
        </form>
        ${part ? '<button class="btn ghost block" id="pWaive">Waive the rest (no more to pay)</button>' : ''}
        ${done || part ? '<button class="btn ghost block" id="pUndo">Clear this payment</button>' : ''}
        <button class="btn ghost block" id="pClose">Cancel</button>
      </div></div>`;
    sheet.showModal();
    const guard = (fn) => async (e) => { e.preventDefault(); try { await fn(); } catch (err) { if (!sessionEnded(err)) toast(err.message); } };
    document.getElementById('pFull').onclick = guard(() => call('full'));
    document.getElementById('pAmt').onsubmit = guard(() => call('amount', { amount: document.getElementById('amt').value }));
    if (part) document.getElementById('pWaive').onclick = guard(() => call('waive'));
    if (done || part) document.getElementById('pUndo').onclick = guard(() => call('undo'));
    document.getElementById('pClose').onclick = () => sheet.close();
  }

  // ---------- overview: last month, this month, next month ----------
  async function paneOverview() {
    pane().innerHTML = '<div class="loading">Loading…</div>';
    let o;
    let tl = [];
    try { [o, tl] = await Promise.all([api.call('overview', {}), api.call('tenants').catch(() => [])]); } catch (e) { if (!sessionEnded(e)) pane().innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const byOwner = {};
    (tl || []).filter((t) => t.status === 'Active').sort((a, b) => a.flat.localeCompare(b.flat)).forEach((t) => {
      const k = t.owner || 'Not set'; (byOwner[k] = byOwner[k] || { flats: [], rent: 0 }); byOwner[k].flats.push(t.flat); byOwner[k].rent += Number(t.currentRent) || 0;
    });
    const ownersPanel = Object.keys(byOwner).length ? `<section class="panel"><h2>Owners on the agreements</h2><p class="sub">Who receives each flat\u2019s rent (change it in Tenants \u2192 Edit). Residents only see one contact \u2014 you.</p>
      <div class="owner-grid">${Object.keys(byOwner).map((k) => `<div class="owner-card"><strong>${esc(k)}</strong><span class="flats">${byOwner[k].flats.map(esc).join(' \u00b7 ')}</span><span class="amt">${inr0(byOwner[k].rent)} <small>rent a month</small></span></div>`).join('')}</div></section>` : '';
    if (o.pendingRequests !== pendingCount) { pendingCount = o.pendingRequests; const t = app.querySelector('[data-t=requests]'); if (t) t.textContent = `Requests${pendingCount ? ` (${pendingCount})` : ''}`; }
    const h = o.history || []; const cur = h[h.length - 1] || {}, prev = h[h.length - 2] || {};
    const owed = (x) => (x.total || 0) - (x.paidRent || 0) - (x.paidUtil || 0);
    const card = (title, x, extra) => `<div class="ov-card"><h3>${title}</h3><p class="ov-month">${esc(monthLabel(x.month))}</p>
      <dl><div><dt>Billed</dt><dd>${inr0(x.total)}</dd></div><div><dt>Received</dt><dd>${inr0((x.paidRent || 0) + (x.paidUtil || 0))}</dd></div>
      <div><dt>Still to collect</dt><dd class="${owed(x) > 0.5 ? 'neg' : ''}">${inr0(Math.max(0, owed(x)))}</dd></div><div><dt>Maintenance per flat</dt><dd>${inr(x.maintenancePerFlat)}</dd></div></dl>${extra || ''}</div>`;
    const nx = o.next || {};
    pane().innerHTML = `
      ${o.warnings.length ? `<ul class="issues">${o.warnings.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${o.pendingRequests ? `<div class="notice renew" style="margin:0 0 16px"><b>${o.pendingRequests} event request${o.pendingRequests > 1 ? 's' : ''}</b> waiting for an answer — see the Requests tab.</div>` : ''}
      ${o.renewals.length ? `<div class="notice renew" style="margin:0 0 16px"><b>Renewal due soon:</b> ${o.renewals.map((r) => `${esc(r.flat)} (${esc(r.tenant)}) on ${dateLabel(r.renewal)}, new rent ${inr0(r.nextRent)}`).join('; ')}</div>` : ''}
      <div class="ov-grid">
        ${prev.month ? card('Previous bill', prev) : ''}
        ${cur.month ? card('Latest bill', cur) : ''}
        <div class="ov-card next"><h3>Next month</h3><p class="ov-month">${esc(monthLabel(nx.month))}</p>
          <dl><div><dt>Rent expected</dt><dd>${inr0(nx.rent)}</dd></div><div><dt>Fixed maintenance</dt><dd>${inr0(nx.fixedMaintenance)}</dd></div>
          <div><dt>Fixed part per flat</dt><dd>${inr0(nx.fixedPerFlat)}</dd></div><div><dt>Renewals</dt><dd>${(nx.renewals || []).length ? nx.renewals.map((r) => esc(r.flat)).join(', ') : 'None'}</dd></div></dl>
          <p class="ov-note">Electricity, water and generator are added when the month's readings are entered.</p></div>
      </div>
      ${ownersPanel}
      <section class="panel"><h2>Billed and received, month by month</h2><p class="sub">Everything billed (rent + electricity + maintenance) and how much has come in.</p>${billedChart(h)}</section>
      <section class="panel"><h2>Electricity units by flat</h2><p class="sub">${esc(monthLabel(prev.month))} compared with ${esc(monthLabel(cur.month))}.</p>${unitsChart(prev, cur)}</section>`;
  }
  function billedChart(h) {
    if (!h.length) return '<p class="sub">No months yet.</p>';
    const W = 720, H = 230, pad = 46, top = 22, base = H - 28;
    const max = Math.max(...h.map((x) => x.total || 0), 1);
    const step = (W - pad - 8) / h.length, bw = Math.min(30, step / 3.2);
    const y = (v) => base - (v / max) * (base - top);
    const k = (v) => v >= 100000 ? (v / 100000).toFixed(1).replace(/\.0$/, '') + 'L' : v >= 1000 ? Math.round(v / 1000) + 'k' : String(Math.round(v));
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = max * i / 4; g += `<line x1="${pad}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad - 8}" y="${y(v) + 4}" text-anchor="end">${k(v)}</text>`; }
    h.forEach((x, i) => {
      const cx = pad + i * step + step / 2, bill = x.total || 0, got = (x.paidRent || 0) + (x.paidUtil || 0);
      g += `<rect class="b-prev" x="${cx - bw - 2}" y="${y(bill)}" width="${bw}" height="${base - y(bill)}" rx="3"><title>Billed ${inr0(bill)}</title></rect>`;
      g += `<rect class="b-rent" x="${cx + 2}" y="${y(got)}" width="${bw}" height="${base - y(got)}" rx="3"><title>Received ${inr0(got)}</title></rect>`;
      g += `<text class="val" x="${cx + 2 + bw / 2}" y="${y(got) - 5}" text-anchor="middle">${got ? k(got) : ''}</text>`;
      g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${monthShort(x.month)}</text>`;
    });
    return `<div class="legend"><span><i class="k-prev"></i>Billed</span><span><i class="k-rent"></i>Received</span></div>
      <svg class="chart wide" viewBox="0 0 ${W} ${H}" role="img" aria-label="Billed and received per month">${g}</svg>`;
  }
  function unitsChart(prev, cur) {
    if (!cur || !cur.units) return '<p class="sub">No readings yet.</p>';
    const flats = Object.keys(cur.units);
    const W = 720, H = 220, pad = 34, top = 14, base = H - 28;
    const max = Math.max(...flats.map((f) => Math.max(cur.units[f] || 0, (prev.units || {})[f] || 0)), 1);
    const step = (W - pad - 8) / flats.length, bw = Math.min(18, step / 3);
    const y = (v) => base - (v / max) * (base - top);
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = max * i / 4; g += `<line x1="${pad}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`; }
    flats.forEach((fl, i) => {
      const cx = pad + i * step + step / 2, a = (prev.units || {})[fl] || 0, b = cur.units[fl] || 0;
      g += `<rect class="b-prev" x="${cx - bw - 1}" y="${y(a)}" width="${bw}" height="${base - y(a)}" rx="2"><title>${fl} last month ${fmt1(a)}</title></rect>`;
      g += `<rect class="b-cur" x="${cx + 1}" y="${y(b)}" width="${bw}" height="${base - y(b)}" rx="2"><title>${fl} this month ${fmt1(b)}</title></rect>`;
      g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${fl}</text>`;
    });
    return `<div class="legend"><span><i class="k-prev"></i>${esc(monthLabel(prev.month))}</span><span><i class="k-cur"></i>${esc(monthLabel(cur.month))}</span></div>
      <svg class="chart wide" viewBox="0 0 ${W} ${H}" role="img" aria-label="Units per flat">${g}</svg>`;
  }

  // ---------- event requests (staff) ----------
  async function paneRequests() {
    pane().innerHTML = '<div class="loading">Loading…</div>';
    let list; const admin = who().role === 'Admin';
    try { list = await api.call('requests'); } catch (e) { if (!sessionEnded(e)) pane().innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    pendingCount = list.filter((x) => x.status === 'Pending').length;
    list.forEach((x) => { if (/^Agreement/.test(x.event) && x.status === 'Approved') x.status = 'Seen'; });
    const t = app.querySelector('[data-t=requests]'); if (t) t.textContent = `Requests${pendingCount ? ` (${pendingCount})` : ''}`;
    pane().innerHTML = `<div class="toolbar"><h1>Event requests</h1></div>
      ${list.length ? `<div class="list-cards">${list.map((x) => `
        <article class="tcard">
          <div class="top"><span class="flat">${esc(x.flat)}</span><span class="pill ${x.status === 'Approved' || x.status === 'Seen' ? 'ok' : x.status === 'Declined' ? 'no' : 'off'}">${esc(x.status)}</span></div>
          <div class="name">${esc(x.event)} · ${dateLabel(x.date)}${x.from ? `, ${esc(x.from)}–${esc(x.to)}` : ''}${x.timing ? ` <span class="pill ${/Night/.test(x.timing) ? 'no' : 'ok'}">${esc(x.timing)}</span>` : ''}</div>
          <div class="meta">${esc(x.tenant)} · asked on ${dateLabel(x.submittedOn)}</div>
          ${x.needs ? `<div class="meta">Needs: ${esc(x.needs)}</div>` : ''}
          ${x.charges ? `<div class="charge-line">Charges: ${esc(x.charges)}</div>` : ''}
          <p style="margin:6px 0 0;font-size:14px">${esc(x.details)}</p>
          ${x.reply ? `<p class="meta" style="margin:4px 0 0">Reply: ${esc(x.reply)}</p>` : ''}
          ${admin && (x.status === 'Approved' || x.status === 'Declined') && x.phone ? `<div><a class="btn ghost small" target="_blank" rel="noopener" href="${waLink(x.phone, `Hello ${x.tenant}, your request for ${x.event} on ${dateLabel(x.date)}${x.from ? ` (${x.from}\u2013${x.to})` : ''} is ${x.status.toLowerCase()}.${x.charges && x.status === 'Approved' ? ' Charges: ' + x.charges + '.' : ''}${x.reply ? ' ' + x.reply : ''} \u2014 Asdaq Vista`)}">Tell on WhatsApp</a></div>` : ''}
          ${admin && x.status === 'Pending' ? (/^Agreement/.test(x.event) ? `<div><button class="btn small" data-ok="${esc(x.id)}">Mark as seen</button></div>` : `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" data-ok="${esc(x.id)}">Approve</button><button class="btn ghost small" data-no="${esc(x.id)}">Decline</button></div>`) : ''}
        </article>`).join('')}</div>` : '<div class="empty">No requests yet. Tenants ask for event permission, and answer the agreement question, from their own page.</div>'}`;
    const decide = (id, status) => {
      const x = list.find((y) => y.id === id) || {}; const needs = x.needs || '';
      const terrace = status === 'Approved' && needs.includes('Use of the terrace'), lights = status === 'Approved' && needs.includes('Outside / terrace lighting');
      const tc = (siteSettings && Number(siteSettings.terraceCharge)) || 500;
      openSheet(`<h2 id="sheet-title">${status === 'Approved' ? 'Approve' : 'Decline'} request</h2>
        <p class="sub">The tenant sees your answer${terrace || lights ? ' and the charges' : ''} on their page.</p>
        ${terrace ? fld('terraceCharge', 'Terrace cleaning charge (\u20b9)', String(tc), { type: 'number', mode: 'numeric' }) : ''}
        ${lights ? fld('lightingCharge', 'Lighting charge (\u20b9, common meter)', '', { type: 'number', mode: 'numeric', ph: 'e.g. 300' }) : ''}
        ${fld('reply', 'Message to the tenant (optional)', '', { ph: status === 'Approved' ? 'e.g. Approved. Please finish by 10 pm.' : 'e.g. Not possible on this date.' })}`,
      async (f) => {
        if (lights && f.lightingCharge.value === '') throw new Error('Type the lighting charge (it can be 0).');
        await api.call('decideRequest', { id, status, reply: f.reply.value, terraceCharge: terrace ? f.terraceCharge.value : '', lightingCharge: lights ? f.lightingCharge.value : '' });
        await paneRequests(); return status === 'Approved' ? 'Approved. Tap \u201cTell on WhatsApp\u201d to let the tenant know now.' : 'Declined. Tap \u201cTell on WhatsApp\u201d to let the tenant know now.';
      });
    };
    pane().querySelectorAll('[data-ok]').forEach((b) => { b.onclick = () => decide(b.dataset.ok, 'Approved'); });
    pane().querySelectorAll('[data-no]').forEach((b) => { b.onclick = () => decide(b.dataset.no, 'Declined'); });
  }

  // ---------- Arshad's account: what he collected, what he paid, his fee, and who owes whom ----------
  let arshadMonth = null;
  async function paneArshad() {
    pane().innerHTML = '<div class="loading">Loading Arshad’s account…</div>';
    let d;
    try { d = await api.call('arshadAccount', { month: arshadMonth }); } catch (e) { if (!sessionEnded(e)) pane().innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    arshadMonth = d.month; const t = d.summary;
    const KINDS = [['Expense', 'Bill or salary'], ['Electricity bill', 'BESCOM electricity bill'], ['Fee', 'Arshad’s fee'], ['Owner gave Arshad', 'You gave Arshad money'], ['Arshad returned', 'Arshad gave money back']];
    const sg = (v) => (v < -0.5 ? '\u2212' : '') + inr0(Math.abs(v));
    const owe = (v) => v < -0.5 ? `<span class="neg">You owe Arshad ${inr0(-v)}</span>` : v > 0.5 ? `Arshad holds ${inr0(v)} of yours` : 'All settled';
    const gap = t.elecBill - t.inc.elecCharged;
    const lineRow = (x) => `<div class="ac-line" data-id="${esc(x.id || '')}">
        <input class="cin" name="item" value="${esc(x.item || '')}" placeholder="What was paid" aria-label="Item">
        <input class="cin num" name="amount" type="number" step="0.01" inputmode="decimal" value="${esc(x.amount == null ? '' : x.amount)}" placeholder="₹" aria-label="Amount">
        <select class="cin" name="kind" aria-label="Kind">${KINDS.map(([k, l]) => `<option value="${k}" ${x.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="cin" name="paidBy" aria-label="Paid by" ${x.kind === 'Fee' || /gave|returned/.test(x.kind || '') ? 'hidden' : ''}><option value="Arshad" ${x.paidBy !== 'Owner' ? 'selected' : ''}>Paid by Arshad</option><option value="Owner" ${x.paidBy === 'Owner' ? 'selected' : ''}>Paid by you</option></select>
        <span class="ac-paid">${x.paidOn ? `<span class="st paid">Paid ${esc(dateLabel(x.paidOn))}</span> <button type="button" class="linkbtn" data-unpay>Undo</button>` : (x.kind === 'Fee' ? '' : '<button type="button" class="paybtn" data-pay>Paid today</button>')}<input type="hidden" name="paidOn" value="${esc(x.paidOn || '')}"></span>
        <button type="button" class="linkbtn" data-del aria-label="Remove line">Remove</button>
      </div>`;
    pane().innerHTML = `
      <div class="toolbar"><h1>Arshad’s account</h1>
        <select class="month-select" id="amsel" aria-label="Choose month">${d.months.map((k) => `<option value="${k}" ${k === d.month ? 'selected' : ''}>${esc(monthLabel(k))}</option>`).join('')}</select></div>
      <p style="color:var(--stone);font-size:14px;max-width:75ch;margin-top:-6px">Arshad collects electricity + maintenance from the tenants, pays the building’s bills and salaries, and keeps his fee of ${inr0(d.fee)} a month. What is left over is yours; if he paid more than he collected, you owe him the difference.</p>
      <div class="ov-grid">
        <div class="ov-card"><h3>Collected from tenants</h3><p class="ov-month">${esc(monthLabel(d.month))}</p><dl>
          <div><dt>Received</dt><dd>${inr0(t.inc.received)}</dd></div><div><dt>Billed</dt><dd>${inr0(t.inc.billed)}</dd></div>
          <div><dt>Not yet received</dt><dd class="${t.inc.billed - t.inc.received > 0.5 ? 'neg' : ''}">${inr0(Math.max(0, t.inc.billed - t.inc.received))}</dd></div></dl></div>
        <div class="ov-card"><h3>Paid out by Arshad</h3><p class="ov-month">Bills, salaries and his fee</p><dl>
          <div><dt>Bills and salaries</dt><dd>${inr0(t.out)}</dd></div><div><dt>His fee</dt><dd>${inr0(t.fee)}</dd></div>
          <div><dt>Still to pay</dt><dd class="${t.unpaid > 0.5 ? 'neg' : ''}">${inr0(t.unpaid)}</dd></div>${t.ownerPaid ? `<div><dt>Paid by you directly</dt><dd>${inr0(t.ownerPaid)}</dd></div>` : ''}</dl></div>
        <div class="ov-card next"><h3>Balance</h3><p class="ov-month">This month ${t.net >= 0 ? '+' : '−'}${inr0(Math.abs(t.net))}</p><dl>
          <div><dt>Brought forward</dt><dd>${sg(t.before)}</dd></div>${t.gave ? `<div><dt>You gave Arshad</dt><dd>${inr0(t.gave)}</dd></div>` : ''}${t.returned ? `<div><dt>Arshad gave back</dt><dd>${inr0(t.returned)}</dd></div>` : ''}
          <div><dt>Now</dt><dd class="${t.running < -0.5 ? 'neg' : ''}">${sg(t.running)}</dd></div></dl><p class="ac-verdict">${owe(t.running)}</p></div>
      </div>
      ${t.elecBill ? `<section class="panel"><h2>Electricity: commercial bill vs what tenants pay</h2>
        <p class="sub">The main meter is billed at commercial rates; tenants are charged domestic rates, as they would be with their own BESCOM meters.</p>
        <div class="gap-bars">${[['BESCOM bill (commercial)', t.elecBill], ['Charged to tenants (domestic)', t.inc.elecCharged]].map(([l, v]) => `<div class="gap-row"><span>${l}</span><div class="gap-track"><i style="width:${Math.max(2, Math.min(100, v / Math.max(t.elecBill, t.inc.elecCharged, 1) * 100))}%"></i></div><b>${inr0(v)}</b></div>`).join('')}</div>
        <p class="ac-verdict" style="margin-top:10px">${gap > 0.5 ? `Difference covered by you: <b>${inr0(gap)}</b>` : 'Tenants’ electricity covers the bill this month.'}</p></section>` : ''}
      <form id="acf" class="panel" novalidate>
        <h2>Payments this month</h2>
        <p class="sub">Each bill and salary, who paid it, and when. Type the BESCOM and water bills when they arrive. Only payments marked “Paid by Arshad” count against what he collected.</p>
        ${t.hasLines ? '' : `<div class="notice info" style="margin:0 0 14px">No list for this month yet. <button type="button" class="btn small" id="acFill">Create this month’s list</button> <span class="sub">(maintenance items, the BESCOM bill and his fee)</span></div>`}
        <div class="ac-lines" id="acLines">${d.lines.map(lineRow).join('')}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 0">
          <button type="button" class="btn ghost small" id="acAdd">Add a payment</button>
          <button type="button" class="btn ghost small" id="acGive">Record money you gave Arshad</button>
          <button type="button" class="btn ghost small" id="acBack">Record money Arshad gave back</button>
        </div>
        <div class="sticky-save"><button class="btn" type="submit">Save</button></div>
      </form>`;
    document.getElementById('amsel').onchange = (e) => { arshadMonth = e.target.value; paneArshad(); };
    const box = document.getElementById('acLines'); const deleted = [];
    const add = (x) => { const tmp = document.createElement('div'); tmp.innerHTML = lineRow(x); box.appendChild(tmp.firstElementChild); box.lastElementChild.querySelector('[name=item]').focus(); };
    document.getElementById('acAdd').onclick = () => add({ kind: 'Expense', paidBy: 'Arshad' });
    document.getElementById('acGive').onclick = () => add({ kind: 'Owner gave Arshad', item: 'Money given to Arshad', paidOn: todayIso() });
    document.getElementById('acBack').onclick = () => add({ kind: 'Arshad returned', item: 'Money Arshad gave back', paidOn: todayIso() });
    box.addEventListener('change', (e) => { if (e.target.name === 'kind') { const r = e.target.closest('.ac-line'); r.querySelector('[name=paidBy]').hidden = /Fee|gave|returned/.test(e.target.value); } });
    box.addEventListener('click', (e) => {
      const r = e.target.closest('.ac-line'); if (!r) return;
      if (e.target.matches('[data-del]')) { if (r.dataset.id) deleted.push(r.dataset.id); r.remove(); }
      const setPaid = (iso) => { r.querySelector('.ac-paid').innerHTML = (iso ? `<span class="st paid">Paid ${esc(dateLabel(iso))}</span> <button type="button" class="linkbtn" data-unpay>Undo</button>` : '<button type="button" class="paybtn" data-pay>Paid today</button>') + `<input type="hidden" name="paidOn" value="${esc(iso)}">`; };
      if (e.target.matches('[data-pay]')) setPaid(todayIso());
      if (e.target.matches('[data-unpay]')) setPaid('');
    });
    const fillBtn = document.getElementById('acFill');
    if (fillBtn) fillBtn.onclick = async () => { busy(fillBtn, true, 'Creating…'); try { await api.call('arshadFill', { month: d.month }); paneArshad(); } catch (err) { if (!sessionEnded(err)) toast(err.message); busy(fillBtn, false, 'Creating…'); } };
    const f = document.getElementById('acf');
    f.onsubmit = async (e) => {
      e.preventDefault(); formError(f);
      const lines = Array.from(box.querySelectorAll('.ac-line')).map((r) => ({ id: r.dataset.id, item: r.querySelector('[name=item]').value, amount: r.querySelector('[name=amount]').value,
        kind: r.querySelector('[name=kind]').value, paidBy: r.querySelector('[name=paidBy]').value, paidOn: r.querySelector('[name=paidOn]').value }));
      if (lines.some((l) => l.item.trim() && l.paidOn && l.amount === '')) return formError(f, 'Type the amount for every line marked as paid.');
      const btn = f.querySelector('button[type=submit]'); busy(btn, true, 'Saving…');
      try { await api.call('arshadSave', { month: d.month, lines, deleted }); toast('Saved.'); paneArshad(); }
      catch (err) { if (!sessionEnded(err)) formError(f, err.message); busy(btn, false, 'Saving…'); }
    };
  }

  // ---------- settings: tariff, private/BESCOM meters, dues, contacts, data kept (owner only) ----------
  async function paneSettings() {
    pane().innerHTML = '<div class="loading">Loading…</div>';
    let cfg;
    try { cfg = await api.call('adminSettings'); } catch (e) { if (!sessionEnded(e)) pane().innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const v = cfg.values || {}; const flats = cfg.flats || [];
    const gov = v.electricity_mode === 'BESCOM meters';
    const num = (k, label, o = {}) => fld(k, label, v[k], Object.assign({ type: 'number', step: o.step || 'any', mode: 'decimal' }, o));
    pane().innerHTML = `
      <div class="toolbar"><h1>Settings</h1></div>
      <form id="sf" novalidate style="max-width:900px">
        <section class="panel">
          <h2>Electricity meters</h2>
          <p class="sub">Choose how electricity is billed. The change applies to the next month you add; months already added stay as they are.</p>
          <div class="mode-pick">
            <label class="mode-card"><input type="radio" name="electricity_mode" value="Private meters" ${gov ? '' : 'checked'}><span><b>Private meters (now)</b><small>The 10 flat meters and the main meter are read each month; common units = main − flats. Electricity is billed here, paid to Arshad with maintenance.</small></span></label>
            <label class="mode-card"><input type="radio" name="electricity_mode" value="BESCOM meters" ${gov ? 'checked' : ''}><span><b>BESCOM meters</b><small>Each flat has its own BESCOM meter and pays BESCOM directly. No readings here; each bill shows the flat’s BESCOM account ID and meter number.</small></span></label>
          </div>
          <div class="notice renew" id="modeWarn" ${gov ? '' : 'hidden'} style="margin:12px 0 0">Fill in every flat’s BESCOM account ID and meter number below, so tenants know what to pay.</div>
        </section>
        <section class="panel">
          <h2>Electricity tariff</h2>
          <p class="sub">Used for private meters. New rates apply to the next month you add.</p>
          <div class="grid-2">${num('fixed_charge', 'Fixed charge (₹ per flat, per month)')}${num('energy_rate', 'Energy (₹ per unit)')}${num('fppca_rate', 'Fuel adjustment FPPCA (₹ per unit)')}${num('pg_surcharge_rate', 'P&amp;G surcharge (₹ per unit)')}${num('tax_percent', 'Tax (% on the electricity subtotal)')}</div>
        </section>
        <section class="panel">
          <h2>BESCOM details for each flat</h2>
          <p class="sub">Shown on a tenant’s bill only when BESCOM meters are on. Each flat’s BESCOM bill shows its account ID and RR / meter number.</p>
          <div class="bz-grid"><div class="bz-head"><span>Flat</span><span>BESCOM account ID</span><span>RR / meter number</span></div>
            ${flats.map((x) => `<div class="bz-row" data-flat="${esc(x.flat)}"><b>${esc(x.flat)}</b><input class="cin" name="acc" value="${esc(x.account)}" inputmode="numeric" autocomplete="off" placeholder="Account ID" aria-label="${esc(x.flat)} BESCOM account ID"><input class="cin" name="met" value="${esc(x.meter)}" autocomplete="off" placeholder="RR / meter no." aria-label="${esc(x.flat)} RR or meter number"></div>`).join('')}</div>
          ${num('bescom_pay_link', 'BESCOM website link (shown on bills)', { type: 'url', mode: 'url' })}
        </section>
        <section class="panel">
          <h2>Due dates and grace</h2>
          <div class="grid-2">${num('utilities_due_day', 'Electricity + maintenance due on day (of next month)', { step: '1' })}${num('utilities_grace_days', 'Days before electricity + maintenance is overdue', { step: '1' })}${num('rent_grace_days', 'Days before rent is overdue', { step: '1' })}${num('renewal_increase_percent', 'Standard rent increase at renewal (%)')}</div>
          <p class="sub" style="margin:0">Grace days are never shown to tenants.</p>
        </section>
        <section class="panel">
          <h2>Maintenance and events</h2>
          <div class="grid-2">${fld('maintenance_round_to_rupee', 'Round maintenance per flat to the rupee', v.maintenance_round_to_rupee || 'Yes', { select: ['Yes', 'No'] })}${num('terrace_cleaning_charge', 'Terrace cleaning charge (₹)', { step: '1' })}</div>
        </section>
        <section class="panel">
          <h2>Contact and alerts</h2>
          <div class="grid-2">${fld('whatsapp_contact', 'Owner’s WhatsApp (Contact page, bills)', v.whatsapp_contact, { mode: 'tel' })}${fld('contact_email', 'Contact email (Contact page)', v.contact_email, { type: 'email', mode: 'email' })}${fld('admin_email', 'Email for alerts (requests, security, daily summary)', v.admin_email, { type: 'email', mode: 'email' })}</div>
        </section>
        <section class="panel">
          <h2>Arshad</h2>
          <div class="grid-2">${num('arshad_monthly_fee', 'Arshad\u2019s fee per month (\u20b9)', { step: '1', hint: 'Used for months whose list is created after a change.' })}${num('arshad_opening_balance', 'Opening balance with Arshad (\u20b9)', { hint: 'What he held of your money when his account started. Minus if you owed him.' })}</div>
        </section>
        <section class="panel">
          <h2>Data kept</h2>
          <div class="grid-2">${num('keep_months', 'Months of data kept in the sheet', { step: '1', hint: '24 = two agreement cycles. Older months, finished requests and tenants who left before that are removed automatically once a month.' })}</div>
          <p class="sub" style="margin:0">A backup copy of the sheet is also saved every week; the 8 newest copies are kept and older ones are deleted.</p>
        </section>
        <div class="sticky-save"><button class="btn" type="submit">Save settings</button></div>
      </form>`;
    const f = document.getElementById('sf');
    f.addEventListener('change', (e) => { if (e.target.name === 'electricity_mode') document.getElementById('modeWarn').hidden = e.target.value !== 'BESCOM meters'; });
    f.onsubmit = async (e) => {
      e.preventDefault(); formError(f);
      const keys = ['fixed_charge', 'energy_rate', 'fppca_rate', 'pg_surcharge_rate', 'tax_percent', 'utilities_due_day', 'utilities_grace_days', 'rent_grace_days', 'renewal_increase_percent', 'maintenance_round_to_rupee', 'terrace_cleaning_charge', 'whatsapp_contact', 'contact_email', 'admin_email', 'keep_months', 'bescom_pay_link', 'arshad_monthly_fee', 'arshad_opening_balance'];
      const values = { electricity_mode: f.querySelector('input[name=electricity_mode]:checked').value };
      keys.forEach((k) => { if (f.elements[k]) values[k] = f.elements[k].value; });
      const fl = Array.from(f.querySelectorAll('.bz-row[data-flat]')).map((tr) => ({ flat: tr.dataset.flat, account: tr.querySelector('[name=acc]').value.trim(), meter: tr.querySelector('[name=met]').value.trim() }));
      if (values.electricity_mode === 'BESCOM meters' && fl.some((x) => x.flat !== 'Common' && !x.account)) {
        if (!window.confirm('Some flats have no BESCOM account ID yet. Switch to BESCOM meters anyway?')) return;
      }
      const btn = f.querySelector('button[type=submit]'); busy(btn, true, 'Saving…');
      try {
        await api.call('saveSettings', { values }); await api.call('saveFlats', { flats: fl });
        siteSettings = null; try { siteSettings = await api.call('settings'); } catch (x) { /* ignore */ }
        toast('Settings saved.'); paneSettings();
      } catch (err) { if (!sessionEnded(err)) formError(f, err.message); busy(btn, false, 'Saving…'); }
    };
  }

  // ---------- maintenance costs (central list) ----------
  async function paneCosts() {
    pane().innerHTML = '<div class="loading">Loading…</div>';
    let list; const admin = who().role === 'Admin';
    try { list = await api.call('costs'); } catch (e) { if (!sessionEnded(e)) pane().innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    const fixed = list.filter((c) => c.type === 'Fixed').reduce((a, c) => a + (Number(c.amount) || 0), 0);
    const row = (c, i) => `<tr data-i="${i}">
      <td>${admin ? `<input class="cin" name="n" value="${esc(c.name)}" ${c.type === 'Auto' ? 'readonly' : ''}>` : esc(c.name)}</td>
      <td>${admin && c.type !== 'Auto' ? `<select class="cin" name="t"><option ${c.type === 'Fixed' ? 'selected' : ''}>Fixed</option><option ${c.type === 'Varies' ? 'selected' : ''}>Varies</option></select>` : esc(c.type === 'Auto' ? 'Automatic' : c.type)}</td>
      <td class="r">${c.type === 'Auto' ? 'Main meter − flats' : admin ? `<input class="cin num" name="a" type="number" step="1" inputmode="numeric" value="${esc(c.amount)}">` : inr0(c.amount)}</td>
      ${admin ? `<td>${c.type === 'Auto' ? '' : '<button type="button" class="linkbtn" data-del>Remove</button>'}</td>` : ''}</tr>`;
    pane().innerHTML = `<div class="toolbar"><h1>Maintenance costs</h1></div>
      <p style="color:var(--stone);font-size:14px;max-width:72ch;margin-top:-6px">The standing list used for every new month. <b>Fixed</b> costs (salaries, lift, CCTV…) are the same each month — change them here when they change. <b>Varies</b> are typed when adding a month (the amount here is a suggestion). Common electricity is worked out from the common units (main meter − all flats). Each flat pays an equal share (÷ 10).</p>
      <form id="cf" class="panel" novalidate style="max-width:820px">
        <div class="tablewrap" style="border:0"><table class="data costs" style="min-width:0"><thead><tr><th class="l">Item</th><th class="l">Type</th><th>Amount per month</th>${admin ? '<th></th>' : ''}</tr></thead>
          <tbody>${list.map(row).join('')}</tbody>
          <tfoot><tr><td colspan="2">Fixed costs per month</td><td class="r">${inr0(fixed)} <small style="font-weight:400;color:var(--stone)">(${inr0(Math.round(fixed / 10))} per flat)</small></td>${admin ? '<td></td>' : ''}</tr></tfoot></table></div>
        ${admin ? '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><button type="button" class="btn ghost small" id="addC">Add an item</button><button class="btn small" type="submit">Save costs</button></div>' : ''}
      </form>`;
    if (!admin) return;
    const tb = pane().querySelector('tbody');
    tb.addEventListener('click', (e) => { if (e.target.matches('[data-del]')) e.target.closest('tr').remove(); });
    document.getElementById('addC').onclick = () => { const tmp = document.createElement('tbody'); tmp.innerHTML = row({ name: '', type: 'Fixed', amount: '' }, 'new'); tb.appendChild(tmp.firstElementChild); tb.lastElementChild.querySelector('input').focus(); };
    document.getElementById('cf').onsubmit = async (e) => {
      e.preventDefault();
      const costs = Array.from(tb.querySelectorAll('tr')).map((tr) => {
        const auto = !tr.querySelector('[name=t]') && !tr.querySelector('[name=a]');
        return { name: tr.querySelector('[name=n]').value.trim(), type: auto ? 'Auto' : tr.querySelector('[name=t]').value, amount: auto ? '' : tr.querySelector('[name=a]').value };
      }).filter((c) => c.name);
      try { await api.call('saveCosts', { costs }); toast('Maintenance costs saved. New months will use them.'); paneCosts(); }
      catch (err) { if (!sessionEnded(err)) toast(err.message); }
    };
  }

  function confirmLow(f, low) {
    if (f.dataset.lowOk === low.join()) return true;
    f.dataset.lowOk = low.join();
    formError(f, `${low.join(', ')}: the new reading is lower than last month. Check the photo — press the button again if it is correct.`);
    return false;
  }

  async function panePeople() {
    pane().innerHTML = '<div class="loading">Loading…</div>';
    let list;
    try { list = await api.call('people'); } catch (e) { if (!sessionEnded(e)) pane().innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    pane().innerHTML = `
      <div class="toolbar"><h1>People</h1></div>
      <p style="color:var(--stone);font-size:14px;max-width:70ch">Only you (the owner) log in. The other owners receive rent but have no login — choose who receives each flat's rent in Tenants → Edit. Forgot your password? Message the developer for a setup code.</p>
      <div class="list-cards">${list.map((p) => `
        <article class="tcard">
          <div class="top"><span class="name">${esc(p.name)}</span>${p.role === 'Admin' ? (() => { const ready = p.dobSet && !/^\+?91 ?0{10}$/.test(p.phone) && p.passwordSet; return `<span class="pill ${ready ? 'ok' : 'off'}">${ready ? 'Logs in' : 'Login not complete'}</span>`; })() : `<span class="pill">${p.role === 'Owner' ? 'Receives rent' : 'Collects electricity + maintenance'}</span>`}</div>
          <div class="meta">${esc(p.role)} · ${esc(p.phone)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn ghost small" data-edit="${esc(p.id)}">Edit</button>

          </div>
        </article>`).join('')}</div>`;
    pane().querySelectorAll('[data-edit]').forEach((b) => {
      const p = list.find((x) => x.id === b.dataset.edit);
      b.onclick = () => {
        const init = { name: p.name, phone: p.phone, dob: '' };
        openSheet(`<h2 id="sheet-title">${esc(p.name)}</h2><p class="sub">${esc(p.role)}</p>${fld('name', 'Name', p.name)}${fld('phone', 'Phone', p.phone, { type: 'tel', mode: 'tel' })}${p.role !== 'Admin' ? '' : fld('dob', 'New date of birth (login)', '', { mode: 'numeric', ph: p.dobSet ? 'Leave empty to keep' : 'DDMMYYYY', hint: '8 digits, e.g. 01101985' })}`,
          async (f) => { const ch = changed(f, init); if (!Object.keys(ch).length) return 'Nothing changed.'; await api.call('updatePerson', { personId: p.id, changes: ch }); ownersCache = null; panePeople(); return 'Saved.'; });
      };
    });
    pane().querySelectorAll('[data-code]').forEach((b) => {
      b.onclick = async () => {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((x) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
        try {
          await api.call('updatePerson', { personId: b.dataset.code, changes: { setupCode: code } });
          sheet.innerHTML = `<div class="sheet-inner"><h2 id="sheet-title">Setup code</h2><p class="sub">Use it on 'Set a new admin password'. It works once.</p>
            <p style="font-family:var(--display);font-size:30px;letter-spacing:.12em;margin:8px 0 20px">${code}</p>
            <div class="sheet-actions"><button class="btn" id="okc">Done</button></div></div>`;
          sheet.showModal(); document.getElementById('okc').onclick = () => { sheet.close(); panePeople(); };
        } catch (e) { if (!sessionEnded(e)) toast(e.message); }
      };
    });
  }

  // ---------- install as an app (Android / desktop: browser prompt; iPhone & iPad: Share → Add to Home Screen) ----------
  let installEvt = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; renderNav(); });
  window.addEventListener('appinstalled', () => { installEvt = null; renderNav(); toast('Installed. Open Asdaq Vista from your home screen.'); });
  async function installApp() {
    if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice; installEvt = null; renderNav(); if (r.outcome === 'accepted') toast('Installing…'); return; }
    const steps = isIOS()
      ? '<ol class="steps" style="grid-template-columns:1fr"><li><strong>Tap the Share button</strong><span>The square with an arrow, at the bottom (iPhone) or top (iPad) of Safari.</span></li><li><strong>Choose “Add to Home Screen”</strong><span>Scroll down the list if you don’t see it.</span></li><li><strong>Tap “Add”</strong><span>Asdaq Vista now opens like an app from your home screen.</span></li></ol>'
      : '<ol class="steps" style="grid-template-columns:1fr"><li><strong>Open the browser menu</strong><span>The ⋮ or ⋯ button at the top right (Chrome, Edge).</span></li><li><strong>Choose “Install app” or “Add to Home screen”</strong><span>On some phones it is under “Cast, save and share”.</span></li><li><strong>Confirm</strong><span>Asdaq Vista now opens like an app.</span></li></ol>';
    sheet.innerHTML = `<div class="sheet-inner"><h2 id="sheet-title">Install Asdaq Vista as an app</h2><p class="sub">It opens straight to your bills, without searching in the browser.</p>${steps}<div class="sheet-actions"><button class="btn" id="instOk">Done</button></div></div>`;
    sheet.showModal(); document.getElementById('instOk').onclick = () => sheet.close();
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-install]'); if (b) { e.preventDefault(); closeMenu(); installApp(); } });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

  // ---------- automatic log-out after 30 minutes without use (owner) or 60 minutes (tenants) ----------
  let lastUse = Date.now();
  ['click', 'keydown', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, () => { lastUse = Date.now(); }, { passive: true }));
  setInterval(async () => {
    const w = who(); if (!w) return;
    const limit = (w.kind === 'staff' ? 30 : 60) * 60 * 1000;
    if (Date.now() - lastUse > limit) {
      try { await api.call('logout'); } catch (e) { /* ignore */ }
      setWho(null); if (sheet.open) sheet.close(); location.hash = '#home'; toast('Logged out after a while without use, to keep your details safe.');
    }
  }, 60 * 1000);

  // ---------- start ----------
  if (api.demo) document.getElementById('demo-note').hidden = false;
  if (!api.token) store.set('av_who', null);
  document.getElementById('year').textContent = new Date().getFullYear();
  renderNav();
  route();
  api.call('settings').then((st) => {
    siteSettings = st || {};
    renderNav();
    document.getElementById('footer-help').innerHTML = '<a href="#contact">Contact the owner</a>';
    if (st && st.mapLink) document.getElementById('footer-map').innerHTML = `<a href="${esc(st.mapLink)}" target="_blank" rel="noopener">Find us on Google Maps</a>`;
  }).catch(() => {});
})();
