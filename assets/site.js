/* Gurkha Labs — site motion. Vanilla JS, no dependencies.
 * Hero: painted Venice sunrise (video when present), GL flag on the summit, drifting snow, rotating headline word
 * Ascent climb, case-study gallery, agent-fleet animation + terminal, Engage/service card loops
 * Count-ups, split-line headings, reveals, card tilt, magnetic CTAs, cursor spotlight, KTM clock,
 * reading progress, active nav, mobile booking dock, brief form → mailto.
 * Everything respects prefers-reduced-motion and pauses off-screen.
 */
(() => {
  'use strict';
  window.__gl = 1;

  // ── config ────────────────────────────────────────────────────────────
  // Paste a Cal.com / Calendly link here and every "Book a call" button uses it.
  const BOOKING_URL = '';
  const EMAIL = 'contact@gurkhalabs.com';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const track = (name, params) => { try { window.gtag && gtag('event', name, params || {}); } catch (_) {} };

  // ── nav ───────────────────────────────────────────────────────────────
  const nav = $('#nav');
  const menuBtn = $('.menu-btn');
  if (nav && menuBtn) {
    const onScroll = () => nav.classList.toggle('scrolled', scrollY > 24);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    menuBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    $$('#nav-links a').forEach((a) => a.addEventListener('click', () => { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }));
  }

  // ── reading progress, active nav link, mobile dock ───────────────────
  const progress = $('#progress'), dock = $('#dock');
  const navMap = new Map($$('#nav-links a[href^="#"]').map((a) => [a.getAttribute('href').slice(1), a]));
  const spySections = [...navMap.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  let pTick = false;
  const onPage = () => {
    pTick = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.setProperty('--sp', (max > 0 ? scrollY / max : 0).toFixed(4));
    let cur = null;
    for (const sec of spySections) if (sec.getBoundingClientRect().top < innerHeight * 0.4) cur = sec.id;
    navMap.forEach((a, id) => a.classList.toggle('active', id === cur));
    if (dock) {
      const contact = document.getElementById('contact');
      const nearContact = contact && contact.getBoundingClientRect().top < innerHeight;
      dock.classList.toggle('show', scrollY > innerHeight * 0.9 && !nearContact);
    }
  };
  addEventListener('scroll', () => { if (!pTick) { pTick = true; requestAnimationFrame(onPage); } }, { passive: true });
  onPage();

  // ── booking links ─────────────────────────────────────────────────────
  $$('[data-book]').forEach((a) => {
    if (BOOKING_URL) { a.href = BOOKING_URL; a.target = '_blank'; a.rel = 'noopener'; }
    a.addEventListener('click', () => track('book_call_click', { location: a.closest('section,header')?.id || 'nav' }));
  });

  // ── package → form prefill ────────────────────────────────────────────
  $$('[data-type]').forEach((a) => a.addEventListener('click', () => {
    const sel = $('#brief select[name="type"]');
    if (sel) sel.value = a.dataset.type;
    track('package_click', { package: a.dataset.type });
  }));

  // ── brief form → mailto ───────────────────────────────────────────────
  const form = $('#brief');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const email = String(f.get('email') || '');
    if (!f.get('name') || !/^\S+@\S+\.\S+$/.test(email)) {
      (!f.get('name') ? form.name : form.email).focus();
      form.querySelector('small').textContent = 'Please add your name and a valid email.';
      return;
    }
    const subject = `Project brief — ${f.get('type')}`;
    const body = [
      `Name: ${f.get('name')}`, `Email: ${email}`, `Project: ${f.get('type')}`,
      `Budget: ${f.get('budget')}`, `Timeline: ${f.get('timeline')}`, '', String(f.get('message') || ''),
    ].join('\n');
    track('brief_submit', { type: f.get('type'), budget: f.get('budget') });
    location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  // ── split-line headings ───────────────────────────────────────────────
  $$('[data-split]').forEach((el) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/([ \t\n\r]+)/).forEach((part) => {
            if (!part) return;
            if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const s = document.createElement('span'); s.textContent = part; s.style.setProperty('--i', i++);
            w.appendChild(s); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el);
    $$('.w', el).forEach((w) => w.setAttribute('aria-hidden', 'true'));
  });

  // ── intro curtain ─────────────────────────────────────────────────────
  const intro = $('#intro');
  if (intro) intro.addEventListener('animationend', (e) => { if (e.animationName === 'intro-out') intro.classList.add('done'); });

  // ── Kathmandu clock (nav + band) ──────────────────────────────────────
  // Studio hours are an assumption: Sun–Fri 09:00–19:00 NPT.
  const navClock = $('#nav-clock'), ktmTime = $('#ktm-time'), ktmStatus = $('#ktm-status');
  let ktmFmt = null;
  const tick = () => {
    ktmFmt = ktmFmt || new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false });
    const parts = Object.fromEntries(ktmFmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
    const hm = `${parts.hour}:${parts.minute}`, h = Number(parts.hour);
    const open = parts.weekday !== 'Sat' && h >= 9 && h < 19;
    if (navClock) { navClock.querySelector('b').textContent = hm; navClock.classList.toggle('after', !open); }
    if (ktmTime) ktmTime.textContent = hm;
    if (ktmStatus) ktmStatus.textContent = open ? '● studio open now' : '● after hours · reply < 24h';
  };
  const startClock = () => { tick(); setInterval(tick, 20000); };
  if ('requestIdleCallback' in window) requestIdleCallback(startClock, { timeout: 1500 }); else setTimeout(startClock, 300);

  // ── cursor spotlight on the dark bands ────────────────────────────────
  if (fine && !reduce) {
    $$('.spot').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--sx', `${e.clientX - r.left}px`); el.style.setProperty('--sy', `${e.clientY - r.top}px`);
        el.classList.add('lit');
      });
      el.addEventListener('pointerleave', () => el.classList.remove('lit'));
    });
  }

  // ── reveals + count-up ────────────────────────────────────────────────
  const countUp = (el) => {
    const to = Number(el.dataset.count);
    if (reduce) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 1400;
    const step = (t) => {
      const p = clamp((t - t0) / dur, 0, 1);
      el.textContent = Math.round(to * (1 - Math.pow(2, -10 * p)));
      if (p < 1) requestAnimationFrame(step); else el.textContent = to;
    };
    el.textContent = 0;
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      $$('[data-count]', e.target).forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal], [data-split]').forEach((el) => io.observe(el));
  // hero heading animates immediately
  requestAnimationFrame(() => $$('.hero [data-split], .hero [data-reveal]').forEach((el) => el.classList.add('in')));

  // ── magnetic CTAs + card tilt (desktop pointer only) ──────────────────
  if (fine && !reduce) {
    $$('[data-magnetic]').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--mx', `${((e.clientX - r.left) / r.width - 0.5) * 10}px`);
        b.style.setProperty('--my', `${((e.clientY - r.top) / r.height - 0.5) * 8}px`);
      });
      b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
    });
    $$('[data-tilt]').forEach((c) => {
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        c.style.setProperty('--ry', `${x * 5}deg`); c.style.setProperty('--rx', `${-y * 4}deg`);
        c.style.setProperty('--px', `${-x * 14}px`); c.style.setProperty('--py', `${-y * 10}px`);
      });
      c.addEventListener('pointerleave', () => ['--rx', '--ry'].forEach((k) => c.style.setProperty(k, '0deg')) || ['--px', '--py'].forEach((k) => c.style.setProperty(k, '0px')));
    });
  }

  // ── ascent: the climb from base camp to the summit ──────────────────
  const ascent = $('#ascent');
  if (ascent) {
    const NS = 'http://www.w3.org/2000/svg';
    const pin = $('.ascent-pin', ascent);
    const trail = $('#trail', ascent);
    const climber = $('#climber', ascent);
    const marks = $('#camp-marks', ascent);
    const camps = $$('.camp', ascent);
    const altNum = $('#alt-num'), altBar = $('#alt-bar');
    const len = trail.getTotalLength();
    const stops = camps.map((c) => ({ at: Number(c.dataset.at), alt: Number(c.dataset.alt) }));
    trail.style.strokeDasharray = `${len}`;
    // camp markers on the trail
    const LABELS = ['base camp', 'camp II', 'camp IV', 'summit'];
    const markEls = stops.map((s, i) => {
      const pt = trail.getPointAtLength(s.at * len);
      const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'camp-mark');
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', i === stops.length - 1 ? 7 : 6);
      const t = document.createElementNS(NS, 'text'); t.textContent = LABELS[i];
      const right = i % 2 === 0; t.setAttribute('x', pt.x + (right ? 14 : -14)); t.setAttribute('y', pt.y + 4); t.setAttribute('text-anchor', right ? 'start' : 'end');
      if (i === stops.length - 1) { t.setAttribute('x', pt.x + 14); t.setAttribute('y', pt.y - 8); t.setAttribute('text-anchor', 'start'); }
      g.append(c, t); marks.appendChild(g); return g;
    });
    const altAt = (p) => {
      for (let i = 1; i < stops.length; i++) if (p <= stops[i].at) {
        const a = stops[i - 1], b = stops[i], k = (p - a.at) / (b.at - a.at || 1);
        return a.alt + (b.alt - a.alt) * k;
      }
      return stops[stops.length - 1].alt;
    };
    const fmt = (n) => Math.round(n).toLocaleString('en-US');
    let ticking = false;
    const climb = () => {
      ticking = false;
      const pinned = !reduce && getComputedStyle(pin).position === 'sticky';
      let p = 1;
      if (pinned) { const r = ascent.getBoundingClientRect(); p = clamp(-r.top / (r.height - innerHeight), 0, 1); }
      trail.style.strokeDashoffset = `${len * (1 - p)}`;
      const pt = trail.getPointAtLength(p * len);
      climber.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
      altNum.textContent = fmt(altAt(p));
      altBar.style.setProperty('--p', ((altAt(p) - 5364) / (8849 - 5364)).toFixed(4));
      let cur = 0;
      stops.forEach((s, i) => { const on = p >= s.at - (i === stops.length - 1 ? 0.03 : 0.001); if (on) cur = i; camps[i].classList.toggle('on', on); markEls[i].classList.toggle('on', on); });
      camps.forEach((c, i) => c.classList.toggle('current', i === cur));
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(climb); } }, { passive: true });
    addEventListener('resize', climb);
    climb();
  }

  // ── case deck: each scroll step swaps to the next case (desktop); tabs jump ──
  const gallery = $('#gallery');
  if (gallery) {
    const gpin = $('.gallery-pin', gallery), count = $('#gallery-count'), bar = $('#gallery-progress');
    const cards = $$('.case', gallery), tabs = $$('.case-tab', gallery);
    const n = cards.length, STEP = 0.75; // viewport heights of scroll per case
    let cur = -1, ticking = false;
    const pinned = () => getComputedStyle(gpin).position === 'sticky';
    const show = (i) => {
      if (i === cur) return; cur = i;
      cards.forEach((c, k) => {
        c.classList.toggle('is-active', k === i); c.classList.toggle('is-past', k < i); c.classList.toggle('is-next', k === i + 1);
        c.setAttribute('aria-hidden', String(k !== i));
      });
      tabs.forEach((t, k) => { t.classList.toggle('is-active', k === i); t.setAttribute('aria-selected', String(k === i)); });
      count.textContent = `0${i + 1} / 0${n}`;
      bar.style.setProperty('--p', ((i + 1) / n).toFixed(3));
    };
    const measure = () => {
      if (!pinned()) { gallery.style.height = ''; cards.forEach((c) => { c.classList.remove('is-past', 'is-next'); c.removeAttribute('aria-hidden'); }); return; }
      gallery.style.height = `${innerHeight * (1 + STEP * (n - 1))}px`;
      cur = -1; update();
    };
    const update = () => {
      ticking = false;
      if (!pinned()) return;
      const r = gallery.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 0.9999);
      show(Math.floor(p * n));
    };
    tabs.forEach((t, i) => t.addEventListener('click', () => {
      if (!pinned()) { cards[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); return; }
      const top = gallery.getBoundingClientRect().top + scrollY + (gallery.offsetHeight - innerHeight) * ((i + 0.5) / n);
      scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    }));
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', measure);
    measure(); show(0);
  }

  // ── hero rotating word: shows the range without blurring the promise ──
  const rotator = $('#rotator');
  if (rotator) {
    const words = $$('.rot-word', rotator);
    let i = 0;
    const fit = () => { rotator.style.width = `${words[i].offsetWidth}px`; };
    fit();
    addEventListener('resize', fit);
    if (document.fonts) document.fonts.ready.then(fit);
    // start on the first interaction: keeps the first paint stable (and LCP honest)
    let started = false;
    const begin = () => {
      if (started) return; started = true;
      ['pointermove', 'touchstart', 'scroll', 'keydown', 'wheel'].forEach((ev) => removeEventListener(ev, begin));
      setInterval(() => {
        if (document.hidden || scrollY > innerHeight) return;
        const prev = words[i];
        i = (i + 1) % words.length;
        prev.classList.remove('is-on'); prev.classList.add('is-out');
        words[i].classList.remove('is-out'); words[i].classList.add('is-on');
        fit();
        setTimeout(() => prev.classList.remove('is-out'), 650);
      }, 2400);
    };
    if (!reduce && words.length > 1) ['pointermove', 'touchstart', 'scroll', 'keydown', 'wheel'].forEach((ev) => addEventListener(ev, begin, { passive: true }));
  }

  // ── cinematic hero: summit placement + scroll parallax ────────────────
  const hero = $('#top');
  const scene = $('#hero-scene');
  const summitEl = $('#summit');
  const skyEl = $('#sky');
  // the peak in the painted sky (assets/art/hero-sky.webp, 2752×1536, cover + center bottom)
  const PEAK = { x: 0.571, y: 0.648, w: 2752, h: 1536 };
  const placeSummit = () => {
    if (!hero || !skyEl || !summitEl) return;
    const W = skyEl.clientWidth, H = skyEl.clientHeight;
    const k = Math.max(W / PEAK.w, H / PEAK.h);
    const x = (W - PEAK.w * k) / 2 + PEAK.x * PEAK.w * k, y = H - PEAK.h * k + PEAK.y * PEAK.h * k;
    summitEl.style.left = `${x}px`;
    summitEl.style.top = `${y}px`;
    skyEl.style.transformOrigin = `${x}px ${y}px`;
  };
  placeSummit();
  addEventListener('resize', placeSummit);

  if (hero && scene && !reduce) {
    const layers = $$('.layer', scene).map((el) => ({ el, d: Number(el.dataset.depth || 0) }));
    const copy = $('#hero-copy');
    let ticking = false;
    const parallax = () => {
      ticking = false;
      const H = hero.clientHeight, s = Math.min(scrollY, H);
      if (scrollY > H * 1.2) return;
      const p = s / H;
      layers.forEach(({ el, d }) => {
        const zoom = el === skyEl ? ` scale(${1 + p * 0.08})` : '';
        el.style.transform = `translate3d(0, ${(s * d).toFixed(1)}px, 0)${zoom}`;
      });
      if (summitEl) summitEl.style.transform = `translate3d(0, ${(s * 0.35).toFixed(1)}px, 0) scale(${1 + p * 0.12})`;
      if (copy) { copy.style.transform = `translate3d(0, ${(-s * 0.18).toFixed(1)}px, 0)`; copy.style.opacity = String(Math.max(0, 1 - p * 1.5)); }
      const hudEl = $('#hud'); if (hudEl) { hudEl.style.transform = `translate3d(0, ${(-s * 0.1).toFixed(1)}px, 0)`; hudEl.style.opacity = String(Math.max(0, 1 - p * 1.6)); }
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(parallax); } }, { passive: true });
    parallax();
  }

  // painted sunrise (Venice): plays once and holds on the sun behind the summit; only when #sky-video has data-src, on wide screens, never on save-data / reduced motion
  const skyVideo = $('#sky-video');
  if (skyVideo && skyVideo.dataset.src && !reduce && innerWidth > 700 && !(navigator.connection && navigator.connection.saveData)) {
    const base = skyVideo.dataset.src;
    const go = () => {
      skyVideo.innerHTML = `<source src="${base}.webm" type="video/webm"><source src="${base}.mp4" type="video/mp4">`;
      skyVideo.hidden = false; skyVideo.load();
      skyVideo.addEventListener('playing', () => skyVideo.classList.add('ready'), { once: true });
      skyVideo.play().catch(() => { skyVideo.hidden = true; });
      // after the sunrise, keep the flags fluttering: a seamless ping-pong of the last seconds
      const loopV = $('#sky-loop');
      if (loopV && loopV.dataset.src) {
        const lb = loopV.dataset.src;
        skyVideo.addEventListener('timeupdate', function prime() {
          if (skyVideo.currentTime < 4.5) return;
          skyVideo.removeEventListener('timeupdate', prime);
          loopV.innerHTML = `<source src="${lb}.webm" type="video/webm"><source src="${lb}.mp4" type="video/mp4">`;
          loopV.preload = 'auto'; loopV.hidden = false; loopV.load();
        });
        skyVideo.addEventListener('ended', () => {
          loopV.play().then(() => { loopV.classList.add('ready'); }).catch(() => {});
        });
        // pause the loop when the hero is off-screen
        new IntersectionObserver(([e]) => { if (!loopV.classList.contains('ready')) return; e.isIntersecting ? loopV.play().catch(() => {}) : loopV.pause(); }).observe(loopV);
      }
    };
    if (document.readyState === 'complete') setTimeout(go, 600); else addEventListener('load', () => setTimeout(go, 600), { once: true });
  }

  // ── engage card loops (Venice) — only when the files exist, only on screen ──
  if (!reduce) {
    $$('.pkg-art video[data-loop]').forEach((v) => {
      const base = v.dataset.loop;
      let loaded = false;
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          if (!loaded) {
            loaded = true;
            v.innerHTML = `<source src="${base}.webm" type="video/webm"><source src="${base}.mp4" type="video/mp4">`;
            v.hidden = false; v.load();
            v.addEventListener('playing', () => v.classList.add('ready'), { once: true });
            v.play().catch(() => {});
          } else if (!v.hidden) v.play().catch(() => {});
        } else if (!v.hidden) v.pause();
      }, { threshold: 0.3 }).observe(v.parentElement);
    });
  }

  // ── tech layer: terminal line, ops HUD, commit strip, blueprint cross-fade ──
  const termLine = $('#term-line');
  if (termLine && !reduce) {
    const cmd = $('.t-cmd', termLine), full = cmd.textContent;
    termLine.classList.add('typing'); cmd.textContent = '$ ';
    let k = 2;
    const typeNext = () => {
      cmd.textContent = full.slice(0, ++k);
      if (k < full.length) setTimeout(typeNext, 38 + Math.random() * 40);
      else setTimeout(() => termLine.classList.remove('typing'), 350);
    };
    setTimeout(typeNext, 700);
  }

  const hud = $('#hud');
  if (hud) {
    const dep = $('#hud-deploys'), p95 = $('#hud-p95'), agents = $('#hud-agents'), spark = $('#hud-spark'), hudTime = $('#hud-time');
    const pts = Array.from({ length: 24 }, () => 34 + Math.random() * 14);
    const draw = () => spark.setAttribute('points', pts.map((v, i) => `${(i / (pts.length - 1)) * 120},${26 - ((v - 30) / 22) * 24}`).join(' '));
    const bump = (el) => { el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 900); };
    // deploys "today" scale with the Kathmandu clock so the number feels plausible
    const hourKTM = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kathmandu', hour: '2-digit', hour12: false }).format(new Date()));
    let deploys = Math.max(3, Math.round(hourKTM() * 0.9));
    dep.textContent = deploys; draw();
    const tickHud = () => {
      if (document.hidden || scrollY > innerHeight) return;
      const v = 36 + Math.random() * 10; pts.shift(); pts.push(v); draw();
      p95.textContent = Math.round(v);
      if (Math.random() < 0.18) { deploys++; dep.textContent = deploys; bump(dep); }
      if (Math.random() < 0.12) { agents.textContent = 17 + Math.floor(Math.random() * 5); bump(agents); }
      if (hudTime) hudTime.textContent = 'KTM ' + new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kathmandu', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    };
    tickHud();
    if (!reduce) setInterval(tickHud, 1600);
  }

  const commitTrack = $('#commit-track');
  if (commitTrack) {
    const commits = [
      ['a41f2c', 'feat(api): stripe webhooks · 8 events', '✓'], ['9be013', 'fix(ios): offline sync on flaky 3G', '✓'],
      ['c7d22e', 'perf(db): p95 41ms on /v1/portfolio', '✓'], ['e1a90b', 'feat(ai): RAG over compliance docs', '✓'],
      ['5f3c71', 'ci: deploy #482 → production', '✓'], ['0d8e44', 'test: 38 new cases · coverage 94.2%', '✓'],
      ['b62f19', 'feat(web): onboarding stepper v2', '✓'], ['71aa03', 'sec: SOC2 audit log export', '✓'],
      ['3c9d5e', 'feat(chain): +3 exchange integrations', '✓'], ['f04b8a', 'chore: infra as code · AWS CDK', '✓'],
    ];
    const html = commits.map(([h, m, ok]) => `<span><b>${h}</b>${m}<i>${ok}</i></span>`).join('');
    commitTrack.innerHTML = html + html;
  }

  const bp = $('#blueprint');
  if (bp && bp.dataset.src && !reduce) {
    const wide = matchMedia('(min-width: 1100px), (min-resolution: 2dppx) and (min-width: 700px)').matches;
    const img = new Image();
    img.alt = ''; img.decoding = 'async';
    img.src = `${bp.dataset.src}${wide ? '' : '-1280'}.webp`;
    const heroEl = $('#top');
    const arm = () => {
      bp.appendChild(img);
      let t = false;
      const fade = () => {
        t = false;
        const p = clamp(scrollY / (heroEl.offsetHeight * 0.7), 0, 1);
        bp.style.opacity = clamp((p - 0.1) / 0.6, 0, 1).toFixed(3);
      };
      addEventListener('scroll', () => { if (!t) { t = true; requestAnimationFrame(fade); } }, { passive: true });
      fade();
    };
    // decode off the main thread before it can ever be shown, so the cross-fade never stutters
    const go = () => (img.decode ? img.decode() : Promise.resolve()).then(arm).catch(() => {});
    if (document.readyState === 'complete') setTimeout(go, 800); else addEventListener('load', () => setTimeout(go, 800), { once: true });
  }

  // ── pause the hero's expensive layers (videos, snow) once it's mostly scrolled past ──
  const heroTop = $('#top');
  if (heroTop) {
    let away = false, tk = false;
    const check = () => {
      tk = false;
      const nowAway = scrollY > heroTop.offsetHeight * 0.75;
      if (nowAway === away) return;
      away = nowAway;
      $$('#sky-video, #sky-loop').forEach((v) => {
        if (!v.classList.contains('ready')) return;
        if (away) v.pause(); else if (v.id === 'sky-loop' || !v.ended) v.play().catch(() => {});
      });
      document.dispatchEvent(new CustomEvent(away ? 'hero:away' : 'hero:back'));
    };
    addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(check); } }, { passive: true });
  }

  // ── light snow drifting across the painted hero (replaces the old contour overlay) ──
  const snow = $('#snow');
  if (snow && !reduce) {
    const ctx = snow.getContext('2d');
    let W = 0, H = 0, flakes = [], raf = 0, on = false, last = 0;
    const N = () => Math.round(Math.min(90, (W * H) / 16000));
    const make = (y) => ({ x: Math.random() * W, y: y ?? Math.random() * H, r: 0.6 + Math.random() * 1.9, s: 8 + Math.random() * 22, w: 14 + Math.random() * 30, ph: Math.random() * 6.28, a: 0.35 + Math.random() * 0.5 });
    const size = () => {
      const r = snow.getBoundingClientRect(), dpr = Math.min(1.5, devicePixelRatio || 1);
      W = r.width; H = r.height; snow.width = W * dpr; snow.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      flakes = Array.from({ length: N() }, () => make());
    };
    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 33) return;
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      ctx.clearRect(0, 0, W, H);
      for (const f of flakes) {
        f.y += f.s * dt; f.x += (f.w + Math.sin(t / 900 + f.ph) * 10) * dt;
        if (f.y > H + 4 || f.x > W + 4) Object.assign(f, make(-4), { x: Math.random() * W * 0.9 - W * 0.1 });
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283);
        ctx.fillStyle = `rgba(255,255,255,${f.a})`; ctx.fill();
        ctx.lineWidth = 0.6; ctx.strokeStyle = `rgba(12,37,58,${f.a * 0.18})`; ctx.stroke();
      }
    };
    const start = () => { if (!on) { on = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { on = false; cancelAnimationFrame(raf); };
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 150); });
    const watch = () => { size(); new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop())).observe(snow); };
    if (document.readyState === 'complete') setTimeout(watch, 400); else addEventListener('load', () => setTimeout(watch, 400), { once: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    document.addEventListener('hero:away', stop);
    document.addEventListener('hero:back', start);
  }

  // ── agent fleet ───────────────────────────────────────────────────────
  const fleet = $('#fleet');
  const term = $('#term');
  if (fleet && term) {
    const NS = 'http://www.w3.org/2000/svg';
    const top = $$('#lanes-top path', fleet), bot = $$('#lanes-bot path', fleet);
    const agents = $$('#agents .agent', fleet);
    const mainNode = $('#main-node', fleet), mainText = $('#main-text', fleet);
    const layer = $('#packets', fleet);
    const LANE = { frontend: 0, backend: 1, qa: 2, devops: 3, review: 4 };
    let pr = 483;
    const script = () => [
      ['cmd', `gurkha run fleet --task "feat: onboarding v2"`],
      ['frontend', 'Scaffolded OnboardingStepper.tsx · 3 components'],
      ['backend', 'Added /v1/onboarding endpoints · zod-validated'],
      ['qa', 'Generated 38 unit tests · coverage 94.2%'],
      ['backend', 'Wired Stripe webhook handler · 8 events'],
      ['devops', 'Preview deploy ready · p95 41ms'],
      ['frontend', 'Accessibility pass · 0 axe violations'],
      ['review', `Opened PR #${pr} · 2 comments resolved`],
      ['review', 'Human review approved · 0 blocking'],
      ['ok', `✓ PR #${pr} merged to main · deployed`],
    ];
    const clock = (() => { let s = 9 * 3600 + 2 * 60 + 20; return () => { s += 3 + Math.floor(Math.random() * 9); const h = String(Math.floor(s / 3600) % 24).padStart(2, '0'), m = String(Math.floor(s / 60) % 60).padStart(2, '0'), x = String(s % 60).padStart(2, '0'); return `${h}:${m}:${x}`; }; })();

    const fly = (path, dur, cls = 'packet') => new Promise((res) => {
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '4'); c.setAttribute('class', cls); layer.appendChild(c);
      const len = path.getTotalLength(), t0 = performance.now();
      const step = (now) => {
        const k = clamp((now - t0) / dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const pt = path.getPointAtLength(e * len); c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y);
        if (k < 1) requestAnimationFrame(step); else { c.remove(); res(); }
      };
      requestAnimationFrame(step);
    });

    const addLine = (kind, text, typed) => {
      const ln = document.createElement('div');
      ln.className = 'ln' + (kind === 'cmd' ? ' cmd' : kind === 'ok' ? ' ok' : '');
      if (kind !== 'cmd' && kind !== 'ok') ln.innerHTML = `<span class="t">${clock()}</span><span class="who">${kind}</span>`;
      const span = document.createElement('span'); ln.appendChild(span);
      term.appendChild(ln);
      while (term.children.length > 11) term.firstElementChild.remove();
      if (!typed) { span.textContent = text; return Promise.resolve(); }
      return new Promise((res) => {
        let i = 0;
        const tick = () => { span.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(tick, 14 + Math.random() * 18); else res(); };
        tick();
      });
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    let visible = false, looping = false;
    const run = async () => {
      if (looping) return; looping = true;
      while (visible) {
        for (const [kind, text] of script()) {
          if (!visible) break;
          if (kind === 'cmd') { await addLine(kind, text, true); await wait(500); continue; }
          if (kind === 'ok') {
            mainNode.classList.add('flash'); mainText.textContent = `PR #${pr} merged ✓`;
            await addLine(kind, text, false);
            await wait(2200); mainNode.classList.remove('flash'); mainText.textContent = 'main · all checks green';
            continue;
          }
          const li = LANE[kind];
          top[li].classList.add('hot');
          await fly(top[li], 650);
          top[li].classList.remove('hot');
          agents[li].classList.add('hot');
          await addLine(kind, text, true);
          bot[li].classList.add('hot');
          await fly(bot[li], 650);
          bot[li].classList.remove('hot'); agents[li].classList.remove('hot');
          await wait(180);
        }
        pr++;
        await wait(900);
      }
      looping = false;
    };
    if (!reduce) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) run(); }, { threshold: 0.25 }).observe(fleet);
    }
  }

  // ── a hello for the curious who open devtools ─────────────────────────
  try {
    console.log(
      '%c GL %c Gurkha Labs \n%cYou opened devtools, so you\'re our kind of person.\nNo framework, no build step: hand-written HTML, CSS and ~30KB of vanilla JS.\nBuilding something hard? contact@gurkhalabs.com',
      'background:#c55818;color:#fff;font-weight:700;padding:4px 6px;border-radius:4px',
      'color:#0c253a;font-weight:700;font-size:14px',
      'color:#4d6479;line-height:1.6'
    );
  } catch (_) {}
})();
