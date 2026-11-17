/* ==========================================================================
   La Boîte à Méliss — animations (GSAP + ScrollTrigger + Lenis, hébergés en local)
   Règles : courbes douces (expo / power3), transform + opacity en priorité,
   stagger partout, version allégée si prefers-reduced-motion, mobile simplifié.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const M = window.MELISS || {};

  /* ---------------------------------------------------------------------- *
   * Repli : sans GSAP, on affiche simplement le site statique
   * ---------------------------------------------------------------------- */
  function staticMode() {
    root.classList.add('no-anim', 'intro-done');
    root.classList.remove('is-loading');
    const l = $('#loader'); if (l) l.style.display = 'none';
    initStatusAndHours();
    initMenu(null);
    initLightbox(null);
    initStaticAnchors();
    initStaticReviews();
  }
  if (!window.gsap || !window.ScrollTrigger) { staticMode(); return; }

  gsap.registerPlugin(ScrollTrigger);
  if (reduce) root.classList.add('no-anim', 'intro-done');

  /* ---------------------------------------------------------------------- *
   * Smooth scroll (Lenis)
   * ---------------------------------------------------------------------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); // jusqu'à la fin du loader
  }
  const easeOutQuart = x => 1 - Math.pow(1 - x, 4);
  function scrollToEl(target, offset = 0) {
    if (lenis) lenis.scrollTo(target, { duration: 1.7, easing: easeOutQuart, offset });
    else if (typeof target === 'number') window.scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  function initStaticAnchors() {
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      const t = id.length > 1 ? $(id) : null;
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  /* ---------------------------------------------------------------------- *
   * Texte découpé (lettres / mots) avec effet masque
   * ---------------------------------------------------------------------- */
  function splitInto(node, out, mode) {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/([ \t\n\r]+)/).forEach(part => {
          if (!part) return;
          if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span');
          w.className = 'w';
          if (mode === 'chars') {
            [...part].forEach(c => {
              const o = document.createElement('span'); o.className = 'ch';
              const i = document.createElement('span'); i.className = 'ch__i'; i.textContent = c;
              o.appendChild(i); w.appendChild(o); out.push(i);
            });
          } else { w.textContent = part; out.push(w); }
          frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('inpill')) splitInto(n, out, mode);
    });
  }
  function split(el, mode = 'chars') {
    const label = el.textContent.trim().replace(/\s+/g, ' ');
    const out = [];
    splitInto(el, out, mode);
    el.setAttribute('aria-label', label);
    $$('.w', el).forEach(w => w.setAttribute('aria-hidden', 'true'));
    return out;
  }

  /* ---------------------------------------------------------------------- *
   * Horaires / ouvert maintenant
   * ---------------------------------------------------------------------- */
  function initStatusAndHours() {
    if (!M.openStatus) return;
    const apply = () => {
      const s = M.openStatus();
      const pill = $('#openNow');
      if (pill) { pill.classList.toggle('is-open', s.open); $('span', pill).textContent = s.text; }
      const hn = $('#hoursNow');
      if (hn) { hn.classList.toggle('is-open', s.open); hn.textContent = s.open ? 'Ouvert maintenant' : s.short; }
      const d = M.parisNow().getDay();
      $$('#hours li').forEach(li => li.classList.toggle('is-today', Number(li.dataset.day) === d));
    };
    apply();
    setInterval(apply, 60000);
  }

  /* ---------------------------------------------------------------------- *
   * Menu mobile
   * ---------------------------------------------------------------------- */
  function initMenu(lns) {
    const burger = $('#burger'), menu = $('#menu');
    if (!burger || !menu) return;
    const set = open => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      if (lns) open ? lns.stop() : lns.start();
      else document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
    $$('a', menu).forEach(a => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
    window.__closeMenu = () => set(false);
  }

  /* ---------------------------------------------------------------------- *
   * Lightbox galerie
   * ---------------------------------------------------------------------- */
  function initLightbox(lns) {
    const box = $('#lightbox'); if (!box) return;
    const img = $('#lbImg'), cap = $('#lbCap');
    const links = $$('[data-lightbox]');
    let idx = 0, opener = null;
    const show = i => {
      idx = (i + links.length) % links.length;
      const a = links[idx];
      img.src = a.getAttribute('href');
      img.alt = $('img', a).alt;
      cap.textContent = a.dataset.cap || '';
      if (window.gsap && !reduce) gsap.fromTo(img, { opacity: 0, scale: .94 }, { opacity: 1, scale: 1, duration: .7, ease: 'expo.out' });
    };
    const open = (i, trigger) => {
      opener = trigger;
      box.hidden = false;
      show(i);
      if (lns) lns.stop(); else document.body.style.overflow = 'hidden';
      if (window.gsap && !reduce) gsap.fromTo(box, { opacity: 0 }, { opacity: 1, duration: .4 });
      $('#lbClose').focus();
    };
    const close = () => {
      box.hidden = true;
      if (lns) lns.start(); else document.body.style.overflow = '';
      if (opener) opener.focus({ preventScroll: true });
    };
    links.forEach((a, i) => a.addEventListener('click', e => { e.preventDefault(); open(i, a); }));
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', () => show(idx - 1));
    $('#lbNext').addEventListener('click', () => show(idx + 1));
    box.addEventListener('click', e => { if (e.target === box) close(); });
    document.addEventListener('keydown', e => {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'Tab') {
        const f = [$('#lbClose'), $('#lbPrev'), $('#lbNext')];
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
  }

  /* ---------------------------------------------------------------------- *
   * Avis : carrousel (glisser, flèches, lecture auto)
   * ---------------------------------------------------------------------- */
  function initReviews(auto) {
    const vp = $('#revViewport'), track = $('#revTrack');
    if (!vp || !track) return;
    const cards = $$('.rev', track);
    const bar = $('#revBar');
    let idx = 0, offsets = [], maxX = 0, lastIdx = 0, x = 0, barTween = null, dragging = false, inView = false, hover = false;

    const measure = () => {
      const base = cards[0].offsetLeft;
      offsets = cards.map(c => c.offsetLeft - base);
      maxX = Math.max(0, track.scrollWidth - vp.clientWidth);
      lastIdx = offsets.findIndex(o => o >= maxX - 2);
      if (lastIdx < 0) lastIdx = cards.length - 1;
    };
    const apply = (animate = true) => {
      x = -Math.min(offsets[idx], maxX);
      if (animate && !reduce) gsap.to(track, { x, duration: 1.1, ease: 'expo.out', overwrite: true });
      else gsap.set(track, { x });
    };
    const startBar = () => {
      if (!auto || reduce || !bar) return;
      if (barTween) barTween.kill();
      barTween = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 7, ease: 'none', onComplete: () => go(idx >= lastIdx ? 0 : idx + 1) });
      if (!inView || hover || dragging) barTween.pause();
    };
    const go = i => { idx = Math.max(0, Math.min(lastIdx, i)); apply(); startBar(); };
    const maybePause = () => { if (!barTween) return; (inView && !hover && !dragging) ? barTween.play() : barTween.pause(); };

    $('#revNext').addEventListener('click', () => go(idx >= lastIdx ? 0 : idx + 1));
    $('#revPrev').addEventListener('click', () => go(idx <= 0 ? lastIdx : idx - 1));
    vp.addEventListener('mouseenter', () => { hover = true; maybePause(); });
    vp.addEventListener('mouseleave', () => { hover = false; maybePause(); });
    vp.addEventListener('focusin', () => { hover = true; maybePause(); });
    vp.addEventListener('focusout', () => { hover = false; maybePause(); });
    vp.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    });

    // glisser à la souris / au doigt
    let sx = 0, sy = 0, startX = 0, moved = false, locked = null;
    vp.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true; moved = false; locked = null; sx = e.clientX; sy = e.clientY; startX = gsap.getProperty(track, 'x');
      gsap.killTweensOf(track); maybePause();
    });
    window.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (locked === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (locked !== 'x') return;
      moved = true;
      const nx = Math.max(-maxX - 60, Math.min(60, startX + dx));
      gsap.set(track, { x: nx });
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (moved) {
        const cur = -gsap.getProperty(track, 'x');
        let best = 0, d = Infinity;
        offsets.forEach((o, i) => { const dd = Math.abs(Math.min(o, maxX) - cur); if (dd < d) { d = dd; best = i; } });
        idx = Math.min(best, lastIdx);
      }
      apply(); startBar(); maybePause();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    vp.addEventListener('dragstart', e => e.preventDefault());

    measure(); apply(false);
    addEventListener('resize', () => { measure(); apply(false); });
    startBar();
    if (auto) {
      const st = ScrollTrigger.create({ trigger: vp, start: 'top 90%', end: 'bottom top', onToggle: s => { inView = s.isActive; maybePause(); } });
      inView = st.isActive; maybePause();
    }
  }
  function initStaticReviews() { const vp = $('#revViewport'); if (vp) vp.style.overflowX = 'auto'; }

  /* ---------------------------------------------------------------------- *
   * Effets souris : curseur, boutons magnétiques, tilt, particules
   * ---------------------------------------------------------------------- */
  function initCursor() {
    if (!fine || reduce) return;
    root.classList.add('has-cursor');
    const wrap = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
    const dx = gsap.quickTo(dot, 'x', { duration: .1, ease: 'power3' }), dy = gsap.quickTo(dot, 'y', { duration: .1, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: .55, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: .55, ease: 'power3' });
    window.addEventListener('pointermove', e => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); wrap.style.opacity = 1; }, { passive: true });
    document.addEventListener('mouseleave', () => { wrap.style.opacity = 0; });
    document.addEventListener('mouseover', e => {
      const t = e.target.closest ? e.target.closest('[data-cursor]') : null;
      const l = e.target.closest ? e.target.closest('a,button,input,textarea,label,[role="button"]') : null;
      wrap.classList.toggle('is-label', !!t);
      wrap.classList.toggle('is-link', !!l && !t);
      label.textContent = t ? t.dataset.cursor : '';
    });
  }
  function magnetic() {
    if (!fine || reduce) return;
    $$('.btn--magnetic').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - (r.left + r.width / 2)) * .28, y: (e.clientY - (r.top + r.height / 2)) * .4, duration: .5, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1,.4)' }));
    });
  }
  function tilt(el, max = 8, glare = true) {
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, 'rotationX', { duration: .6, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: .6, ease: 'power3' });
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      ry((px - .5) * max * 2); rx(-(py - .5) * max * 2);
      if (glare) { el.style.setProperty('--gx', px * 100 + '%'); el.style.setProperty('--gy', py * 100 + '%'); el.classList.add('is-hover'); }
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); el.classList.remove('is-hover'); });
  }
  function burst(x, y) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.innerHTML = '<use href="#i-spark"/>';
      const size = gsap.utils.random(10, 22);
      Object.assign(s.style, { position: 'fixed', left: x + 'px', top: y + 'px', width: size + 'px', height: size + 'px', zIndex: 320, pointerEvents: 'none', color: gsap.utils.random(['#FF4FA3', '#E9C39B', '#ffffff']), marginLeft: -size / 2 + 'px', marginTop: -size / 2 + 'px' });
      document.body.appendChild(s);
      const a = (i / n) * Math.PI * 2 + gsap.utils.random(-.3, .3), d = gsap.utils.random(50, 120);
      gsap.fromTo(s, { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }, { x: Math.cos(a) * d, y: Math.sin(a) * d, scale: 0, opacity: 0, rotate: gsap.utils.random(-120, 120), duration: gsap.utils.random(.8, 1.3), ease: 'power3.out', onComplete: () => s.remove() });
    }
  }
  function sparkBursts() {
    if (reduce) return;
    document.addEventListener('click', e => {
      const b = e.target.closest ? e.target.closest('.btn--pink, [data-spark]') : null;
      if (b) burst(e.clientX, e.clientY);
    });
  }

  /* ---------------------------------------------------------------------- *
   * Étincelles décoratives
   * ---------------------------------------------------------------------- */
  function makeSparks(container, n) {
    const els = [];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      const size = gsap.utils.random(8, 28);
      s.style.cssText = `left:${gsap.utils.random(2, 97)}%;top:${gsap.utils.random(4, 94)}%;width:${size}px;height:${size}px;color:${gsap.utils.random(['#ffffff', '#FF4FA3', '#E9C39B'])}`;
      s.innerHTML = '<svg><use href="#i-spark"/></svg>';
      s.dataset.depth = gsap.utils.random(20, 140).toFixed(0);
      container.appendChild(s);
      els.push(s);
      if (!reduce) gsap.fromTo(s, { scale: 0, rotate: 0, opacity: 0 }, { scale: gsap.utils.random(.5, 1.05), rotate: 90, opacity: gsap.utils.random(.5, .95), duration: gsap.utils.random(1.3, 3), repeat: -1, yoyo: true, ease: 'sine.inOut', delay: gsap.utils.random(0, 3) });
    }
    return els;
  }

  /* ---------------------------------------------------------------------- *
   * Marquee réactif au scroll
   * ---------------------------------------------------------------------- */
  function initMarquee() {
    const rows = $$('[data-marquee]').map(row => {
      const track = $('.marquee__track', row);
      const base = track.innerHTML;
      const w = track.scrollWidth;
      const copies = Math.ceil((innerWidth * 1.2) / Math.max(w, 1)) + 1;
      for (let i = 0; i < copies; i++) track.insertAdjacentHTML('beforeend', base);
      return { track, dir: Number(row.dataset.marquee), x: 0, w };
    });
    if (reduce) return;
    let vel = 0, scrollDir = 1, active = true, boost = 0;
    ScrollTrigger.create({ onUpdate: s => { vel = s.getVelocity(); if (s.direction) scrollDir = s.direction; } });
    ScrollTrigger.create({ trigger: '.marquee', start: 'top bottom', end: 'bottom top', onToggle: s => { active = s.isActive; } });
    gsap.ticker.add((time, dt) => {
      vel *= .9;
      if (!active) return;
      boost += (Math.min(Math.abs(vel) / 260, 16) - boost) * .08;
      const f = dt / 16.67;
      rows.forEach(r => {
        r.x -= r.dir * scrollDir * (.9 + boost) * f;
        if (r.x <= -r.w) r.x += r.w;
        if (r.x > 0) r.x -= r.w;
        r.track.style.transform = `translate3d(${r.x}px,0,0)`;
      });
    });
  }

  /* ---------------------------------------------------------------------- *
   * Intro (après le loader)
   * ---------------------------------------------------------------------- */
  let heroChars = [];
  function playIntro() {
    root.classList.add('intro-done');
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('.hero__video', { scale: 1.28 }, { scale: 1.08, duration: 2.8, ease: 'power3.out' }, 0)
      .to('.hero__eyebrow', { opacity: 1, duration: 1 }, .15)
      .fromTo('.ey-line', { scaleX: 0 }, { scaleX: 1, duration: 1.2 }, .15)
      .from(heroChars, { yPercent: 120, rotate: 4, duration: 1.5, stagger: .06 }, .1)
      .fromTo('.hero__brush', { scaleX: 0 }, { scaleX: 1, duration: 1.5, ease: 'power4.out' }, .75)
      .fromTo('.hero__script', { opacity: 0, yPercent: 40, rotate: -10 }, { opacity: 1, yPercent: 0, rotate: -3, duration: 1.4 }, 1)
      .to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1.2, stagger: .15 }, 1.1)
      .to('.hero__badge', { opacity: 1, duration: .6 }, 1.4)
      .fromTo('.hero__badge-core', { scale: 0, rotate: -120 }, { scale: 1, rotate: 0, duration: 1.4, ease: 'elastic.out(1,.55)' }, 1.4)
      .to('.hero__foot', { opacity: 1, duration: 1 }, 1.6);
  }

  /* ---------------------------------------------------------------------- *
   * Loader : la boîte se dessine, puis s'ouvre sur le hero
   * ---------------------------------------------------------------------- */
  function runLoader() {
    const loader = $('#loader');
    const finish = () => {
      if (loader) loader.style.display = 'none';
      root.classList.remove('is-loading');
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
    };
    if (!loader || reduce) { finish(); root.classList.add('intro-done'); return; }

    const num = $('#loadNum'), obj = { v: 0 };
    const strokes = $$('.loader__box rect, .loader__box path');
    strokes.forEach(el => { const L = el.getTotalLength ? el.getTotalLength() : 300; el.style.strokeDasharray = L; el.style.strokeDashoffset = L; });

    let exited = false;
    const loaded = new Promise(res => { document.readyState === 'complete' ? res() : addEventListener('load', res, { once: true }); });
    const exit = () => {
      if (exited) return; exited = true;
      const tl = gsap.timeline({ onComplete: finish });
      tl.to('.loader__center', { opacity: 0, y: -40, duration: .5, ease: 'power3.in' })
        .to('.loader__panel i', { scaleY: 1, duration: .75, ease: 'expo.inOut' }, '-=.2')
        .to('.loader__panel--t', { yPercent: -101, duration: 1.2, ease: 'expo.inOut' }, '+=.05')
        .to('.loader__panel--b', { yPercent: 101, duration: 1.2, ease: 'expo.inOut' }, '<')
        .add(playIntro, '<+=.45');
    };

    const tl = gsap.timeline({ onComplete: () => { Promise.race([loaded, new Promise(r => setTimeout(r, 3500))]).then(exit); } });
    tl.to(strokes, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut', stagger: .07 }, 0)
      .to(obj, { v: 100, duration: 2.1, ease: 'power2.inOut', onUpdate: () => { num.textContent = Math.round(obj.v); } }, 0)
      .fromTo('.loader__name', { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out' }, .25)
      .to('.lb-lid', { y: -14, rotate: -9, duration: .45, ease: 'back.out(2.4)' }, 1.7)
      .to('.lb-lid', { y: 0, rotate: 0, duration: .5, ease: 'bounce.out' }, 2.15);
    setTimeout(exit, 9000); // sécurité
  }

  /* ====================================================================== *
   * INITIALISATION
   * ====================================================================== */
  const nav = $('#nav');
  heroChars = split($('[data-hero-l1]'), 'chars');
  $$('[data-split]').forEach(el => { el._chars = split(el, 'chars'); });
  const manifestWords = split($('[data-words]'), 'words');

  initStatusAndHours();
  initMenu(lenis);
  initLightbox(lenis);
  initCursor();
  magnetic();
  sparkBursts();
  initMarquee();

  // ancres
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id === '#top') { e.preventDefault(); scrollToEl(0); return; }
    const t = id.length > 1 ? $(id) : null;
    if (!t) return;
    e.preventDefault();
    if (window.__closeMenu) window.__closeMenu();
    scrollToEl(t);
  }));
  // boutons « Réserver » des cartes + bons cadeaux
  document.addEventListener('click', e => {
    const b = e.target.closest ? e.target.closest('[data-book]') : null;
    if (!b) return;
    e.preventDefault();
    if (M.select) M.select(b.dataset.book);
    scrollToEl($('#reserver'));
  });
  window.addEventListener('melissa:scrollto', e => scrollToEl(e.detail, -90));
  let rt = null;
  document.addEventListener('melissa:layout', () => { clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 160); });

  // barre de progression + nav + bouton flottant
  gsap.to('.progress__bar', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .15 } });
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: self => {
      const y = self.scroll();
      nav.classList.toggle('is-solid', y > 60);
      if (y > 260 && self.direction === 1) nav.classList.add('is-hidden');
      else if (self.direction === -1 || y <= 260) nav.classList.remove('is-hidden');
    }
  });
  const fab = $('#fab');
  ScrollTrigger.create({ start: () => window.innerHeight * .75, end: 'max', onToggle: s => fab.classList.toggle('is-on', s.isActive) });

  /* ---- titres : lettres qui montent ------------------------------------ */
  $$('[data-split]').forEach(el => {
    if (reduce) return;
    gsap.from(el._chars, { yPercent: 118, duration: 1.2, ease: 'expo.out', stagger: .022, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  /* ---- hero : parallax multicouche ------------------------------------- */
  const sparks = makeSparks($('[data-sparks]'), window.innerWidth < 900 ? 10 : 24);
  if (!reduce) {
    const heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.hero__media', { yPercent: 16, ease: 'none', scrollTrigger: heroST });
    gsap.to('.hero__content', { yPercent: -16, opacity: .2, ease: 'none', scrollTrigger: heroST });
    gsap.to('.hero__brush', { yPercent: -10, ease: 'none', scrollTrigger: heroST });
    gsap.to('.hero__badge', { y: -120, ease: 'none', scrollTrigger: heroST });
    sparks.forEach(s => gsap.to(s, { y: -Number(s.dataset.depth) * 2.4, ease: 'none', scrollTrigger: heroST }));
    if (fine) {
      const hx = gsap.quickTo('[data-sparks]', 'x', { duration: 1.4, ease: 'power3' }), hy = gsap.quickTo('[data-sparks]', 'y', { duration: 1.4, ease: 'power3' });
      $('.hero').addEventListener('pointermove', e => { hx((e.clientX / innerWidth - .5) * -40); hy((e.clientY / innerHeight - .5) * -30); });
    }
  }

  /* ---- manifeste -------------------------------------------------------- */
  if (!reduce) {
    gsap.fromTo(manifestWords, { opacity: .13 }, { opacity: 1, ease: 'none', stagger: .12, scrollTrigger: { trigger: '[data-words]', start: 'top 78%', end: 'bottom 52%', scrub: true } });
    gsap.to('.inpill', { scaleX: 1, duration: 1.3, ease: 'expo.out', stagger: .25, scrollTrigger: { trigger: '[data-words]', start: 'top 72%', once: true } });
    gsap.from('[data-sticker]', { scale: 0, rotate: -120, duration: 1.4, ease: 'back.out(1.8)', scrollTrigger: { trigger: '.manifest__visuals', start: 'top 70%', once: true } });
    gsap.to('[data-sticker]', { y: -10, rotate: -6, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    $$('[data-circle-reveal]').forEach(el => {
      gsap.to(el, { clipPath: 'circle(78% at 50% 50%)', duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
    });
    $$('[data-parallax-img]').forEach(img => {
      gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* ---- sections avec matchMedia (desktop / mobile) ---------------------- */
  const mm = gsap.matchMedia();

  mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
    /* Rituel : section pinnée, 4 étapes pilotées par le scroll */
    const steps = $$('.step'), imgs = $$('.rimg'), dots = $$('.ritual__dots i'), numEl = $('#ritualNum');
    gsap.set(steps.slice(1), { autoAlpha: 0, y: 50 });
    gsap.set(steps[0], { autoAlpha: 1 });
    imgs.forEach((im, i) => { if (i) { gsap.set(im, { yPercent: 100 }); gsap.set($('.rimg__in', im), { yPercent: -100 }); } });

    let cur = 0;
    const setActive = a => {
      if (a === cur) return;
      cur = a;
      dots.forEach((d, i) => d.classList.toggle('is-on', i === a));
      numEl.textContent = String(a + 1).padStart(2, '0');
    };
    const marks = [0];
    let tl = null;
    tl = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      scrollTrigger: {
        trigger: '.ritual__pin', start: 'top top', end: '+=330%', pin: true, scrub: .7, anticipatePin: 1
      },
      onUpdate: () => { if (!tl) return; const t = tl.time(); let a = 0; marks.forEach((m, i) => { if (t >= m) a = i; }); setActive(a); }
    });
    tl.to({}, { duration: .5 });
    for (let i = 1; i < steps.length; i++) {
      const at = `s${i}`;
      tl.addLabel(at)
        .to(steps[i - 1], { autoAlpha: 0, y: -50, duration: .45, ease: 'power2.in' }, at)
        .fromTo(imgs[i], { yPercent: 100 }, { yPercent: 0, duration: .9 }, at)
        .fromTo($('.rimg__in', imgs[i]), { yPercent: -100 }, { yPercent: 0, duration: .9 }, at)
        .to($('.rimg__in', imgs[i - 1]), { yPercent: 22, duration: .9 }, at)
        .fromTo(steps[i], { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: .55, ease: 'power3.out' }, `${at}+=.4`)
        .to({}, { duration: .55 });
      marks.push(tl.labels[at] + .45);
    }
    $$('.step__fig').forEach(f => { f.style.display = 'none'; });
    return () => { $$('.step__fig').forEach(f => { f.style.display = ''; }); };
  });

  mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
    /* Prestations : défilement horizontal piloté par le scroll vertical */
    const track = $('[data-track]'), pin = $('.services__pin');
    const bar = $('[data-bar]'), count = $('[data-count]');
    const cards = $$('.svc');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: pin, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .6, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: self => {
          gsap.set(bar, { scaleX: self.progress });
          const i = Math.min(cards.length, Math.max(1, Math.round(self.progress * (cards.length - 1)) + 1));
          count.textContent = `${String(i).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
        }
      }
    });
    $$('[data-svc-img]').forEach(img => {
      gsap.fromTo(img, { xPercent: -7 }, { xPercent: 7, ease: 'none', scrollTrigger: { trigger: img.closest('.svc'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });
    if (fine) cards.forEach(c => tilt(c, 8, true));
  });

  mm.add('(max-width: 900px)', () => {
    /* Mobile : cartes en carrousel natif, entrées simples */
    if (reduce) return;
    gsap.from('.svc', { y: 40, opacity: 0, duration: 1, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '.services__track', start: 'top 85%', once: true } });
  });

  /* ---- chiffres --------------------------------------------------------- */
  const stats = $$('[data-count-to]');
  const fmt = (v, d) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  stats.forEach(el => {
    const to = Number(el.dataset.countTo), d = Number(el.dataset.decimals || 0), suf = el.dataset.suffix || '';
    if (reduce) { el.textContent = fmt(to, d) + suf; return; }
    const o = { v: 0 };
    gsap.to(o, { v: to, duration: 2.4, ease: 'power2.out', onUpdate: () => { el.textContent = fmt(o.v, d) + suf; }, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });
  if (!reduce) {
    gsap.from('.stat', { y: 70, opacity: 0, duration: 1.3, stagger: .15, ease: 'expo.out', scrollTrigger: { trigger: '.stats__grid', start: 'top 82%', once: true } });
    makeSparks($('[data-sparks="stats"]'), window.innerWidth < 900 ? 8 : 18);
  }

  /* ---- avis ------------------------------------------------------------- */
  initReviews(!reduce);
  if (!reduce) gsap.from('.rev', { y: 60, opacity: 0, duration: 1.2, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '#revViewport', start: 'top 85%', once: true } });

  /* ---- galerie ---------------------------------------------------------- */
  const tiles = $$('.tile');
  if (!reduce) {
    tiles.forEach((t, i) => {
      gsap.from(t, { y: 90, opacity: 0, duration: 1.3, ease: 'expo.out', delay: (i % 4) * .08, scrollTrigger: { trigger: t, start: 'top 92%', once: true } });
      gsap.fromTo($('[data-tile-img]', t), { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: t, start: 'top bottom', end: 'bottom top', scrub: true } });
      if (fine) tilt(t, 5, false);
    });
  }

  /* ---- boutique --------------------------------------------------------- */
  if (!reduce) {
    const card = $('.giftcard');
    gsap.fromTo(card, { y: 90, rotate: -14, opacity: 0 }, { y: 0, rotate: -4, opacity: 1, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: card, start: 'top 85%', once: true } });
    gsap.fromTo('.giftcard__shine', { xPercent: -130 }, { xPercent: 130, duration: 1.9, ease: 'power2.inOut', repeat: -1, repeatDelay: 2.8 });
    if (fine) {
      card.addEventListener('pointerenter', () => gsap.to(card, { rotate: -1, scale: 1.04, duration: .9, ease: 'expo.out' }));
      card.addEventListener('pointerleave', () => gsap.to(card, { rotate: -4, scale: 1, duration: .9, ease: 'expo.out' }));
    }
    gsap.from('.item', { x: 70, opacity: 0, duration: 1.2, stagger: .14, ease: 'expo.out', scrollTrigger: { trigger: '.shop__items', start: 'top 88%', once: true } });
    if (window.innerWidth > 900) $$('.item').forEach((it, i) => gsap.to(it, { y: -6, duration: 2.4 + i * .35, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
    gsap.from('.shop__cta .btn', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.shop__cta', start: 'top 92%', once: true } });
  }

  /* ---- réservation + contact ------------------------------------------- */
  if (!reduce) {
    gsap.from('.wizard', { y: 80, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.wizard', start: 'top 88%', once: true } });
    gsap.from('.ticks li', { x: -30, opacity: 0, duration: 1, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '.ticks', start: 'top 88%', once: true } });
    gsap.from('.find__addr a', { y: 30, opacity: 0, duration: 1, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: '.find__addr', start: 'top 88%', once: true } });
    gsap.from('.hours', { y: 50, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.hours', start: 'top 92%', once: true } });
  }

  /* ---- footer ----------------------------------------------------------- */
  const mega = split($('[data-mega]'), 'chars');
  if (!reduce) {
    gsap.from(mega, { yPercent: 115, duration: 1.4, ease: 'expo.out', stagger: .035, scrollTrigger: { trigger: '.footer', start: 'top 80%', once: true } });
    gsap.from('.footer__cols > div', { y: 40, opacity: 0, duration: 1, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: '.footer__cols', start: 'top 92%', once: true } });
  }

  /* ---- démarrage -------------------------------------------------------- */
  runLoader();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 250); });
})();
