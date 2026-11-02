/* Demo backend — used only while AV_CONFIG.API_URL is empty.
 * Fictional tenants and readings so the design can be reviewed safely.
 * It answers the same actions as apps-script/Code.gs. */
(function () {
  const RATES = { fixed: 360, energy: 6.82, fppca: 0.47, pg: 0.36, tax: 9 };
  const FLATS = ['N1', 'N2', 'N3', 'N4', 'N5', 'S1', 'S2', 'S3', 'S4', 'S5'];
  const OWNERS = { N1: 'Owner A', N2: 'Owner A', N3: 'Owner A', N4: 'Owner A', S1: 'Owner B', S2: 'Owner B', S3: 'Owner B', S4: 'Owner B', S5: 'Owner C', N5: 'Owner C' };
  const NAMES = ['Ravi Menon', 'Anita Rao', 'Farooq Ali', 'Deepa Nair', 'Joseph Mathew', 'Kiran Shetty', 'Sameer Khan', 'Lakshmi Iyer', 'Priya Das', 'Arun Pillai'];

  const settings = { property: 'Asdaq Vista', tagline: 'Living Redefined', company: 'Asdaq Construction',
    address: 'Hulimavu, Bengaluru, Karnataka 560076', mapLink: '', whatsapp: '+91 7349091146', ownerHelp: '+91 9902700475', email: 'sasdaq@gmail.com', contactName: 'Basheeruddin Asdaq Syed Mohammed', terraceCharge: 500, dueDay: 5, electricityMode: 'Private meters', bescomPayLink: 'https://bescom.karnataka.gov.in' };
  // owner-editable settings (Settings tab on the website)
  const cfg = { electricity_mode: 'Private meters', fixed_charge: 360, energy_rate: 6.82, fppca_rate: 0.47, pg_surcharge_rate: 0.36, tax_percent: 9,
    utilities_due_day: 1, utilities_grace_days: 3, rent_grace_days: 2, renewal_increase_percent: 5, maintenance_round_to_rupee: 'Yes',
    terrace_cleaning_charge: 500, keep_months: 24, arshad_monthly_fee: 35000, arshad_opening_balance: 0, whatsapp_contact: '+91 7349091146', contact_email: 'sasdaq@gmail.com', admin_email: 'sasdaq+asdaq_vista@gmail.com', bescom_pay_link: 'https://bescom.karnataka.gov.in' };
  const flatsInfo = ['N1', 'N2', 'N3', 'N4', 'N5', 'S1', 'S2', 'S3', 'S4', 'S5', 'Common'].map((f) => ({ flat: f, account: '', meter: '' }));
  const people = [
    { id: 'ADM-01', name: 'Demo Admin', role: 'Admin', phone: '+91 9000000000', dob: '01011960', password: 'asdaq-demo-password', setup: '' },
    { id: 'OWN-01', name: 'Owner A', role: 'Owner', phone: '+91 9000000001', dob: '02021970', password: '', setup: '' },
    { id: 'OWN-02', name: 'Owner B', role: 'Owner', phone: '+91 9000000002', dob: '03031970', password: '', setup: '' },
    { id: 'OWN-03', name: 'Owner C', role: 'Owner', phone: '+91 9000000003', dob: '04041990', password: '', setup: '' },
    { id: 'COL-01', name: 'Arshad', role: 'Collector', phone: '+91 9000000004', dob: '', password: '', setup: '' },
  ];
  const tenants = FLATS.map((f, i) => {
    const rent = i % 3 === 0 ? 36000 : 35000;
    const renewal = ['2026-12-01', '2026-10-01', '2027-02-01', '2026-11-20', '2027-01-01', '2026-11-01', '2027-07-08', '2027-03-01', '2027-03-01', '2027-04-01'][i];
    const start = (function (iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 12, d)).toISOString().slice(0, 10); })(renewal);
    return { id: 'T-' + f + '-01', flat: f, name: NAMES[i], phone: '+91 98765000' + String(i).padStart(2, '0'), secret: '0101198' + i,
      owner: OWNERS[f], status: 'Active', rent, afterRenewal: Math.round(rent * 1.05), start, renewal, deposit: 250000,
      movedIn: f === 'S2' ? '2026-08-08' : '' };
  });

  // fictional readings: start values and monthly usage per flat
  const monthsSpec = [
    { month: '2026-08', takenOn: '31/08/2026 10:00 PM', maintenance: 2900, mainMeter: 37340.8 },
    { month: '2026-09', takenOn: '30/09/2026 10:00 PM', maintenance: 3650, mainMeter: 41546.1 },
    { month: '2026-10', takenOn: '31/10/2026 10:00 PM', maintenance: 3420, mainMeter: 45708.7 },
  ];
  const usage = [[248, 214, 206], [221, 219, 231], [198, 185, 209], [183, 189, 172], [190, 186, 171], [272, 244, 249], [52, 128, 135], [331, 340, 302], [350, 371, 398], [226, 359, 364]];
  const startRead = [690, 620, 490, 530, 720, 730, 585.8, 900, 850, 665];
  const months = monthsSpec.map((m, mi) => {
    const d = new Date(m.month + '-01T00:00:00'); const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const rows = FLATS.map((f, i) => {
      const prev = +(startRead[i] + usage[i].slice(0, mi).reduce((a, b) => a + b, 0)).toFixed(1);
      const cur = +(prev + usage[i][mi]).toFixed(1);
      const billedDays = f === 'S2' && mi === 0 ? 24 : days;
      // sample payments: September all paid; October rent paid by most, one part payment, one overpayment
      const pay = mi === 1 ? { utilPaid: '2026-10-02', rentPaid: '2026-09-02' } : mi === 2 ? (i === 3 ? { rentPaid: '2026-10-03', rentAmt: 30000, utilPaid: '2026-11-02' } : i === 7 ? { rentPaid: '2026-10-01', rentAmt: 36000 } : i < 6 ? { rentPaid: '2026-10-02', utilPaid: '2026-11-02' } : {}) : {};
      return Object.assign({ sheetRow: 15 + i, flat: f, tenantId: 'T-' + f + '-01', prev, cur, days: billedDays, overrides: { fixed: '', maintenance: '', rent: f === 'S2' && mi === 0 ? 0 : '' }, billed: true, note: '' }, pay);
    });
    // the 'Common' row holds the MAIN meter (whole building); common units = main units − all flats' units
    rows.push({ sheetRow: 25, flat: 'Common', tenantId: '—', prev: [33508.8, 37340.8, 41546.1][mi], cur: m.mainMeter, unitsFixed: [1079, 1750.3, 1709.4][mi], days, overrides: { fixed: '', maintenance: '', rent: '' }, billed: false, note: '' });
    return { month: m.month, start: m.month + '-01', days, takenOn: m.takenOn, maintenance: m.maintenance, mainMeter: m.mainMeter, published: true, rows, rates: Object.assign({}, RATES) };
  });

  const round = (v, n) => Math.round(v * Math.pow(10, n)) / Math.pow(10, n);
  function rentFor(t, m, days) {
    const start = new Date(m.start + 'T00:00:00'), end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const r = new Date(t.renewal + 'T00:00:00');
    let monthly;
    if (r <= start) monthly = t.afterRenewal;
    else if (r > end) monthly = t.rent;
    else monthly = t.rent * (r.getDate() - 1) / m.days + t.afterRenewal * ((end - r) / 864e5 + 1) / m.days;
    return Math.round(monthly * days / m.days);
  }
  function compute(m, r) {
    const t = tenants.find((x) => x.id === r.tenantId);
    const RT = m.rates || RATES;
    const units = r.unitsFixed != null ? r.unitsFixed : (r.cur === '' || r.prev === '' || r.cur == null || r.prev == null ? 0 : round(r.cur - r.prev, 1));
    const fixedAuto = round(RT.fixed * r.days / m.days, 2);
    const fixed = r.overrides.fixed === '' ? fixedAuto : Number(r.overrides.fixed);
    const energy = units * RT.energy, fppca = units * RT.fppca, pg = units * RT.pg;
    const subtotal = fixed + energy + fppca + pg, tax = subtotal * RT.tax / 100, electricity = subtotal + tax;
    const maintenance = !t ? '' : (r.overrides.maintenance === '' ? round(m.maintenance * r.days / m.days, 2) : Number(r.overrides.maintenance));
    const rent = !t ? '' : (r.overrides.rent === '' ? rentFor(t, m, r.days) : Number(r.overrides.rent));
    r._util = electricity + (Number(maintenance) || 0);
    return { sheetRow: r.sheetRow, flat: r.flat, tenantId: r.tenantId, tenant: t ? t.name : '—', prev: r.prev, cur: r.cur, units, days: r.days,
      fixed, energy, fppca, pg, subtotal, tax, electricity, maintenance, rent, payee: t ? t.owner : '',
      total: r.billed ? electricity + (Number(maintenance) || 0) + (Number(rent) || 0) : '', billed: r.billed, note: r.note,
      arshad: '', diff: '', overrides: Object.assign({}, r.overrides), ...payments(m, r, t, rent) };
  }
  // same rules as the sheet: rent due on the agreement-start day; electricity + maintenance due on the 1st of next month
  const TRACK_FROM = '2026-10-01';
  function status(due, paid, grace, amt, owed, waived) {
    if (!due) return '';
    if (due < TRACK_FROM) return 'Not tracked';
    if (paid) {
      if (amt === '' || amt == null) return 'Paid';
      if (amt > owed + 0.004) return 'Overpaid';
      if (amt >= owed - 0.004) return 'Paid';
      if (waived) return 'Paid (rest waived)';
      const late0 = new Date(due + 'T00:00:00'); late0.setDate(late0.getDate() + grace);
      return new Date().toISOString().slice(0, 10) > late0.toISOString().slice(0, 10) ? 'Part paid — overdue' : 'Part paid';
    }
    const t = new Date().toISOString().slice(0, 10);
    const late = new Date(due + 'T00:00:00'); late.setDate(late.getDate() + grace);
    if (t > late.toISOString().slice(0, 10)) return 'Overdue';
    return t >= due ? 'Due' : 'Upcoming';
  }
  function payments(m, r, t, rent) {
    if (!t || !r.billed) return { rentDue: '', utilDue: '', rentStatus: '', utilStatus: '', rentPaid: '', utilPaid: '', rentBalance: '', utilBalance: '' };
    const [y, mo] = m.month.split('-').map(Number);
    const day = Math.min(Number(t.start.slice(8, 10)), m.days);
    const rentDue = rent ? `${m.month}-${String(day).padStart(2, '0')}` : '';
    const nx = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
    const util = round(r._util || 0, 2);
    const ra = r.rentAmt == null ? '' : r.rentAmt, ua = r.utilAmt == null ? '' : r.utilAmt;
    return { rentDue, rentPaid: r.rentPaid || '', rentAmountPaid: ra, rentStatus: status(rentDue, r.rentPaid, 2, ra, Number(rent) || 0, r.rentWaive),
             rentBalance: r.rentPaid && ra !== '' ? (Number(rent) || 0) - ra : '',
             utilDue: nx, utilPaid: r.utilPaid || '', utilAmountPaid: ua, utilStatus: status(nx, r.utilPaid, 3, ua, util, r.utilWaive),
             utilBalance: r.utilPaid && ua !== '' ? round(util - ua, 2) : '' };
  }
  function readMonth(name) {
    const m = months.find((x) => x.month === name);
    if (!m) throw new Error('Month not found.');
    const cm = m.rows.find((r) => r.flat === 'Common');
    const rt = m.rates || RATES;
    return { meta: { month: m.month, start: m.start, days: m.days, takenOn: m.takenOn, maintenance: m.maintenance, rates: rt, published: m.published, commonReading: cm && cm.cur !== '' && cm.cur != null ? cm.cur : null,
             electricityMode: [rt.fixed, rt.energy, rt.fppca, rt.pg].every((x) => !Number(x)) ? 'BESCOM meters' : 'Private meters' },
             rows: m.rows.map((r) => compute(m, r)) };
  }
  const today = () => new Date().toISOString().slice(0, 10);
  const addMonths = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, d)).toISOString().slice(0, 10); };
  function tObj(t) {
    const renewed = today() >= t.renewal;
    const cur = renewed ? t.renewal : t.start;
    return { id: t.id, flat: t.flat, name: t.name, owner: t.owner, status: t.status, rent: t.rent, currentRent: renewed ? t.afterRenewal : t.rent,
      start: cur, renewal: addMonths(cur, 11), afterRenewal: renewed ? Math.round(t.afterRenewal * 1.05) : t.afterRenewal, ends: addMonths(cur, 11), reminder: addMonths(cur, 9),
      movedIn: t.movedIn, movedOut: '', deposit: t.deposit, phone: t.phone };
  }
  const digits = (v) => String(v || '').replace(/\D/g, '').slice(-10);
  const sessions = {};
  const sess = (req, need) => {
    const s = sessions[req.token]; if (!s) throw new Error('Your session has ended. Please log in again.');
    if (need === 'tenant' && s.kind !== 'tenant') throw new Error('Not allowed.');
    if (need === 'staff' && s.kind !== 'staff') throw new Error('Not allowed.');
    if (need === 'admin' && s.role !== 'Admin') throw new Error('Only the admin can do this.');
    return s;
  };
  const tok = (o) => { const k = Math.random().toString(36).slice(2); sessions[k] = o; return k; };
  const strip = (r) => { const o = Object.assign({}, r); delete o.arshad; delete o.diff; delete o.overrides; delete o.sheetRow; return o; };
  const costs = [
    { name: 'Watchman salary', type: 'Fixed', amount: 10000 }, { name: 'Lift maintenance', type: 'Fixed', amount: 2500 },
    { name: 'CCTV & internet charges', type: 'Fixed', amount: 500 }, { name: 'BBMP garbage charges', type: 'Fixed', amount: 1000 },
    { name: 'Generator expenses', type: 'Varies', amount: 3000 }, { name: 'BWSSB water charges', type: 'Varies', amount: 2403 },
    { name: 'Common electricity', type: 'Auto', amount: '' }, { name: 'Cleaning Material', type: 'Varies', amount: 500 },
  ];
  // Arshad's account (fictional): payments he makes, his fee, money given back and forth
  const acLines = [];
  function acIncome(name) {
    const m = readMonth(name); const fl = m.rows.filter((r) => r.flat !== 'Common' && r.billed);
    const util = (r) => (Number(r.electricity) || 0) + (Number(r.maintenance) || 0); const cm = m.rows.find((r) => r.flat === 'Common');
    return { billed: fl.reduce((a, r) => a + util(r), 0), received: fl.reduce((a, r) => a + (r.utilPaid ? (r.utilAmountPaid !== '' && r.utilAmountPaid != null ? Number(r.utilAmountPaid) : util(r)) : 0), 0),
      elecCharged: fl.reduce((a, r) => a + (Number(r.electricity) || 0), 0) + (cm ? Number(cm.electricity) || 0 : 0), mode: m.meta.electricityMode };
  }
  function acNet(name, ls) {
    const inc = acIncome(name); const sum = (f) => ls.filter(f).reduce((a, x) => a + (x.amount || 0), 0);
    const isBill = (x) => x.kind === 'Expense' || x.kind === 'Electricity bill';
    const out = sum((x) => isBill(x) && x.paidBy === 'Arshad'), fee = sum((x) => x.kind === 'Fee'), gave = sum((x) => x.kind === 'Owner gave Arshad'), returned = sum((x) => x.kind === 'Arshad returned');
    return { inc, out, fee, gave, returned, net: inc.received - out - fee + gave - returned, unpaid: sum((x) => isBill(x) && x.paidBy === 'Arshad' && !x.paidOn),
      ownerPaid: sum((x) => isBill(x) && x.paidBy === 'Owner'), elecBill: sum((x) => x.kind === 'Electricity bill') };
  }
  function acFill(month) {
    if (acLines.some((x) => x.month === month)) throw new Error('This month already has a list.');
    const id = () => 'A-' + Math.random().toString(36).slice(2, 10);
    const gov = (months.find((m) => m.month === month) || {}).rates && !Number(months.find((m) => m.month === month).rates.energy);
    if (!gov) acLines.push({ id: id(), month, item: 'BESCOM main meter bill (commercial rate)', amount: null, kind: 'Electricity bill', paidBy: 'Arshad', paidOn: '' });
    costs.filter((c) => c.type !== 'Auto').forEach((c) => acLines.push({ id: id(), month, item: c.name, amount: c.amount, kind: 'Expense', paidBy: 'Arshad', paidOn: '' }));
    acLines.push({ id: id(), month, item: 'Arshad’s fee for managing the property', amount: cfg.arshad_monthly_fee, kind: 'Fee', paidBy: '', paidOn: '' });
    return acLines.length;
  }
  // sample October account: BESCOM commercial bill typed, most bills paid by Arshad, water paid by the owner
  acFill('2026-10');
  acLines.forEach((x) => { if (x.kind === 'Electricity bill') { x.amount = 52480; x.paidOn = '2026-11-02'; } else if (/water/i.test(x.item)) { x.paidBy = 'Owner'; x.paidOn = '2026-11-01'; } else if (x.kind === 'Expense' && !/generator/i.test(x.item)) x.paidOn = '2026-11-01'; });
  const mins = (t) => { const p = String(t).split(':'); return Number(p[0]) * 60 + Number(p[1]); };
  const runsAtNight = (from, to) => { const f = mins(from), t = mins(to); return t <= f || f < 360 || f >= 1320 || t > 1320; };
  const chargesText = (needs, terrace, lights) => [needs.includes('Use of the terrace') ? `Terrace cleaning ₹${terrace} — payable to the owner` : '',
    needs.includes('Outside / terrace lighting') ? (lights === '' ? 'Lighting (common meter) — amount set by the owner' : `Lighting (common meter) ₹${lights}`) : ''].filter(Boolean).join('; ');
  const requests = [
    { id: 'R-261020-411', submittedOn: '2026-10-20', tenantId: 'T-S3-01', flat: 'S3', tenant: 'Lakshmi Iyer', event: 'Religious function', date: '2026-11-14', from: '17:00', to: '21:30', details: 'Satyanarayan pooja at home, about 25 guests in the evening.', needs: 'Outside / terrace lighting', status: 'Pending', decidedBy: '', decidedOn: '', reply: '', timing: 'Day', charges: 'Lighting (common meter) — amount set by the owner' },
    { id: 'R-261005-208', submittedOn: '2026-10-05', tenantId: 'T-S2-01', flat: 'S2', tenant: 'Sameer Khan', event: 'Birthday or family party', date: '2026-10-12', from: '18:00', to: '22:00', details: "Son's birthday, 15 guests, done by 10 pm.", needs: 'Use of the terrace', status: 'Approved', decidedBy: 'Demo Admin', decidedOn: '2026-10-06', reply: 'Approved. Please keep the terrace clean afterwards.', timing: 'Day', charges: 'Terrace cleaning ₹500 — payable to the owner' },
  ];
  function approve(s, owner, pw) {
    if (s.name === owner) return owner;
    const p = people.find((x) => x.name === owner);
    if (!p || p.dob !== String(pw || '').replace(/\D/g, '')) throw new Error(owner + '’s date of birth (8 digits) is needed to approve this change.');
    return owner;
  }

  const locks = {};
  function guard(key) {
    const L = locks[key] = locks[key] || { fails: 0, level: 0, until: 0 };
    if (L.until > Date.now()) { const sec = Math.ceil((L.until - Date.now()) / 1000); throw new Error(`Too many wrong attempts. Please wait ${sec < 60 ? sec + ' seconds' : Math.ceil(sec / 60) + ' minutes'} and try again. [wait:${sec}]`); }
    return {
      fail() { L.fails += 1; if (L.fails >= 5) { const steps = [30, 300, 900]; const sec = steps[Math.min(L.level, 2)]; L.until = Date.now() + sec * 1000; L.level += 1; L.fails = 0; throw new Error(`Too many wrong attempts. Please wait ${sec < 60 ? sec + ' seconds' : Math.ceil(sec / 60) + ' minutes'} and try again. [wait:${sec}]`); } },
      ok() { L.fails = 0; L.level = 0; L.until = 0; },
    };
  }
  const A = {
    settings: () => settings,
    tenantLogin(req) {
      const g = guard('t_' + digits(req.phone));
      const t = tenants.find((x) => x.status === 'Active' && digits(x.phone) === digits(req.phone) && x.secret === String(req.dob || '').replace(/\D/g, ''));
      if (!t) { g.fail(); throw new Error('Those details don’t match our records. Use the phone number and date of birth of the person named on the agreement.'); }
      g.ok();
      return { token: tok({ kind: 'tenant', tenantId: t.id }), tenant: tObj(t), settings };
    },
    staffLogin(req) {
      const g = guard('p_' + digits(req.phone));
      const p = people.find((x) => digits(x.phone) === digits(req.phone) && x.role === 'Admin' && x.dob === String(req.dob || '') && x.password === req.password);
      if (!p) { g.fail(); throw new Error('Phone number, date of birth or password is wrong.'); }
      g.ok();
      return { token: tok({ kind: 'staff', name: p.name, role: p.role }), person: { id: p.id, name: p.name, role: p.role }, settings };
    },
    staffSetup(req) {
      const p = people.find((x) => x.role === 'Admin' && digits(x.phone) === digits(req.phone) && x.dob === String(req.dob || '') && x.setup && x.setup === req.setupCode);
      if (!p) throw new Error('Phone number, date of birth or setup code is wrong.');
      if (String(req.newPassword || '').length < 16) throw new Error('Choose a password of at least 16 characters.');
      p.password = req.newPassword; p.setup = ''; return true;
    },
    logout: (req) => { delete sessions[req.token]; return true; },
    months(req) {
      const s = sess(req);
      return months.filter((m) => s.kind === 'staff' || m.published).map((m) => m.month).reverse();
    },
    bill(req) {
      const s = sess(req, 'tenant'); const m = readMonth(req.month);
      if (!m.meta.published) throw new Error('This month’s bill is not ready yet.');
      const rows = m.rows.filter((r) => r.tenantId === s.tenantId && r.billed);
      const fl = rows.length ? rows[0].flat : '';
      return { meta: m.meta, rows: rows.map(strip), tenant: tObj(tenants.find((t) => t.id === s.tenantId)), payTo: { utilities: 'Arshad' }, settings, renewalPercent: 5,
        bescom: m.meta.electricityMode === 'BESCOM meters' ? Object.assign({}, flatsInfo.find((x) => x.flat === fl)) : null };
    },
    history(req) {
      const s = sess(req, 'tenant');
      return months.filter((m) => m.published).map((m) => {
        const rows = readMonth(m.month).rows.filter((r) => r.tenantId === s.tenantId && r.billed);
        return { month: m.month, units: rows.reduce((a, r) => a + r.units, 0), total: rows.reduce((a, r) => a + r.total, 0) };
      });
    },
    overview(req) {
      const s = sess(req, 'staff');
      const name = req.month || months[months.length - 1].month;
      const m = readMonth(name);
      let rows = m.rows; if (s.role === 'Owner') rows = rows.filter((r) => r.payee === s.name);
      const billed = rows.filter((r) => r.billed); const sum = (k) => billed.reduce((a, r) => a + (Number(r[k]) || 0), 0);
      const byOwner = {}; billed.forEach((r) => { byOwner[r.payee] = (byOwner[r.payee] || 0) + (Number(r.rent) || 0); });
      const ts = tenants.map(tObj).filter((t) => t.status === 'Active' && (s.role !== 'Owner' || t.owner === s.name));
      const renewals = ts.filter((t) => t.reminder <= today()).map((t) => ({ flat: t.flat, tenant: t.name, ends: t.ends, renewal: t.renewal, nextRent: t.afterRenewal }));
      const warnings = s.role === 'Admin' ? m.rows.filter((r) => m.meta.electricityMode !== 'BESCOM meters' && r.flat !== 'Common' && (r.cur === '' || Number(r.cur) < Number(r.prev))).map((r) => r.flat + ': check the current reading.')
        .concat(m.rows.filter((r) => /verdue/.test(r.rentStatus)).map((r) => `${r.flat}: rent ${r.rentStatus.toLowerCase()} (due ${r.rentDue}).`))
        .concat(m.rows.filter((r) => /verdue/.test(r.utilStatus)).map((r) => `${r.flat}: electricity + maintenance ${r.utilStatus.toLowerCase()} (due ${r.utilDue}).`)) : [];
      const history = months.slice(-6).map((mm) => {
        let rr = readMonth(mm.month).rows.filter((r) => r.billed); if (s.role === 'Owner') rr = rr.filter((r) => r.payee === s.name);
        const sm = (k) => rr.reduce((a, r) => a + (Number(r[k]) || 0), 0);
        const units = {}; readMonth(mm.month).rows.forEach((r) => { if (r.flat !== 'Common' && (s.role !== 'Owner' || r.payee === s.name)) units[r.flat] = (units[r.flat] || 0) + r.units; });
        return { month: mm.month, electricity: sm('electricity'), maintenance: sm('maintenance'), rent: sm('rent'), total: sm('total'), maintenancePerFlat: mm.maintenance, units,
          paidRent: rr.reduce((a, r) => a + (r.rentPaid ? (r.rentAmountPaid !== '' ? r.rentAmountPaid : Number(r.rent) || 0) : 0), 0),
          paidUtil: rr.reduce((a, r) => a + (r.utilPaid ? (r.utilAmountPaid !== '' ? r.utilAmountPaid : r.electricity + (Number(r.maintenance) || 0)) : 0), 0) };
      });
      const [ly, lm] = months[months.length - 1].month.split('-').map(Number); const nxt = new Date(ly, lm, 1); const nKey = `${nxt.getFullYear()}-${String(nxt.getMonth() + 1).padStart(2, '0')}`;
      const nEnd = new Date(nxt.getFullYear(), nxt.getMonth() + 1, 0).toISOString().slice(0, 10);
      const fixedSum = costs.filter((c) => c.type === 'Fixed').reduce((a, c) => a + c.amount, 0);
      const next = { month: nKey, rent: ts.reduce((a, t) => a + (t.renewal <= nEnd ? t.afterRenewal : t.currentRent), 0), fixedMaintenance: fixedSum, fixedPerFlat: Math.round(fixedSum / 10),
        renewals: ts.filter((t) => t.renewal <= nEnd).map((t) => ({ flat: t.flat, renewal: t.renewal, nextRent: t.afterRenewal })) };
      const pendingRequests = requests.filter((x) => x.status === 'Pending' && (s.role !== 'Owner' || OWNERS[x.flat] === s.name)).length;
      return { months: months.map((x) => x.month).reverse(), meta: m.meta, rows: s.role === 'Owner' ? rows.map((r) => Object.assign(strip(r), { sheetRow: r.sheetRow })) : rows,
        history, next, pendingRequests,
        totals: { electricity: sum('electricity'), maintenance: sum('maintenance'), rent: sum('rent'), total: sum('total') },
        byOwner, toArshad: sum('electricity') + sum('maintenance'), renewals, warnings, role: s.role, name: s.name };
    },
    tenants(req) { const s = sess(req, 'staff'); return tenants.map(tObj).filter((t) => s.role !== 'Owner' || t.owner === s.name); },
    people(req) { sess(req, 'admin'); return people.map((p) => ({ id: p.id, name: p.name, role: p.role, phone: p.phone, dobSet: (p.dob || '').length === 8, passwordSet: !!p.password, hasSetupCode: !!p.setup, active: true })); },
    updateTenant(req) {
      const s = sess(req, 'admin'); const t = tenants.find((x) => x.id === req.tenantId);
      const ch = req.changes || {};
      if (!(Object.keys(ch).length === 1 && 'owner' in ch)) approve(s, t.owner, req.ownerDob);
      Object.keys(ch).forEach((k) => {
        if (k === 'agreed') { t.afterRenewal = ch.agreed === '' ? Math.round(t.rent * 1.05) : Number(ch.agreed); return; }
        t[k] = ['rent', 'deposit'].includes(k) ? Number(ch[k]) : ch[k];
      });
      return true;
    },
    addTenant(req) {
      const s = sess(req, 'admin'); const d = req.tenant; approve(s, d.owner, req.ownerDob);
      tenants.filter((x) => x.flat === d.flat && x.status === 'Active').forEach((x) => { x.status = 'Vacated'; });
      const id = 'T-' + d.flat + '-0' + (tenants.filter((x) => x.flat === d.flat).length + 1);
      tenants.push({ id, flat: d.flat, name: d.name, phone: d.phone || '+91 0000000000', secret: d.secret || '', owner: d.owner, status: 'Active',
        rent: Number(d.rent), afterRenewal: d.agreed ? Number(d.agreed) : Math.round(Number(d.rent) * 1.05), start: d.start, renewal: d.renewal, deposit: Number(d.deposit), movedIn: d.movedIn });
      return { id };
    },
    updatePerson(req) {
      sess(req, 'admin'); const p = people.find((x) => x.id === req.personId);
      Object.keys(req.changes || {}).forEach((k) => { if (k === 'setupCode') { p.setup = req.changes[k]; p.password = ''; } else p[k] = req.changes[k]; });
      return true;
    },
    addMonth(req) {
      sess(req, 'admin');
      if (months.some((m) => m.month === req.month)) throw new Error(req.month + ' already exists. Edit it instead.');
      const last = months[months.length - 1]; const d = new Date(req.month + '-01T00:00:00');
      const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const active = {}; tenants.filter((t) => t.status === 'Active').forEach((t) => { active[t.flat] = t.id; });
      const gov = cfg.electricity_mode === 'BESCOM meters';
      const rates = gov ? { fixed: 0, energy: 0, fppca: 0, pg: 0, tax: 0 } : { fixed: +cfg.fixed_charge, energy: +cfg.energy_rate, fppca: +cfg.fppca_rate, pg: +cfg.pg_surcharge_rate, tax: +cfg.tax_percent };
      const pv = req.prevReadings || {}, rd = req.readings || {};
      const has = (v) => v !== '' && v != null && !isNaN(Number(v));
      const lastC = last.rows.find((r) => r.flat === 'Common');
      const cPrev = gov ? '' : (lastC && has(lastC.cur) ? Number(lastC.cur) : has(pv.Common) ? Number(pv.Common) : Number(req.commonPrev));
      const cCur = gov ? '' : Number(rd.Common);
      const flatPrev = (r) => (has(r.cur) ? Number(r.cur) : has(pv[r.flat]) ? Number(pv[r.flat]) : null);
      const flatUnits = last.rows.filter((r) => r.flat !== 'Common').reduce((a, r) => a + (has(rd[r.flat]) && flatPrev(r) != null ? Number(rd[r.flat]) - flatPrev(r) : 0), 0);
      const common = gov ? 0 : round(cCur - cPrev - flatUnits, 1);   // main meter units − all flats' units
      const commonElec = gov ? (Number(req.commonBill) || 0) : (rates.fixed + common * (rates.energy + rates.fppca + rates.pg)) * (1 + rates.tax / 100);
      const totalCost = costs.filter((c) => c.type === 'Fixed').reduce((a, c) => a + c.amount, 0) + commonElec + (req.items || []).reduce((a, x) => a + (Number(x.amount) || 0), 0);
      months.push({ month: req.month, start: req.month + '-01', days, takenOn: req.takenOn, maintenance: Math.round(totalCost / 10), published: false, rates,
        rows: last.rows.map((r) => r.flat === 'Common'
          ? Object.assign({}, r, { prev: cPrev, cur: cCur, unitsFixed: common, days })
          : { sheetRow: r.sheetRow, flat: r.flat, tenantId: active[r.flat] || '—', prev: gov ? '' : (has(r.cur) ? Number(r.cur) : has(pv[r.flat]) ? Number(pv[r.flat]) : ''), cur: gov || !has(rd[r.flat]) ? '' : Number(rd[r.flat]), days, overrides: { fixed: '', maintenance: '', rent: '' }, billed: !!active[r.flat], note: '' }) });
      acFill(req.month);
      return { month: req.month };
    },
    updateMonthRow(req) {
      sess(req, 'admin'); const m = months.find((x) => x.month === req.month); const r = m.rows.find((x) => x.sheetRow === Number(req.sheetRow));
      const ch = req.changes || {};
      const map = { fixedOverride: 'fixed', maintenanceOverride: 'maintenance', rentOverride: 'rent' };
      Object.keys(ch).forEach((k) => {
        if (map[k]) r.overrides[map[k]] = ch[k] === '' ? '' : Number(ch[k]);
        else if (k === 'days') r.days = ch[k] === '' ? m.days : Number(ch[k]);
        else if (k === 'bill') r.billed = ch[k] === 'Yes';
        else if (k === 'prev' || k === 'cur') r[k] = Number(ch[k]);
        else if (k === 'rentPaid' || k === 'utilPaid') r[k] = ch[k];
        else r[k] = ch[k];
      });
      return true;
    },
    renewAgreement(req) {
      const s = sess(req, 'admin'); const t = tenants.find((x) => x.id === req.tenantId); approve(s, t.owner, req.ownerDob);
      t.rent = Number(req.newRent) || t.afterRenewal; t.start = req.newStart || t.renewal;
      t.renewal = addMonths(t.start, 11); t.afterRenewal = Math.round(t.rent * 1.05); return true;
    },
    adminSettings(req) { sess(req, 'admin'); return { values: Object.assign({}, cfg), flats: flatsInfo.map((x) => Object.assign({}, x)) }; },
    saveSettings(req) {
      sess(req, 'admin'); const v = req.values || {};
      const numK = { fixed_charge: [0, 5000], energy_rate: [0, 100], fppca_rate: [0, 100], pg_surcharge_rate: [0, 100], tax_percent: [0, 50], utilities_due_day: [1, 28], utilities_grace_days: [0, 30], rent_grace_days: [0, 30], renewal_increase_percent: [0, 50], terrace_cleaning_charge: [0, 100000], keep_months: [12, 120] };
      Object.keys(numK).forEach((k) => { if (k in v) { const x = Number(v[k]); if (v[k] === '' || isNaN(x) || x < numK[k][0] || x > numK[k][1]) throw new Error(`${k.replace(/_/g, ' ')} must be a number from ${numK[k][0]} to ${numK[k][1]}.`); } });
      if (v.bescom_pay_link && !/^https:\/\//.test(v.bescom_pay_link)) throw new Error('The BESCOM link must start with https://');
      Object.keys(v).forEach((k) => { if (k in cfg) cfg[k] = k in numK ? Number(v[k]) : v[k]; });
      settings.electricityMode = cfg.electricity_mode; settings.bescomPayLink = cfg.bescom_pay_link; settings.terraceCharge = cfg.terrace_cleaning_charge;
      settings.whatsapp = cfg.whatsapp_contact; settings.email = cfg.contact_email;
      return true;
    },
    saveFlats(req) { sess(req, 'admin'); (req.flats || []).forEach((f) => { const x = flatsInfo.find((y) => y.flat === f.flat); if (x) { x.account = f.account || ''; x.meter = f.meter || ''; } }); return true; },
    arshadAccount(req) {
      sess(req, 'admin');
      const list = months.map((m) => m.month);
      const month = list.includes(req.month) ? req.month : list[list.length - 1];
      let running = cfg.arshad_opening_balance, before = running;
      list.filter((n) => n <= month).forEach((n) => { const ls = acLines.filter((x) => x.month === n); if (!ls.length) return; const net = acNet(n, ls).net; if (n < month) before += net; running += net; });
      const lines = acLines.filter((x) => x.month === month);
      return { month, months: list.slice().reverse(), lines: lines.map((x) => Object.assign({}, x)), summary: Object.assign(acNet(month, lines), { before, running, hasLines: lines.length > 0 }), fee: cfg.arshad_monthly_fee, opening: cfg.arshad_opening_balance };
    },
    arshadSave(req) {
      sess(req, 'admin');
      (req.deleted || []).forEach((id) => { const i = acLines.findIndex((x) => x.id === id && x.month === req.month); if (i >= 0) acLines.splice(i, 1); });
      (req.lines || []).forEach((l) => {
        if (!String(l.item || '').trim()) return;
        if (l.amount !== '' && isNaN(Number(l.amount))) throw new Error(l.item + ': the amount must be a number.');
        const v = { month: req.month, item: l.item.trim(), amount: l.amount === '' ? null : Number(l.amount), kind: l.kind, paidBy: l.kind === 'Fee' ? '' : (l.paidBy === 'Owner' ? 'Owner' : 'Arshad'), paidOn: l.paidOn || '', notes: '' };
        const hit = acLines.find((x) => x.id === l.id && x.month === req.month);
        if (hit) Object.assign(hit, v); else acLines.push(Object.assign(v, { id: 'A-' + Math.random().toString(36).slice(2, 10) }));
      });
      return true;
    },
    arshadFill(req) { sess(req, 'admin'); return acFill(req.month); },
    publishMonth(req) { sess(req, 'admin'); months.find((x) => x.month === req.month).published = !!req.published; return true; },
    markPaid(req) {
      const s = sess(req, 'staff'); const m = months.find((x) => x.month === req.month); const r = m.rows.find((x) => x.sheetRow === Number(req.sheetRow));
      const t = tenants.find((x) => x.id === r.tenantId);
      if (s.role === 'Owner' && (req.what !== 'rent' || !t || t.owner !== s.name)) throw new Error('Owners can only mark rent for their own flats.');
      const k = req.what === 'util' ? 'util' : 'rent';
      if (req.mode === 'undo') { delete r[k + 'Paid']; delete r[k + 'Amt']; delete r[k + 'Waive']; return true; }
      if (req.mode === 'waive') { r[k + 'Waive'] = true; return true; }
      r[k + 'Paid'] = today(); delete r[k + 'Waive'];
      if (req.mode === 'amount') { const a = Number(req.amount); if (!a || a <= 0) throw new Error('Type the amount received.'); r[k + 'Amt'] = a; } else delete r[k + 'Amt'];
      return true;
    },
    costs(req) { sess(req, 'staff'); return costs; },
    saveCosts(req) { sess(req, 'admin'); costs.length = 0; (req.costs || []).forEach((c) => costs.push({ name: c.name, type: c.type, amount: c.type === 'Auto' ? '' : Number(c.amount) || 0 })); if (!costs.some((c) => c.type === 'Auto')) costs.push({ name: 'Common electricity', type: 'Auto', amount: '' }); return true; },
    requests(req) { const s = sess(req, 'staff'); return requests.filter((x) => s.role !== 'Owner' || OWNERS[x.flat] === s.name).map((x) => Object.assign({}, x, { phone: (tenants.find((t) => t.id === x.tenantId) || {}).phone || '' })); },
    myRequests(req) { const s = sess(req, 'tenant'); return requests.filter((x) => x.tenantId === s.tenantId); },
    requestEvent(req) {
      const s = sess(req, 'tenant'); const t = tenants.find((x) => x.id === s.tenantId); const to = tObj(t);
      const id = 'R-' + today().slice(2).replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100);
      if (req.kind === 'agreement') {
        requests.unshift({ id, submittedOn: today(), tenantId: t.id, flat: t.flat, tenant: t.name, event: req.choice === 'end' ? 'Agreement: wants to end and move out' : 'Agreement: wants to continue (renew)',
          date: to.ends, from: '', to: '', details: req.choice === 'end' ? 'Will move out when the agreement ends.' : 'Would like to renew the agreement.', needs: '', status: 'Pending', decidedBy: '', decidedOn: '', reply: '' });
        return { id };
      }
      if (!req.event || !req.date || !req.from || !req.to || String(req.details || '').length < 5) throw new Error('Choose the event, the date, the start and end time, and write the reason.');
      if (!['Day', 'Night', 'Day and night'].includes(req.timing)) throw new Error('Choose whether the event is in the day, at night, or both.');
      if (req.timing === 'Day' && runsAtNight(req.from, req.to)) throw new Error('These times run into the night (after 10 pm or before 6 am). Choose “Night” or “Day and night”.');
      const needs = (req.needs || []).join(', ');
      requests.unshift({ id, submittedOn: today(), tenantId: t.id, flat: t.flat, tenant: t.name, event: req.event, date: req.date, from: req.from, to: req.to, details: req.details, needs, status: 'Pending', decidedBy: '', decidedOn: '', reply: '', timing: req.timing, charges: chargesText(needs, 500, '') });
      return { id };
    },
    decideRequest(req) {
      const s = sess(req, 'admin'); const x = requests.find((y) => y.id === req.id); x.status = req.status === 'Approved' ? 'Approved' : 'Declined'; x.decidedBy = s.name; x.decidedOn = today(); x.reply = req.reply || '';
      const num = (v, d) => (v === '' || v == null || isNaN(Number(v)) ? d : Math.max(0, Math.round(Number(v))));
      if (x.status === 'Approved' && !/^Agreement/.test(x.event)) x.charges = chargesText(x.needs, num(req.terraceCharge, 500), num(req.lightingCharge, ''));
      return true;
    },
  };

  window.AV_DEMO = {
    handle(action, payload) {
      return new Promise((resolve, reject) => setTimeout(() => {
        try { const fn = A[action]; if (!fn) throw new Error('Unknown action.'); resolve(JSON.parse(JSON.stringify(fn(payload || {})))); }
        catch (e) { reject(e); }
      }, 220));
    },
    hints: { tenant: 'Demo: flat S2 = phone 9876500006, date of birth 01011986. (N1 = 9876500000 / 01011980 … S5 = 9876500009 / 01011989.)',
             staff: 'Demo: owner phone 9000000000, date of birth 01011960, password asdaq-demo-password.' },
  };
})();
