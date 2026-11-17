/* ==========================================================================
   La Boîte à Méliss — réservation sans back-end ni abonnement.
   La demande est composée dans la page, puis envoyée par SMS pré-rempli (sms:),
   e-mail (mailto:), copie du message, appel (tel:) ou fichier agenda (.ics).
   Rien n'est stocké ni envoyé à un serveur.
   ========================================================================== */
(() => {
  'use strict';

  /* ---- Données à modifier ici si besoin --------------------------------- */
  const CONTACT = {
    phoneIntl: '+33659902186',
    email: 'esthmel@hotmail.fr',
    place: 'La Boîte à Méliss, 14 rue Jean Briquin, 54180 Houdemont'
  };
  // [ouverture, fermeture] en minutes depuis minuit ; jours : 0 = dimanche … 6 = samedi
  const HOURS = {
    1: [9 * 60, 19 * 60],
    2: [9 * 60, 18 * 60 + 30],
    3: [9 * 60, 19 * 60 + 30],
    4: [9 * 60, 19 * 60],
    5: [9 * 60, 17 * 60 + 30]
  };
  const SLOT_STEP = 30;          // un créneau toutes les 30 min
  const LAST_START_BEFORE_CLOSE = 60; // dernier départ = fermeture − 60 min
  const MIN_LEAD = 120;          // aujourd'hui : au moins 2 h de préavis
  /* ----------------------------------------------------------------------- */

  const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const pad = n => String(n).padStart(2, '0');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  function parisNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  }
  function fmtH(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} h ${pad(m)}` : `${h} h`;
  }
  function openStatus() {
    const now = parisNow();
    const d = now.getDay();
    const mins = now.getHours() * 60 + now.getMinutes();
    const today = HOURS[d];
    if (today && mins >= today[0] && mins < today[1]) {
      return { open: true, text: `Ouvert · jusqu'à ${fmtH(today[1])}`, short: `Ouvert jusqu'à ${fmtH(today[1])}` };
    }
    for (let i = 0; i <= 7; i++) {
      const dd = (d + i) % 7;
      const h = HOURS[dd];
      if (!h) continue;
      if (i === 0 && mins >= h[1]) continue;
      if (i === 0) return { open: false, text: `Fermé · ouvre à ${fmtH(h[0])}`, short: `Fermé, ouvre à ${fmtH(h[0])}` };
      const when = i === 1 ? 'demain' : DAYS_FR[dd];
      return { open: false, text: `Fermé · ouvre ${when} à ${fmtH(h[0])}`, short: `Fermé, ouvre ${when} à ${fmtH(h[0])}` };
    }
    return { open: false, text: 'Fermé', short: 'Fermé' };
  }

  /* ---------------------------------------------------------------------- */
  const wiz = $('#wizard');
  const state = { services: new Map(), date: null, time: null, flex: false, step: 1 };
  let isCoarse = false;

  function init() {
    if (!wiz) return;
    isCoarse = matchMedia('(pointer:coarse)').matches;
    buildChips();
    buildDays();
    $('#wNext').addEventListener('click', next);
    $('#wPrev').addEventListener('click', prev);
    wiz.addEventListener('submit', e => e.preventDefault());
    wiz.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); next(); }
    });
    $('#sendIcs').addEventListener('click', downloadIcs);
    $('#sendCopy').addEventListener('click', copyMessage);
    update();
  }

  /* ---- étape 1 : soins -------------------------------------------------- */
  function buildChips() {
    const wrap = $('#chips');
    const list = $$('.svc[data-service]').map(el => ({ id: el.dataset.service, title: el.dataset.title.replace(/&amp;/g, '&') }));
    list.push({ id: 'conseil', title: 'Conseillez-moi' });
    list.forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.id = s.id;
      b.setAttribute('aria-pressed', 'false');
      const icon = s.id === 'conseil' ? '#i-spark' : `#ic-${s.id}`;
      b.innerHTML = `<svg aria-hidden="true"><use href="${icon}"/></svg><span></span>`;
      b.lastChild.textContent = s.title;
      b.addEventListener('click', () => toggleService(s.id, s.title));
      wrap.appendChild(b);
    });
  }
  function toggleService(id, title, force) {
    const on = force !== undefined ? force : !state.services.has(id);
    if (id === 'conseil' && on) { state.services.clear(); }
    else if (on) { state.services.delete('conseil'); }
    if (on) state.services.set(id, title); else state.services.delete(id);
    $$('.chip').forEach(c => c.setAttribute('aria-pressed', String(state.services.has(c.dataset.id))));
    clearError();
  }
  function onlyGift() { return state.services.size === 1 && state.services.has('cadeau'); }

  /* ---- étape 2 : jour + heure ------------------------------------------ */
  function slotsFor(date, isToday, nowMin) {
    const h = HOURS[date.getDay()];
    if (!h) return [];
    let start = h[0];
    if (isToday) start = Math.max(start, Math.ceil((nowMin + MIN_LEAD) / SLOT_STEP) * SLOT_STEP);
    const last = h[1] - LAST_START_BEFORE_CLOSE;
    const out = [];
    for (let m = start; m <= last; m += SLOT_STEP) out.push(m);
    return out;
  }
  function buildDays() {
    const wrap = $('#days');
    const now = parisNow();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let shown = 0;
    for (let i = 0; i < 45 && shown < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const slots = slotsFor(d, i === 0, nowMin);
      if (!slots.length) continue;
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'day';
      b.dataset.date = key;
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`);
      b.innerHTML = `<small>${i === 0 ? 'auj.' : DAYS_FR[d.getDay()].slice(0, 3) + '.'}</small><b>${d.getDate()}</b><span>${MONTHS_FR[d.getMonth()].slice(0, 4)}${MONTHS_FR[d.getMonth()].length > 4 ? '.' : ''}</span>`;
      b.addEventListener('click', () => selectDay(key, d, slots));
      wrap.appendChild(b);
      shown++;
    }
  }
  function selectDay(key, d, slots) {
    state.date = { key, d };
    state.time = null;
    state.flex = false;
    $$('.day').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.date === key)));
    const wrap = $('#slots');
    wrap.innerHTML = '';
    slots.forEach(m => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.dataset.m = m;
      b.setAttribute('aria-pressed', 'false');
      b.textContent = fmtH(m);
      b.addEventListener('click', () => selectSlot(m));
      wrap.appendChild(b);
    });
    const f = document.createElement('button');
    f.type = 'button';
    f.className = 'slot slot--flex';
    f.setAttribute('aria-pressed', 'false');
    f.textContent = 'Peu importe, Mélissa me propose une heure';
    f.addEventListener('click', () => selectSlot('flex'));
    wrap.appendChild(f);
    $('#slotHint').textContent = 'Créneau souhaité : Mélissa confirme la disponibilité par retour.';
    clearError();
    document.dispatchEvent(new Event('melissa:layout'));
  }
  function selectSlot(m) {
    state.flex = m === 'flex';
    state.time = state.flex ? null : m;
    $$('.slot').forEach(x => x.setAttribute('aria-pressed', String(state.flex ? x.classList.contains('slot--flex') : x.dataset.m == m)));
    clearError();
  }

  /* ---- navigation ------------------------------------------------------- */
  function setError(msg) { $('#wErr').textContent = msg; }
  function clearError() { $('#wErr').textContent = ''; }

  function validate(step) {
    if (step === 1) {
      if (!state.services.size) { setError('Choisissez au moins un soin (ou « Conseillez-moi »).'); return false; }
    }
    if (step === 2 && !onlyGift()) {
      if (!state.date) { setError('Choisissez un jour.'); return false; }
      if (!state.time && !state.flex) { setError('Choisissez une heure, ou « Peu importe ».'); return false; }
    }
    if (step === 3) {
      const n = $('#fName'), t = $('#fTel');
      const digits = t.value.replace(/[^\d+]/g, '');
      const okName = n.value.trim().length >= 2;
      const okTel = /^(\+33|0033|0)[1-9]\d{8}$/.test(digits) || /^\+\d{9,15}$/.test(digits);
      n.setAttribute('aria-invalid', String(!okName));
      t.setAttribute('aria-invalid', String(!okTel));
      if (!okName) { setError('Indiquez votre prénom.'); n.focus(); return false; }
      if (!okTel) { setError('Indiquez un numéro de téléphone valide (ex. 06 12 34 56 78).'); t.focus(); return false; }
    }
    clearError();
    return true;
  }
  function next() {
    if (state.step >= 4) return;
    if (!validate(state.step)) return;
    go(state.step + 1);
  }
  function prev() { if (state.step > 1) go(state.step - 1); }
  function go(n) {
    state.step = n;
    if (n === 4) buildSummary();
    update();
    const active = $(`.wstep[data-step="${n}"]`);
    const legend = $('legend, .wstep__title', active);
    if (legend) { legend.setAttribute('tabindex', '-1'); legend.focus({ preventScroll: true }); }
    const r = wiz.getBoundingClientRect();
    if (r.top < 0 || r.top > innerHeight * .5) window.dispatchEvent(new CustomEvent('melissa:scrollto', { detail: wiz }));
    document.dispatchEvent(new Event('melissa:layout'));
  }
  function update() {
    $$('.wstep', wiz).forEach(s => s.classList.toggle('is-active', Number(s.dataset.step) === state.step));
    $$('#wSteps li').forEach(li => {
      const s = Number(li.dataset.s);
      li.classList.toggle('is-active', s === state.step);
      li.classList.toggle('is-done', s < state.step);
      if (s === state.step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('#wPrev').hidden = state.step === 1;
    const nx = $('#wNext');
    nx.hidden = state.step === 4;
    nx.querySelector('span').textContent = state.step === 3 ? 'Voir ma demande' : 'Continuer';
  }

  /* ---- étape 4 : message + liens --------------------------------------- */
  function dateLabel() {
    if (!state.date) return '';
    const d = state.date.d;
    return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
  }
  function slotLabel() {
    if (state.time != null) return `à ${fmtH(state.time)}`;
    if (state.flex) return '(heure flexible)';
    return '';
  }
  function servicesLabel() { return [...state.services.values()].join(', '); }
  function buildMessage() {
    const name = $('#fName').value.trim();
    const tel = $('#fTel').value.trim();
    const note = $('#fMsg').value.trim();
    const lines = [`Bonjour Mélissa, c'est ${name}.`];
    if (state.services.has('conseil')) lines.push('Je souhaiterais prendre rendez-vous et j\'aimerais un conseil sur le soin qui me conviendrait.');
    else if (onlyGift()) lines.push('Je souhaiterais commander un bon cadeau.');
    else lines.push(`Je souhaiterais prendre rendez-vous pour : ${servicesLabel()}.`);
    if (state.date && !onlyGift()) lines.push(`Créneau souhaité : ${dateLabel()} ${slotLabel()}.`.replace(/\s+\./, '.'));
    if (note) lines.push(`Précision : ${note}`);
    lines.push(`Mon numéro : ${tel}.`);
    lines.push('Merci beaucoup !');
    return lines.join('\n');
  }
  function buildSummary() {
    const msg = buildMessage();
    const name = $('#fName').value.trim();
    const tel = $('#fTel').value.trim();
    const slot = state.date && !onlyGift() ? `${dateLabel()} ${slotLabel()}` : (onlyGift() ? 'À convenir' : '—');
    const recap = $('#recap');
    recap.innerHTML = '';
    [['Soin', state.services.has('conseil') ? 'Conseil personnalisé' : servicesLabel()], ['Créneau', slot], ['Vous', `${name} · ${tel}`]].forEach(([k, v]) => {
      const row = document.createElement('div');
      const kk = document.createElement('span'); kk.className = 'k'; kk.textContent = k;
      const vv = document.createElement('b'); vv.textContent = v;
      row.append(kk, vv);
      recap.appendChild(row);
    });
    const sms = $('#sendSms'), mail = $('#sendMail');
    sms.href = `sms:${CONTACT.phoneIntl}?&body=${encodeURIComponent(msg)}`;
    const subject = onlyGift() ? 'Demande de bon cadeau' : `Demande de rendez-vous${state.date ? ' – ' + dateLabel() : ''}`;
    mail.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg + '\n')}`;
    // Sur ordinateur, l'e-mail passe en premier ; sur mobile, le SMS.
    const send = $('#send');
    if (isCoarse) { send.prepend(sms, mail); sms.classList.add('btn--pink'); sms.classList.remove('btn--line'); mail.classList.add('btn--line'); mail.classList.remove('btn--pink'); }
    else { send.prepend(mail, sms); mail.classList.add('btn--pink'); mail.classList.remove('btn--line'); sms.classList.add('btn--line'); sms.classList.remove('btn--pink'); }
    const hasSlot = !!state.date && !onlyGift();
    $('#sendIcs').toggleAttribute('hidden', !hasSlot);
    $('#sendHint').textContent = isCoarse
      ? 'Touchez « Envoyer par SMS » : le message est déjà écrit, il ne reste qu\'à appuyer sur envoyer. Le rendez-vous n\'est confirmé que lorsque Mélissa vous répond.'
      : 'Sur ordinateur, utilisez l\'e-mail, ou copiez le message pour l\'envoyer par SMS depuis votre téléphone. Le rendez-vous n\'est confirmé que lorsque Mélissa vous répond.';
  }
  async function copyMessage() {
    const msg = buildMessage();
    const btn = $('#sendCopy span');
    const old = btn.textContent;
    try { await navigator.clipboard.writeText(msg); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = msg; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) { /* ignore */ }
      ta.remove();
    }
    btn.textContent = 'Message copié !';
    setTimeout(() => { btn.textContent = old; }, 2200);
  }

  /* ---- fichier agenda (.ics) ------------------------------------------- */
  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function downloadIcs() {
    if (!state.date) return;
    const d = state.date.d;
    const startMin = state.time != null ? state.time : 9 * 60;
    const endMin = startMin + 60;
    const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const t = m => `${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const desc = `Soin : ${state.services.has('conseil') ? 'conseil personnalisé' : servicesLabel()}\nDemande envoyée depuis le site : le rendez-vous est confirmé lorsque Mélissa répond.\nTéléphone : 06 59 90 21 86`;
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//La Boite a Meliss//Reservation//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@laboiteameliss`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${ymd}T${t(startMin)}`,
      `DTEND:${ymd}T${t(endMin)}`,
      `SUMMARY:${icsEscape('Rendez-vous La Boîte à Méliss (à confirmer)')}`,
      `LOCATION:${icsEscape(CONTACT.place)}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      'STATUS:TENTATIVE',
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Rendez-vous La Boîte à Méliss', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'rendez-vous-la-boite-a-meliss.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ---- API publique ----------------------------------------------------- */
  window.MELISS = {
    CONTACT, HOURS, parisNow, fmtH, openStatus,
    select(id) {
      const el = $(`.svc[data-service="${id}"]`);
      const title = el ? el.dataset.title.replace(/&amp;/g, '&') : id;
      if (!wiz) return;
      toggleService(id, title, true);
      if (state.step !== 1) go(1);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
