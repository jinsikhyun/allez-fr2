'use strict';
(() => {
  // ================================================================ utils
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const app = $('#app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rand(a.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hasHangul = (s) => /[가-힣]/.test(s || '');
  const BLANK = /_{3,}/;

  let DAY_OFFSET = 0; // 디버그 전용: 날짜 앞당기기
  function today(d = new Date(Date.now() + DAY_OFFSET * 86400000)) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function addDays(s, n) { const [y, m, d] = s.split('-').map(Number); return today(new Date(y, m - 1, d + n)); }
  function daysBetween(a, b) {
    const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
    return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
  }
  const shortDate = (s) => { const [, m, d] = s.split('-').map(Number); return `${m}/${d}`; };

  // 채점용 정규화: 대소문자·공백·끝 문장부호·아포스트로피 종류 무시, 악센트는 유지
  const norm = (s) => String(s ?? '').normalize('NFC')
    .replace(/[’‘`´]/g, "'").replace(/[«»"“”]/g, '')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae')
    .toLowerCase()
    .replace(/\s+([?!.,;:])/g, '$1').replace(/\s*-\s*/g, '-').replace(/\s*'\s*/g, "'")
    .replace(/\s+/g, ' ').trim().replace(/[.?!…]+$/, '').trim();
  const deaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const blocksOf = (s) => s.replace(/\s*[.?!]+\s*$/, '').split(/\s+/).filter(Boolean);
  const fill = (q, a) => q.replace(BLANK, a);

  const VOWEL = /^[aeiouyàâäéèêëîïôöûùüœæh]/i;
  const PERSONS = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];
  const PLABEL = { je: 'je', tu: 'tu', il: 'il/elle', nous: 'nous', vous: 'vous', ils: 'ils/elles' };
  const subjFor = (p, form) => p === 'je' ? (VOWEL.test(form) ? "j'" : 'je') : p === 'il' ? pick(['il', 'elle', 'on']) : p === 'ils' ? pick(['ils', 'elles']) : p;
  const joinSubj = (subj, form) => subj.endsWith("'") ? subj + form : `${subj} ${form}`;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ================================================================ state
  const KEY = 'allez.state.v1';
  const fresh = () => ({
    v: 1, created: today(), cards: {}, xp: 0,
    streak: { n: 0, last: null, best: 0 }, days: {},
    settings: { sound: true, rate: 0.9, goal: 2, theme: 'auto' },
    seenLessons: null, lastVersion: null,
    stats: { sessions: 0, answers: 0, correct: 0, bestCombo: 0 },
    sk: {}, // 스킬별 { n, ok, h: 최근 결과 '1'/'0'/'h' 문자열 }
    kd: {}, // 문제 형태별 { n, ok }
    sens: {}, // 레슨별 감도 'fast' | 'normal' | 'thorough' (없으면 자동)
    sensAt: 0,
    device: null, // 이 기기 id (동기화용, 기기마다 다름)
    sync: null, // { code, at, err } — 기기마다 따로
    ledgers: {}, // 다른 기기들의 장부 (동기화로 받아옴)
    vb: { ed: {}, del: {}, kn: {} }, // 동사장에서 바꾼 것 (추가·수정·삭제·외웠어요)
    fold: {}, // 홈에서 접어 둔 유닛 { 유닛id: true/false } (없으면 마지막 유닛만 펼침)
    wk: {}, // 약점 노트 { 카드id: { at, cat, n, part, tag, q, heard, given, ans } | { at, done: true } }
    exams: [], // 실전 연습 기록 [{ at, units, n, ok, parts }]
    srs: 2, // 카드 상태 형식 버전 (2 = 졸업 시스템)
  });
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const f = fresh();
        const out = { ...f, ...s, settings: { ...f.settings, ...s.settings }, streak: { ...f.streak, ...s.streak }, stats: { ...f.stats, ...s.stats }, sk: s.sk || {}, kd: s.kd || {}, sens: s.sens || {}, ledgers: s.ledgers || {}, fold: s.fold || {}, wk: s.wk || {}, exams: s.exams || [], vb: s.vb || { ed: {}, del: {}, kn: {} } };
        if ((s.srs || 1) < 2) migrateToGraduation(out);
        return out;
      }
    } catch (e) { /* 저장소 못 쓰는 환경 */ }
    return fresh();
  }
  // v1(박스만) → v2(졸업): 이전 기록은 모두 첫날 것이라 맞힌 적 있으면 '연속 1일'로 본다
  function migrateToGraduation(st) {
    const t = today();
    for (const c of Object.values(st.cards || {})) {
      if (c.st !== undefined) continue;
      if (c.b >= 1) { c.st = 1; c.sd = c.last || t; c.due = c.due > t ? addDays(t, 1) : c.due; }
      else { c.st = 0; c.due = t; }
    }
    st.srs = 2;
  }
  function save() {
    const cutoff = addDays(today(), -120);
    for (const d of Object.keys(S.days)) if (d < cutoff) delete S.days[d];
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }

  // ================================================================ content index
  let C = null;
  let allCards = [];
  const cardMeta = new Map(); // id -> { lesson, unit }
  const cardById = new Map();
  const lessonById = new Map();
  const unitColors = [['#2f6bff', '#1d4fd6'], ['#8b5cf6', '#6d3fe0'], ['#ff7a1a', '#d95f00'], ['#22b863', '#17914c'], ['#e84393', '#c02a74'], ['#00a8a8', '#008080']];

  function indexContent() {
    allCards = [];
    C.units.forEach((u, ui) => {
      u.color = unitColors[ui % unitColors.length];
      u.lessons.forEach((l) => {
        l.unitRef = u;
        lessonById.set(l.id, l);
        l.cards.forEach((c) => { cardMeta.set(c.id, { lesson: l, unit: u }); cardById.set(c.id, c); allCards.push(c); });
      });
    });
  }
  const lessonOf = (c) => cardMeta.get(c.id).lesson;
  const unitOf = (c) => cardMeta.get(c.id).unit;
  const allLessons = () => C.units.flatMap((u) => u.lessons);
  const usable = (c) => (c.t !== 'listen' && !c.dictate) || S.settings.sound; // 듣기·받아쓰기 카드는 소리 끄면 제외

  // ================================================================ 복습 스케줄 (졸업 시스템)
  // 카드 상태: 새 카드 → 학습 중 → 졸업.
  // - 힌트 없이, 그 판의 첫 시도에서 맞히면 '연속 정답 일수' st +1 (하루에 한 번만 셈)
  // - st가 감도(need)에 닿으면 졸업 → 2~3주 뒤 기억 점검 1번 (한 판에 최대 1장), 통과하면 30일 뒤 또
  // - 틀리면 st=0, 졸업 취소, 오늘 다시
  // - 박스 b는 문제 형태 난이도(객관식 → 직접 쓰기) 고르는 데만 쓴다
  const SENS = { fast: { n: 2, label: '🐇 빠르게' }, normal: { n: 3, label: '🐢 보통' }, thorough: { n: 5, label: '🦉 꼼꼼히' } };
  function skillAcc(id) {
    const st = S.sk[id];
    if (!st || st.h.length < 4) return null;
    return [...st.h].reduce((n, x) => n + (x === '1' ? 1 : x === 'h' ? 0.5 : 0), 0) / st.h.length;
  }
  const sensOf = (lessonId) => S.sens[lessonId] || 'auto';
  function needFor(card) {
    const mode = sensOf(lessonOf(card).id);
    if (mode !== 'auto') return SENS[mode].n;
    let n = SENS.normal.n;
    const acc = skillAcc(card.skill);
    if (acc !== null) n += acc < 0.6 ? 2 : acc < 0.8 ? 1 : 0;
    const st = S.cards[card.id];
    if (st && st.w >= 2) n += 1;
    return Math.min(n, 6);
  }
  let justGraduated = [];
  function grade(id, ok, hinted, retry) {
    const t = today();
    const c = S.cards[id] || (S.cards[id] = { b: 0, due: t, n: 0, w: 0, r: 0, st: 0 });
    c.n++;
    c.last = t;
    if (ok) c.r++;
    else { c.w++; c.lw = Date.now(); }
    if (ok && !hinted) c.b = Math.min(5, c.b + 1);
    else if (!ok) c.b = c.b >= 3 ? 1 : 0;
    if (!ok) { c.st = 0; c.g = null; c.due = t; return; }
    if (retry) return;
    if (!hinted && S.wk && S.wk[id] && !S.wk[id].done) S.wk[id] = { at: Date.now(), done: true }; // 약점 노트에서 졸업 // 같은 판 재도전은 연속 정답에 안 넣음
    if (hinted) { c.hn = (c.hn || 0) + 1; c.due = addDays(t, 1); return; }
    if (c.sd !== t) { c.st = (c.st || 0) + 1; c.sd = t; }
    const card = cardById.get(id);
    if (c.g) c.due = addDays(t, 30); // 기억 점검 통과
    else if (card && c.st >= needFor(card)) {
      c.g = t;
      c.due = addDays(t, 14 + rand(8));
      justGraduated.push(id);
    } else c.due = addDays(t, 1);
  }
  const boxOf = (c) => (S.cards[c.id] ? S.cards[c.id].b : 0);
  const isNew = (c) => !S.cards[c.id];
  const isGrad = (c) => !!(S.cards[c.id] && S.cards[c.id].g);
  const isDue = (c, t = today()) => S.cards[c.id] && S.cards[c.id].due <= t;
  const isLearningDue = (c, t = today()) => isDue(c, t) && !isGrad(c);
  const isCheckDue = (c, t = today()) => isDue(c, t) && isGrad(c);
  // 졸업 진행도: 졸업 = 1, 학습 중 = 연속 정답 / 필요 횟수
  function progressOf(c) {
    const st = S.cards[c.id];
    if (!st) return 0;
    if (st.g) return 1;
    return Math.min(0.95, (st.st || 0) / needFor(c));
  }
  function mastery(cards) {
    if (!cards.length) return 0;
    return cards.reduce((n, c) => n + progressOf(c), 0) / cards.length;
  }
  const mistakeCards = () => allCards.filter((c) => S.cards[c.id] && S.cards[c.id].w > 0 && !isGrad(c) && usable(c))
    .sort((a, b) => (S.cards[b.id].lw || 0) - (S.cards[a.id].lw || 0));

  // ================================================================ levels
  const need = (L) => 25 * L * L + 75 * L - 100;
  function levelOf(xp) { let L = 1; while (xp >= need(L + 1)) L++; return L; }
  const TITLES = [
    [1, '🧳', 'Touriste', '갓 도착한 여행자'], [2, '🥖', 'Baguette', '바게트 한 입'], [3, '🥐', 'Croissant', '크루아상 러버'],
    [4, '☕', 'Café crème', '카페 단골'], [5, '🚇', 'Métro', '메트로 마스터'], [6, '🧀', 'Fromage', '치즈 감별사'],
    [7, '🎨', 'Montmartre', '몽마르트르 화가'], [8, '📚', 'Sorbonne', '소르본 학생'], [9, '🗼', 'Tour Eiffel', '에펠탑 정상'],
    [10, '🇫🇷', 'Parisien·ne', '진짜 파리지앵'], [12, '🎭', 'Molière', '몰리에르의 후예'], [15, '🏛️', 'Académie', '아카데미 회원'],
    [20, '👑', 'Immortel·le', '불멸의 존재'],
  ];
  function titleOf(L) { let t = TITLES[0]; for (const x of TITLES) if (L >= x[0]) t = x; return t; }
  function currentStreak() {
    const t = today();
    return S.streak.last === t || S.streak.last === addDays(t, -1) ? S.streak.n : 0;
  }
  const todayDay = () => S.days[today()] || { xp: 0, s: 0 };

  // ================================================================ audio
  const TTS = {
    voice: null,
    ok: 'speechSynthesis' in window,
    init() {
      if (!this.ok) return;
      const choose = () => {
        const vs = speechSynthesis.getVoices();
        this.voice = vs.find((v) => v.lang === 'fr-FR' && /Thomas|Amélie|Audrey|Marie|Google/.test(v.name))
          || vs.find((v) => v.lang === 'fr-FR') || vs.find((v) => /^fr/i.test(v.lang)) || null;
      };
      choose();
      speechSynthesis.onvoiceschanged = choose;
    },
    speak(text, rate) {
      if (!this.ok || !S.settings.sound || !text) return;
      const clean = text.replace(BLANK, '…').replace(/\(e\)|\(s\)/g, '');
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = 'fr-FR';
      if (this.voice) u.voice = this.voice;
      u.rate = rate || S.settings.rate;
      speechSynthesis.speak(u);
    },
  };
  const SFX = {
    ctx: null,
    get() {
      if (!S.settings.sound) return null;
      if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    play(notes, type = 'sine', vol = 0.12) {
      const ctx = this.get();
      if (!ctx) return;
      const t0 = ctx.currentTime + 0.01;
      for (const [f, at, dur] of notes) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0 + at);
        g.gain.linearRampToValueAtTime(vol, t0 + at + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        o.connect(g).connect(ctx.destination);
        o.start(t0 + at); o.stop(t0 + at + dur + 0.02);
      }
    },
    ok() { this.play([[784, 0, 0.12], [1175, 0.09, 0.22]], 'triangle', 0.14); },
    bad() { this.play([[233, 0, 0.16], [196, 0.12, 0.26]], 'square', 0.05); },
    combo() { this.play([[988, 0, 0.08], [1319, 0.06, 0.08], [1568, 0.12, 0.16]], 'triangle', 0.1); },
    fanfare() { this.play([[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.4]], 'triangle', 0.14); },
    tap() { this.play([[660, 0, 0.04]], 'sine', 0.05); },
  };
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* noop */ } };

  // ================================================================ UI helpers
  let toastTimer;
  function toast(msg, ms = 2600) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  function confetti(ms = 2400) {
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#2f6bff', '#ff4b5c', '#ffb300', '#22b863', '#8b5cf6', '#ffffff'];
    const parts = Array.from({ length: 110 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 12 - 4,
      r: Math.random() * 6 + 4, c: pick(colors), a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4,
    }));
    const end = performance.now() + ms;
    (function frame(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, Math.min(1, (end - now) / 600));
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
      }
      if (now < end) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(performance.now());
  }
  function ring(pct, color) {
    const r = 44, c = 2 * Math.PI * r;
    return `<svg class="node-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/>` +
      (pct > 0 ? `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c * pct} ${c}" transform="rotate(-90 50 50)"/>` : '') + '</svg>';
  }
  const speakBtn = (text, cls = '') => S.settings.sound && TTS.ok && text ? `<button class="speak-btn ${cls}" data-say="${esc(text)}" aria-label="듣기">🔊</button>` : '';
  function bindSpeak(root = app) {
    $$('[data-say]', root).forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); TTS.speak(b.dataset.say, b.classList.contains('slow') ? 0.55 : undefined); }));
  }
  function applyTheme() {
    const t = S.settings.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  const mainHtml = (s) => esc(s).replace(/_{3,}/g, '<span class="blank">&nbsp;</span>');

  // ================================================================ navigation
  let view = 'home';
  function openView(name, render) {
    if (view === 'home') history.pushState({ sub: 1 }, '');
    view = name;
    render();
    window.scrollTo(0, 0);
  }
  function goHome() {
    if (history.state && history.state.sub) history.back();
    else { view = 'home'; renderHome(); }
  }
  window.addEventListener('popstate', () => {
    closeSheet();
    if (P && !P.finished) TTS.ok && speechSynthesis.cancel();
    P = null;
    view = 'home';
    renderHome();
  });

  // ================================================================ question generators
  function tiers(card, type, fn) {
    const L = lessonOf(card), U = unitOf(card);
    const ok = (x) => x !== card && x.t === type;
    return [
      L.cards.filter(ok).map(fn),
      U.lessons.filter((l) => l !== L).flatMap((l) => l.cards).filter(ok).map(fn),
      allCards.filter((x) => ok(x) && unitOf(x) !== U).map(fn),
    ];
  }
  function options(ans, tierList, n = 3, first = []) {
    const out = [];
    const seen = new Set([norm(ans)]);
    const add = (s) => {
      if (!s || out.length >= n) return;
      const k = norm(s);
      if (seen.has(k)) return;
      seen.add(k); out.push(s);
    };
    first.forEach(add);
    for (const tier of tierList) shuffle(tier).forEach(add);
    return shuffle([ans, ...out]);
  }
  const stripArticle = (fr) => fr.replace(/^(le|la|les|un|une|des)\s+/i, '').replace(/^l['’]/i, '');
  const withNote = (...parts) => parts.filter(Boolean).join(' ');

  function fakeForms(c, p) {
    const inf = c.inf;
    if (/^(se |s')/.test(inf)) return [];
    const out = [];
    if (inf.endsWith('er')) {
      const st = inf.slice(0, -2);
      out.push(...{ je: [st + 'es', st + 'ent'], tu: [st + 'e', st + 'ent'], il: [st + 'es', st + 'ent'], nous: [st + 'ez', st + 'ont'], vous: [st + 'ons', st + 'es'], ils: [st + 'e', st + 'ont'] }[p]);
    } else if (inf.endsWith('ir')) {
      const st = inf.slice(0, -2);
      out.push(...{ je: [st + 'it', st + 'e'], tu: [st + 'it', st + 'es'], il: [st + 'is', st + 'e'], nous: [st + 'ons', st + 'issez'], vous: [st + 'ez', st + 'issons'], ils: [st + 'ent', st + 'issons'] }[p]);
    } else if (inf.endsWith('re')) {
      const st = inf.slice(0, -2);
      out.push(...{ je: [st + 'e', st + 't'], tu: [st + 'es', st + 't'], il: [st + 's', st + 'e'], nous: [st + 'ez', inf + 'ons'], vous: [st + 'ons', st + 'es'], ils: [st + 'ont', st + 'es'] }[p]);
    }
    return out.filter((f) => f !== c.forms[p]);
  }
  function fakePP(inf) {
    const base = inf.replace(/^(se |s')/, '');
    const st2 = base.slice(0, -2), st3 = base.slice(0, -3);
    if (base.endsWith('oir')) return [st3 + 'u', st3 + 'i', st2 + 'u'];
    if (base.endsWith('er')) return [st2 + 'é', st2 + 'u', st2 + 'i'];
    if (base.endsWith('ir')) return [st2 + 'i', st2 + 'u', st2 + 'é'];
    if (base.endsWith('re')) return [st2 + 'u', st2 + 'i', st2 + 'é'];
    return [];
  }

  // ---- 자동 힌트 (정답을 직접 말하지 않는 단서)
  const firstKo = (ko) => `뜻의 첫 글자는 「${[...ko.replace(/^[(\s]+/, '')][0]}…」`;
  function frStart(fr) {
    const m = fr.match(/^((?:le|la|les|un|une|des)\s+|l['’])?(\S)/i);
    return m ? `${m[1] || ''}${m[2]}` : fr[0];
  }
  function genderHint(c) {
    const w = stripArticle(c.fr).toLowerCase();
    const F = ['tion', 'sion', 'té', 'ure', 'ette', 'ence', 'ance', 'ie', 'ée', 'ise', 'ade'];
    const M = ['age', 'ment', 'eau', 'isme', 'oir', 'et', 'ier', 'eur'];
    const f = F.find((e) => w.endsWith(e));
    const m = M.find((e) => w.endsWith(e));
    if (f) return `-${f}로 끝나는 명사는 보통 여성이에요 (예외도 있어요!)`;
    if (m) return `-${m}로 끝나는 명사는 보통 남성이에요 (예외도 있어요!)`;
    return '수업 때 관사와 세트로 외웠던 걸 떠올려봐요: un ○○ / une ○○';
  }
  const regularPP = (inf) => {
    const b = inf.replace(/^(se |s')/, '');
    return b.endsWith('er') ? b.slice(0, -2) + 'é' : b.endsWith('ir') ? b.slice(0, -2) + 'i' : b.endsWith('re') ? b.slice(0, -2) + 'u' : null;
  };
  const ppHint = (c) => (regularPP(c.inf) === c.pp ? '규칙형이에요: -er → -é, -ir → -i, -re → -u' : '불규칙 과거분사! 규칙대로 만들면 함정이에요 🪤');
  function verbHint(c, p, form, trapWhy) {
    if (trapWhy) return trapWhy;
    const pre = /^(se |s')/.test(c.inf) ? '재귀대명사 me·te·se·nous·vous·se부터! ' : '';
    if (c.forms.nous.endsWith('issons')) return pre + '-ir(2군) 어미: -is · -is · -it · -issons · -issez · -issent';
    if (c.inf.endsWith('er') && c.inf !== 'aller') return pre + '-er 어미: -e · -es · -e · -ons · -ez · -ent';
    const q = p === 'nous' || p === 'vous' ? 'je' : 'nous';
    const other = c.forms[q];
    if (other && other !== form) return `${pre}불규칙! 참고로 ${q === 'je' && VOWEL.test(other) ? "j'" + other : q + ' ' + other}`;
    return pre + '불규칙 동사예요. 주어와 세트로 외운 소리를 떠올려봐요!';
  }

  function qWord(c, b) {
    const snd = S.settings.sound && TTS.ok;
    const say = c.say || c.fr.replace(/\s*\/\s*/g, ', ');
    const kinds = b === 0 ? ['fr2ko', 'fr2ko', 'ko2fr'] : b === 1 ? ['ko2fr', 'fr2ko', snd && 'listen'] : ['ko2fr', 'ko2fr', snd && 'listen', snd && 'listen'];
    if ((c.g === 'm' || c.g === 'f') && stripArticle(c.fr) !== c.fr) kinds.push('gender');
    const k = pick(kinds.filter(Boolean));
    const base = { ids: [c.id], star: c.star, say, pron: c.pron, explain: withNote(c.explain, c.note) };
    const koT = tiers(c, 'word', (x) => x.ko);
    const frT = tiers(c, 'word', (x) => x.fr);
    if (k === 'fr2ko') return { ...base, kind: 'mc', tag: '단어', prompt: '무슨 뜻일까요?', main: c.fr, mainFr: true, speakMain: say, options: options(c.ko, koT), answer: c.ko, reveal: `${c.fr} = ${c.ko}`, hint: firstKo(c.ko) };
    if (k === 'ko2fr') return { ...base, kind: 'mc', tag: '단어', prompt: '프랑스어로 하면?', main: c.ko, options: options(c.fr, frT), optionsFr: true, answer: c.fr, reveal: c.fr, hint: `「${frStart(c.fr)}…」로 시작해요` };
    if (k === 'listen') return { ...base, kind: 'mc', tag: '듣기', prompt: '듣고 뜻을 고르세요', listen: say, options: options(c.ko, koT), answer: c.ko, reveal: `${c.fr} = ${c.ko}`, hint: `🐢 버튼으로 천천히 들어봐요. ${firstKo(c.ko)}` };
    const M = '남성 ♂ le · un', F = '여성 ♀ la · une';
    return { ...base, kind: 'mc', tag: '성별', prompt: '이 명사는 남성? 여성?', main: stripArticle(c.fr), mainFr: true, speakMain: say, options: [M, F], fixed: true, grid: true, answer: c.g === 'm' ? M : F, reveal: `${c.fr} (${c.ko})`, hint: genderHint(c) };
  }

  function qVerb(c, b, force) {
    const trapPs = (c.traps || []).map((t) => t.p);
    const p = trapPs.length && Math.random() < 0.45 ? pick(trapPs) : pick(PERSONS);
    const form = c.forms[p];
    const subj = subjFor(p, form);
    const full = joinSubj(subj, form);
    const shownSubj = subj === "j'" ? 'je' : subj;
    const elided = subj === "j'";
    const trapsHere = (c.traps || []).filter((t) => t.p === p);
    const trapNote = trapsHere.map((t) => t.why).filter(Boolean)[0];
    const hasTraps = (c.traps || []).length > 0;
    let kinds;
    if (b === 0) kinds = ['conj-mc', 'conj-mc', 'inf-mc', 'meaning', 'pmatch'];
    else if (b === 1) kinds = ['conj-mc', 'inf-mc', 'pmatch', 'conj-type', hasTraps && 'trap-ox'];
    else kinds = ['conj-type', 'conj-type', 'conj-type', 'inf-type', hasTraps && 'trap-ox', 'inf-mc'];
    const k = force && (force !== 'trap-ox' || hasTraps) ? force : pick(kinds.filter(Boolean));
    const base = { ids: [c.id], star: c.star };
    const elisionNote = elided ? "모음 앞 je → j' (élision!)" : '';
    const infT = tiers(c, 'verb', (x) => x.inf);

    if (k === 'conj-mc' || k === 'conj-type') {
      const others = shuffle(PERSONS.filter((q) => q !== p).map((q) => c.forms[q]));
      const firsts = [...trapsHere.map((t) => t.wrong), ...shuffle([...others.slice(0, 3), ...fakeForms(c, p)])];
      const q = {
        ...base, tag: '동사 변화', prompt: k === 'conj-mc' ? '알맞은 형태는?' : '동사를 변화시켜 쓰세요',
        main: `${shownSubj} ___`, mainFr: true, sub: `${c.inf} · ${c.ko}`, reveal: full, say: full,
        explain: withNote(elisionNote, trapNote, c.note), hint: verbHint(c, p, form, trapNote),
      };
      if (k === 'conj-mc') return { ...q, kind: 'mc', options: options(form, [], 3, firsts), optionsFr: true, answer: form, grid: form.length < 12 };
      return { ...q, kind: 'type', accept: [form, full], elisionTrap: elided ? `je ${form}` : null };
    }
    if (k === 'inf-mc' || k === 'inf-type') {
      const q = { ...base, tag: '동사원형', prompt: '이 동사의 원형은?', main: cap(full), mainFr: true, speakMain: full, reveal: `${c.inf} (${c.ko})`, say: c.inf, explain: c.note || '', hint: `뜻은 「${c.ko}」예요` };
      if (k === 'inf-mc') return { ...q, kind: 'mc', options: options(c.inf, infT), optionsFr: true, answer: c.inf, grid: true };
      return { ...q, kind: 'type', accept: [c.inf] };
    }
    if (k === 'meaning') {
      return { ...base, kind: 'mc', tag: '동사', prompt: '무슨 뜻일까요?', main: c.inf, mainFr: true, speakMain: c.inf, options: options(c.ko, tiers(c, 'verb', (x) => x.ko)), answer: c.ko, reveal: `${c.inf} = ${c.ko}`, say: c.inf, hint: firstKo(c.ko) };
    }
    if (k === 'pmatch') {
      const chosen = [];
      const used = new Set();
      for (const q of shuffle(PERSONS)) {
        if (chosen.length >= 4) break;
        if (used.has(c.forms[q])) continue;
        used.add(c.forms[q]); chosen.push(q);
      }
      if (chosen.length >= 3) {
        return {
          ...base, kind: 'match', tag: '짝 맞추기', prompt: `${c.inf}: 주어와 형태를 연결하세요`,
          pairs: chosen.map((q) => ({ l: PLABEL[q], r: c.forms[q], id: c.id })), rFr: true,
          reveal: chosen.map((q) => joinSubj(subjFor(q, c.forms[q]), c.forms[q])).join(' · '), explain: c.note || '',
        };
      }
      return qVerb(c, 0);
    }
    // trap-ox
    const t = pick(c.traps);
    const tf = c.forms[t.p];
    const ts = subjFor(t.p, tf);
    const right = cap(joinSubj(ts, tf));
    const showWrong = Math.random() < 0.55;
    const wrongS = cap(joinSubj(t.p === 'je' ? (VOWEL.test(t.wrong) ? "j'" : 'je') : ts, t.wrong));
    return {
      ...base, kind: 'ox', tag: 'O / X', prompt: '이 형태, 맞을까요?', main: showWrong ? wrongS : right, mainFr: true, sub: `${c.inf} · ${c.ko}`,
      ox: !showWrong, reveal: showWrong ? `${wrongS} ✗ → ${right}` : right, say: right, explain: withNote(t.why, c.note),
      hint: `${c.inf}의 ${PLABEL[t.p]} 형태, 철자 하나하나 확인해봐요`,
    };
  }

  function qPP(c, b, force) {
    const pronominal = /^(se |s')/.test(c.inf);
    const kinds = b === 0 ? ['pp-mc', 'pp-mc', !pronominal && 'aux'] : b === 1 ? ['pp-mc', !pronominal && 'aux', c.ex && 'ex-mc', 'pp-type'] : ['pp-type', 'pp-type', c.ex && 'ex-type', !pronominal && 'aux'];
    const k = force && !(force === 'aux' && pronominal) && !(force.startsWith('ex') && !c.ex) ? force : pick(kinds.filter(Boolean));
    const base = { ids: [c.id], star: c.star, pron: c.pron, explain: withNote(c.explain, c.note) };
    const ppT = tiers(c, 'pp', (x) => x.pp);
    const fakes = shuffle(fakePP(c.inf)).slice(0, 2);
    const say = c.ex ? c.ex.fr : `${c.inf}, ${c.pp}`;
    if (k === 'pp-mc' || k === 'pp-type') {
      const q = { ...base, tag: '과거분사', prompt: k === 'pp-mc' ? '과거분사는?' : '과거분사를 쓰세요', main: c.inf, mainFr: true, speakMain: c.inf, sub: c.ko, reveal: `${c.inf} → ${c.pp}`, say, hint: ppHint(c) };
      if (k === 'pp-mc') return { ...q, kind: 'mc', options: options(c.pp, ppT, 3, fakes), optionsFr: true, answer: c.pp, grid: true };
      return { ...q, kind: 'type', accept: [c.pp] };
    }
    if (k === 'aux') {
      const aux = c.aux === 'être' ? 'est' : 'a';
      return {
        ...base, kind: 'mc', tag: '조동사', prompt: 'avoir? être? 빈칸에 알맞은 것은', main: `Il ___ ${c.pp}.`, mainFr: true, sub: `${c.inf} · ${c.ko}`,
        options: ['a', 'est'], fixed: true, grid: true, optionsFr: true, answer: aux, reveal: `Il ${aux} ${c.pp}. (${c.aux})`, say: `Il ${aux} ${c.pp}.`,
        explain: base.explain || (c.aux === 'être' ? '이동·상태 변화 동사는 être!' : '대부분의 동사는 avoir.'),
      };
    }
    const re = new RegExp(`(^|[\\s'’])${c.pp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s.,!?]|$)`);
    const blanked = c.ex.fr.replace(re, '$1___');
    const q = { ...base, tag: '과거분사', prompt: '빈칸에 알맞은 과거분사는?', main: blanked, mainFr: true, sub: `${c.ex.ko}  (${c.inf})`, reveal: c.ex.fr, say: c.ex.fr, hint: ppHint(c) };
    if (k === 'ex-mc') return { ...q, kind: 'mc', options: options(c.pp, ppT, 3, fakes), optionsFr: true, answer: c.pp, grid: true };
    return { ...q, kind: 'type', accept: [c.pp, c.ex.fr] };
  }

  function qChoice(c) {
    const qIsFr = !hasHangul(c.q);
    const say = c.say !== undefined ? c.say : (qIsFr ? fill(c.q, c.a) : '');
    const allOpts = [c.a, ...c.wrong.slice(0, 3)];
    return {
      kind: 'mc', ids: [c.id], star: c.star, tag: '문법', prompt: c.prompt || '알맞은 것을 고르세요',
      main: c.q, mainFr: qIsFr, speakMain: qIsFr && !BLANK.test(c.q) ? c.q : null, sub: c.ko,
      options: shuffle(allOpts), optionsFr: !hasHangul(allOpts.join(' ')), answer: c.a,
      grid: allOpts.every((o) => o.length <= 10), reveal: BLANK.test(c.q) ? fill(c.q, c.a) : c.a,
      say, explain: c.explain, pron: c.pron,
    };
  }
  function qBuild(c, b) {
    const extra = b === 0 ? (c.extra || []).slice(0, 1) : (c.extra || []);
    return {
      kind: 'build', ids: [c.id], star: c.star, tag: '문장 만들기', prompt: c.prompt,
      main: c.from || c.ko, mainFr: !!c.from, speakMain: c.from || null, sub: c.from ? c.ko : null,
      blocks: shuffle([...blocksOf(c.a), ...extra]), accept: [c.a, ...(c.alts || [])],
      reveal: c.a, say: c.a, explain: c.explain,
    };
  }
  function qError(c, b) {
    const i = c.s.indexOf(c.wrong);
    let st = i, en = i + c.wrong.length;
    while (st > 0 && !/\s/.test(c.s[st - 1])) st--;
    while (en < c.s.length && !/\s/.test(c.s[en])) en++;
    const fixedS = c.s.slice(0, i) + c.right + c.s.slice(i + c.wrong.length);
    const base = { ids: [c.id], star: c.star, sub: c.ko, explain: c.explain, say: fixedS, fixWord: c.right };
    if (b >= 1 && Math.random() < 0.45) {
      const showWrong = Math.random() < 0.6;
      return { ...base, kind: 'ox', tag: 'O / X', prompt: '이 문장, 맞을까요?', main: showWrong ? c.s : fixedS, mainFr: true, ox: !showWrong, reveal: showWrong ? `${c.wrong} ✗ → ${c.right} ✓` : fixedS };
    }
    const chunks = [
      ...c.s.slice(0, st).split(/\s+/).filter(Boolean).map((t) => ({ t, bad: false })),
      { t: c.s.slice(st, en), bad: true },
      ...c.s.slice(en).split(/\s+/).filter(Boolean).map((t) => ({ t, bad: false })),
    ];
    return { ...base, kind: 'tap', tag: '틀린 곳 찾기', prompt: '틀린 부분을 톡!', chunks, reveal: `${c.wrong} → ${c.right}\n${fixedS}` };
  }
  function qListen(c) {
    return {
      kind: 'mc', ids: [c.id], star: c.star, tag: '듣기', prompt: '들리는 것을 고르세요', listen: c.say,
      options: shuffle([c.a, ...c.wrong.slice(0, 3)]), optionsFr: true, answer: c.a,
      reveal: c.ko ? `${c.a} = ${c.ko}` : c.a, say: c.say, pron: c.pron, explain: c.explain,
    };
  }
  // 문제에 주어가 이미 나와 있으면(Elle connaît → Elle a connu) 주어를 빼고 써도 정답: "a connu"
  function splitSubj(s) {
    const m = String(s || '').normalize('NFC').replace(/[’‘]/g, "'").trim().match(/^(j'|(?:je|tu|il|elle|on|nous|vous|ils|elles)\s+)(.+)$/i);
    return m ? { subj: m[1].trim().toLowerCase().replace("j'", 'je'), rest: m[2].trim() } : null;
  }
  function withoutSubject(q, answers) {
    const sq = splitSubj(q);
    if (!sq) return [];
    return answers.map(splitSubj).filter((x) => x && x.subj === sq.subj).map((x) => x.rest);
  }
  function qType(c) {
    const qFr = c.q && !hasHangul(c.q);
    const answers = [c.a, ...(c.alts || [])];
    return {
      kind: 'type', ids: [c.id], star: c.star, tag: '쓰기', prompt: c.prompt, main: c.q || c.ko, mainFr: qFr,
      speakMain: qFr && !BLANK.test(c.q) ? c.q : null, sub: c.q ? c.ko : null,
      accept: [...new Set([...answers, ...(qFr ? withoutSubject(c.q, answers) : [])])], reveal: c.a, say: hasHangul(c.a) ? '' : c.a, explain: c.explain, pron: c.pron,
      // dictate: 시험 I번 '듣기 빈칸' — 문장 전체를 들려주고 q의 빈칸만 쓰게 한다
      ...(c.dictate ? { listen: c.dictate, speakMain: null, tag: '듣기 빈칸', say: c.dictate, reveal: `${c.a}\n🔊 ${c.dictate}` } : {}),
    };
  }
  function makeQuestion(c) {
    const b = boxOf(c);
    let q;
    switch (c.t) {
      case 'word': q = qWord(c, b); break;
      case 'verb': q = qVerb(c, b); break;
      case 'pp': q = qPP(c, b); break;
      case 'choice': q = qChoice(c); break;
      case 'build': q = qBuild(c, b); break;
      case 'error': q = qError(c, b); break;
      case 'listen': q = qListen(c); break;
      case 'type': q = qType(c); break;
      default: return null;
    }
    if (q) {
      q.skill = c.skill;
      q.lessonId = lessonOf(c).id;
      if (q.hint === undefined) q.hint = c.hint || skillHint(c.skill);
    }
    return q;
  }

  // ================================================================ 약점 스킬용 자동 생성 문제
  // 카드 데이터를 조합해 같은 문법 포인트의 "새" 문제를 만든다 (SRS 대신 스킬 통계에만 반영)
  const isPronominal = (inf) => /^(se |s')/.test(inf);
  const verbsWhere = (f) => allCards.filter((c) => c.t === 'verb' && f(c));
  const ppsWhere = (f) => allCards.filter((c) => c.t === 'pp' && f(c));
  const synth = (skill, q) => ({ ids: [], gen: true, skill, ...q });
  const fromCard = (skill, q) => (q ? { ...q, skill, gen: true } : null);
  const verbGen = (skill) => () => {
    const vs = verbsWhere((c) => c.skill === skill);
    return vs.length ? fromCard(skill, qVerb(pick(vs), 2, pick(['conj-type', 'conj-type', 'conj-mc', 'trap-ox']))) : null;
  };
  const GEN = {
    on() {
      const vs = verbsWhere((c) => !isPronominal(c.inf));
      if (!vs.length) return null;
      const c = pick(vs);
      const form = c.forms.il;
      return synth('on', {
        kind: 'mc', tag: 'on = 3인칭 단수', prompt: '알맞은 형태는?', main: 'On ___', mainFr: true, sub: `${c.inf} · ${c.ko}`,
        options: options(form, [], 3, shuffle([c.forms.nous, c.forms.ils, c.forms.vous, c.forms.tu])), optionsFr: true, grid: true,
        answer: form, reveal: `On ${form}`, say: `On ${form}`, explain: "on은 '우리/사람들'이라는 뜻이어도 동사는 3인칭 단수 (il과 같은 형태)!",
        hint: 'on은 뜻은 복수여도… 문법적으로는 몇 인칭일까요?',
      });
    },
    elision() {
      const vs = verbsWhere((c) => !isPronominal(c.inf) && VOWEL.test(c.forms.je));
      if (!vs.length) return null;
      const c = pick(vs);
      let right, wrong, explain;
      if (Math.random() < 0.5) {
        right = `J'${c.forms.je}.`; wrong = `Je ${c.forms.je}.`; explain = "모음·무음 h 앞의 je는 j'로! (élision)";
      } else {
        const p = pick(['je', 'il', 'nous', 'vous'].filter((x) => VOWEL.test(c.forms[x])));
        const subj = { je: 'Je', il: 'Il', nous: 'Nous', vous: 'Vous' }[p];
        right = `${subj} n'${c.forms[p]} pas.`; wrong = `${subj} ne ${c.forms[p]} pas.`; explain = "모음 앞의 ne는 n'로! (élision)";
      }
      const showWrong = Math.random() < 0.55;
      return synth('elision', {
        kind: 'ox', tag: '엘리지옹', prompt: '이 문장, 맞을까요?', main: showWrong ? wrong : right, mainFr: true, sub: `${c.inf} · ${c.ko}`,
        ox: !showWrong, reveal: showWrong ? `${wrong} ✗ → ${right}` : right, say: right, explain,
        hint: '동사가 모음(또는 무음 h)으로 시작하네요. 앞 단어는 그대로 둬도 될까요?',
      });
    },
    neg() {
      const vs = verbsWhere((c) => !isPronominal(c.inf));
      if (!vs.length) return null;
      const c = pick(vs);
      const p = pick(PERSONS);
      const form = c.forms[p];
      const subj = subjFor(p, form);
      const Subj = cap(subj === "j'" ? 'je' : subj);
      const v = VOWEL.test(form);
      const a = v ? `${Subj} n'${form} pas.` : `${Subj} ne ${form} pas.`;
      return synth('neg', {
        kind: 'build', tag: '부정문', prompt: '부정문으로 바꾸세요', main: cap(joinSubj(subj, form)) + '.', mainFr: true, sub: `${c.inf} · ${c.ko}`,
        blocks: shuffle([...blocksOf(a), v ? 'ne' : "n'", 'non']), accept: [a], reveal: a, say: a,
        explain: v ? "동사를 ne…pas로 감싸고, 모음 앞 ne는 n'로!" : '동사를 ne…pas로 감싸요.',
        hint: v ? '동사를 ne…pas로 감싸요. 그런데 동사가 모음으로 시작하네요!' : 'ne와 pas가 동사를 샌드위치처럼 감싸요 🥪',
      });
    },
    agreement() {
      if (Math.random() < 0.65) {
        const ps = ppsWhere((c) => c.aux === 'être' && !isPronominal(c.inf) && !/s$/.test(c.pp));
        if (!ps.length) return null;
        const c = pick(ps);
        const [S1, aux, suf, who] = pick([['Elle', 'est', 'e', '여성 단수'], ['Elles', 'sont', 'es', '여성 복수'], ['Ils', 'sont', 's', '남성 복수'],
          ['Marie', 'est', 'e', '여성 단수'], ['Paul et Léa', 'sont', 's', '남+여 → 남성 복수'], ['Julie et Anne', 'sont', 'es', '여성 복수'], ['Il', 'est', '', '남성 단수']]);
        const ans = c.pp + suf;
        return synth('agreement', {
          kind: 'mc', tag: '성수일치', prompt: '알맞은 과거분사는?', main: `${S1} ${aux} ___.`, mainFr: true, sub: `${c.inf} · ${c.ko}`,
          options: shuffle([c.pp, c.pp + 'e', c.pp + 's', c.pp + 'es']), optionsFr: true, grid: true, answer: ans,
          reveal: `${S1} ${aux} ${ans}.`, say: `${S1} ${aux} ${ans}.`, explain: `être 동사 → 주어(${who})에 일치: ${suf ? '-' + suf : '그대로'}`,
          hint: `조동사가 ${aux}! 그럼 주어 ${S1}의 성·수를 따져봐요`,
        });
      }
      const ps = ppsWhere((c) => c.aux === 'avoir' && !/[se]$/.test(c.pp));
      if (!ps.length) return null;
      const c = pick(ps);
      const [S1, aux] = pick([['Elles', 'ont'], ['Marie', 'a'], ['Ils', 'ont'], ['Elle', 'a']]);
      return synth('agreement', {
        kind: 'mc', tag: '성수일치', prompt: '알맞은 과거분사는?', main: `${S1} ${aux} ___.`, mainFr: true, sub: `${c.inf} · ${c.ko}`,
        options: shuffle([c.pp, c.pp + 'e', c.pp + 's', c.pp + 'es']), optionsFr: true, grid: true, answer: c.pp,
        reveal: `${S1} ${aux} ${c.pp}.`, say: `${S1} ${aux} ${c.pp}.`, explain: 'avoir는 주어와 일치하지 않아요! (앞에 COD 대명사가 올 때만 일치)',
        hint: '조동사가 avoir예요. 동사 앞에 COD 대명사(le, la, les)가 있나요?',
      });
    },
    aux() {
      const ps = ppsWhere((c) => !isPronominal(c.inf));
      return ps.length ? fromCard('aux', qPP(pick(ps), 1, 'aux')) : null;
    },
    pp() {
      const ps = ppsWhere(() => true);
      return ps.length ? fromCard('pp', qPP(pick(ps), 2, pick(['pp-type', 'pp-type', 'ex-type', 'pp-mc']))) : null;
    },
    inf() {
      const vs = verbsWhere(() => true);
      return vs.length ? fromCard('inf', qVerb(pick(vs), 2, pick(['inf-type', 'inf-mc']))) : null;
    },
    'pc-neg-q'() {
      const ps = ppsWhere((c) => !isPronominal(c.inf));
      if (!ps.length) return null;
      const c = pick(ps);
      const aux = c.aux === 'être' ? 'est' : 'a';
      if (Math.random() < 0.5) {
        const a = `Il n'${aux} pas ${c.pp}.`;
        return synth('pc-neg-q', {
          kind: 'build', tag: '복합과거 부정', prompt: '부정문으로 바꾸세요', main: `Il ${aux} ${c.pp}.`, mainFr: true, sub: `${c.inf} · ${c.ko}`,
          blocks: shuffle([...blocksOf(a), 'ne', aux]), accept: [a], reveal: a, say: a, explain: '복합과거 부정은 조동사만 ne…pas로 감싸요. 과거분사는 pas 뒤!',
          hint: 'ne…pas가 감싸는 건 과거분사가 아니라 조동사! 모음 앞 ne는?',
        });
      }
      const right = aux === 'a' ? `A-t-il ${c.pp} ?` : `Est-il ${c.pp} ?`;
      const wrongs = aux === 'a' ? [`A-il ${c.pp} ?`, `Il a-t-il ${c.pp} ?`, `A-t-il-${c.pp} ?`] : [`Est-t-il ${c.pp} ?`, `Il est-il ${c.pp} ?`, `Est-il-${c.pp} ?`];
      return synth('pc-neg-q', {
        kind: 'mc', tag: '복합과거 의문', prompt: '도치 의문문으로 바르게 바꾼 것은?', main: `Il ${aux} ${c.pp}.`, mainFr: true, sub: `${c.inf} · ${c.ko}`,
        options: shuffle([right, ...wrongs]), optionsFr: true, answer: right, reveal: right, say: right,
        explain: aux === 'a' ? '조동사와 주어를 뒤집어요. a와 il 사이엔 모음 충돌을 막는 -t-!' : 'est는 t로 끝나니까 -t-가 필요 없어요: Est-il ?',
        hint: '도치는 조동사와 주어를 뒤집어요. 모음끼리 부딪치면 뭘 넣었더라?',
      });
    },
    'pres-er': verbGen('pres-er'), 'pres-ir': verbGen('pres-ir'), 'pres-irr': verbGen('pres-irr'),
    'stem-change': verbGen('stem-change'), pronominal: verbGen('pronominal'),
  };
  function genFor(skill) {
    const f = GEN[skill];
    if (!f) return null;
    try {
      const q = f();
      if (q && q.hint === undefined) q.hint = skillHint(skill);
      return q;
    } catch (e) { return null; }
  }

  // ================================================================ 약점 분석
  const KIND_LABEL = { mc: '객관식', listen: '듣기', type: '직접 쓰기', build: '문장 배열', tap: '틀린 곳 찾기', ox: 'O/X', match: '짝 맞추기' };
  function recordStats(q, ok, hinted) {
    if (q.skill) {
      const s = S.sk[q.skill] || (S.sk[q.skill] = { n: 0, ok: 0, h: '' });
      s.n++; if (ok) s.ok++;
      s.h = (s.h + (ok ? (hinted ? 'h' : '1') : '0')).slice(-15);
    }
    const kind = q.listen ? 'listen' : q.kind;
    const k = S.kd[kind] || (S.kd[kind] = { n: 0, ok: 0 });
    k.n++; if (ok) k.ok++;
  }
  function skillReport() {
    return (C.skills || []).map((sk) => {
      const cards = allCards.filter((c) => c.skill === sk.id && usable(c));
      const st = S.sk[sk.id] || { n: 0, ok: 0, h: '' };
      const recent = st.h.length;
      const acc = recent ? [...st.h].reduce((n, x) => n + (x === '1' ? 1 : x === 'h' ? 0.5 : 0), 0) / recent : null;
      const mast = mastery(cards);
      const weak = recent >= 3 ? (1 - acc) * 0.75 + (1 - mast) * 0.25 : null;
      return { ...sk, cards, n: st.n, recent, acc, mast, weak, canDrill: cards.length > 0 || !!GEN[sk.id] };
    }).filter((r) => r.cards.length || r.n);
  }
  const weakSkills = () => skillReport().filter((r) => r.weak !== null && r.acc < 0.8).sort((a, b) => b.weak - a.weak);
  function makeWordMatch(cards) {
    return {
      kind: 'match', ids: cards.map((c) => c.id), tag: '짝 맞추기', prompt: '짝을 맞춰보세요',
      pairs: cards.map((c) => ({ l: c.fr, r: c.ko, id: c.id })), lFr: true,
      reveal: cards.map((c) => `${c.fr} = ${c.ko}`).join('\n'),
    };
  }

  // ================================================================ session builder
  const SESSION = 10;
  // 약점 훈련: 약한 스킬의 카드(틀린 것·약한 것 우선) + 자동 생성 변형 문제
  function buildWeakSession(skillIds) {
    const t = today();
    const qs = [];
    const perSkill = Math.ceil(SESSION / skillIds.length);
    for (const sk of skillIds) {
      const cards = allCards.filter((c) => c.skill === sk && usable(c)).map((c) => {
        const st = S.cards[c.id];
        const s = !st ? 1.5 : st.g ? -3 : (st.w > 0 ? 2 + st.w * 0.2 : 0) + (st.due <= t ? 1 : 0) + (5 - st.b) * 0.2;
        return { c, s: s + Math.random() };
      }).sort((a, b) => b.s - a.s).map((x) => x.c);
      const nGen = GEN[sk] ? Math.max(2, Math.round(perSkill * 0.4)) : 0;
      const fromCards = cards.slice(0, perSkill - Math.min(nGen, perSkill - 1)).map(makeQuestion).filter(Boolean);
      qs.push(...fromCards);
      for (let i = 0; qs.length < perSkill * (skillIds.indexOf(sk) + 1) && i < perSkill * 2; i++) {
        const g = genFor(sk);
        if (g) qs.push(g);
        else if (cards.length) { const q = makeQuestion(pick(cards)); if (q) qs.push(q); }
        else break;
      }
    }
    return shuffle(qs).slice(0, SESSION);
  }
  function buildSession(mode, lessonId) {
    if (mode === 'weaknote') return buildWeakNoteSession();
    if (mode === 'weak') {
      const ids = lessonId ? [lessonId] : weakSkills().slice(0, 2).map((r) => r.id);
      return ids.length ? buildWeakSession(ids) : [];
    }
    const t = today();
    let pool;
    if (mode === 'lesson') pool = lessonById.get(lessonId).cards.filter(usable);
    else if (mode === 'mistakes') pool = mistakeCards();
    else pool = allCards.filter(usable);
    if (!pool.length) return [];
    if (mode === 'mistakes') return finalize(shuffle(pool.slice(0, SESSION)).map(makeQuestion).filter(Boolean));

    const jit = () => Math.random() * 0.6;
    const byScore = (arr, f) => arr.map((c) => [c, f(c) + jit()]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const recency = (c) => 1 - Math.min(Math.max(0, daysBetween(lessonOf(c).date, t)), 28) / 28;
    const st = (c) => S.cards[c.id];
    // 1) 학습 중인데 오늘 복습할 카드 (오늘 틀린 것 먼저)
    const dueL = byScore(pool.filter((c) => isLearningDue(c, t)), (c) => (st(c).last === t && st(c).st === 0 ? 1 : 0) + Math.min(daysBetween(st(c).due, t), 10) * 0.1 + (c.star ? 0.3 : 0));
    // 2) 새 카드 = 새 개념 (복습 모드는 최근 수업 우선)
    const fresh = byScore(pool.filter(isNew), (c) => (mode === 'lesson' ? 0 : recency(c) * 1.2) + (c.star ? 0.4 : 0));
    // 3) 졸업 카드 기억 점검 (한 판에 최대 1장)
    const checks = pool.filter((c) => isCheckDue(c, t)).sort((a, b) => st(a).due.localeCompare(st(b).due));
    // 4) 학습 중이지만 오늘은 쉬는 카드 / 5) 졸업 카드 — 새 카드가 바닥났을 때만
    const resting = byScore(pool.filter((c) => !isNew(c) && !isGrad(c) && !isDue(c, t)), (c) => 1 - progressOf(c));
    const graduated = shuffle(pool.filter((c) => isGrad(c) && !isDue(c, t)));

    const weak = mode === 'review' ? weakSkills()[0] : null;
    const cardSlots = weak ? SESSION - 2 : SESSION;
    const CAP = { choice: 4, verb: 4, word: 4, pp: 4, error: 2, build: 3, type: 2, listen: 2 };
    const perType = {}, perLesson = {};
    const qs = [];
    const used = new Set();
    let wantMatch = Math.random() < 0.5;
    const take = (list, quota, { capped = true, lessonCap = 0 } = {}) => {
      let n = 0;
      for (const c of list) {
        if (n >= quota || qs.length >= cardSlots) break;
        if (used.has(c.id)) continue;
        if (capped && (perType[c.t] || 0) >= (CAP[c.t] || 3)) continue;
        const lid = lessonOf(c).id;
        if (lessonCap && (perLesson[lid] || 0) >= lessonCap) continue;
        if (wantMatch && c.t === 'word' && qs.length >= 2) {
          const group = [c];
          const fr = new Set([norm(c.fr)]), ko = new Set([norm(c.ko)]);
          for (const x of list) {
            if (group.length >= 4) break;
            if (x.t !== 'word' || x === c || used.has(x.id) || fr.has(norm(x.fr)) || ko.has(norm(x.ko))) continue;
            group.push(x); fr.add(norm(x.fr)); ko.add(norm(x.ko));
          }
          if (group.length === 4) {
            qs.push(makeWordMatch(group));
            group.forEach((g) => used.add(g.id));
            perLesson[lid] = (perLesson[lid] || 0) + 4;
            wantMatch = false; n++;
            continue;
          }
        }
        const q = makeQuestion(c);
        if (!q) continue;
        qs.push(q); used.add(c.id); n++;
        perType[c.t] = (perType[c.t] || 0) + 1;
        perLesson[lid] = (perLesson[lid] || 0) + 1;
      }
    };
    // 밀린 복습이 적으면 새 개념을 많이, 많으면 복습 위주 (그래도 새 카드는 최소 3장)
    const D = dueL.length;
    const newWanted = !fresh.length ? 0 : D <= 3 ? cardSlots - D : D <= 8 ? 5 : D <= 16 ? 4 : 3;
    const dueQuota = Math.max(0, cardSlots - Math.min(newWanted, fresh.length) - (checks.length ? 1 : 0));
    take(dueL, dueQuota);
    take(checks, 1);
    take(fresh, cardSlots, { lessonCap: mode === 'review' ? 5 : 0 });
    take(fresh, cardSlots, { capped: false });
    take(dueL, cardSlots, { capped: false });
    if (qs.length < cardSlots && mode === 'review' && !weak) {
      const w2 = weakSkills()[0] || skillReport().filter((r) => GEN[r.id] && r.n).sort((a, b) => a.mast - b.mast)[0];
      for (let i = 0; w2 && i < 3 && qs.length < cardSlots; i++) { const g = genFor(w2.id); if (g) qs.push(g); }
    }
    take(resting, cardSlots, { capped: false });
    if (mode === 'lesson') take(graduated, cardSlots, { capped: false });
    // 오늘의 복습엔 가장 약한 스킬의 변형 문제 2개 (새로 만든 문제)
    if (weak) [genFor(weak.id), genFor(weak.id)].filter(Boolean).forEach((g) => qs.push(g));
    return finalize(qs);
  }
  function finalize(qs) {
    const out = shuffle(qs);
    if (out.length > 1 && out[0].kind === 'match') [out[0], out[1]] = [out[1], out[0]];
    return out;
  }
  // ================================================================ player
  let P = null;
  function startSession(mode, lessonId) {
    closeSheet();
    const qs = buildSession(mode, lessonId);
    if (!qs.length) { toast(mode === 'weaknote' ? '약점 노트가 비어 있어요! 👏' : mode === 'mistakes' ? '오답이 없어요! 👏' : mode === 'weak' ? '아직 약점 데이터가 부족해요. 몇 판 더 풀어봐요!' : '풀 수 있는 문제가 없어요'); return; }
    if (lessonId && mode === 'lesson') markSeen(lessonId);
    P = { mode, lessonId, queue: qs, i: 0, phase: 'answer', combo: 0, bestCombo: 0, xp: 0, ok: 0, answered: 0, mistakes: 0, retried: new Set(), start: Date.now(), finished: false, hintsUsed: 0 };
    SFX.get();
    if (view === 'player' || view === 'result') { view = 'player'; renderPlayer(); }
    else openView('player', renderPlayer);
  }
  function quitSession() {
    if (P && P.answered > 0 && !confirm(P.mode === 'exam' && P.ex.grading === 'end' ? '그만할까요? 이 시험은 채점되지 않아요.' : '그만할까요? 푼 문제는 기록돼요.')) return;
    save();
    P = null;
    TTS.ok && speechSynthesis.cancel();
    goHome();
  }

  function renderPlayer() {
    const q = P.queue[P.i];
    if (P.mode === 'exam' && q.partI === 0 && !P.ex.shown[q.part]) return renderPartIntro(q);
    const exTag = P.mode === 'exam' ? `${(EXAM_PARTS.find((p) => p.id === q.part) || {}).ko || ''} ${q.partI + 1}/${q.partN} · ` : '';
    P.phase = 'answer';
    P.sel = null;
    const pct = (P.i / P.queue.length) * 100;
    app.innerHTML = `
      <div class="player">
        <div class="p-top">
          <button class="icon-btn" id="quit" aria-label="그만하기">✕</button>
          <div class="progress"><i style="width:${pct}%"></i></div>
          <div class="combo" id="combo">${P.combo >= 3 ? `🔥 ${P.combo}` : ''}</div>
        </div>
        <div class="p-body">
          <div class="q-tag">${esc(exTag + (q.tag || ''))}${q.star ? ' <span class="star">★ 교수님 강조</span>' : ''}</div>
          <h2 class="q-prompt">${esc(q.prompt)}</h2>
          ${q.listen ? `<div class="big-play">${speakBtn(q.listen)}${speakBtn(q.listen, 'slow').replace('🔊', '🐢')}</div>` : ''}
          ${q.main ? `<div class="q-main"><div class="txt ${q.mainFr ? 'fr' : ''}">${mainHtml(q.main)}</div>${q.speakMain ? speakBtn(q.speakMain) : ''}</div>` : ''}
          ${q.sub ? `<div class="q-sub">${esc(q.sub)}</div>` : ''}
          <div id="qa"></div>
          <div id="hintbox"></div>
        </div>
        <div class="p-foot" id="foot">
          <div class="fb" id="fb"></div>
          <div class="foot-row">
            <button class="hint-btn" id="hint" aria-label="힌트 보기"><span>💡</span><small>힌트</small></button>
            <button class="btn" id="check" disabled>확인</button>
          </div>
        </div>
      </div>`;
    $('#quit').onclick = quitSession;
    bindSpeak();
    const qa = $('#qa');
    const check = $('#check');
    ({ mc: renderMC, ox: renderOX, type: renderType, build: renderBuild, tap: renderTap, match: renderMatch, vtable: renderVTable })[q.kind](q, qa, check);
    check.onclick = () => (P.phase === 'answer' ? submit() : next());
    sanitizeHint(q);
    P.hintSteps = hintSteps(q);
    P.hintStep = 0;
    P.hinted = false;
    const hb = $('#hint');
    if (!P.hintSteps.length || P.mode === 'exam') hb.classList.add('hidden');
    if (P.mode === 'exam' && P.ex.grading === 'end') check.textContent = P.i === P.queue.length - 1 ? '제출하고 채점 ✓' : '다음 ›';
    hb.onclick = useHint;
    if (q.listen) setTimeout(() => TTS.speak(q.listen), 250);
  }

  // ================================================================ 힌트 (1단계: Pipou의 한마디 · 2단계: 범위 좁히기)
  const skillHint = (id) => ((C.skills || []).find((x) => x.id === id) || {}).hint || null;
  // 힌트 문장에 정답이 들어 있으면 첫 글자만 남기고 가린다 (예: prenons → p______)
  function sanitizeHint(q) {
    if (!q.hint || q.hintChecked) return;
    q.hintChecked = true;
    const answers = [q.answer, ...(q.accept || []), q.fixWord].filter((a) => typeof a === 'string' && a.trim())
      .map((a) => a.replace(/[.?!]+$/, '').trim()).filter((a) => a.length >= 2 && !hasHangul(a)).sort((x, y) => y.length - x.length);
    let h = q.hint.normalize('NFC');
    for (const a of answers) {
      const re = new RegExp(`(^|[^\\p{L}])(${a.normalize('NFC').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]")})(?=[^\\p{L}]|$)`, 'giu');
      h = h.replace(re, (m, pre, w) => pre + maskWord(w));
    }
    q.hint = h;
  }
  function hintSteps(q) {
    const st = [];
    if (q.hint) st.push('text');
    if (q.kind === 'mc' && q.options.length >= 3) st.push('narrow');
    else if (q.kind === 'type') st.push('narrow');
    else if (q.kind === 'build' && blocksOf(q.accept[0]).length >= 3) st.push('narrow');
    else if (q.kind === 'tap' && q.chunks.length >= 4) st.push('narrow');
    else if (q.kind === 'match') st.push('narrow', 'narrow');
    return st;
  }
  // 단어마다 첫 글자만 남기고 가리기: "Parles-tu" → "P_____-t_"
  const maskWord = (w) => w.replace(/\p{L}+/gu, (m) => m[0] + '_'.repeat(m.length - 1));
  function showHint(html) {
    const box = $('#hintbox');
    if (!box.firstChild) box.innerHTML = `<div class="hint-card"><span class="hint-pipou">${Pipou.svg('think')}</span><div class="hint-bubble"><b>Pipou의 힌트</b><div class="hint-lines"></div></div></div>`;
    $('.hint-lines', box).insertAdjacentHTML('beforeend', `<div class="hint-line">${html}</div>`);
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function useHint() {
    const q = P.queue[P.i];
    const step = P.hintSteps[P.hintStep];
    if (!step || P.phase !== 'answer') return;
    P.hintStep++;
    P.hinted = true;
    P.hintsUsed++;
    S.stats.hints = (S.stats.hints || 0) + 1;
    SFX.tap();
    const qa = $('#qa');
    const check = $('#check');
    if (step === 'text') showHint(esc(q.hint));
    else if (q.kind === 'mc') {
      const wrongs = shuffle($$('.opt', qa).filter((b) => norm(q.options[+b.dataset.i]) !== norm(q.answer)));
      const n = Math.ceil(wrongs.length / 2);
      wrongs.slice(0, n).forEach((b) => {
        if (b.classList.contains('sel')) { P.sel = null; check.disabled = true; }
        b.classList.remove('sel'); b.classList.add('gone'); b.disabled = true;
      });
      showHint(`✂️ 오답 ${n}개를 지웠어요!`);
    } else if (q.kind === 'type') {
      showHint(`첫 글자 힌트: <code class="fr mask">${esc(maskWord(q.accept[0]))}</code>`);
    } else if (q.kind === 'build') {
      const want = blocksOf(q.accept[0]);
      const n = Math.max(1, Math.ceil(want.length / 3));
      const sel = [];
      for (const w of want.slice(0, n)) {
        const i = q.blocks.findIndex((b, k) => norm(b) === norm(w) && !sel.includes(k));
        if (i >= 0) sel.push(i);
      }
      P.sel = sel;
      P.buildRedraw && P.buildRedraw();
      showHint(`🧱 앞의 ${sel.length}블록을 채워뒀어요!`);
    } else if (q.kind === 'tap') {
      const others = shuffle($$('.chip', qa).filter((b) => !q.chunks[+b.dataset.i].bad));
      const drop = others.slice(0, Math.max(0, others.length - 2));
      drop.forEach((b) => {
        if (b.classList.contains('sel')) { P.sel = null; check.disabled = true; }
        b.classList.remove('sel'); b.classList.add('gone'); b.disabled = true;
      });
      showHint(`🔎 후보를 ${q.chunks.length - drop.length}개로 줄였어요!`);
    } else if (q.kind === 'match') {
      P.matchAuto && P.matchAuto();
      showHint('🧩 짝 하나를 맞춰드렸어요!');
    }
    const hb = $('#hint');
    if (P.hintStep >= P.hintSteps.length) { hb.disabled = true; hb.classList.add('spent'); hb.querySelector('small').textContent = '다 씀'; }
    else hb.querySelector('small').textContent = '한 번 더';
  }

  function renderMC(q, qa, check) {
    const opts = q.fixed ? q.options : q.options;
    qa.innerHTML = `<div class="options ${q.grid ? 'grid' : ''}">${opts.map((o, i) =>
      `<button class="opt ${q.optionsFr ? 'fr' : ''}" data-i="${i}">${q.grid ? '' : `<span class="k">${i + 1}</span>`}<span>${esc(o)}</span></button>`).join('')}</div>`;
    $$('.opt', qa).forEach((b) => b.onclick = () => {
      if (P.phase !== 'answer') return;
      $$('.opt', qa).forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      P.sel = opts[+b.dataset.i];
      check.disabled = false;
      SFX.tap();
      if (q.optionsFr && !q.listen) TTS.speak(P.sel);
    });
  }
  function renderOX(q, qa, check) {
    qa.innerHTML = `<div class="ox"><button class="opt" data-v="1">⭕<small>맞아요</small></button><button class="opt" data-v="0">❌<small>틀려요</small></button></div>`;
    $$('.opt', qa).forEach((b) => b.onclick = () => {
      if (P.phase !== 'answer') return;
      $$('.opt', qa).forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      P.sel = b.dataset.v === '1';
      check.disabled = false;
      SFX.tap();
    });
  }
  const ACCENTS = ['é', 'è', 'ê', 'à', 'â', 'ç', 'î', 'ï', 'ô', 'û', 'ù', 'ë', 'œ', "'", '-'];
  function renderType(q, qa, check) {
    qa.innerHTML = `<div class="type-wrap">
      <input class="type-input fr" id="ti" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" lang="fr" placeholder="여기에 입력">
      <div class="accents">${ACCENTS.map((a) => `<button data-a="${esc(a)}">${esc(a)}</button>`).join('')}</div></div>`;
    const inp = $('#ti');
    const sync = () => { P.sel = inp.value; check.disabled = !inp.value.trim(); };
    inp.addEventListener('input', sync);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!check.disabled) check.click(); } });
    $$('.accents button', qa).forEach((b) => {
      b.addEventListener('pointerdown', (e) => e.preventDefault()); // 키보드 안 내려가게
      b.onclick = () => {
        const s = inp.selectionStart ?? inp.value.length, e2 = inp.selectionEnd ?? inp.value.length;
        inp.value = inp.value.slice(0, s) + b.dataset.a + inp.value.slice(e2);
        inp.setSelectionRange(s + 1, s + 1);
        inp.focus();
        sync();
      };
    });
    setTimeout(() => inp.focus(), 60);
  }
  function renderBuild(q, qa, check) {
    P.sel = [];
    qa.innerHTML = `<div class="build-line" id="line"></div><div class="bank" id="bank">${q.blocks.map((w, i) =>
      `<button class="chip fr" data-i="${i}">${esc(w)}</button>`).join('')}</div>`;
    const line = $('#line');
    const redraw = () => {
      line.innerHTML = P.sel.map((i) => `<button class="chip fr" data-i="${i}">${esc(q.blocks[i])}</button>`).join('');
      $$('#bank .chip').forEach((b) => b.classList.toggle('used', P.sel.includes(+b.dataset.i)));
      $$('.chip', line).forEach((b) => b.onclick = () => {
        if (P.phase !== 'answer') return;
        P.sel = P.sel.filter((x) => x !== +b.dataset.i);
        SFX.tap(); redraw();
      });
      check.disabled = P.sel.length === 0;
    };
    P.buildRedraw = redraw;
    $$('#bank .chip').forEach((b) => b.onclick = () => {
      if (P.phase !== 'answer' || P.sel.includes(+b.dataset.i)) return;
      P.sel.push(+b.dataset.i);
      SFX.tap(); redraw();
    });
    redraw();
  }
  function renderTap(q, qa, check) {
    qa.innerHTML = `<div class="tap-line fr">${q.chunks.map((c, i) => `<button class="chip" data-i="${i}">${esc(c.t)}</button>`).join('')}</div>`;
    $$('.chip', qa).forEach((b) => b.onclick = () => {
      if (P.phase !== 'answer') return;
      $$('.chip', qa).forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      P.sel = +b.dataset.i;
      check.disabled = false;
      SFX.tap();
    });
  }
  function renderMatch(q, qa, check) {
    const L = shuffle(q.pairs.map((p, i) => ({ ...p, i })));
    const R = shuffle(q.pairs.map((p, i) => ({ ...p, i })));
    P.matchBad = new Set();
    P.matchLeft = q.pairs.length;
    check.textContent = '짝을 모두 맞춰보세요';
    qa.innerHTML = `<div class="match"><div class="col">${L.map((p) => `<button class="opt ${q.lFr ? 'fr' : ''}" data-side="l" data-i="${p.i}">${esc(p.l)}</button>`).join('')}</div>
      <div class="col">${R.map((p) => `<button class="opt ${q.rFr ? 'fr' : ''}" data-side="r" data-i="${p.i}">${esc(p.r)}</button>`).join('')}</div></div>`;
    let selL = null, selR = null;
    P.matchAuto = () => {
      const i = q.pairs.findIndex((_, k) => !$(`[data-side="l"][data-i="${k}"]`, qa).classList.contains('done'));
      if (i < 0) return;
      $$('.opt', qa).forEach((x) => x.classList.remove('sel'));
      selL = selR = null;
      [$(`[data-side="l"][data-i="${i}"]`, qa), $(`[data-side="r"][data-i="${i}"]`, qa)].forEach((b) => b.classList.add('done'));
      P.matchLeft--;
      if (P.matchLeft === 0) { P.sel = true; setTimeout(submit, 350); }
    };
    const tryPair = () => {
      if (selL === null || selR === null) return;
      const bl = $(`[data-side="l"][data-i="${selL}"]`, qa), br = $(`[data-side="r"][data-i="${selR}"]`, qa);
      if (selL === selR) {
        bl.classList.remove('sel'); br.classList.remove('sel');
        bl.classList.add('done'); br.classList.add('done');
        SFX.tap();
        if (q.lFr) TTS.speak(q.pairs[selL].l);
        else if (q.rFr) TTS.speak(joinSubj(q.pairs[selL].l.split('/')[0], q.pairs[selL].r));
        P.matchLeft--;
        if (P.matchLeft === 0) { P.sel = true; setTimeout(submit, 350); }
      } else {
        P.mistakes++;
        P.matchBad.add(q.pairs[selL].id); P.matchBad.add(q.pairs[selR].id);
        [bl, br].forEach((b) => { b.classList.remove('sel'); b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); });
        SFX.bad(); buzz(60);
      }
      selL = selR = null;
    };
    $$('.opt', qa).forEach((b) => b.onclick = () => {
      if (P.phase !== 'answer' || b.classList.contains('done')) return;
      const side = b.dataset.side, i = +b.dataset.i;
      $$(`[data-side="${side}"]`, qa).forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      if (side === 'l') selL = i; else selR = i;
      tryPair();
    });
  }

  const PRAISE = ['Parfait !', 'Bien joué !', 'Excellent !', 'Super !', 'Bravo !', "C'est ça !", 'Magnifique !', 'Génial !'];
  const OOPS = ['Oups…', 'Presque !', 'Pas grave !', 'Aïe !', 'Mince !'];

  function evaluate(q) {
    if (q.kind === 'vtable') return vtEvaluate(q);
    let ok = false;
    let hint = '';
    if (q.kind === 'mc') ok = norm(P.sel) === norm(q.answer);
    else if (q.kind === 'ox') ok = P.sel === q.ox;
    else if (q.kind === 'tap') ok = q.chunks[P.sel] && q.chunks[P.sel].bad;
    else if (q.kind === 'match') ok = P.matchBad.size === 0;
    else if (q.kind === 'build') {
      const s = norm(P.sel.map((i) => q.blocks[i]).join(' '));
      ok = q.accept.some((a) => norm(a) === s);
    } else if (q.kind === 'type') {
      const lz = (s) => norm(q.loose ? String(s ?? '').replace(/[,;:!?.«»"()]/g, ' ') : s); // 받아쓰기·작문: 문장부호 무시
      const n = lz(P.sel);
      ok = q.accept.some((a) => lz(a) === n);
      if (!ok && q.elisionTrap && n === norm(q.elisionTrap)) hint = "élision! 모음 앞에선 je → j'";
      else if (!ok && q.accept.some((a) => deaccent(lz(a)) === deaccent(n))) hint = '악센트만 달라요! 철자까지 정확하게 ✍️';
    }
    return { ok: !!ok, hint };
  }

  function submit() {
    const q = P.queue[P.i];
    const { ok, hint } = evaluate(q);
    if (P.mode === 'exam') P.ex.log[P.i] = { q, ok, hint, given: givenText(q) };
    if (P.mode === 'exam' && P.ex.grading === 'end') { P.answered++; SFX.tap(); next(); return; }
    P.phase = 'feedback';
    P.answered++;
    S.stats.answers++;
    const hinted = P.hinted;
    // 직접 쓰기 오답은 "내 답도 맞아요"로 되돌릴 수 있게 채점 전 상태를 기억 (악센트·엘리지옹 실수는 진짜 오답이라 제외)
    const undo = !ok && q.kind === 'type' && !hint ? snapshotAnswer(q) : null;
    const gained = commitAnswer(q, ok, hinted);
    if (q.vid && P.vlog) P.vlog[P.i] = { vid: q.vid, ok };
    save();
    const hb = $('#hint');
    if (hb) hb.classList.add('hidden');
    showFeedback(q, ok, { hinted, hint, gained, undo });
  }

  // "내 답도 맞아요": 오답 기록을 되돌리고 정답으로 다시 기록
  function overrideAnswer(q, undo, hinted) {
    if (!P || P.phase !== 'feedback' || P.queue[P.i] !== q) return;
    restoreAnswer(q, undo);
    if (P.mode === 'exam' && P.ex.log[P.i]) P.ex.log[P.i].ok = true;
    const gained = commitAnswer(q, true, hinted);
    if (q.vid && P.vlog) P.vlog[P.i] = { vid: q.vid, ok: true };
    save();
    showFeedback(q, true, { hinted, gained, overridden: true });
  }
  function snapshotAnswer(q) {
    const copy = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
    const kind = q.listen ? 'listen' : q.kind;
    return {
      cards: q.ids.map((id) => [id, copy(S.cards[id])]), sk: q.skill ? copy(S.sk[q.skill]) : undefined, kind, kd: copy(S.kd[kind]),
      combo: P.combo, mistakes: P.mistakes, queueLen: P.queue.length, retried: new Set(P.retried),
    };
  }
  function restoreAnswer(q, snap) {
    for (const [id, c] of snap.cards) { if (c) S.cards[id] = c; else delete S.cards[id]; }
    if (q.skill) { if (snap.sk) S.sk[q.skill] = snap.sk; else delete S.sk[q.skill]; }
    if (snap.kd) S.kd[snap.kind] = snap.kd; else delete S.kd[snap.kind];
    P.combo = snap.combo;
    P.mistakes = snap.mistakes;
    P.queue.length = snap.queueLen; // 이 오답 때문에 뒤에 붙은 재도전 문제 빼기
    P.retried = snap.retried;
  }

  // 채점 결과를 기록에 반영 (복습 스케줄·통계·XP·재도전 문제). 얻은 XP를 돌려준다
  function commitAnswer(q, ok, hinted) {
    justGraduated = [];
    if (q.kind === 'match' && q.ids.length > 1) q.ids.forEach((id) => grade(id, !P.matchBad.has(id), hinted, q.retry));
    else q.ids.forEach((id) => grade(id, ok, hinted, q.retry));
    if (justGraduated.length) P.graduated = (P.graduated || 0) + justGraduated.length;
    recordStats(q, ok, hinted);

    let gained = 0;
    if (ok) {
      P.ok++; S.stats.correct++;
      if (hinted) {
        gained = q.retry ? 3 : 5; // 힌트 정답: XP 절반, 콤보는 유지만
      } else {
        P.combo++;
        P.bestCombo = Math.max(P.bestCombo, P.combo);
        gained = q.retry ? 5 : 10;
        if (P.combo >= 5) gained += 5;
      }
      P.xp += gained;
    } else {
      P.combo = 0;
      if (q.kind !== 'match') P.mistakes++;
      const key = q.gen ? `gen:${q.skill}` : q.ids.join(',');
      if (P.mode !== 'exam' && !P.retried.has(key)) {
        P.retried.add(key);
        const cards = q.ids.map((id) => allCards.find((c) => c.id === id)).filter(Boolean);
        const retry = q.gen && !cards.length ? genFor(q.skill) : cards.length > 1 ? makeWordMatch(cards) : cards.length ? makeQuestion(cards[0]) : null;
        if (retry) { retry.retry = true; P.queue.push(retry); }
      }
    }
    return gained;
  }

  // 채점 결과 화면. overridden = "내 답도 맞아요"로 정답 처리한 뒤 다시 그리는 경우
  function showFeedback(q, ok, { hinted, hint = '', gained = 0, undo = null, overridden = false }) {
    const foot = $('#foot');
    foot.classList.remove('ok', 'bad');
    foot.classList.add(ok ? 'ok' : 'bad');
    const qa = $('#qa');
    if (q.kind === 'mc') $$('.opt', qa).forEach((b) => {
      const v = q.options[+b.dataset.i];
      if (norm(v) === norm(q.answer)) b.classList.add('right');
      else if (b.classList.contains('sel')) b.classList.add('wrong');
    });
    if (q.kind === 'ox') $$('.opt', qa).forEach((b) => {
      if ((b.dataset.v === '1') === q.ox) b.classList.add('right');
      else if (b.classList.contains('sel')) b.classList.add('wrong');
    });
    if (q.kind === 'tap') $$('.chip', qa).forEach((b) => {
      if (q.chunks[+b.dataset.i].bad) b.classList.add(ok ? 'right' : 'wrong');
      b.classList.remove('sel');
    });
    if (q.kind === 'type') {
      const ti = $('#ti');
      ti.classList.remove('right', 'wrong');
      ti.classList.add(ok ? 'right' : 'wrong');
      ti.blur();
    }
    if (q.kind === 'build') $$('#line .chip').forEach((b) => b.classList.add(ok ? 'right' : 'wrong'));
    if (q.kind === 'vtable') (q._cells || []).forEach((r, i) => { const inp = $(`#vt-${i}`); if (inp) { inp.classList.add(r ? 'right' : 'wrong'); inp.blur(); inp.readOnly = true; } });

    const showAnswer = !ok || q.kind === 'type' || q.kind === 'vtable' || q.kind === 'build' || q.kind === 'tap' || q.kind === 'ox' || q.kind === 'match';
    const title = overridden ? '정답으로 바꿨어요' : ok ? (hinted ? '힌트 찬스 성공!' : pick(PRAISE)) : (q.kind === 'match' ? '짝 맞추기 완료!' : pick(OOPS));
    const noteSkill = hint.startsWith('élision') ? 'elision' : q.skill;
    const related = !ok && noteSkill ? relatedNotes(q, noteSkill) : [];
    $('#fb').innerHTML = `
      <div class="fb-title"><span class="fb-pipou">${Pipou.svg(ok ? 'happy' : q.kind === 'match' ? 'think' : 'sad')}</span> ${esc(title)} ${q.say ? speakBtn(q.say) : ''}</div>
      ${hint ? `<div class="fb-ans">${esc(hint)}</div>` : ''}
      ${showAnswer && q.reveal ? `<div class="fb-ans fr"><span class="lbl">${ok ? '정답' : '정답은'}</span>${esc(q.reveal).replace(/\n/g, '<br>')}</div>` : ''}
      ${q.pron ? `<div class="fb-pron">🗣️ ${esc(q.pron)}</div>` : ''}
      ${q.explain ? `<div class="fb-exp">${esc(q.explain)}</div>` : ''}
      ${q.kind === 'match' && !ok ? `<div class="fb-exp">헷갈린 카드는 곧 다시 나와요.</div>` : ''}
      ${gradLine(q, ok, hinted)}
      ${undo ? '<button class="fb-override" id="fb-override">🙋 내 답도 맞아요 — 정답으로 처리</button>' : ''}
      ${related.length ? `<button class="note-link" id="fb-note">📖 관련 노트 보기 · ${esc(related[0].s.h)}</button>` : ''}`;
    bindSpeak($('#fb'));
    if (related.length) $('#fb-note').onclick = () => openNoteSheet(related);
    if (undo) $('#fb-override').onclick = () => overrideAnswer(q, undo, hinted);
    const check = $('#check');
    check.disabled = false;
    check.textContent = '계속';
    check.className = `btn ${ok ? 'green' : 'red'}`;

    const combo = $('#combo');
    combo.textContent = P.combo >= 3 ? `🔥 ${P.combo}` : '';
    if (P.combo >= 3) { combo.classList.remove('pop'); void combo.offsetWidth; combo.classList.add('pop'); }
    $('.progress i').style.width = `${((P.i + 1) / P.queue.length) * 100}%`;

    if (ok) {
      if (P.combo > 0 && P.combo % 5 === 0) SFX.combo(); else SFX.ok();
      buzz(20);
      const f = document.createElement('div');
      f.className = 'xp-float';
      f.textContent = `+${gained} XP`;
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 900);
    } else if (q.kind !== 'match') { SFX.bad(); buzz([40, 40, 40]); }
    if (q.say && !overridden) setTimeout(() => TTS.speak(q.say), ok ? 280 : 420);
  }

  // 졸업까지 남은 연속 정답을 ●○로 보여준다 (카드 하나짜리 문제만)
  function gradLine(q, ok, hinted) {
    if (q.ids.length !== 1) return '';
    const card = cardById.get(q.ids[0]);
    const st = card && S.cards[card.id];
    if (!st) return '';
    if (justGraduated.includes(card.id)) return `<div class="grad-line done">🎓 <b>졸업!</b> 이제 이 카드는 가끔 기억 점검으로만 나와요</div>`;
    if (st.g) return ok ? `<div class="grad-line">👑 기억 점검 통과 — 한 달 뒤에 또 확인해요</div>` : '';
    const need = needFor(card);
    const dots = Array.from({ length: need }, (_, i) => `<i class="${i < (st.st || 0) ? 'on' : ''}"></i>`).join('');
    let msg;
    if (!ok) msg = '연속 기록이 처음부터 다시 시작돼요';
    else if (q.retry) msg = '재도전 정답은 연속 기록에 안 들어가요';
    else if (hinted) msg = '💡 힌트 정답은 연속 기록에 안 들어가요';
    else msg = `졸업까지 ${need - st.st}번 — 다음은 내일부터 세요`;
    return `<div class="grad-line"><span class="dots">${dots}</span>${esc(msg)}</div>`;
  }

  function next() {
    TTS.ok && speechSynthesis.cancel();
    P.i++;
    if (P.i >= P.queue.length) finish();
    else { renderPlayer(); window.scrollTo(0, 0); }
  }

  function finish() {
    P.finished = true;
    if (P.mode === 'exam') examCommit();
    const perfect = P.mistakes === 0;
    if (perfect) P.xp += 20;
    const t = today();
    const levelBefore = levelOf(S.xp);
    S.xp += P.xp;
    const d = S.days[t] || (S.days[t] = { xp: 0, s: 0 });
    d.xp += P.xp;
    d.s++;
    S.stats.sessions++;
    S.stats.bestCombo = Math.max(S.stats.bestCombo, P.bestCombo);
    if (P.mode === 'verbtest') vtFinish();
    let streakUp = false;
    if (d.s >= S.settings.goal && S.streak.last !== t) {
      S.streak.n = S.streak.last === addDays(t, -1) ? S.streak.n + 1 : 1;
      S.streak.last = t;
      S.streak.best = Math.max(S.streak.best, S.streak.n);
      streakUp = true;
    }
    save();
    syncNow();
    const levelAfter = levelOf(S.xp);
    (P.mode === 'exam' ? renderExamResult : renderResult)({ perfect, streakUp, levelUp: levelAfter > levelBefore, levelAfter, day: d });
  }

  function renderResult({ perfect, streakUp, levelUp, levelAfter, day }) {
    view = 'result';
    const acc = P.answered ? Math.round((P.ok / P.answered) * 100) : 0;
    const [mood, head, sub] = perfect ? ['cheer', 'Parfait !', '실수 0개! 완벽한 한 판 (+20 XP 보너스)'] : acc >= 80 ? ['happy', 'Très bien !', '아주 좋아요. 틀린 건 금방 다시 나와요'] : acc >= 60 ? ['idle', 'Pas mal !', '나쁘지 않아요! 오답은 곧 다시 복습해요'] : ['think', 'Courage !', '괜찮아요, 틀린 만큼 기억에 남아요'];
    const L = levelAfter;
    const lo = need(L), hi = need(L + 1);
    const pct = Math.min(100, ((S.xp - lo) / (hi - lo)) * 100);
    const [, le, lt] = titleOf(L);
    const goal = S.settings.goal;
    const banner = streakUp
      ? `<div class="streak-banner"><span class="f">🔥</span><div>${S.streak.n}일 연속!<br><small>오늘 목표 달성 — 내일도 만나요</small></div></div>`
      : day.s < goal
        ? `<div class="streak-banner"><span class="f">⏳</span><div>오늘 ${day.s}/${goal}판<br><small>${goal - day.s}판만 더 하면 스트릭 ${currentStreak() + 1}일!</small></div></div>`
        : '';
    app.innerHTML = `
      <div class="result">
        <div class="big">${Pipou.svg(mood, 'bounce')}</div>
        <div><h2>${head}</h2><div class="muted">${sub}</div>${P.graduated ? `<div class="grad-pill">🎓 이번 판 졸업 ${P.graduated}장</div>` : ''}${P.hintsUsed ? `<div class="muted" style="font-size:13.5px;margin-top:4px">💡 힌트 ${P.hintsUsed}번 사용 — 힌트 쓴 카드는 내일 다시 나와요</div>` : ''}</div>
        <div class="tiles">
          <div class="tile" style="--c:var(--gold)"><div class="th">XP</div><div class="tv">+${P.xp}</div></div>
          <div class="tile" style="--c:var(--green)"><div class="th">정답률</div><div class="tv">${acc}%</div></div>
          <div class="tile" style="--c:var(--orange)"><div class="th">최고 콤보</div><div class="tv">${P.bestCombo}</div></div>
        </div>
        ${banner}
        ${P.mode === 'verbtest' ? vtResultHtml() : ''}
        <div class="levelbar"><div class="lb-top"><span>${le} Lv.${L} ${esc(lt)}</span><span>${S.xp - lo} / ${hi - lo}</span></div><div class="bar"><i style="width:0%"></i></div></div>
        <div class="actions">
          <button class="btn" id="again">${P.mode === 'verbtest' ? '같은 설정으로 다시 ▶' : '한 판 더 ▶'}</button>
          <button class="btn ghost" id="home">${P.mode === 'verbtest' ? '📒 동사장으로' : '홈으로'}</button>
        </div>
      </div>`;
    requestAnimationFrame(() => setTimeout(() => { const i = $('.levelbar .bar i'); if (i) i.style.width = pct + '%'; }, 80));
    const mode = P.mode, lessonId = P.lessonId, vtCfg = P.vt;
    if (mode === 'verbtest') {
      bindVtResult();
      $('#again').onclick = () => startVerbTest(vtCfg);
      $('#home').onclick = () => { P = null; renderVerbs(); window.scrollTo(0, 0); };
    } else {
      $('#again').onclick = () => startSession(mode === 'mistakes' && !mistakeCards().length ? 'review' : mode, lessonId);
      $('#home').onclick = () => { P = null; goHome(); };
    }
    SFX.fanfare();
    if (perfect || streakUp) confetti();
    if (levelUp) setTimeout(() => showLevelUp(levelAfter), 900);
  }
  function showLevelUp(L) {
    const [, e, name, ko] = titleOf(L);
    const el = document.createElement('div');
    el.className = 'levelup';
    el.innerHTML = `<div class="card"><div class="lv-pipou">${Pipou.svg('cheer', 'bounce')}<span class="lv-badge">${e}</span></div><h3>레벨 업! Lv.${L}</h3><p><b>${esc(name)}</b> · ${esc(ko)}</p><button class="btn">Allez !</button></div>`;
    document.body.appendChild(el);
    SFX.fanfare(); confetti(3000); buzz([30, 60, 30]);
    $('button', el).onclick = () => el.remove();
  }

  // ================================================================ 동사장 (Mes verbes)
  // 기본 목록 = content.json의 verbs. 학생이 바꾼 것 = S.vb (기기 연동으로 합쳐짐, 바꾼 시각이 늦은 쪽이 이김)
  //   S.vb.ed[id]  = { doc, at }   추가하거나 고친 동사
  //   S.vb.del[id] = { v, at }     지운 동사 (v=false면 되살림)
  //   S.vb.kn[id]  = { v, at }     외웠어요 표시
  const VB_GROUPS = { 1: { name: '1군', sub: '-er 규칙 동사', color: 'var(--blue)' }, 2: { name: '2군', sub: '-ir 규칙 동사 (-issons)', color: 'var(--purple)' }, 3: { name: '불규칙', sub: '3군 (-ir · -re · -oir 등)', color: 'var(--orange)' } };
  const AUX_FORMS = { avoir: ['ai', 'as', 'a', 'avons', 'avez', 'ont'], être: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'] };
  const ETRE_VERBS = new Set(['aller', 'venir', 'arriver', 'partir', 'entrer', 'sortir', 'monter', 'descendre', 'naître', 'mourir', 'tomber', 'rester', 'rentrer', 'retourner', 'revenir', 'devenir', 'passer', 'repartir', 'ressortir', 'redescendre', 'remonter', 'parvenir', 'intervenir']);
  const IR_IRREG = /(dormir|partir|sortir|sentir|servir|mentir|courir|mourir|ouvrir|offrir|couvrir|souffrir|cueillir|tenir|venir|fuir|acquérir|bouillir)$/;
  const vbSlug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const vbIsPron = (inf) => /^(se |s')/.test(inf);
  const vbBase = (inf) => inf.replace(/^(se |s')/, '');
  const VB = { q: '', filter: 'all', hide: false, revealed: new Set(), confirm: null, showDeleted: false };
  function vbState() {
    if (!S.vb) S.vb = { ed: {}, del: {}, kn: {} };
    for (const k of ['ed', 'del', 'kn', 'st']) if (!S.vb[k]) S.vb[k] = {};
    return S.vb;
  }
  function vbList() {
    const st = vbState();
    const map = new Map((C.verbs || []).map((v) => [v.id, { ...v, origin: 'class' }]));
    for (const [id, e] of Object.entries(st.ed)) map.set(id, { ...(map.get(id) || {}), ...e.doc, id, origin: map.has(id) ? (map.get(id).origin) : 'mine', edited: map.has(id) });
    const out = [];
    for (const [id, v] of map) {
      if (vbIsDeleted(id)) continue;
      out.push({ ...v, known: !!(st.kn[id] && st.kn[id].v) });
    }
    return out.sort((a, b) => (a.group || '3').localeCompare(b.group || '3') || vbBase(a.inf).localeCompare(vbBase(b.inf), 'fr'));
  }
  function vbIsDeleted(id) {
    const st = vbState();
    const d = st.del[id];
    return !!(d && d.v && d.at >= ((st.ed[id] || {}).at || 0));
  }
  function vbDeleted() { return (C.verbs || []).filter((v) => vbIsDeleted(v.id)); }
  function vbTouch() { save(); syncNow(); }

  // ---- 규칙으로 변화형 채우기 (규칙 동사 · 아는 동사의 파생어)
  function vbGuess(infRaw) {
    const inf = infRaw.trim().toLowerCase().replace(/\s+/g, ' ');
    const pron = vbIsPron(inf);
    const base = vbBase(inf);
    let forms, pp, group, aux = 'avoir', how;
    const list = vbList();
    // 1) 아는 동사에서 파생 (revenir ← venir, permettre ← mettre, découvrir ← couvrir…)
    const parent = list.filter((v) => !v.pronominal && v.group === '3' && base !== vbBase(v.inf) && base.endsWith(vbBase(v.inf)) && vbBase(v.inf).length >= 4)
      .sort((a, b) => vbBase(b.inf).length - vbBase(a.inf).length)[0];
    if (parent) {
      const pre = base.slice(0, base.length - parent.inf.length);
      forms = Object.fromEntries(PERSONS.map((p) => [p, pre + parent.forms[p]]));
      pp = pre + parent.pp; group = '3'; aux = parent.aux; how = `「${parent.inf}」와 같은 변화`;
    } else if (/er$/.test(base) && base !== 'aller') {
      const st = base.slice(0, -2);
      let strong = st, nous = st;
      if (/g$/.test(st)) nous = st + 'e';
      if (/c$/.test(st)) nous = st.slice(0, -1) + 'ç';
      if (/(oy|uy)$/.test(st)) strong = st.slice(0, -1) + 'i';
      else if (/(app|rapp)el$|(^|re)jet$/.test(st)) strong = st + st.slice(-1);
      else if (/é[^aeiouéèê]+$/.test(st)) strong = st.replace(/é([^aeiouéèê]+)$/, 'è$1');
      else if (/e[^aeiouéèê]$/.test(st) && st.length > 2) strong = st.replace(/e([^aeiouéèê])$/, 'è$1');
      forms = { je: strong + 'e', tu: strong + 'es', il: strong + 'e', nous: nous + 'ons', vous: st + 'ez', ils: strong + 'ent' };
      pp = st + 'é'; group = '1'; how = '1군 규칙';
    } else if (/ir$/.test(base) && !IR_IRREG.test(base)) {
      const st = base.slice(0, -2);
      forms = { je: st + 'is', tu: st + 'is', il: st + 'it', nous: st + 'issons', vous: st + 'issez', ils: st + 'issent' };
      pp = st + 'i'; group = '2'; how = '2군 규칙 (dormir·partir처럼 3군일 수도 있으니 확인!)';
    } else if (/dre$/.test(base) && !/prendre$/.test(base)) {
      const st = base.slice(0, -2);
      forms = { je: st + 's', tu: st + 's', il: st, nous: st + 'ons', vous: st + 'ez', ils: st + 'ent' };
      pp = st + 'u'; group = '3'; how = 'attendre형 (-dre)';
    } else return null;
    if (pron) {
      const refl = ['me', 'te', 'se', 'nous', 'vous', 'se'];
      forms = Object.fromEntries(PERSONS.map((p, i) => {
        const f = forms[p], r = refl[i];
        return [p, r.length === 2 && VOWEL.test(f) ? r[0] + "'" + f : `${r} ${f}`];
      }));
      aux = 'être';
    } else if (ETRE_VERBS.has(base)) aux = 'être';
    const nous = forms.nous.replace(/^nous /, '');
    let ppr = ({ avoir: 'ayant', être: 'étant', savoir: 'sachant' })[base] || nous.replace(/ons$/, 'ant');
    if (pron) ppr = (VOWEL.test(ppr) ? "s'" : 'se ') + ppr;
    return { inf, forms, pp, ppr, group, aux, pronominal: pron, how };
  }

  // ---- 표시용 변화형
  function vbMark(form, inf) {
    const m = form.match(/^((?:me|te|se|nous|vous) |[mts]')?(.*)$/);
    const refl = m[1] || '', verb = m[2];
    const stem = vbBase(inf).replace(/(er|ir|re|oir)$/, '');
    let i = 0;
    while (i < verb.length && i < stem.length && verb[i] === stem[i]) i++;
    if (i === 0) i = Math.max(0, verb.length - 3);
    const tail = verb.slice(i);
    return `${esc(refl)}${esc(verb.slice(0, i))}${tail ? `<em>${esc(tail)}</em>` : ''}`;
  }
  function vbPresent(v) {
    return PERSONS.map((p) => {
      const f = (v.forms || {})[p] || '';
      const s = p === 'je' && !v.pronominal && VOWEL.test(f) ? "j'" : PLABEL[p];
      const spoken = (s.endsWith("'") ? s : s.split('/')[0] + ' ') + f;
      return { s, html: vbMark(f, v.inf), spoken };
    });
  }
  function vbPC(v) {
    const aux = AUX_FORMS[v.aux] || AUX_FORMS.avoir;
    const etre = v.aux === 'être';
    const agree = ['(e)', '(e)', '(e)', '(e)s', '(e)(s)', '(e)s'];
    const refl = ['me', 'te', 'se', 'nous', 'vous', 'se'];
    return PERSONS.map((p, i) => {
      const a = aux[i];
      const pre = v.pronominal ? ((i !== 3 && i !== 4 && VOWEL.test(a)) ? refl[i][0] + "'" + a : `${refl[i]} ${a}`) : a;
      const s = !v.pronominal && p === 'je' && VOWEL.test(a) ? "j'" : PLABEL[p];
      const spoken = (s.endsWith("'") ? s : s.split('/')[0] + ' ') + pre + ' ' + v.pp;
      return { s, html: `${esc(pre)} ${esc(v.pp)}${etre ? `<em>${esc(agree[i])}</em>` : ''}`, spoken };
    });
  }

  function vbCard(v) {
    const g = VB_GROUPS[v.group] || VB_GROUPS[3];
    const hidden = VB.hide && !VB.revealed.has(v.id);
    const line = (l) => `<button class="vb-line ${hidden ? 'vb-hid' : ''} ${l.s.endsWith("'") ? 'el' : ''}" data-vsay="${esc(l.spoken)}"><span class="p">${esc(l.s)}</span><span class="f">${l.html}</span></button>`;
    const src = v.origin === 'mine' ? '내가 추가한 동사' : v.since ? `${shortDate(v.since)} 수업부터` : '수업 예문·필기에 등장';
    return `<article class="vb-card ${v.known ? 'known' : ''}" data-vid="${esc(v.id)}">
      <div class="vb-head">
        <span class="vb-inf fr">${esc(v.inf)}</span>
        ${speakBtn(v.inf)}
        <span class="muted">→</span><span class="vb-ko">${esc(v.ko || '')}</span>
        <span class="vb-pron muted">${esc(v.pron || '')}</span>
        <span class="vb-badge" style="background:${g.color}">${g.name}${v.pronominal ? ' · 대명동사' : ''}</span>
        ${v.origin === 'mine' ? '<span class="vb-badge" style="background:var(--muted)">내가 추가</span>' : v.edited ? '<span class="vb-badge" style="background:var(--muted)">수정함</span>' : ''}
      </div>
      <div class="vb-tools">
        <button class="vb-known" data-vact="known" aria-pressed="${v.known}">${v.known ? '✓ 외웠어요' : '외웠어요?'}</button>
        ${VB.hide ? `<button class="vb-more" data-vact="reveal">${VB.revealed.has(v.id) ? '다시 가리기' : '다 보기'}</button>` : ''}
        <button class="vb-more" data-vact="edit">수정</button><button class="vb-more" data-vact="del">삭제</button>
      </div>
      ${VB.confirm === v.id ? `<div class="vb-confirm">「${esc(v.inf)}」를 동사장에서 지울까요?${v.origin === 'class' ? ' (설정 아래 「지운 동사」에서 되살릴 수 있어요)' : ''} <button class="btn small red" data-vact="del-yes">삭제</button><button class="btn small ghost" data-vact="del-no">취소</button></div>` : ''}
      <div class="vb-box fr">
        <div><span class="lbl">Infinitif</span><b>${esc(v.inf)}</b></div>
        <div class="${hidden ? 'vb-hid' : ''}"><span class="lbl">Participe présent</span><b class="f">${esc(v.ppr || '')}</b></div>
        <div class="${hidden ? 'vb-hid' : ''}"><span class="lbl">Participe passé</span><b class="f">${esc(v.pp || '')}</b></div>
      </div>
      <div class="vb-meta"><span>Groupe <b>${g.name}</b></span><span>Auxiliaire <b class="fr">${esc(v.aux)}</b></span><span>${esc(src)}</span>${(() => { const t = vbState().st[v.id]; return t ? `<span class="vb-score">📝 테스트 ✓${t.ok} ✗${t.ng}</span>` : ''; })()}</div>
      <div class="vb-tenses fr">
        <div class="vb-tense"><h4>Présent</h4>${vbPresent(v).map(line).join('')}</div>
        <div class="vb-tense"><h4>Passé composé</h4>${vbPC(v).map(line).join('')}</div>
      </div>
      ${v.note ? `<div class="vb-note"><b>주의</b> ${esc(v.note)}</div>` : ''}
    </article>`;
  }

  function vbFiltered(all) {
    const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = strip(VB.q.trim());
    return all.filter((v) => {
      const f = VB.filter;
      if (f === 'pron' && !v.pronominal) return false;
      if (['1', '2', '3'].includes(f) && v.group !== f) return false;
      if (f === 'todo' && v.known) return false;
      if (f === 'known' && !v.known) return false;
      if (f === 'mine' && v.origin !== 'mine') return false;
      if (!q) return true;
      return strip([v.inf, v.ko, v.pp, ...Object.values(v.forms || {})].join(' ')).includes(q);
    });
  }

  function renderVerbs() {
    view = 'verbs';
    const all = vbList();
    const n = (fn) => all.filter(fn).length;
    const chips = [['all', `전체 ${all.length}`], ['1', `1군 ${n((v) => v.group === '1')}`], ['2', `2군 ${n((v) => v.group === '2')}`], ['3', `불규칙 ${n((v) => v.group === '3')}`],
      ['pron', `대명동사 ${n((v) => v.pronominal)}`], ['todo', `외울 것 ${n((v) => !v.known)}`], ['known', `✓ 외웠어요 ${n((v) => v.known)}`]];
    if (all.some((v) => v.origin === 'mine')) chips.push(['mine', `내가 추가 ${n((v) => v.origin === 'mine')}`]);
    const vs = vbFiltered(all);
    let body = '';
    for (const g of ['1', '2', '3']) {
      const part = vs.filter((v) => v.group === g);
      if (!part.length) continue;
      body += `<div class="vb-group"><span class="vb-dot" style="background:${VB_GROUPS[g].color}"></span><h3>${VB_GROUPS[g].name}</h3><span class="muted">${esc(VB_GROUPS[g].sub)} · ${part.length}개</span></div>${part.map(vbCard).join('')}`;
    }
    if (!body) body = `<div class="empty"><div class="e">${Pipou.svg('think')}</div><p>${VB.q ? `「${esc(VB.q)}」에 맞는 동사가 없어요.` : '이 필터에 해당하는 동사가 없어요.'}</p></div>`;
    const deleted = vbDeleted();
    const scrollY = window.scrollY;
    app.innerHTML = `
      <div class="page-head"><button class="icon-btn" id="back" aria-label="뒤로">←</button><h2>📒 동사장 <small class="muted fr" style="font-weight:600">Mes verbes</small></h2><button class="btn small green" id="vb-test" style="width:auto">📝 테스트</button><button class="btn small" id="vb-add" style="width:auto">＋</button></div>
      <div class="page vb-page">
        <div class="vb-bar">
          <input class="type-input" id="vb-q" type="search" placeholder="동사·뜻 검색 (예: prendre, 가다)" value="${esc(VB.q)}" autocomplete="off" autocapitalize="off" spellcheck="false">
          <button class="btn small ghost vb-hide" id="vb-hide" aria-pressed="${VB.hide}">🙈 가리기</button>
        </div>
        <div class="vb-chips">${chips.map(([k, t]) => `<button class="vb-chip" data-vf="${k}" aria-pressed="${VB.filter === k}">${esc(t)}</button>`).join('')}</div>
        <div class="muted" style="font-size:13px">외운 동사 ${n((v) => v.known)} / ${all.length} · 줄을 누르면 읽어줘요${VB.hide ? ' · 가린 칸은 눌러서 확인' : ''}</div>
        ${body}
        ${deleted.length ? `<details class="box" ${VB.showDeleted ? 'open' : ''} id="vb-deleted"><summary>🗑️ 지운 동사 ${deleted.length}개</summary>${deleted.map((v) => `<div class="li"><div class="l1"><b class="fr">${esc(v.inf)}</b><small>${esc(v.ko)}</small></div><button class="btn small ghost" style="width:auto" data-vrestore="${esc(v.id)}">되살리기</button></div>`).join('')}</details>` : ''}
      </div>`;
    window.scrollTo(0, scrollY);
    $('#back').onclick = goHome;
    $('#vb-add').onclick = () => vbForm(null);
    $('#vb-test').onclick = openVerbTestSetup;
    const qi = $('#vb-q');
    qi.oninput = () => {
      VB.q = qi.value;
      const pos = qi.selectionStart;
      renderVerbs();
      const ni = $('#vb-q'); ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) { /* 무시 */ }
    };
    $('#vb-hide').onclick = () => { VB.hide = !VB.hide; VB.revealed.clear(); renderVerbs(); };
    $$('[data-vf]').forEach((b) => b.onclick = () => { VB.filter = b.dataset.vf; renderVerbs(); });
    $$('[data-vrestore]').forEach((b) => b.onclick = () => { const st = vbState(); st.del[b.dataset.vrestore] = { v: false, at: Date.now() }; VB.showDeleted = true; vbTouch(); renderVerbs(); toast('되살렸어요'); });
    const det = $('#vb-deleted'); if (det) det.ontoggle = () => { VB.showDeleted = det.open; };
    $$('[data-vsay]').forEach((b) => b.onclick = () => {
      if (b.classList.contains('vb-hid')) { b.classList.remove('vb-hid'); return; }
      TTS.speak(b.dataset.vsay);
    });
    $$('.vb-box .vb-hid').forEach((d) => d.onclick = () => d.classList.remove('vb-hid'));
    $$('[data-vact]').forEach((b) => b.onclick = () => {
      const id = b.closest('.vb-card').dataset.vid;
      const v = all.find((x) => x.id === id);
      const st = vbState();
      const act = b.dataset.vact;
      if (act === 'known') { st.kn[id] = { v: !v.known, at: Date.now() }; vbTouch(); renderVerbs(); return; }
      if (act === 'reveal') { VB.revealed.has(id) ? VB.revealed.delete(id) : VB.revealed.add(id); renderVerbs(); return; }
      if (act === 'edit') { vbForm(v); return; }
      if (act === 'del') { VB.confirm = id; renderVerbs(); return; }
      if (act === 'del-no') { VB.confirm = null; renderVerbs(); return; }
      if (act === 'del-yes') {
        VB.confirm = null;
        if (v.origin === 'mine') delete st.ed[id];
        st.del[id] = { v: true, at: Date.now() };
        vbTouch(); renderVerbs(); toast(`「${v.inf}」를 지웠어요`);
      }
    });
    bindSpeak();
  }

  function vbForm(v) {
    const editing = !!v;
    const f = v || { forms: {} };
    const sh = sheet(`
      <h3>${editing ? `「${esc(v.inf)}」 수정` : '동사 추가'}</h3>
      <form class="vb-form" id="vb-form">
        <div class="vb-row"><label>동사원형<input id="vf-inf" class="fr" value="${esc(f.inf || '')}" ${editing ? 'disabled' : ''} required autocapitalize="off" spellcheck="false" placeholder="예: revenir, se coucher"></label>
          ${editing ? '' : '<button type="button" class="btn small ghost" id="vf-guess" style="width:auto">✨ 변화형 채우기</button>'}</div>
        <div class="muted" id="vf-msg" style="font-size:13px">${editing ? '' : '동사원형을 쓰고 「변화형 채우기」를 누르면 규칙 동사와 아는 동사의 파생어(revenir, permettre…)는 자동으로 채워져요. 뜻·발음은 직접 써주세요.'}</div>
        <div class="vb-grid">
          <label>뜻<input id="vf-ko" value="${esc(f.ko || '')}" required></label>
          <label>발음<input id="vf-pron" value="${esc(f.pron || '')}" placeholder="[프항드흐]"></label>
          <label>그룹<select id="vf-group">${['1', '2', '3'].map((g) => `<option value="${g}" ${f.group === g ? 'selected' : ''}>${VB_GROUPS[g].name}</option>`).join('')}</select></label>
          <label>조동사<select id="vf-aux" class="fr">${['avoir', 'être'].map((a) => `<option ${f.aux === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
          <label>과거분사<input id="vf-pp" class="fr" value="${esc(f.pp || '')}" required></label>
          <label>현재분사<input id="vf-ppr" class="fr" value="${esc(f.ppr || '')}"></label>
        </div>
        <div class="vb-grid">${PERSONS.map((p) => `<label>${PLABEL[p]}<input id="vf-${p}" class="fr" value="${esc((f.forms || {})[p] || '')}" required autocapitalize="off" spellcheck="false"></label>`).join('')}</div>
        <label class="vb-full">메모 (주의할 점)<textarea id="vf-note" rows="2">${esc(f.note || '')}</textarea></label>
        <div class="row"><button type="button" class="btn ghost" id="vf-cancel">취소</button><button type="submit" class="btn">저장</button></div>
      </form>`);
    sh.classList.add('tall');
    const msg = $('#vf-msg', sh);
    $('#vf-cancel', sh).onclick = closeSheet;
    const g = $('#vf-guess', sh);
    if (g) g.onclick = () => {
      const inf = $('#vf-inf', sh).value.trim();
      if (!inf) { msg.textContent = '먼저 동사원형을 써주세요.'; return; }
      const r = vbGuess(inf);
      if (!r) { msg.textContent = '불규칙 동사라 자동으로 못 채워요. 변화형을 직접 써주세요.'; return; }
      $('#vf-group', sh).value = r.group; $('#vf-aux', sh).value = r.aux; $('#vf-pp', sh).value = r.pp; $('#vf-ppr', sh).value = r.ppr;
      PERSONS.forEach((p) => { $(`#vf-${p}`, sh).value = r.forms[p]; });
      msg.textContent = `채웠어요 (${r.how}). 틀린 곳이 없는지 확인하세요.`;
    };
    $('#vb-form', sh).onsubmit = (e) => {
      e.preventDefault();
      const inf = editing ? v.inf : $('#vf-inf', sh).value.trim().replace(/\s+/g, ' ');
      const id = editing ? v.id : vbSlug(inf);
      if (!editing && vbList().some((x) => x.id === id)) { msg.textContent = `「${inf}」는 이미 동사장에 있어요.`; return; }
      const doc = {
        inf, ko: $('#vf-ko', sh).value.trim(), pron: $('#vf-pron', sh).value.trim(), group: $('#vf-group', sh).value,
        aux: $('#vf-aux', sh).value, pp: $('#vf-pp', sh).value.trim(), ppr: $('#vf-ppr', sh).value.trim(), pronominal: vbIsPron(inf),
        forms: Object.fromEntries(PERSONS.map((p) => [p, $(`#vf-${p}`, sh).value.trim()])), note: $('#vf-note', sh).value.trim(),
        since: editing ? (v.since || '') : '', lessons: editing ? (v.lessons || []) : [],
      };
      vbState().ed[id] = { doc, at: Date.now() };
      vbTouch();
      closeSheet();
      if (!editing) { VB.q = ''; VB.filter = 'all'; }
      renderVerbs();
      toast(editing ? `「${inf}」를 고쳤어요` : `「${inf}」를 추가했어요`);
    };
  }

  // ================================================================ 동사 테스트 (동사장 안)
  // 문제는 Allez의 문제 화면(renderPlayer)을 그대로 쓴다. 변화표 6칸만 새 형식(vtable).
  // 결과: 동사별 맞힘/틀림을 S.vb.st[id] = { ok, ng, at }에, 틀린 동사는 "외울 것"으로 되돌리고 다 맞힌 동사는 "외웠어요" 제안
  const VT_CATS = {
    pres: { label: '현재형 변화', sub: 'nous ___ (prendre)', kinds: ['pres'] },
    table: { label: '변화표 채우기', sub: 'je~ils 6칸 (Quiz 1 II번)', kinds: ['table'] },
    ppaux: { label: '과거분사·조동사', sub: 'prendre → pris · avoir/être', kinds: ['pp', 'aux'] },
    inf: { label: '뜻·원형', sub: '뜻 → 원형 · 변화형 → 원형 · 현재분사', kinds: ['meaning', 'inf', 'ppr'] },
  };
  const VT = { cats: ['pres', 'table', 'ppaux', 'inf'], scope: 'view', todoOnly: false, count: 10 };
  try { Object.assign(VT, JSON.parse(localStorage.getItem('allez.vt') || '{}')); } catch (e) { /* 기본값 */ }
  const vtSave = () => { try { localStorage.setItem('allez.vt', JSON.stringify(VT)); } catch (e) { /* 무시 */ } };
  const vtSkill = (v) => (v.pronominal ? 'pronominal' : v.group === '1' ? 'pres-er' : v.group === '2' ? 'pres-ir' : 'pres-irr');
  const vtEnding = (v) => (v.group === '1' ? '-er 어미: -e · -es · -e · -ons · -ez · -ent' : v.group === '2' ? '-ir(2군) 어미: -is · -is · -it · -issons · -issez · -issent' : '불규칙 동사! 주어와 세트로 외운 소리를 떠올려봐요');

  function vtScopeList(scope, todoOnly) {
    const all = vbList();
    let list;
    if (scope === 'view') list = vbFiltered(all);
    else if (scope === 'all') list = all;
    else if (['1', '2', '3'].includes(scope)) list = all.filter((v) => v.group === scope);
    else if (scope === 'pron') list = all.filter((v) => v.pronominal);
    else if (scope === 'missed') { const st = vbState().st; list = all.filter((v) => st[v.id] && st[v.id].ng > 0 && (st[v.id].last === false)); }
    else list = all;
    if (todoOnly) list = list.filter((v) => !v.known);
    return list.filter((v) => v.forms && PERSONS.every((p) => v.forms[p]) && v.pp);
  }

  // 한 동사 + 한 종류 → Allez 문제 하나
  function vtQuestion(v, kind, pool) {
    const mc = Math.random() < 0.5;
    const base = { ids: [], vid: v.id, skill: vtSkill(v), star: false, tag: '동사 테스트', explain: v.note || '' };
    const others = pool.filter((x) => x.id !== v.id);
    const infT = [others.filter((x) => x.group === v.group).map((x) => x.inf), others.map((x) => x.inf)];
    if (kind === 'pres') {
      const p = pick(PERSONS);
      const form = v.forms[p];
      const subj = p === 'je' && !v.pronominal && VOWEL.test(form) ? "j'" : p === 'il' ? pick(['il', 'elle', 'on']) : p === 'ils' ? pick(['ils', 'elles']) : p;
      const full = subj.endsWith("'") ? subj + form : `${subj} ${form}`;
      const q = { ...base, tag: '동사 테스트 · 현재형', prompt: mc ? '알맞은 형태는?' : '동사를 변화시켜 쓰세요', main: `${subj === "j'" ? 'je' : subj} ___`, mainFr: true, sub: `${v.inf} · ${v.ko}`, reveal: full, say: full, hint: verbHint(v, p, form, null) };
      if (mc) return { ...q, kind: 'mc', options: options(form, [], 3, shuffle([...PERSONS.filter((x) => x !== p).map((x) => v.forms[x]), ...fakeForms(v, p)])), optionsFr: true, answer: form, grid: form.length < 12 };
      return { ...q, kind: 'type', accept: [form, full], elisionTrap: subj === "j'" ? `je ${form}` : null };
    }
    if (kind === 'table') {
      const lines = PERSONS.map((p) => `${p === 'je' && !v.pronominal && VOWEL.test(v.forms.je) ? "j'" : PLABEL[p] + ' '}${v.forms[p]}`);
      return { ...base, kind: 'vtable', tag: '동사 테스트 · 변화표', prompt: '현재형 변화표를 채우세요', main: v.inf, mainFr: true, speakMain: v.inf, sub: v.ko, cells: PERSONS.map((p) => v.forms[p]), reveal: lines.join('\n'), say: lines.join(', '), hint: vtEnding(v) };
    }
    if (kind === 'pp') {
      const q = { ...base, skill: 'pp', tag: '동사 테스트 · 과거분사', prompt: mc ? '과거분사는?' : '과거분사를 쓰세요', main: v.inf, mainFr: true, speakMain: v.inf, sub: v.ko, reveal: `${v.inf} → ${v.pp}`, say: v.pp, hint: ppHint(v) };
      if (mc) return { ...q, kind: 'mc', options: options(v.pp, [others.map((x) => x.pp)], 3, shuffle(fakePP(v.inf)).slice(0, 2)), optionsFr: true, answer: v.pp, grid: true };
      return { ...q, kind: 'type', accept: [v.pp] };
    }
    if (kind === 'aux') {
      if (v.pronominal) return vtQuestion(v, 'pp', pool);
      const a = v.aux === 'être' ? 'est' : 'a';
      return { ...base, skill: 'aux', kind: 'mc', tag: '동사 테스트 · 조동사', prompt: 'avoir? être? 빈칸에 알맞은 것은', main: `Il ___ ${v.pp}.`, mainFr: true, sub: `${v.inf} · ${v.ko}`, options: ['a', 'est'], fixed: true, grid: true, optionsFr: true, answer: a, reveal: `Il ${a} ${v.pp}. (${v.aux})`, say: `Il ${a} ${v.pp}.`, hint: '이동·상태 변화 동사와 대명동사는 être, 나머지는 avoir' };
    }
    if (kind === 'meaning') {
      const q = { ...base, skill: 'vocab', tag: '동사 테스트 · 뜻', prompt: mc ? '이 뜻의 동사는?' : '이 뜻의 동사원형을 쓰세요', main: v.ko, reveal: `${v.inf} = ${v.ko}`, say: v.inf, hint: `「${vbBase(v.inf).slice(0, 1)}…」로 시작해요${v.pronominal ? ' (대명동사)' : ''}` };
      if (mc) return { ...q, kind: 'mc', options: options(v.inf, infT), optionsFr: true, answer: v.inf };
      return { ...q, kind: 'type', accept: [v.inf] };
    }
    if (kind === 'inf') {
      const p = pick(PERSONS);
      const form = v.forms[p];
      const subj = p === 'je' && !v.pronominal && VOWEL.test(form) ? "j'" : PLABEL[p].split('/')[0];
      const full = subj.endsWith("'") ? subj + form : `${subj} ${form}`;
      const q = { ...base, skill: 'inf', tag: '동사 테스트 · 원형 찾기', prompt: '이 동사의 원형은?', main: cap(full), mainFr: true, speakMain: full, reveal: `${v.inf} (${v.ko})`, say: v.inf, hint: `뜻은 「${v.ko}」예요` };
      if (mc) return { ...q, kind: 'mc', options: options(v.inf, infT), optionsFr: true, answer: v.inf, grid: true };
      return { ...q, kind: 'type', accept: [v.inf] };
    }
    // ppr
    if (!v.ppr) return vtQuestion(v, 'inf', pool);
    const q = { ...base, skill: 'part-pres', tag: '동사 테스트 · 현재분사', prompt: mc ? '현재분사는?' : '현재분사를 쓰세요', main: v.inf, mainFr: true, speakMain: v.inf, sub: v.ko, reveal: `${v.inf} → ${v.ppr}`, say: v.ppr, hint: 'nous 현재형에서 -ons를 떼고 -ant! (예외: ayant · étant · sachant)' };
    if (mc) return { ...q, kind: 'mc', options: options(v.ppr, [], 3, shuffle([v.forms.nous.replace(/^nous /, '').replace(/ons$/, 'ent'), vbBase(v.inf).replace(/(er|ir|re|oir)$/, '') + 'ant', v.forms.nous.replace(/^nous /, '') + 'ant'])), optionsFr: true, answer: v.ppr, grid: true };
    return { ...q, kind: 'type', accept: [v.ppr] };
  }

  function buildVerbTest(cfg) {
    const verbs = shuffle(vtScopeList(cfg.scope, cfg.todoOnly));
    if (!verbs.length || !cfg.cats.length) return [];
    const n = cfg.count === 'all' ? verbs.length : Math.min(cfg.count, Math.max(verbs.length * 3, 1));
    // 종류(카테고리)를 고르게 돌리고, 그 안에서 세부 문제를 고른다. 변화표는 길어서 전체의 30%까지만
    const cats = cfg.cats.slice();
    const qs = [];
    let tables = 0;
    let order = shuffle(cats);
    for (let i = 0; i < n; i++) {
      const v = verbs[i % verbs.length];
      if (!order.length) order = shuffle(cats);
      let cat = order.pop();
      if (cat === 'table' && tables >= Math.max(1, Math.round(n * 0.3)) && cats.length > 1) cat = pick(cats.filter((c) => c !== 'table'));
      const kind = pick(VT_CATS[cat].kinds);
      if (kind === 'table') tables++;
      const q = vtQuestion(v, kind, verbs);
      if (q) qs.push(q);
    }
    return qs;
  }
  function startVerbTest(cfg) {
    closeSheet();
    const qs = buildVerbTest(cfg);
    if (!qs.length) { toast('이 범위에는 시험 볼 동사가 없어요'); return; }
    P = { mode: 'verbtest', vt: { ...cfg }, queue: qs, i: 0, phase: 'answer', combo: 0, bestCombo: 0, xp: 0, ok: 0, answered: 0, mistakes: 0, retried: new Set(), start: Date.now(), finished: false, hintsUsed: 0, vlog: {} };
    SFX.get();
    view = 'player';
    renderPlayer();
    window.scrollTo(0, 0);
  }

  // 변화표 6칸 입력
  function renderVTable(q, qa, check) {
    qa.innerHTML = `<div class="vt-table fr">${PERSONS.map((p, i) => `<label class="vt-cell"><span>${p === 'je' && VOWEL.test(q.cells[0]) && !/^(me|m')/.test(q.cells[0]) ? "je / j'" : PLABEL[p]}</span>
        <input id="vt-${i}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" lang="fr"></label>`).join('')}</div>
      <div class="accents">${ACCENTS.map((a) => `<button data-a="${esc(a)}">${esc(a)}</button>`).join('')}</div>`;
    const inputs = PERSONS.map((_, i) => $(`#vt-${i}`, qa));
    let last = inputs[0];
    const sync = () => { P.sel = inputs.map((x) => x.value); check.disabled = !inputs.some((x) => x.value.trim()); };
    inputs.forEach((inp, i) => {
      inp.addEventListener('focus', () => { last = inp; });
      inp.addEventListener('input', sync);
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (i < inputs.length - 1) inputs[i + 1].focus(); else if (!check.disabled) check.click();
      });
    });
    $$('.accents button', qa).forEach((b) => {
      b.addEventListener('pointerdown', (e) => e.preventDefault());
      b.onclick = () => {
        const s = last.selectionStart ?? last.value.length, e2 = last.selectionEnd ?? last.value.length;
        last.value = last.value.slice(0, s) + b.dataset.a + last.value.slice(e2);
        last.setSelectionRange(s + 1, s + 1); last.focus(); sync();
      };
    });
    P.sel = inputs.map(() => '');
    setTimeout(() => inputs[0].focus(), 60);
  }
  // 칸 하나 채점: 동사형만 써도, 주어까지 써도 정답
  function vtCellOk(typed, form, p) {
    const n = norm(typed);
    if (!n) return false;
    const subj = p === 'je' && VOWEL.test(form) && !/^(me|m')/.test(form) ? "j'" : PLABEL[p].split('/')[0];
    const alts = [form, subj.endsWith("'") ? subj + form : `${subj} ${form}`];
    if (p === 'il') alts.push(`elle ${form}`, `on ${form}`);
    if (p === 'ils') alts.push(`elles ${form}`);
    return alts.some((a) => norm(a) === n);
  }
  function vtEvaluate(q) {
    const res = q.cells.map((form, i) => vtCellOk(P.sel[i] || '', form, PERSONS[i]));
    const ok = res.every(Boolean);
    let hint = '';
    if (!ok) {
      const wrong = res.filter((r) => !r).length;
      const accentOnly = q.cells.every((form, i) => res[i] || deaccent(norm(P.sel[i] || '')) === deaccent(norm(form)));
      hint = accentOnly ? '악센트만 달라요! 철자까지 정확하게 ✍️' : `6칸 중 ${6 - wrong}칸 정답`;
    }
    q._cells = res;
    return { ok, hint };
  }

  // 시험이 끝나면: 동사별 기록 + 외울 것/외웠어요 반영
  function vtFinish() {
    const st = vbState();
    const now = Date.now();
    const per = {};
    for (const { vid, ok } of Object.values(P.vlog || {})) {
      const r = per[vid] || (per[vid] = { ok: 0, ng: 0 });
      ok ? r.ok++ : r.ng++;
    }
    const all = vbList();
    P.vtDemoted = [];
    P.vtSuggest = [];
    for (const [vid, r] of Object.entries(per)) {
      const s = st.st[vid] || { ok: 0, ng: 0 };
      st.st[vid] = { ok: (s.ok || 0) + r.ok, ng: (s.ng || 0) + r.ng, last: r.ng === 0, at: now };
      const v = all.find((x) => x.id === vid);
      if (!v) continue;
      if (r.ng > 0) {
        if (v.known) { st.kn[vid] = { v: false, at: now }; P.vtDemoted.push(v); }
      } else if (!v.known) P.vtSuggest.push(v);
    }
    P.vtPer = per;
  }
  function vtResultHtml() {
    const all = vbList();
    const per = P.vtPer || {};
    const wrong = Object.entries(per).filter(([, r]) => r.ng > 0).map(([id, r]) => ({ v: all.find((x) => x.id === id), r })).filter((x) => x.v);
    return `<div class="vt-result">
      ${wrong.length ? `<div class="box"><h4>❌ 틀린 동사 ${wrong.length}개</h4>${wrong.map(({ v, r }) => `<div class="li"><div class="l1"><b class="fr">${esc(v.inf)}</b><small>${esc(v.ko)} · 이번 시험 ✓${r.ok} ✗${r.ng}</small></div></div>`).join('')}
        ${P.vtDemoted.length ? `<p class="muted" style="font-size:13px;margin-top:6px">「외웠어요」였던 ${P.vtDemoted.map((v) => esc(v.inf)).join(', ')}는 「외울 것」으로 돌려놨어요.</p>` : ''}</div>` : ''}
      ${P.vtSuggest.length ? `<div class="box"><h4>✅ 다 맞힌 동사 — 외웠어요로 표시할까요?</h4>${P.vtSuggest.map((v) => `<label class="vt-sug"><input type="checkbox" data-vtsug="${esc(v.id)}" checked> <b class="fr">${esc(v.inf)}</b> <small class="muted">${esc(v.ko)}</small></label>`).join('')}
        <button class="btn small green" id="vt-mark" style="margin-top:8px">선택한 동사 「외웠어요」로 표시</button></div>` : ''}
    </div>`;
  }
  function bindVtResult() {
    const btn = $('#vt-mark');
    if (!btn) return;
    btn.onclick = () => {
      const st = vbState();
      const ids = $$('[data-vtsug]').filter((x) => x.checked).map((x) => x.dataset.vtsug);
      ids.forEach((id) => { st.kn[id] = { v: true, at: Date.now() }; });
      save(); syncNow();
      btn.disabled = true;
      btn.textContent = `✓ ${ids.length}개 표시했어요`;
    };
  }

  // 시작 화면 (시트)
  function openVerbTestSetup() {
    const scopes = [['view', '지금 보는 목록'], ['all', '전체'], ['1', '1군'], ['2', '2군'], ['3', '불규칙'], ['pron', '대명동사'], ['missed', '지난 시험에서 틀린 동사']];
    const draw = () => {
      const n = vtScopeList(VT.scope, VT.todoOnly).length;
      const sh = sheet(`
        <h3>📝 동사 테스트</h3>
        <div class="meta">객관식과 직접 쓰기가 섞여 나와요 · 변화표는 직접 써요</div>
        <div class="vt-set"><div class="vt-h">문제 종류</div>
          ${Object.entries(VT_CATS).map(([k, c]) => `<label class="vt-opt"><input type="checkbox" data-vtcat="${k}" ${VT.cats.includes(k) ? 'checked' : ''}><span><b>${c.label}</b><small class="fr">${esc(c.sub)}</small></span></label>`).join('')}</div>
        <div class="vt-set"><div class="vt-h">범위 <small class="muted">· 동사 ${n}개</small></div>
          <div class="vb-chips">${scopes.map(([k, t]) => `<button class="vb-chip" data-vtscope="${k}" aria-pressed="${VT.scope === k}">${esc(t)}</button>`).join('')}</div>
          <label class="vt-opt" style="margin-top:6px"><input type="checkbox" id="vt-todo" ${VT.todoOnly ? 'checked' : ''}><span><b>「외울 것」만</b><small>외웠어요 표시한 동사는 빼기</small></span></label></div>
        <div class="vt-set"><div class="vt-h">문항 수</div>
          <div class="seg" id="vt-count">${[[10, '10문제'], [20, '20문제'], ['all', `동사마다 1문제 (${n})`]].map(([v, t]) => `<button data-v="${v}" class="${String(VT.count) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <button class="btn" id="vt-go" ${!n || !VT.cats.length ? 'disabled' : ''}>▶ 시작하기</button>`);
      sh.classList.add('tall');
      $$('[data-vtcat]', sh).forEach((c) => c.onchange = () => { VT.cats = $$('[data-vtcat]', sh).filter((x) => x.checked).map((x) => x.dataset.vtcat); vtSave(); draw(); });
      $$('[data-vtscope]', sh).forEach((b) => b.onclick = () => { VT.scope = b.dataset.vtscope; vtSave(); draw(); });
      $('#vt-todo', sh).onchange = (e) => { VT.todoOnly = e.target.checked; vtSave(); draw(); };
      $$('#vt-count button', sh).forEach((b) => b.onclick = () => { VT.count = b.dataset.v === 'all' ? 'all' : Number(b.dataset.v); vtSave(); draw(); });
      $('#vt-go', sh).onclick = () => startVerbTest({ ...VT });
    };
    draw();
  }

  // ================================================================ 📝 실전 연습 — 유닛(Leçon) 범위 · 시험형
  // 파트 순서대로 듣기 30% → 쓰기 30% → 객관식 40% (소리 꺼짐이면 듣기 빼고 쓰기 43 · 객관식 57).
  // 레슨을 돌아가며 1장씩 뽑아 범위 전체에 고르게, 같은 레슨에선 이미 나온 노트 주제(ns)는 피한다. 힌트·재도전 없음.
  const EXAM_PARTS = [
    { id: 'listen', fr: 'Compréhension orale', ko: '🎧 듣기', desc: '듣고 고르거나 받아쓰기 · 🔊 🐢로 다시 들을 수 있어요' },
    { id: 'write', fr: 'Expression écrite', ko: '✍️ 쓰기', desc: '보기 없이 직접 써요 · 악센트까지 정확하게' },
    { id: 'mc', fr: 'Questions à choix multiples', ko: '☑️ 객관식', desc: '알맞은 것을 고르세요' },
  ];
  const EX = (() => {
    const d = { units: null, n: 20, grading: 'end' };
    try { return { ...d, ...JSON.parse(localStorage.getItem('allez.exam') || '{}') }; } catch (e) { return d; }
  })();
  const exSave = () => { try { localStorage.setItem('allez.exam', JSON.stringify(EX)); } catch (e) { /* 무시 */ } };
  const isFrText = (s) => !!s && !hasHangul(s);
  const wordCount = (s) => blocksOf(String(s || '')).length;
  const shortFr = (s, max = 9) => isFrText(s) && wordCount(s) >= 2 && wordCount(s) <= max && !/[/()…→]|_{3}/.test(s);
  const unitShort = (u) => u.title.split(' · ')[0];
  const unitNames = (ids) => ids.map((id) => C.units.find((u) => u.id === id)).filter(Boolean).map(unitShort).join(' + ');
  // 카드 속 완성된 프랑스어 문장과 뜻 [fr, ko] (받아쓰기·듣고 뜻 고르기용)
  function cardSentence(c) {
    if (c.t === 'choice' && isFrText(c.q) && isFrText(c.a) && c.say !== '') {
      const fr = c.say || (BLANK.test(c.q) ? fill(c.q, c.a) : null);
      if (fr) return [fr, c.ko];
    }
    if (c.t === 'build' && isFrText(c.a)) return [c.a, c.ko];
    if (c.t === 'type' && isFrText(c.a) && wordCount(c.a) >= 2) return [c.a, c.ko];
    if (c.t === 'error') { const i = c.s.indexOf(c.wrong); return [c.s.slice(0, i) + c.right + c.s.slice(i + c.wrong.length), c.ko]; }
    if (c.t === 'pp' && c.ex) return [c.ex.fr, c.ex.ko];
    return null;
  }
  const plainWord = (c) => c.t === 'word' && !/[/()]/.test(c.fr);
  const blankChoice = (c, maxA = 3) => c.t === 'choice' && isFrText(c.q) && BLANK.test(c.q) && isFrText(c.a) && wordCount(c.a) <= maxA && !/^-|-$/.test(c.a);
  // 파트별 문제 만들기: [가중치, 만드는 함수] 목록 (빈 목록 = 이 파트엔 못 냄)
  const EX_GEN = {
    listen(c) {
      const g = [];
      if (c.t === 'listen') g.push([2, () => ({ ...qListen(c), tag: '소리 구별' })]);
      if (c.dictate) g.push([4, () => ({ ...qType(c), tag: '듣기 빈칸' })]); // 시험 I번 형식
      if (plainWord(c)) {
        const say = c.say || c.fr;
        g.push([2, () => ({ kind: 'type', tag: '받아쓰기 · 단어', prompt: '듣고 그대로 쓰세요', listen: say, accept: [c.fr], reveal: `${c.fr} = ${c.ko}`, say, explain: c.note || '' })]);
        g.push([2, () => ({ kind: 'mc', tag: '듣고 뜻 고르기', prompt: '듣고 뜻을 고르세요', listen: say, options: options(c.ko, tiers(c, 'word', (x) => x.ko)), answer: c.ko, reveal: `${c.fr} = ${c.ko}`, say })]);
      }
      if (blankChoice(c)) {
        const full = c.say || fill(c.q, c.a);
        if (shortFr(full, 12)) g.push([3, () => ({ kind: 'type', tag: '듣고 빈칸 쓰기', prompt: '문장을 듣고 빈칸을 쓰세요', listen: full, main: c.q, mainFr: true, accept: [c.a, full], reveal: full, say: full, explain: c.explain })]);
      }
      const sen = cardSentence(c);
      if (sen && shortFr(sen[0])) {
        g.push([3, () => ({ kind: 'type', tag: '받아쓰기 · 문장', prompt: '듣고 문장을 그대로 쓰세요', listen: sen[0], accept: [sen[0]], loose: true, reveal: sen[1] ? `${sen[0]}\n= ${sen[1]}` : sen[0], say: sen[0], explain: c.explain })]);
        if (sen[1]) g.push([2, () => {
          const kos = (cs) => cs.filter((x) => x !== c).map(cardSentence).filter((s) => s && s[1] && s[1] !== sen[1]).map((s) => s[1]);
          return { kind: 'mc', tag: '듣고 뜻 고르기', prompt: '듣고 알맞은 뜻을 고르세요', listen: sen[0], options: options(sen[1], [kos(lessonOf(c).cards), kos(unitOf(c).lessons.flatMap((l) => l.cards))]), answer: sen[1], reveal: `${sen[0]}\n= ${sen[1]}`, say: sen[0] };
        }]);
      }
      return g;
    },
    write(c) {
      const g = [];
      if (blankChoice(c) && (c.ko || /\(.+\)/.test(c.q))) { // 보기 없이 풀려면 뜻이나 (원형) 단서가 있어야
        const full = fill(c.q, c.a);
        g.push([3, () => ({ kind: 'type', tag: '빈칸 쓰기', prompt: c.prompt && !/고르|것은|맞는/.test(c.prompt) ? c.prompt : '빈칸에 알맞은 말을 쓰세요', main: c.q, mainFr: true, sub: c.ko, accept: [c.a, full], reveal: full, say: c.say || full, explain: c.explain, pron: c.pron })]);
      }
      if (c.t === 'verb') g.push([2, () => qVerb(c, 2, 'conj-type')]);
      if (c.t === 'pp') g.push([2, () => qPP(c, 2, c.ex ? 'ex-type' : 'pp-type')]);
      if (c.t === 'type' && !c.dictate) g.push([3, () => ({ ...qType(c), tag: '쓰기' })]);
      if (c.t === 'build' && wordCount(c.a) <= 10) {
        g.push([3, () => ({ kind: 'type', tag: c.from ? '바꿔 쓰기' : '작문', prompt: c.from ? (c.prompt || '바꿔 쓰세요') : '프랑스어로 쓰세요', main: c.from || c.ko, mainFr: !!c.from, sub: c.from ? c.ko : null, accept: [c.a, ...(c.alts || [])], loose: true, reveal: c.a, say: c.a, explain: c.explain })]);
      }
      if (c.t === 'error') {
        const fixed = cardSentence(c)[0];
        g.push([2, () => ({ kind: 'type', tag: '고쳐 쓰기', prompt: '틀린 부분을 찾아 바르게 고쳐 쓰세요 (고친 말만 써도 돼요)', main: c.s, mainFr: true, sub: c.ko, accept: [c.right, fixed], loose: true, reveal: `${c.wrong} → ${c.right}\n${fixed}`, say: fixed, explain: c.explain, fixWord: c.right })]);
      }
      if (plainWord(c)) g.push([1, () => ({ kind: 'type', tag: '단어 쓰기', prompt: c.g ? '프랑스어로 쓰세요 (관사까지)' : '프랑스어로 쓰세요', main: c.ko, accept: [c.fr], reveal: c.fr, say: c.say || c.fr, explain: c.note || '' })]);
      return g;
    },
    mc(c) {
      const g = [];
      if (c.t === 'choice') g.push([4, () => qChoice(c)]);
      if (c.t === 'error') g.push([2, () => qError(c, 1)]);
      if (c.t === 'word') g.push([2, () => qWord(c, 0)]);
      if (c.t === 'verb') g.push([2, () => qVerb(c, 0, pick(['conj-mc', 'inf-mc']))]);
      if (c.t === 'pp') g.push([2, () => qPP(c, 0, pick(['pp-mc', 'aux']))]);
      return g;
    },
  };
  function examQuestion(c, part) {
    const gens = EX_GEN[part](c);
    for (let tries = 0; gens.length && tries < 4; tries++) {
      let r = Math.random() * gens.reduce((a, x) => a + x[0], 0);
      const g = gens.find((x) => (r -= x[0]) < 0) || gens[0];
      let q = null;
      try { q = g[1](); } catch (e) { q = null; }
      if (!q || q.kind === 'match' || (q.kind === 'mc' && !q.fixed && (!q.options || q.options.length < 3))) continue;
      q.ids = q.ids && q.ids.length ? q.ids : [c.id];
      q.skill = c.skill;
      q.lessonId = lessonOf(c).id;
      q.star = c.star;
      q.part = part;
      if (q.pron === undefined) q.pron = c.pron;
      return q;
    }
    return null;
  }
  function examCounts(n) {
    if (!(S.settings.sound && TTS.ok)) { const w = Math.round(n * 0.43); return { listen: 0, write: w, mc: n - w }; }
    const l = Math.round(n * 0.3), w = Math.round(n * 0.3);
    return { listen: l, write: w, mc: n - l - w };
  }
  function buildExam(cfg) {
    const lessons = C.units.filter((u) => cfg.units.includes(u.id)).flatMap((u) => u.lessons);
    const counts = examCounts(cfg.n);
    const used = new Set();
    const usedNs = {};
    const out = [];
    for (const part of EXAM_PARTS) {
      const want = counts[part.id];
      let order = shuffle(lessons.map((l) => ({ l, cards: l.cards.filter((c) => usable(c) && EX_GEN[part.id](c).length) })).filter((x) => x.cards.length));
      const qs = [];
      while (qs.length < want && order.length) {
        for (const x of order) {
          if (qs.length >= want) break;
          const cand = x.cards.filter((c) => !used.has(c.id));
          if (!cand.length) continue;
          const nsUsed = usedNs[x.l.id] || (usedNs[x.l.id] = new Set());
          // 틀린 적 있는 카드·새 카드·교수님 강조를 조금 우선, 같은 레슨에서 이미 나온 주제는 피하기
          const score = (c) => {
            const st = S.cards[c.id];
            return (st && st.w > 0 && !st.g ? 2.5 : 0) + (!st ? 1 : 0) + (c.star ? 0.6 : 0) - (c.ns && nsUsed.has(c.ns[0]) ? 2 : 0) + Math.random() * 1.6;
          };
          const c = cand.map((k) => [k, score(k)]).sort((a, b) => b[1] - a[1])[0][0];
          used.add(c.id);
          if (c.ns) nsUsed.add(c.ns[0]);
          const q = examQuestion(c, part.id);
          if (q) qs.push(q);
        }
        order = order.filter((x) => x.cards.some((c) => !used.has(c.id)));
      }
      shuffle(qs).forEach((q, i) => { q.partI = i; q.partN = qs.length; out.push(q); });
    }
    return out;
  }
  function startExam(cfg) {
    closeSheet();
    if (!cfg.units || !cfg.units.length) { toast('범위를 하나 이상 골라요'); return; }
    const qs = buildExam(cfg);
    if (!qs.length) { toast('이 범위에는 낼 문제가 없어요'); return; }
    P = { mode: 'exam', ex: { units: [...cfg.units], n: cfg.n, grading: cfg.grading, log: [], shown: {} }, queue: qs, i: 0, phase: 'answer', combo: 0, bestCombo: 0, xp: 0, ok: 0, answered: 0, mistakes: 0, retried: new Set(), start: Date.now(), finished: false, hintsUsed: 0 };
    SFX.get();
    if (view === 'player' || view === 'result') { view = 'player'; renderPlayer(); window.scrollTo(0, 0); }
    else openView('player', renderPlayer);
  }
  const partNo = (part) => EXAM_PARTS.filter((p) => P.queue.some((q) => q.part === p.id)).findIndex((p) => p.id === part) + 1;
  function renderPartIntro(q) {
    const part = EXAM_PARTS.find((p) => p.id === q.part);
    app.innerHTML = `
      <div class="player">
        <div class="p-top"><button class="icon-btn" id="quit" aria-label="그만하기">✕</button><div class="progress"><i style="width:${(P.i / P.queue.length) * 100}%"></i></div><div class="combo"></div></div>
        <div class="p-body part-intro">
          <div class="pi-k">${esc(part.ko)}</div>
          <h2 class="fr">Partie ${partNo(q.part)} · ${esc(part.fr)}</h2>
          <p>${q.partN}문제 · ${esc(part.desc)}</p>
          ${P.ex.grading === 'end' ? '<p class="muted">정답은 다 풀고 나서 한꺼번에 보여줘요</p>' : ''}
        </div>
        <div class="p-foot"><div class="foot-row"><button class="btn" id="pi-go">시작 ▶</button></div></div>
      </div>`;
    $('#quit').onclick = quitSession;
    $('#pi-go').onclick = () => { P.ex.shown[q.part] = true; SFX.tap(); renderPlayer(); };
  }
  // 채점 기록에 남길 "내 답"
  function givenText(q) {
    if (q.kind === 'mc' || q.kind === 'type') return P.sel ?? '';
    if (q.kind === 'ox') return P.sel ? '⭕ 맞아요' : '❌ 틀려요';
    if (q.kind === 'tap') return q.chunks[P.sel] ? q.chunks[P.sel].t : '';
    if (q.kind === 'build') return (P.sel || []).map((i) => q.blocks[i]).join(' ');
    return '';
  }

  // ---- 틀린 이유 분류 → 약점 노트
  const VERBISH = new Set(['pres-er', 'pres-ir', 'pres-irr', 'stem-change', 'pronominal', 'pp', 'aux', 'futur', 'imperatif', 'part-pres', 'gerondif', 'inf', 'pc-neg-q']);
  const WK_CATS = {
    accent: { e: '✏️', label: '악센트', tip: '뜻·문법은 맞았는데 악센트가 빠지거나 바뀌었어요. é · è · ê · à · ç · ô… 쓰고 나서 모음 위를 한 번 더!' },
    elision: { e: '✂️', label: '엘리지옹', tip: "모음·무음 h 앞에선 je → j', ne → n', que → qu', le·la → l', de → d'. (qu'Alex · qu'hier · n'iront)" },
    agreement: { e: '⚖️', label: '성·수 일치', tip: '단어 끝 -e · -s · -es가 틀렸어요. 주어(être 동사)나 명사의 성·수를 다시 따져봐요.' },
    order: { e: '🔀', label: '어순', tip: '단어는 다 맞는데 순서가 달라요. ne…pas · 대명사 · 형용사 자리를 확인!' },
    listen: { e: '🎧', label: '듣기 · 받아쓰기', tip: '비슷한 소리를 헷갈렸어요. 🐢로 느리게 다시 듣고 끝소리(-ons/-ont · -ez/-ai)와 모음(se/sau)에 집중!' },
    verb: { e: '🔧', label: '동사 형태', tip: '동사 활용·시제 형태가 틀렸어요. 📒 동사장에서 변화표를 직접 써 봐요.' },
    vocab: { e: '📚', label: '어휘', tip: '단어 뜻 · 철자 · 관사를 헷갈렸어요. 관사와 세트로 소리 내어 외우기!' },
    grammar: { e: '🧩', label: '문법', tip: '문법 규칙을 다시 확인해요. 관련 노트를 열어 보세요.' },
  };
  function classifyMiss(r) {
    const q = r.q;
    if (r.hint && r.hint.startsWith('élision')) return 'elision';
    if (q.kind === 'type' || q.kind === 'build') {
      const loose = (s) => (q.loose ? String(s).replace(/[,;:!?.«»"()]/g, ' ') : String(s));
      const n = norm(loose(r.given || ''));
      const answers = (q.accept || []).map((a) => norm(loose(a)));
      if (n && answers.some((a) => deaccent(a) === deaccent(n))) return 'accent';
      const el = (s) => deaccent(s).replace(/\b(j|l|n|qu|d|m|t|s|c)'/g, '$1e ').replace(/\s+/g, ' ').trim();
      if (n && answers.some((a) => el(a) === el(n))) return 'elision';
      if (n && (!VERBISH.has(q.skill) || q.skill === 'agreement')) {
        const stem = (s) => deaccent(s).split(' ').map((w) => w.replace(/(es|e|s|x)$/, '')).join(' ');
        if (answers.some((a) => stem(a) === stem(n))) return 'agreement';
      }
      const bag = (s) => deaccent(s).split(/[\s']+/).filter(Boolean).sort().join(' ');
      if (wordCount(n) > 2 && answers.some((a) => bag(a) === bag(n))) return 'order';
    }
    if (q.part === 'listen') return 'listen';
    if (q.skill === 'agreement' || q.skill === 'elision') return q.skill;
    if (q.skill === 'vocab' || q.skill === 'gender' || /단어/.test(q.tag || '')) return 'vocab';
    if (VERBISH.has(q.skill)) return 'verb';
    return 'grammar';
  }
  function addWeak(r, now) {
    const id = r.q.ids[0];
    if (!id) return;
    const prev = S.wk[id];
    S.wk[id] = {
      at: now, cat: r.cat, n: (prev && !prev.done ? prev.n || 1 : 0) + 1, part: r.q.part, tag: r.q.tag,
      q: String(r.q.main || '').slice(0, 160), sub: String(r.q.sub || '').slice(0, 120), heard: String(r.q.listen || '').slice(0, 160),
      given: String(r.given ?? '').slice(0, 120), ans: String(r.q.reveal || r.q.answer || '').slice(0, 200),
    };
  }
  function examScore(log) {
    const rs = log.filter(Boolean);
    const parts = {}, lessons = {};
    for (const r of rs) {
      for (const [m, k] of [[parts, r.q.part], [lessons, r.q.lessonId]]) {
        const x = m[k] || (m[k] = { n: 0, ok: 0 });
        x.n++; if (r.ok) x.ok++;
      }
    }
    return { n: rs.length, ok: rs.filter((r) => r.ok).length, parts, lessons };
  }
  // 시험 끝: (한꺼번에 채점이면) 기록 반영 → 틀린 문제 분류해 약점 노트 → 시험 기록
  function examCommit() {
    const ex = P.ex;
    const copy = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
    if (ex.grading === 'end') {
      ex.log.forEach((r) => {
        if (!r) return;
        S.stats.answers++;
        r.snap = copy(S.cards[r.q.ids[0]]);
        commitAnswer(r.q, r.ok, false);
      });
    }
    const now = Date.now();
    ex.log.forEach((r) => { if (r && !r.ok) { r.cat = classifyMiss(r); addWeak(r, now); } });
    const res = examScore(ex.log);
    ex.at = now;
    S.exams = [...(S.exams || []), { at: now, units: ex.units, n: res.n, ok: res.ok, parts: res.parts }].slice(-30);
  }
  // 결과 화면의 "내 답도 맞아요" (한꺼번에 채점, 직접 쓰기 오답)
  function examOverride(i) {
    const r = P.ex.log[i];
    if (!r || r.ok) return;
    const id = r.q.ids[0];
    if (r.snap) S.cards[id] = r.snap; else delete S.cards[id];
    grade(id, true, false);
    const sk = S.sk[r.q.skill];
    if (sk) { sk.ok++; const k = sk.h.lastIndexOf('0'); if (k >= 0) sk.h = sk.h.slice(0, k) + '1' + sk.h.slice(k + 1); }
    const kd = S.kd[r.q.listen ? 'listen' : r.q.kind];
    if (kd) kd.ok++;
    S.stats.correct++;
    P.ok++; P.mistakes = Math.max(0, P.mistakes - 1);
    r.ok = true;
    if (S.wk[id] && !S.wk[id].done) S.wk[id] = { at: Date.now(), done: true };
    const h = (S.exams || []).find((e) => e.at === P.ex.at);
    if (h) { const res = examScore(P.ex.log); h.ok = res.ok; h.parts = res.parts; }
    save(); syncNow();
  }
  const scoreBar = (label, x, wide) => {
    const p = x.n ? x.ok / x.n : 0;
    const col = p < 0.5 ? 'var(--red)' : p < 0.8 ? 'var(--gold)' : 'var(--green)';
    return `<div class="bar-row ${wide ? 'wide' : ''}"><span>${esc(label)}</span><div class="hbar"><i style="width:${p * 100}%;background:${col}"></i></div><b>${x.ok}/${x.n}</b></div>`;
  };
  function examReviewRow(r, i) {
    const q = r.q;
    const part = EXAM_PARTS.find((p) => p.id === q.part);
    const canOverride = !r.ok && P.ex.grading === 'end' && q.kind === 'type' && !['accent', 'elision'].includes(r.cat);
    const cat = !r.ok && r.cat ? WK_CATS[r.cat] : null;
    return `<div class="rv ${r.ok ? 'ok' : 'bad'}" data-i="${i}">
      <div class="rv-h"><b>${r.ok ? '✓' : '✗'} ${i + 1}</b><small>${esc(part ? part.ko : '')} · ${esc(q.tag || '')}</small>${cat ? `<span class="pill">${cat.e} ${esc(cat.label)}</span>` : ''}</div>
      ${q.listen ? `<div class="rv-q"><span class="fr">🔊 ${esc(q.listen)}</span> ${speakBtn(q.listen)}</div>` : ''}
      ${q.main ? `<div class="rv-q ${q.mainFr ? 'fr' : ''}">${esc(q.main)}</div>` : ''}${q.sub ? `<div class="rv-exp">${esc(q.sub)}</div>` : ''}
      ${!r.ok ? `<div class="rv-me">내 답 <span class="fr">${esc(r.given || '(비움)')}</span></div>` : ''}
      <div class="rv-ans">정답 <span class="fr">${esc(q.reveal || q.answer || '').replace(/\n/g, '<br>')}</span></div>
      ${!r.ok && q.explain ? `<div class="rv-exp">${esc(q.explain)}</div>` : ''}
      ${!r.ok ? `<div class="rv-act">${q.skill ? `<button class="note-link rv-note" data-i="${i}">📖 관련 노트</button>` : ''}${canOverride ? `<button class="fb-override rv-ov" data-i="${i}">🙋 내 답도 맞아요</button>` : ''}</div>` : ''}
    </div>`;
  }
  function renderExamResult({ perfect, streakUp, levelUp, levelAfter }) {
    view = 'result';
    const ex = P.ex;
    const res = examScore(ex.log);
    const pct = res.n ? Math.round((res.ok / res.n) * 100) : 0;
    const cats = {};
    ex.log.forEach((r) => { if (r && !r.ok && r.cat) cats[r.cat] = (cats[r.cat] || 0) + 1; });
    const catList = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const lessonRows = Object.entries(res.lessons).map(([id, x]) => ({ l: lessonById.get(id), ...x })).filter((x) => x.l)
      .sort((a, b) => a.ok / a.n - b.ok / b.n || b.n - a.n);
    const [mood, head] = pct >= 90 ? ['cheer', 'Excellent !'] : pct >= 75 ? ['happy', 'Très bien !'] : pct >= 55 ? ['idle', 'Pas mal !'] : ['think', 'Courage !'];
    app.innerHTML = `
      <div class="page-head"><button class="icon-btn" id="back" aria-label="홈으로">←</button><h2>📝 실전 연습 결과</h2></div>
      <div class="page exam-result">
        <div class="score-card">
          <div class="sc-pipou">${Pipou.svg(mood, 'bounce')}</div>
          <div><div class="sc-big">${pct}<small>점</small></div><div class="sc-sub"><b>${esc(head)}</b> ${res.ok}/${res.n} 정답 · ${esc(unitNames(ex.units))} · +${P.xp} XP${streakUp ? ` · 🔥 ${S.streak.n}일 연속` : ''}</div></div>
        </div>
        <div class="section-title">영역별</div>
        <div class="box">${EXAM_PARTS.filter((p) => res.parts[p.id]).map((p) => scoreBar(p.ko, res.parts[p.id])).join('')}</div>
        ${catList.length ? `<div class="section-title">이번 시험에서 틀린 이유</div>
          <div class="box">${catList.map(([k, n]) => `<div class="wk-cat"><b>${WK_CATS[k].e} ${esc(WK_CATS[k].label)} <span class="muted">${n}문제</span></b><small>${esc(WK_CATS[k].tip)}</small></div>`).join('')}
          <button class="btn small" id="ex-wk" style="margin-top:10px">🩹 약점 노트 열기</button></div>` : ''}
        <div class="section-title">레슨별 (약한 순)</div>
        <div class="box">${lessonRows.map((x) => scoreBar(`${x.l.emoji || ''} ${x.l.title}`, x, true)).join('')}</div>
        <div class="section-title">문제별 채점</div>
        <div class="rv-list">${ex.log.map((r, i) => (r ? examReviewRow(r, i) : '')).join('')}</div>
        <div class="actions">
          <button class="btn" id="again">같은 범위로 다시 ▶</button>
          <button class="btn ghost" id="home">홈으로</button>
        </div>
      </div>`;
    bindSpeak();
    const cfg = { units: ex.units, n: ex.n, grading: ex.grading };
    $('#again').onclick = () => startExam(cfg);
    $('#home').onclick = $('#back').onclick = () => { P = null; goHome(); };
    if ($('#ex-wk')) $('#ex-wk').onclick = () => { P = null; view = 'weaknote'; renderWeakNote(); window.scrollTo(0, 0); };
    $$('.rv-note').forEach((b) => b.onclick = () => { const q = ex.log[+b.dataset.i].q; openNoteSheet(relatedNotes(q, q.skill)); });
    $$('.rv-ov').forEach((b) => b.onclick = () => { const y = window.scrollY; examOverride(+b.dataset.i); renderExamResult({ perfect: false, streakUp: false, levelUp: false, levelAfter }); window.scrollTo(0, y); });
    if (!levelUp && !perfect && !streakUp) return;
    SFX.fanfare();
    if (perfect || streakUp) confetti();
    if (levelUp) setTimeout(() => showLevelUp(levelAfter), 900);
  }
  function openExamSetup() {
    if (!EX.units || !EX.units.some((id) => C.units.find((u) => u.id === id))) EX.units = [C.units[C.units.length - 1].id];
    const draw = () => {
      const sound = S.settings.sound && TTS.ok;
      const cnt = examCounts(EX.n);
      const hist = (S.exams || []).slice(-4).reverse();
      const sh = sheet(`
        <h3>📝 실전 연습</h3>
        <div class="meta">시험처럼 파트별로: ${sound ? `🎧 듣기 ${cnt.listen} → ` : ''}✍️ 쓰기 ${cnt.write} → ☑️ 객관식 ${cnt.mc} · 힌트 없음 · 범위 전체에서 고르게</div>
        <div class="vt-set"><div class="vt-h">범위 <small class="muted">· 여러 개 고를 수 있어요</small></div>
          ${C.units.map((u) => `<label class="vt-opt"><input type="checkbox" data-exu="${esc(u.id)}" ${EX.units.includes(u.id) ? 'checked' : ''}><span><b>${esc(u.emoji || '📘')} ${esc(u.title)}</b><small>${esc(u.subtitle || '')} · 레슨 ${u.lessons.length}개 · ${Math.round(mastery(u.lessons.flatMap((l) => l.cards)) * 100)}%</small></span></label>`).join('')}</div>
        <div class="vt-set"><div class="vt-h">문항 수</div>
          <div class="seg" id="ex-n">${[20, 30, 40].map((v) => `<button data-v="${v}" class="${EX.n === v ? 'on' : ''}">${v}문제</button>`).join('')}</div></div>
        <div class="vt-set"><div class="vt-h">채점</div>
          <div class="seg" id="ex-g">${[['end', '📋 끝나고 한꺼번에'], ['each', '⚡ 문제마다 바로']].map(([v, t]) => `<button data-v="${v}" class="${EX.grading === v ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        ${sound ? '' : '<div class="ex-warn">🔇 소리가 꺼져 있어서 듣기 파트가 빠져요. <button class="btn small ghost" id="ex-sound">🔊 소리 켜기</button></div>'}
        ${hist.length ? `<div class="vt-set"><div class="vt-h">지난 기록</div>${hist.map((e) => `<div class="ex-hist"><span>${shortDate(today(new Date(e.at)))} · ${esc(unitNames(e.units))} · ${e.n}문제</span><b>${e.n ? Math.round((e.ok / e.n) * 100) : 0}점</b></div>`).join('')}</div>` : ''}
        <button class="btn" id="ex-go" ${EX.units.length ? '' : 'disabled'}>▶ 시작하기</button>`);
      sh.classList.add('tall');
      $$('[data-exu]', sh).forEach((c) => c.onchange = () => { EX.units = $$('[data-exu]', sh).filter((x) => x.checked).map((x) => x.dataset.exu); exSave(); draw(); });
      $$('#ex-n button', sh).forEach((b) => b.onclick = () => { EX.n = Number(b.dataset.v); exSave(); SFX.tap(); draw(); });
      $$('#ex-g button', sh).forEach((b) => b.onclick = () => { EX.grading = b.dataset.v; exSave(); SFX.tap(); draw(); });
      if ($('#ex-sound', sh)) $('#ex-sound', sh).onclick = () => { S.settings.sound = true; save(); draw(); };
      $('#ex-go', sh).onclick = () => startExam({ ...EX });
    };
    draw();
  }

  // ================================================================ home
  function markSeen(lessonId) {
    if (!S.seenLessons) S.seenLessons = [];
    if (!S.seenLessons.includes(lessonId)) { S.seenLessons.push(lessonId); save(); }
  }
  const isNewLesson = (l) => S.seenLessons && !S.seenLessons.includes(l.id);

  function topbar() {
    const L = levelOf(S.xp);
    const st = currentStreak();
    const doneToday = S.streak.last === today();
    return `<div class="topbar">
      <button class="stat-chip streak ${doneToday ? '' : 'off'}" id="tb-streak" aria-label="스트릭">🔥 ${st}</button>
      <button class="stat-chip lv" id="tb-lv" aria-label="레벨">${titleOf(L)[1]} Lv.${L}</button>
      <span class="spacer"></span>
      <button class="icon-btn" id="tb-sound" aria-label="소리">${S.settings.sound ? '🔊' : '🔇'}</button>
      <button class="icon-btn" id="tb-me" aria-label="내 기록·설정">⚙️</button>
    </div>`;
  }
  function bindTopbar() {
    $('#tb-sound').onclick = () => {
      S.settings.sound = !S.settings.sound;
      save();
      toast(S.settings.sound ? '🔊 소리 켬 — 듣기 문제도 나와요' : '🔇 소리 끔 — 듣기 문제는 빠져요');
      renderHome();
    };
    $('#tb-me').onclick = () => openView('profile', renderProfile);
    $('#tb-lv').onclick = $('#tb-me').onclick;
    $('#tb-streak').onclick = () => {
      const d = todayDay();
      toast(S.streak.last === today() ? `🔥 ${currentStreak()}일 연속! 오늘 목표 달성 완료` : `오늘 ${d.s}/${S.settings.goal}판 — 목표를 채우면 스트릭 +1`);
    };
  }

  function greeting(due, fresh, weak) {
    const d = todayDay();
    const goal = S.settings.goal;
    const st = currentStreak();
    const h = new Date().getHours();
    if (d.s >= goal) return ['cheer', `Bravo ! 오늘 목표 달성 🔥 ${st}일 연속이에요. 더 하고 싶으면 얼마든지!`];
    if (d.s > 0) return ['happy', `좋아요! 한 판만 더 하면 스트릭 ${st + (S.streak.last === today() ? 0 : 1)}일 🔥`];
    if (weak && Math.random() < 0.5) return ['think', `음… 요즘 「${weak.label}」에서 자주 틀려요. 약점 훈련 한 판 어때요?`];
    if (h >= 23 || h < 5) return ['sleep', `늦었네요… 3분만 하고 자요 😴 복습 ${due}장!`];
    if (due > 0) return ['idle', `${h < 12 ? 'Bonjour' : 'Salut'} ! 복습할 카드 ${due}장이 기다려요. 3분이면 끝!`];
    if (fresh > 0) return ['happy', `새 카드 ${fresh}장! 오늘도 Allez ! 🥐`];
    return ['cheer', '전부 복습 완료! 대단해요. 그래도 한 판 더? 😎'];
  }

  function renderHome() {
    view = 'home';
    const t = today();
    const usableCards = allCards.filter(usable);
    const due = usableCards.filter((c) => isDue(c, t)).length;
    const fresh = usableCards.filter(isNew).length;
    const weak = weakSkills()[0];
    const day = todayDay();
    const goal = S.settings.goal;
    const mistakes = mistakeCards().length;
    const wkN = weakItems().length;
    const [mood, msg] = greeting(due, fresh, weak);

    const recent = recentLessons();
    const recentHtml = recent.length ? `<div class="recent"><div class="recent-h">🆕 최근 수업</div>${recent.map((l) => {
      const nw = l.cards.filter(isNew).length;
      return `<button class="recent-row" data-l="${esc(l.id)}"><span class="re">${esc(l.emoji || '📘')}</span>
        <span class="rt"><b>${esc(l.title)}</b><small>${shortDate(l.date)} 수업 · ${Math.round(mastery(l.cards) * 100)}%${nw ? ` · 새 카드 ${nw}` : ''}</small></span>
        ${isNewLesson(l) ? '<span class="badge-new inline">NEW</span>' : ''}<span class="go" aria-hidden="true">›</span></button>`;
    }).join('')}</div>` : '';

    let paths = '';
    for (const u of C.units) {
      const [col, colD] = u.color;
      const um = mastery(u.lessons.flatMap((l) => l.cards));
      const folded = unitFolded(u);
      paths += `<div class="unit-head ${folded ? 'folded' : ''}" style="background:${col}">
        <button class="unit-toggle" data-u="${esc(u.id)}" aria-expanded="${!folded}"><span class="ue">${esc(u.emoji || '📘')}</span>
          <span class="ut"><b>${esc(u.title)}</b><small>${esc(u.subtitle || '')} · ${Math.round(um * 100)}%${folded ? ` · 레슨 ${u.lessons.length}개` : ''}</small></span>
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="unit-note" data-u="${esc(u.id)}">📖 노트</button></div>`;
      if (folded) continue;
      paths += `<div class="path">`;
      const offs = [0, 44, 66, 44, 0, -44, -66, -44];
      u.lessons.forEach((l, i) => {
        const m = mastery(l.cards);
        const started = l.cards.some((c) => !isNew(c));
        paths += `<div class="node-wrap" style="transform:translateX(${offs[i % offs.length]}px)">
          <button class="node ${started ? '' : 'fresh'}" data-l="${esc(l.id)}" style="--c:${col};--cd:${colD}" aria-label="${esc(l.title)}">
            ${ring(m, 'var(--gold)')}<span>${esc(l.emoji || '📘')}</span>
            ${isNewLesson(l) ? '<span class="badge-new">NEW</span>' : ''}
            ${m >= 0.8 ? '<span class="crown">👑</span>' : ''}
          </button>
          <div class="node-label">${esc(l.title)}<small>${shortDate(l.date)} · ${Math.round(m * 100)}%</small></div>
        </div>`;
      });
      paths += `</div>`;
    }

    app.innerHTML = `${topbar()}
      <div class="home">
        <div class="hello">
          <div class="hello-top">
            <div class="hello-pipou">${Pipou.svg(mood, 'bob')}</div>
            <div class="bubble">${esc(msg)}</div>
          </div>
          <div class="goal-row">
            <div class="goal-dots">${Array.from({ length: goal }, (_, i) => `<span class="goal-dot ${i < day.s ? 'on' : ''}">${i < day.s ? '✓' : ''}</span>`).join('')}</div>
            <span>오늘 ${Math.min(day.s, goal)}/${goal}판</span>
          </div>
          <button class="btn" id="go-review">▶ 오늘의 복습 · 약 3분</button>
          <button class="btn purple" id="go-exam">📝 실전 연습 · 듣기 · 쓰기 · 객관식</button>
          <div class="sub-actions">
            <button class="btn small ghost" id="go-weak">🎯 약점 훈련${weak ? '' : ''}</button>
            <button class="btn small ghost" id="go-mistakes">📕 오답노트${mistakes ? ` ${mistakes}` : ''}</button>
            <button class="btn small ghost" id="go-weaknote">🩹 약점 노트${wkN ? ` ${wkN}` : ''}</button>
            <button class="btn small ghost" id="go-verbs">📒 동사장 · Mes verbes</button>
          </div>
        </div>
        ${restoreHtml()}
        ${recentHtml}
        ${paths}
        <div class="muted" style="text-align:center;font-size:12.5px;margin-top:8px">업데이트 ${esc((C.built || '').slice(0, 10))} · 카드 ${allCards.length}장</div>
      </div>`;
    bindTopbar();
    $('#go-review').onclick = () => startSession('review');
    $('#go-weak').onclick = () => openView('weak', renderWeak);
    $('#go-mistakes').onclick = () => openView('mistakes', renderMistakes);
    $('#go-exam').onclick = openExamSetup;
    $('#go-weaknote').onclick = () => openView('weaknote', renderWeakNote);
    $('#go-verbs').onclick = () => { window.scrollTo(0, 0); openView('verbs', renderVerbs); };
    bindRestore();
    $$('.node, .recent-row').forEach((b) => b.onclick = () => openLessonSheet(b.dataset.l));
    $$('.unit-note').forEach((b) => b.onclick = () => openView('notes', () => renderUnitNotes(b.dataset.u)));
    $$('.unit-toggle').forEach((b) => b.onclick = () => {
      const u = C.units.find((x) => x.id === b.dataset.u);
      const top = b.getBoundingClientRect().top;
      S.fold = { ...(S.fold || {}), [u.id]: !unitFolded(u) };
      save();
      SFX.tap();
      renderHome();
      const nb = $(`.unit-toggle[data-u="${u.id}"]`);
      if (nb) window.scrollBy(0, nb.getBoundingClientRect().top - top); // 누른 유닛 머리가 제자리에 있게
    });
  }
  // 접힌 유닛: 직접 접고 편 기록이 없으면 마지막(지금 배우는) 유닛만 펼친다
  const unitFolded = (u) => (S.fold && u.id in S.fold ? !!S.fold[u.id] : u !== C.units[C.units.length - 1]);
  // 홈의 "최근 수업": 가장 최근 수업일의 레슨 (2개가 안 되면 그 전 수업일까지, 최대 3개)
  function recentLessons() {
    const ls = allLessons();
    const dates = [...new Set(ls.map((l) => l.date))].sort().reverse();
    const out = [];
    for (const d of dates) {
      if (out.length >= 2) break;
      out.push(...ls.filter((l) => l.date === d));
    }
    return out.slice(0, 3);
  }

  // ================================================================ lesson sheet
  function closeSheet() { $$('.scrim, .sheet').forEach((x) => x.remove()); }
  function sheet(html) {
    closeSheet();
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    const sh = document.createElement('div');
    sh.className = 'sheet';
    sh.innerHTML = `<div class="grab"></div>${html}`;
    scrim.onclick = closeSheet;
    document.body.append(scrim, sh);
    return sh;
  }
  function openLessonSheet(id) {
    const l = lessonById.get(id);
    const m = mastery(l.cards);
    const grad = l.cards.filter(isGrad).length;
    const learning = l.cards.filter((c) => !isNew(c) && !isGrad(c)).length;
    const nw = l.cards.filter(isNew).length;
    const mode = sensOf(id);
    const autoNs = l.cards.map(needFor);
    const autoDesc = mode === 'auto'
      ? `자동: 기본 3번, 자주 틀리는 유형은 더 많이 (지금 이 레슨 ${Math.min(...autoNs)}~${Math.max(...autoNs)}번)`
      : `${SENS[mode].label}: 다른 날 ${SENS[mode].n}번 연속 맞히면 졸업`;
    const sh = sheet(`
      <div style="font-size:44px">${esc(l.emoji || '📘')}</div>
      <h3>${esc(l.title)}</h3>
      <div class="meta">${esc(l.unitRef.title)} · ${shortDate(l.date)} 수업 · ${esc((l.sources || []).join(', '))}</div>
      <div class="grad-stats"><span>🎓 졸업 <b>${grad}</b></span><span>📘 학습 중 <b>${learning}</b></span><span>✨ 새 카드 <b>${nw}</b></span></div>
      <div class="mastery"><i style="width:${m * 100}%"></i></div>
      <div class="sens">
        <div class="sens-h">감도 <small>몇 번 맞혀야 졸업할지</small></div>
        <div class="seg sens-seg">${[['auto', '🤖 자동'], ['fast', '🐇 2번'], ['normal', '🐢 3번'], ['thorough', '🦉 5번']].map(([v, lbl]) => `<button data-v="${v}" class="${mode === v ? 'on' : ''}">${lbl}</button>`).join('')}</div>
        <div class="sens-desc">${esc(autoDesc)}</div>
        <button class="sens-all" id="sens-all">↳ 「${esc(l.unitRef.title)}」 레슨 전체에 이 감도 적용</button>
      </div>
      <div class="row">
        <button class="btn ghost" id="sh-notes">📖 노트</button>
        <button class="btn" id="sh-start">▶ 시작</button>
      </div>`);
    $('#sh-start').onclick = () => startSession('lesson', id);
    $('#sh-notes').onclick = () => { closeSheet(); markSeen(id); openView('notes', () => renderNotes(id)); };
    $$('.sens-seg button', sh).forEach((b) => b.onclick = () => {
      if (b.dataset.v === 'auto') delete S.sens[id]; else S.sens[id] = b.dataset.v;
      S.sensAt = Date.now();
      save();
      SFX.tap();
      openLessonSheet(id);
      if (view === 'home') renderHomePathOnly();
    });
    $('#sens-all', sh).onclick = () => {
      for (const x of l.unitRef.lessons) { if (mode === 'auto') delete S.sens[x.id]; else S.sens[x.id] = mode; }
      S.sensAt = Date.now();
      save();
      toast(`「${l.unitRef.title}」 ${l.unitRef.lessons.length}개 레슨 모두 ${mode === 'auto' ? '🤖 자동' : SENS[mode].label}으로!`);
      if (view === 'home') renderHomePathOnly();
    };
  }
  function renderHomePathOnly() { /* 시트 뒤 홈의 진행률 갱신 */
    const scrollY = window.scrollY;
    const keep = $$('.scrim, .sheet');
    keep.forEach((x) => x.remove());
    renderHome();
    document.body.append(...keep);
    window.scrollTo(0, scrollY);
  }

  // ================================================================ notes (수업자료 + 노션 필기 종합)
  const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  function srcChips(src) {
    return (src || []).map((x) => `<span class="src ${/노션|notion/i.test(x) ? 'n' : 'd'}">${/노션|notion/i.test(x) ? '📝' : '📄'} ${esc(x)}</span>`).join('');
  }
  function noteBlock(b) {
    if (b.p !== undefined) return `<p>${rich(b.p)}</p>`;
    if (b.list) return `<ul>${b.list.map((x) => `<li>${rich(x)}</li>`).join('')}</ul>`;
    if (b.warn) return `<div class="nb warn">⚠️ ${rich(b.warn)}</div>`;
    if (b.memo) return `<div class="nb memo">🗒️ ${rich(b.memo)}</div>`;
    if (b.ex) return `<div class="exs">${b.ex.map(([fr, ko]) => `<div class="exr"><div><b class="fr">${esc(fr)}</b><small>${esc(ko)}</small></div>${speakBtn(fr)}</div>`).join('')}</div>`;
    if (b.table) {
      const rows = b.table;
      return `<div class="tbl-wrap"><table class="tbl fr">${rows.map((r, i) => `<tr>${r.map((x) => (b.head && i === 0 ? `<th>${rich(x)}</th>` : `<td>${rich(x)}</td>`)).join('')}</tr>`).join('')}</table></div>`;
    }
    return '';
  }
  function noteSection(sec, id) {
    const sk = (C.skills || []).find((x) => x.id === sec.skill);
    return `<section class="box note" ${id ? `id="${id}"` : ''}>
      <h4>${esc(sec.h)}</h4>
      <div class="chips">${sk ? `<span class="src s">${esc(sk.emoji)} ${esc(sk.label)}</span>` : ''}${srcChips(sec.src)}</div>
      ${(sec.body || []).map(noteBlock).join('')}
    </section>`;
  }
  function notesForSkill(skill, lesson) {
    const out = [];
    const add = (l) => (l.note || []).forEach((s) => { if (s.skill === skill) out.push({ l, s }); });
    if (lesson) add(lesson);
    if (!out.length && lesson) lesson.unitRef.lessons.forEach((l) => l !== lesson && add(l));
    if (!out.length) allLessons().forEach(add);
    return out.slice(0, 3);
  }
  // 틀린 문제의 "관련 노트": 빌드가 카드마다 골라 둔 섹션(ns, 가장 관련 깊은 것 먼저) → 없으면 같은 skill 섹션
  function relatedNotes(q, skill) {
    const card = q.ids.length === 1 ? cardById.get(q.ids[0]) : null;
    if (card && card.ns && skill === q.skill) {
      const l = lessonOf(card);
      const out = card.ns.map((i) => (l.note || [])[i]).filter(Boolean).map((s) => ({ l, s }));
      if (out.length) return out;
    }
    return notesForSkill(skill, q.lessonId && lessonById.get(q.lessonId));
  }
  function openNoteSheet(items) {
    const sh = sheet(`${items.map(({ l, s }) => `<div class="muted" style="font-size:12.5px;font-weight:700;margin:4px 0">${esc(l.unitRef.title)} › ${esc(l.title)}</div>${noteSection(s)}`).join('')}
      <button class="btn" id="ns-close" style="margin-top:12px">돌아가기</button>`);
    sh.classList.add('tall');
    bindSpeak(sh);
    $('#ns-close', sh).onclick = closeSheet;
  }
  function cardLine(c) {
    const sp = (t) => speakBtn(t);
    switch (c.t) {
      case 'word': return `<div class="li"><div class="l1"><b class="fr">${esc(c.fr)}</b><small>${esc(c.ko)}${c.g ? ` · ${{ m: '남성', f: '여성', pl: '복수' }[c.g]}` : ''}${c.note ? ` · ${esc(c.note)}` : ''}${c.pron ? ` · ${esc(c.pron)}` : ''}</small></div>${sp(c.say || c.fr)}</div>`;
      case 'verb': return `<div class="li"><div class="l1"><b class="fr">${esc(c.inf)} <span class="muted" style="font-weight:600">${esc(c.ko)}</span></b>
        <div class="forms fr">${PERSONS.map((p) => `<span>${p === 'je' && VOWEL.test(c.forms.je) ? "j'" : PLABEL[p]}</span><span>${esc(c.forms[p])}</span>`).join('')}</div>
        ${c.note ? `<small>${esc(c.note)}</small>` : ''}</div>${sp(PERSONS.map((p) => joinSubj(p === 'il' ? 'il' : p === 'ils' ? 'ils' : subjFor(p, c.forms[p]), c.forms[p])).join(', '))}</div>`;
      case 'pp': return `<div class="li"><div class="l1"><b class="fr">${esc(c.inf)} → ${esc(c.pp)}</b><small>${esc(c.aux)} · ${esc(c.ko)}${c.ex ? `<br><span class="fr">${esc(c.ex.fr)}</span> ${esc(c.ex.ko)}` : ''}</small></div>${sp(c.ex ? c.ex.fr : c.pp)}</div>`;
      case 'choice': {
        const fr = !hasHangul(c.q);
        return `<div class="li"><div class="l1"><b class="${fr ? 'fr' : ''}">${esc(BLANK.test(c.q) ? fill(c.q, c.a) : `${c.q} → ${c.a}`)}</b><small>${esc(c.ko || '')}${c.ko && c.explain ? ' · ' : ''}${esc(c.explain || '')}</small></div>${fr ? sp(fill(c.q, c.a)) : ''}</div>`;
      }
      case 'build': return `<div class="li"><div class="l1">${c.from ? `<small class="fr">${esc(c.from)} →</small>` : ''}<b class="fr">${esc(c.a)}</b><small>${esc(c.ko || '')}</small></div>${sp(c.a)}</div>`;
      case 'error': return `<div class="li"><div class="l1"><b class="fr"><span style="color:var(--red-d);text-decoration:line-through">${esc(c.wrong)}</span> → <span style="color:var(--green-d)">${esc(c.right)}</span></b><small>${esc(c.explain || c.ko || '')}</small></div></div>`;
      case 'listen': return `<div class="li"><div class="l1"><b class="fr">${esc(c.a)}</b><small>${esc([c.pron, c.ko, c.explain].filter(Boolean).join(' · '))}</small></div>${sp(c.say)}</div>`;
      case 'type': return `<div class="li"><div class="l1">${c.q ? `<small class="fr">${esc(c.q)} →</small>` : ''}<b class="fr">${esc(c.a)}</b><small>${esc(c.explain || '')}</small></div>${hasHangul(c.a) ? '' : sp(c.a)}</div>`;
      default: return '';
    }
  }
  function lessonNoteHtml(l, withCards) {
    const groups = [
      ['단어·표현', (c) => c.t === 'word'], ['동사 변화', (c) => c.t === 'verb'], ['과거분사', (c) => c.t === 'pp'],
      ['자주 틀리는 것', (c) => c.t === 'error'], ['발음', (c) => c.t === 'listen'], ['문장·문법', (c) => ['choice', 'build', 'type'].includes(c.t)],
    ];
    return `
      ${(l.tips || []).length ? `<div class="box summary"><h4>⚡ 한눈에 요약</h4>${l.tips.map((t) => `<div class="tip"><b>${esc(t.h)}</b>${t.b ? `<p>${rich(t.b)}</p>` : ''}
        ${t.rows ? `<div class="tbl-wrap"><table class="tbl fr">${t.rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</table></div>` : ''}</div>`).join('')}</div>` : ''}
      ${(l.note || []).map((s, i) => noteSection(s, `n-${l.id}-${i}`)).join('')}
      ${(l.fixes || []).length ? `<div class="box fix"><h4>⚠️ 필기 정정</h4>${l.fixes.map((f) => `<p style="margin-top:8px"><small class="muted">${esc(f.where || '')}</small><br><span class="was fr">${esc(f.was)}</span><br><span class="now fr">→ ${esc(f.now)}</span>${f.why ? `<br><small>${esc(f.why)}</small>` : ''}</p>`).join('')}</div>` : ''}
      ${withCards ? `<details class="box cards-all"><summary>🃏 이 레슨 카드 모아보기 (${l.cards.length})</summary>
        ${groups.map(([name, fn]) => { const cs = l.cards.filter(fn); return cs.length ? `<div class="section-title">${name} · ${cs.length}</div><div class="list">${cs.map(cardLine).join('')}</div>` : ''; }).join('')}</details>` : ''}`;
  }
  // "p.3, p.4, p.5, p.9" → "p.3–5, 9"
  function pageRange(keys) {
    const nums = keys.map((k) => /^p\.(\d+)$/.exec(k)).filter(Boolean).map((m) => +m[1]).sort((a, b) => a - b);
    const other = keys.filter((k) => !/^p\.\d+$/.test(k));
    const parts = [];
    for (let i = 0; i < nums.length; i++) {
      let j = i;
      while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
      parts.push(i === j ? `${nums[i]}` : `${nums[i]}–${nums[j]}`);
      i = j;
    }
    return [nums.length ? `p.${parts.join(', ')}` : '', other.length ? `${other.length}개 섹션` : ''].filter(Boolean).join(' · ');
  }
  function coversHtml(l) {
    if (!l.covers) return '';
    return `<details class="box covers"><summary>📚 이 레슨이 다루는 수업 자료</summary>${Object.entries(l.covers).map(([src, keys]) =>
      `<div class="cov-row"><span class="src ${/노션/.test(src) ? 'n' : 'd'}">${/노션/.test(src) ? '📝' : '📄'} ${esc(src.replace(/^Revision_Generale_.*/, '교프어I 최종복습 자료'))}</span> <small>${esc(pageRange(keys))}</small>${/노션/.test(src) ? `<div class="cov-secs">${keys.map((k) => esc(k.replace(/^§\s*/, ''))).join(' · ')}</div>` : ''}</div>`).join('')}</details>`;
  }
  function renderNotes(id) {
    const l = lessonById.get(id);
    app.innerHTML = `
      <div class="page-head"><button class="icon-btn" id="back" aria-label="뒤로">←</button><h2>${esc(l.emoji || '')} ${esc(l.title)}</h2></div>
      <div class="page">
        <div class="muted" style="font-size:13px">${esc(l.unitRef.title)} · ${shortDate(l.date)} 수업 · 수업자료와 노션 필기를 합쳐 정리했어요</div>
        ${coversHtml(l)}
        ${lessonNoteHtml(l, true)}
        <button class="btn" id="n-start">▶ 이 레슨 한 판</button>
      </div>`;
    $('#back').onclick = goHome;
    $('#n-start').onclick = () => startSession('lesson', id);
    bindSpeak();
  }
  function renderUnitNotes(uid) {
    const u = C.units.find((x) => x.id === uid);
    app.innerHTML = `
      <div class="page-head"><button class="icon-btn" id="back" aria-label="뒤로">←</button><h2>📖 ${esc(u.title)}</h2></div>
      <div class="page">
        <div class="box toc"><h4>목차</h4>${u.lessons.map((l) => `<button class="toc-i" data-to="L-${esc(l.id)}">${esc(l.emoji || '')} ${esc(l.title)} <small>${shortDate(l.date)}</small></button>`).join('')}</div>
        ${u.lessons.map((l) => `<h3 class="l-head" id="L-${esc(l.id)}">${esc(l.emoji || '')} ${esc(l.title)}</h3>${lessonNoteHtml(l, false)}`).join('')}
      </div>`;
    $('#back').onclick = goHome;
    $$('.toc-i').forEach((b) => b.onclick = () => document.getElementById(b.dataset.to).scrollIntoView({ behavior: 'smooth', block: 'start' }));
    bindSpeak();
  }

  // ================================================================ weakness
  function renderWeak() {
    const rep = skillReport();
    const weak = weakSkills();
    const tried = rep.filter((r) => r.recent >= 3);
    const kinds = Object.entries(S.kd).filter(([, v]) => v.n >= 3).map(([k, v]) => ({ k, acc: v.ok / v.n, n: v.n })).sort((a, b) => a.acc - b.acc);
    const pct = (x) => (x === null ? '–' : `${Math.round(x * 100)}%`);
    const color = (x) => (x === null ? 'var(--line2)' : x < 0.5 ? 'var(--red)' : x < 0.8 ? 'var(--gold)' : 'var(--green)');
    const sorted = rep.slice().sort((a, b) => (b.weak ?? -1) - (a.weak ?? -1) || a.mast - b.mast);
    const msg = weak.length
      ? `「${weak[0].label}」이(가) 제일 약해요 (최근 정답률 ${pct(weak[0].acc)}). 관련 문제를 새로 만들어서 집중 훈련해요!`
      : tried.length ? '지금은 뚜렷한 약점이 없어요! 👏 그래도 숙련도 낮은 유형을 골라 연습할 수 있어요.' : '아직 데이터가 부족해요. 몇 판 풀면 약한 유형을 찾아줄게요!';
    app.innerHTML = `
      <div class="page-head"><button class="icon-btn" id="back" aria-label="뒤로">←</button><h2>🎯 약점 분석</h2></div>
      <div class="page">
        <div class="hello-top"><div class="hello-pipou">${Pipou.svg(weak.length ? 'think' : tried.length ? 'happy' : 'idle', 'bob')}</div><div class="bubble">${esc(msg)}</div></div>
        ${weak.length ? `<button class="btn red" id="w-start">🎯 약점 집중 훈련 · ${esc(weak.slice(0, 2).map((w) => w.label).join(' + '))}</button>` : ''}
        ${kinds.length ? `<div class="section-title">문제 형태별 정답률</div><div class="box">${kinds.map((k) => `<div class="bar-row"><span>${esc(KIND_LABEL[k.k] || k.k)}</span><div class="hbar"><i style="width:${k.acc * 100}%;background:${color(k.acc)}"></i></div><b>${pct(k.acc)}</b></div>`).join('')}</div>` : ''}
        <div class="section-title">유형별 · 탭하면 그 유형만 훈련</div>
        <div class="box list">${sorted.map((r) => `<button class="skill-row" data-s="${esc(r.id)}" ${r.canDrill ? '' : 'disabled'}>
            <span class="se">${esc(r.emoji)}</span>
            <span class="l1"><b>${esc(r.label)}</b><small>최근 정답률 ${pct(r.acc)} · 졸업 진행 ${Math.round(r.mast * 100)}% · 카드 ${r.cards.length}${GEN[r.id] ? ' · 변형문제 ✨' : ''}</small>
              <span class="hbar"><i style="width:${(r.acc ?? 0) * 100}%;background:${color(r.acc)}"></i></span></span>
            <span class="go">▶</span></button>`).join('')}</div>
        <div class="muted" style="font-size:12.5px">✨ 표시된 유형은 수업 카드를 조합해 새 변형 문제를 계속 만들어요.</div>
      </div>`;
    $('#back').onclick = goHome;
    if (weak.length) $('#w-start').onclick = () => startSession('weak');
    $$('.skill-row').forEach((b) => b.onclick = () => startSession('weak', b.dataset.s));
  }

  // ================================================================ mistakes
  function renderMistakes() {
    const ms = mistakeCards();
    app.innerHTML = `
      <div class="page-head"><button class="icon-btn" id="back" aria-label="뒤로">←</button><h2>📕 오답노트</h2></div>
      <div class="page">
        ${ms.length ? `
          <div class="muted" style="font-size:14px">최근에 틀린 카드예요. 연속으로 맞히면 여기서 졸업해요 🎓</div>
          <button class="btn red" id="m-start">오답만 한 판 (${Math.min(ms.length, SESSION)}문제)</button>
          <div class="box list">${ms.map((c) => `<div>${cardLine(c).replace('<div class="l1">', `<div class="l1"><span class="pill">✗ ${S.cards[c.id].w} · ${esc(lessonOf(c).title)}</span>`)}</div>`).join('')}</div>`
        : `<div class="empty"><div class="e">${Pipou.svg('happy', 'bob')}</div><p>틀린 카드가 없어요!<br>문제를 풀다 틀리면 여기에 모여요.</p></div>`}
      </div>`;
    $('#back').onclick = goHome;
    if (ms.length) $('#m-start').onclick = () => startSession('mistakes');
    bindSpeak();
  }

  // ================================================================ 🩹 약점 노트 (실전 연습에서 틀린 문제를 이유별로 모아 둠 · 다시 맞히면 사라짐)
  function weakItems() {
    return Object.entries(S.wk || {}).filter(([id, w]) => w && !w.done && cardById.has(id))
      .map(([id, w]) => ({ id, w, c: cardById.get(id), l: lessonOf(cardById.get(id)) }))
      .sort((a, b) => (b.w.n || 1) - (a.w.n || 1) || b.w.at - a.w.at);
  }
  function buildWeakNoteSession() {
    const items = shuffle(weakItems()).slice(0, SESSION);
    return items.map(({ c, w }) => (w.part && examQuestion(c, w.part)) || makeQuestion(c)).filter(Boolean);
  }
  function renderWeakNote() {
    const items = weakItems();
    const byCat = {};
    items.forEach((x) => (byCat[x.w.cat] || (byCat[x.w.cat] = [])).push(x));
    const cats = Object.keys(WK_CATS).filter((k) => byCat[k]).sort((a, b) => byCat[b].length - byCat[a].length);
    const bySkill = {};
    items.forEach((x) => { bySkill[x.c.skill] = (bySkill[x.c.skill] || 0) + 1; });
    const topSkills = Object.entries(bySkill).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ sk: (C.skills || []).find((s) => s.id === id) || { id, label: id, emoji: '🧩' }, n }));
    const byLesson = {};
    items.forEach((x) => { byLesson[x.l.id] = (byLesson[x.l.id] || 0) + 1; });
    const topLessons = Object.entries(byLesson).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ l: lessonById.get(id), n }));
    const itemHtml = ({ id, w, l }) => `<div class="rv bad">
      <div class="rv-h"><small>${esc(l.title)} · ${esc(w.tag || '')}${(w.n || 1) > 1 ? ` · ${w.n}번 틀림` : ''}</small></div>
      ${w.heard ? `<div class="rv-q"><span class="fr">🔊 ${esc(w.heard)}</span> ${speakBtn(w.heard)}</div>` : ''}
      ${w.q ? `<div class="rv-q ${hasHangul(w.q) ? '' : 'fr'}">${esc(w.q)}</div>` : ''}${w.sub ? `<div class="rv-exp">${esc(w.sub)}</div>` : ''}
      <div class="rv-me">내 답 <span class="fr">${esc(w.given || '(비움)')}</span></div>
      <div class="rv-ans">정답 <span class="fr">${esc(w.ans).replace(/\n/g, '<br>')}</span></div>
      <div class="rv-act"><button class="note-link wk-note" data-id="${esc(id)}">📖 관련 노트</button></div>
    </div>`;
    app.innerHTML = `
      <div class="page-head"><button class="icon-btn" id="back" aria-label="뒤로">←</button><h2>🩹 약점 노트</h2></div>
      <div class="page">
        ${items.length ? `
          <div class="hello-top"><div class="hello-pipou">${Pipou.svg('think', 'bob')}</div><div class="bubble">실전 연습에서 틀린 ${items.length}문제를 틀린 이유별로 모았어요. 「${esc(WK_CATS[cats[0]].label)}」이(가) 제일 많아요. 다시 맞히면 여기서 사라져요!</div></div>
          <button class="btn red" id="wk-start">🩹 약점만 다시 풀기 (${Math.min(items.length, SESSION)}문제)</button>
          <div class="section-title">틀린 이유</div>
          <div class="box">${cats.map((k) => `<div class="bar-row"><span>${WK_CATS[k].e} ${esc(WK_CATS[k].label)}</span><div class="hbar"><i style="width:${(byCat[k].length / items.length) * 100}%;background:var(--red)"></i></div><b>${byCat[k].length}</b></div>`).join('')}</div>
          <div class="section-title">많이 틀린 문법 · 레슨</div>
          <div class="box list">${topSkills.map(({ sk, n }) => `<button class="skill-row wk-skill" data-s="${esc(sk.id)}"><span class="se">${esc(sk.emoji || '🧩')}</span><span class="l1"><b>${esc(sk.label)}</b><small>약점 ${n}문제 · 탭하면 그 유형 집중 훈련</small></span><span class="go">▶</span></button>`).join('')}
            ${topLessons.map(({ l, n }) => `<button class="skill-row wk-lesson" data-l="${esc(l.id)}"><span class="se">${esc(l.emoji || '📘')}</span><span class="l1"><b>${esc(l.title)}</b><small>약점 ${n}문제 · 탭하면 레슨 노트</small></span><span class="go">›</span></button>`).join('')}</div>
          ${cats.map((k) => `<div class="section-title">${WK_CATS[k].e} ${esc(WK_CATS[k].label)} · ${byCat[k].length}</div>
            <div class="wk-tip">${esc(WK_CATS[k].tip)}</div>
            <div class="rv-list">${byCat[k].map(itemHtml).join('')}</div>`).join('')}`
        : `<div class="empty"><div class="e">${Pipou.svg('happy', 'bob')}</div><p>약점 노트가 비어 있어요!<br>📝 실전 연습에서 틀린 문제가 이유별로 여기에 모여요.</p></div>
           <button class="btn" id="wk-exam">📝 실전 연습 하러 가기</button>`}
      </div>`;
    $('#back').onclick = goHome;
    bindSpeak();
    if ($('#wk-start')) $('#wk-start').onclick = () => startSession('weaknote');
    if ($('#wk-exam')) $('#wk-exam').onclick = openExamSetup;
    $$('.wk-note').forEach((b) => b.onclick = () => {
      const c = cardById.get(b.dataset.id);
      openNoteSheet(relatedNotes({ ids: [c.id], skill: c.skill, lessonId: lessonOf(c).id }, c.skill));
    });
    $$('.wk-skill').forEach((b) => b.onclick = () => startSession('weak', b.dataset.s));
    $$('.wk-lesson').forEach((b) => b.onclick = () => openView('notes', () => renderNotes(b.dataset.l)));
  }

  // ================================================================ profile & settings
  function renderProfile() {
    const L = levelOf(S.xp);
    const [, e, name, ko] = titleOf(L);
    const lo = need(L), hi = need(L + 1);
    const seen = allCards.filter((c) => !isNew(c)).length;
    const mastered = allCards.filter(isGrad).length;
    const acc = S.stats.answers ? Math.round((S.stats.correct / S.stats.answers) * 100) : 0;
    const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
    const maxXp = Math.max(50, ...days.map((d) => (S.days[d] || {}).xp || 0));
    const wd = ['일', '월', '화', '수', '목', '금', '토'];
    const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, lbl]) => `<button data-v="${v}" class="${String(S.settings[key]) === String(v) ? 'on' : ''}">${lbl}</button>`).join('')}</div>`;
    app.innerHTML = `
      <div class="page-head"><button class="icon-btn" id="back" aria-label="뒤로">←</button><h2>📊 내 기록</h2></div>
      <div class="page">
        <div class="box" style="text-align:center">
          <div style="font-size:56px;line-height:1.1">${e}</div>
          <h3 style="margin:6px 0 0">Lv.${L} ${esc(name)}</h3>
          <div class="muted" style="font-size:14px">${esc(ko)}</div>
          <div class="levelbar" style="margin-top:12px"><div class="lb-top"><span>다음 레벨까지</span><span>${S.xp - lo} / ${hi - lo} XP</span></div><div class="bar"><i style="width:${((S.xp - lo) / (hi - lo)) * 100}%"></i></div></div>
        </div>
        <div class="stats">
          <div class="stat"><span class="si">🔥</span><div><b>${currentStreak()}일</b><small>연속 · 최고 ${S.streak.best}일</small></div></div>
          <div class="stat"><span class="si">⚡</span><div><b>${S.xp}</b><small>총 XP</small></div></div>
          <div class="stat"><span class="si">🃏</span><div><b>${seen}/${allCards.length}</b><small>만나본 카드</small></div></div>
          <div class="stat"><span class="si">👑</span><div><b>${mastered}</b><small>졸업한 카드 🎓</small></div></div>
          <div class="stat"><span class="si">🎯</span><div><b>${acc}%</b><small>전체 정답률</small></div></div>
          <div class="stat"><span class="si">💥</span><div><b>${S.stats.bestCombo}</b><small>최고 콤보</small></div></div>
        </div>
        <div class="box"><h4>최근 7일 XP</h4>
          <div class="week">${days.map((d) => { const x = (S.days[d] || {}).xp || 0; const [y, m, dd] = d.split('-').map(Number); return `<div class="d ${d === today() ? 'today' : ''}"><span>${x || ''}</span><i style="height:${(x / maxXp) * 70}px"></i>${wd[new Date(y, m - 1, dd).getDay()]}</div>`; }).join('')}</div>
        </div>
        <div class="section-title">설정</div>
        <div class="box">
          <div class="setting"><div class="l1"><b>소리</b><small>끄면 듣기 문제가 빠지고 읽어주기도 멈춰요</small></div><button class="switch ${S.settings.sound ? 'on' : ''}" id="st-sound" aria-label="소리"></button></div>
          <div class="setting"><div class="l1"><b>읽기 속도</b></div>${seg('rate', [[0.7, '느리게'], [0.9, '보통'], [1.05, '빠르게']])}</div>
          <div class="setting"><div class="l1"><b>하루 목표</b><small>채우면 스트릭 +1</small></div>${seg('goal', [[1, '1판'], [2, '2판'], [3, '3판']])}</div>
          <div class="setting"><div class="l1"><b>테마</b></div>${seg('theme', [['auto', '자동'], ['light', '라이트'], ['dark', '다크']])}</div>
        </div>
        <div class="section-title">☁️ 기기 연동</div>
        <div class="box" id="sync-box">${syncBoxHtml()}</div>
        <div class="section-title">백업</div>
        <div class="box">
          <p class="muted" style="font-size:13.5px">기록은 이 폰에만 저장돼요. 폰을 바꾸거나 브라우저 데이터를 지우기 전에 백업 코드를 복사해두세요.</p>
          <div class="row" style="display:flex;gap:10px;margin-top:10px"><button class="btn small ghost" id="bk-export">백업 코드 복사</button><button class="btn small ghost" id="bk-import">복원하기</button></div>
          <div id="bk-area"></div>
        </div>
        <div class="muted" style="font-size:12.5px;text-align:center">콘텐츠 버전 ${esc(C.version)} · ${esc((C.built || '').slice(0, 16).replace('T', ' '))}</div>
        <button class="btn small ghost" id="reset" style="color:var(--red-d)">기록 초기화</button>
      </div>`;
    $('#back').onclick = goHome;
    bindSyncBox();
    $('#st-sound').onclick = () => { S.settings.sound = !S.settings.sound; save(); renderProfile(); };
    $$('.seg').forEach((sg) => $$('button', sg).forEach((b) => b.onclick = () => {
      const key = sg.dataset.key;
      S.settings[key] = key === 'theme' ? b.dataset.v : Number(b.dataset.v);
      save();
      if (key === 'theme') applyTheme();
      if (key === 'rate') TTS.speak('Bonjour ! Allez, on y va !');
      renderProfile();
    }));
    $('#bk-export').onclick = async () => {
      const code = 'ALLEZ1:' + btoa(unescape(encodeURIComponent(JSON.stringify(S))));
      $('#bk-area').innerHTML = `<textarea class="code" readonly style="margin-top:10px">${esc(code)}</textarea>`;
      try { await navigator.clipboard.writeText(code); toast('📋 백업 코드를 복사했어요. 메모장에 붙여넣어 두세요'); }
      catch (e) { $('#bk-area textarea').select(); toast('코드를 길게 눌러 복사하세요'); }
    };
    $('#bk-import').onclick = () => {
      $('#bk-area').innerHTML = `<textarea class="code" id="bk-in" placeholder="ALLEZ1:로 시작하는 백업 코드를 붙여넣기" style="margin-top:10px"></textarea><button class="btn small" id="bk-do" style="margin-top:8px">이 코드로 복원</button>`;
      $('#bk-do').onclick = () => {
        try {
          const raw = $('#bk-in').value.trim();
          if (!raw.startsWith('ALLEZ1:')) throw new Error('prefix');
          const data = JSON.parse(decodeURIComponent(escape(atob(raw.slice(7)))));
          if (!data.cards || typeof data.xp !== 'number') throw new Error('shape');
          if (!confirm('지금 기록을 백업 코드의 기록으로 바꿀까요?')) return;
          localStorage.setItem(KEY, JSON.stringify(data));
          S = load();
          applyTheme();
          toast('✅ 복원 완료!');
          renderProfile();
        } catch (e) { toast('코드가 올바르지 않아요'); }
      };
    };
    $('#reset').onclick = () => {
      if (!confirm(`정말 모든 기록(XP, 스트릭, 복습 기록)을 지울까요? 되돌릴 수 없어요.${S.sync ? '\n(기기 연동도 해제돼요. 다른 기기의 기록은 그대로예요)' : ''}`)) return;
      const keep = S.settings;
      S = fresh();
      S.settings = keep;
      S.seenLessons = allLessons().map((l) => l.id);
      S.lastVersion = C.version;
      save();
      toast('기록을 초기화했어요');
      renderProfile();
    };
  }

  // ================================================================ 기기 연동 (동기화 코드 + Vercel Blob)
  // 합치기 규칙
  // - XP·판 수·일별 기록: 기기별 장부(ledger). 내 장부 = 합계 − 다른 기기 장부. 합계 = 모든 장부의 합 → 두 번 세지 않음
  // - 카드: 더 많이 푼 쪽(n) · 같으면 최근(last) / 스킬·형태 통계: 시도 수 많은 쪽 / 감도: 나중에 바꾼 쪽
  // - 스트릭은 합친 일별 기록으로 다시 계산. 소리·테마·하루 목표는 기기마다 따로
  const SYNC_WORDS = ['croissant', 'baguette', 'metro', 'fromage', 'cafe', 'louvre', 'seine', 'beret', 'pigeon', 'macaron',
    'crepe', 'velo', 'soleil', 'lune', 'etoile', 'nuage', 'pomme', 'fraise', 'citron', 'chat', 'chien', 'lapin', 'tortue',
    'hibou', 'renard', 'livre', 'stylo', 'jardin', 'fleur', 'arbre', 'plage', 'montagne', 'neige', 'pluie', 'tour', 'pont',
    'gare', 'musee', 'opera', 'piano', 'guitare', 'chanson', 'poeme', 'lettre', 'bateau', 'avion', 'train', 'chapeau',
    'fromager', 'bonbon', 'gateau', 'chocolat', 'miel', 'olive', 'tomate', 'carotte', 'orange', 'violet', 'rouge', 'bleu',
    'vert', 'jaune', 'lumiere', 'matin'];
  const makeSyncCode = () => {
    const r = new Uint32Array(4);
    crypto.getRandomValues(r);
    return `${SYNC_WORDS[r[0] % 64]}-${SYNC_WORDS[r[1] % 64]}-${SYNC_WORDS[r[2] % 64]}-${String(r[3] % 10000).padStart(4, '0')}`;
  };
  const SYNC_CODE_RE = /^[a-z]+-[a-z]+-[a-z]+-\d{4}$/;
  const deviceName = () => (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) ? '📱 폰' : '💻 컴퓨터');
  function deviceId() {
    if (!S.device) {
      S.device = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).slice(0, 18);
      save();
    }
    return S.device;
  }
  const emptyLedger = () => ({ xp: 0, s: 0, a: 0, c: 0, h: 0, days: {} });
  function ledgerSum(ls) {
    const out = emptyLedger();
    for (const l of ls) {
      out.xp += l.xp || 0; out.s += l.s || 0; out.a += l.a || 0; out.c += l.c || 0; out.h += l.h || 0;
      for (const [d, [x, s]] of Object.entries(l.days || {})) {
        const cur = out.days[d] || [0, 0];
        out.days[d] = [cur[0] + x, cur[1] + s];
      }
    }
    return out;
  }
  function ledgerMax(a, b) {
    if (!a) return b;
    if (!b) return a;
    const out = { ...a };
    for (const k of ['xp', 's', 'a', 'c', 'h']) out[k] = Math.max(a[k] || 0, b[k] || 0);
    out.days = { ...(a.days || {}) };
    for (const [d, [x, s]] of Object.entries(b.days || {})) {
      const cur = out.days[d] || [0, 0];
      out.days[d] = [Math.max(cur[0], x), Math.max(cur[1], s)];
    }
    out.name = b.at > (a.at || 0) ? b.name : a.name;
    out.at = Math.max(a.at || 0, b.at || 0);
    return out;
  }
  // 내 장부 = 지금 합계 − 이미 알고 있는 다른 기기 장부
  function ownLedger() {
    const others = ledgerSum(Object.values(S.ledgers || {}));
    const cut = addDays(today(), -120);
    const own = {
      xp: Math.max(0, S.xp - others.xp), s: Math.max(0, S.stats.sessions - others.s), a: Math.max(0, S.stats.answers - others.a),
      c: Math.max(0, S.stats.correct - others.c), h: Math.max(0, (S.stats.hints || 0) - others.h), days: {},
      name: deviceName(), at: Date.now(),
    };
    for (const [d, v] of Object.entries(S.days)) {
      if (d < cut) continue;
      const o = others.days[d] || [0, 0];
      const x = Math.max(0, (v.xp || 0) - o[0]), s = Math.max(0, (v.s || 0) - o[1]);
      if (x || s) own.days[d] = [x, s];
    }
    return own;
  }
  function applyTotals(own, others) {
    const tot = ledgerSum([own, ...Object.values(others)]);
    S.xp = tot.xp;
    S.stats.sessions = tot.s; S.stats.answers = tot.a; S.stats.correct = tot.c; S.stats.hints = tot.h;
    S.days = {};
    for (const [d, [x, s]] of Object.entries(tot.days)) S.days[d] = { xp: x, s };
    recomputeStreak();
  }
  function recomputeStreak() {
    const t = today();
    const goal = S.settings.goal;
    const hit = (d) => ((S.days[d] || {}).s || 0) >= goal;
    let d = hit(t) ? t : addDays(t, -1);
    const last = d;
    let n = 0;
    while (hit(d)) { n++; d = addDays(d, -1); }
    if (n > 0) { S.streak.n = n; S.streak.last = last; }
    S.streak.best = Math.max(S.streak.best || 0, n);
  }
  function mergeRemote(remote, own) {
    const me = deviceId();
    const others = { ...(S.ledgers || {}) };
    for (const [id, l] of Object.entries(remote.ledgers || {})) {
      if (id === me) own = ledgerMax(own, l); // 같은 기기(복원 등)
      else others[id] = ledgerMax(others[id], l);
    }
    S.ledgers = others;
    applyTotals(own, others);
    for (const [id, rc] of Object.entries(remote.cards || {})) {
      const lc = S.cards[id];
      if (!lc || (rc.n || 0) > (lc.n || 0) || ((rc.n || 0) === (lc.n || 0) && (rc.last || '') > (lc.last || ''))) S.cards[id] = rc;
    }
    for (const key of ['sk', 'kd']) {
      for (const [id, r] of Object.entries(remote[key] || {})) {
        const l = S[key][id];
        if (!l || (r.n || 0) > (l.n || 0)) S[key][id] = r;
      }
    }
    if ((remote.sensAt || 0) > (S.sensAt || 0)) { S.sens = remote.sens || {}; S.sensAt = remote.sensAt; }
    if (remote.vb) {
      const st = vbState();
      for (const k of ['ed', 'del', 'kn', 'st']) {
        for (const [id, r] of Object.entries(remote.vb[k] || {})) {
          if (r && typeof r === 'object' && (!st[k][id] || (r.at || 0) > (st[k][id].at || 0))) st[k][id] = r;
        }
      }
    }
    for (const [id, r] of Object.entries(remote.wk || {})) { const l = S.wk[id]; if (r && (!l || (r.at || 0) > (l.at || 0))) S.wk[id] = r; }
    if (Array.isArray(remote.exams)) S.exams = [...new Map([...(S.exams || []), ...remote.exams].map((e) => [e.at, e])).values()].sort((a, b) => a.at - b.at).slice(-30);
    if (Array.isArray(remote.seenLessons)) S.seenLessons = [...new Set([...(S.seenLessons || []), ...remote.seenLessons])];
    S.stats.bestCombo = Math.max(S.stats.bestCombo || 0, remote.bestCombo || 0);
    S.streak.best = Math.max(S.streak.best || 0, remote.streakBest || 0);
    return own;
  }
  async function syncApi(op, data) {
    const r = await fetch('api/sync', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op, code: S.sync.code, data }),
    });
    if (!r.ok) throw new Error(`sync ${r.status}`);
    return r.json();
  }
  let syncing = null;
  let syncAgain = false;
  async function syncNow({ quiet = true } = {}) {
    if (!S.sync || !S.sync.code || location.protocol === 'file:') return false;
    if (syncing) { syncAgain = true; return syncing; }
    syncing = (async () => {
      try {
        let own = ownLedger();
        const got = await syncApi('get');
        if (got.data) own = mergeRemote(got.data, own);
        const me = deviceId();
        await syncApi('put', {
          v: 1, updatedAt: Date.now(), ledgers: { ...S.ledgers, [me]: own }, cards: S.cards, sk: S.sk, kd: S.kd,
          sens: S.sens, sensAt: S.sensAt || 0, vb: vbState(), seenLessons: S.seenLessons || [], wk: S.wk || {}, exams: S.exams || [], bestCombo: S.stats.bestCombo || 0, streakBest: S.streak.best || 0,
        });
        S.sync.at = Date.now();
        S.sync.err = null;
        save();
        if (!quiet) toast('☁️ 동기화 완료!');
        return true;
      } catch (e) {
        S.sync.err = navigator.onLine === false ? '오프라인' : '연결 실패';
        save();
        if (!quiet) toast(`☁️ 동기화 못 했어요 (${S.sync.err}). 나중에 다시 할게요`);
        return false;
      } finally {
        syncing = null;
        if (syncAgain) { syncAgain = false; setTimeout(() => syncNow(), 500); }
      }
    })();
    return syncing;
  }
  async function connectSync(code, { created = false } = {}) {
    S.sync = { code, at: 0, err: null };
    deviceId();
    save();
    const ok = await syncNow();
    if (ok) toast(created ? '☁️ 코드를 만들었어요! 다른 기기에서 입력하세요' : '☁️ 연결 완료! 두 기기 기록을 합쳤어요');
    else toast('☁️ 코드는 저장했어요. 인터넷 연결되면 동기화할게요');
    if (view === 'home') renderHome();
    else if (view === 'profile') renderProfile();
  }
  const syncLink = () => `${location.origin}${location.pathname}#sync=${S.sync.code}`;
  function syncBoxHtml() {
    if (!S.sync || !S.sync.code) {
      return `<p class="muted" style="font-size:13.5px">컴퓨터와 폰의 기록(XP·스트릭·졸업·약점)을 합쳐서 같이 써요. 로그인 없이 <b>동기화 코드</b> 하나로 연결해요.</p>
        <div class="row" style="display:flex;gap:10px;margin-top:10px"><button class="btn small" id="sy-new">새 코드 만들기</button><button class="btn small ghost" id="sy-enter">코드 입력</button></div>
        <div id="sy-area"></div>`;
    }
    const devs = Object.values(S.ledgers || {});
    const when = S.sync.at ? new Date(S.sync.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '아직';
    return `<div class="sync-code fr">${esc(S.sync.code)}</div>
      <p class="muted" style="font-size:13px;margin-top:6px">다른 기기에서 이 코드를 입력하거나, 아래 <b>연결 링크</b>를 그 기기에서 열면 돼요. 코드는 비밀번호라 남에게 알려주지 마세요.</p>
      <div class="sync-meta">☁️ 마지막 동기화 ${esc(when)}${S.sync.err ? ` · <span style="color:var(--red-d)">${esc(S.sync.err)}</span>` : ''}</div>
      <div class="sync-meta">연결된 기기: ${esc(deviceName())} (이 기기)${devs.map((d) => ` · ${esc(d.name || '기기')}`).join('')}</div>
      <div class="row" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn small" id="sy-link">🔗 연결 링크 복사</button>
        <button class="btn small ghost" id="sy-now">지금 동기화</button>
        <button class="btn small ghost" id="sy-off" style="color:var(--red-d)">연동 해제</button>
      </div>`;
  }
  function bindSyncBox() {
    const area = $('#sy-area');
    if ($('#sy-new')) $('#sy-new').onclick = () => connectSync(makeSyncCode(), { created: true });
    if ($('#sy-enter')) $('#sy-enter').onclick = () => {
      area.innerHTML = `<input class="type-input fr" id="sy-in" placeholder="croissant-metro-pomme-1234" autocapitalize="off" autocorrect="off" spellcheck="false" style="margin-top:10px;font-size:17px">
        <button class="btn small" id="sy-go" style="margin-top:8px">연결하기</button>`;
      $('#sy-go').onclick = () => {
        const code = $('#sy-in').value.trim().toLowerCase().replace(/\s+/g, '-');
        if (!SYNC_CODE_RE.test(code)) { toast('코드 형식이 달라요: 단어-단어-단어-숫자4개'); return; }
        connectSync(code);
      };
    };
    if ($('#sy-link')) $('#sy-link').onclick = async () => {
      try { await navigator.clipboard.writeText(syncLink()); toast('🔗 링크 복사! 카톡 "나에게 보내기"로 폰에 보내서 열어보세요'); }
      catch (e) { prompt('이 링크를 복사하세요', syncLink()); }
    };
    if ($('#sy-now')) $('#sy-now').onclick = async () => { await syncNow({ quiet: false }); renderProfile(); };
    if ($('#sy-off')) $('#sy-off').onclick = () => {
      if (!confirm('이 기기의 연동을 해제할까요? 지금까지 기록은 이 기기에 그대로 남아요.')) return;
      S.sync = null;
      save();
      renderProfile();
    };
  }
  // 기록 지킴이: 연동 안 된 기기의 홈에 안내 카드.
  // 브라우저 저장공간이 비면(사이트 데이터 삭제·다른 프로필·다른 주소) 기록이 통째로 사라져 보이므로,
  // 새로 시작한 기기면 "예전 기록 불러오기", 오래 쓴 기기면 "연동 켜 두기"를 권한다. 닫으면 그 기기에선 다시 안 띄움
  function restoreHtml() {
    if ((S.sync && S.sync.code) || S.restoreOff) return '';
    const isNewish = !S.created || S.created >= addDays(today(), -7);
    const [title, body] = isNewish
      ? ['☁️ 예전에 쓰던 기록이 있나요?', '다른 기기(폰·다른 브라우저)에서 쓰던 기록은 <b>동기화 코드</b>로 불러올 수 있어요. 그 기기의 프로필 → 기기 연동에 코드가 있어요.']
      : ['☁️ 기기 연동을 켜 두세요', '이 브라우저의 사이트 데이터가 지워지면 기록도 사라져요. 연동해 두면 코드만 다시 넣어 되살릴 수 있어요.'];
    return `<div class="restore-card"><button class="restore-x" id="rs-x" aria-label="닫기">✕</button>
      <b>${title}</b><p>${body}</p>
      <div class="restore-btns"><button class="btn small" id="rs-enter">🔑 코드 입력</button>${isNewish ? '' : '<button class="btn small ghost" id="rs-new">새 코드 만들기</button>'}</div></div>`;
  }
  function bindRestore() {
    if (!$('#rs-x')) return;
    $('#rs-x').onclick = () => { S.restoreOff = true; save(); renderHome(); };
    $('#rs-enter').onclick = () => {
      openView('profile', renderProfile);
      const go = $('#sy-enter');
      if (go) { go.click(); $('#sync-box').scrollIntoView({ block: 'center' }); setTimeout(() => $('#sy-in') && $('#sy-in').focus(), 300); }
    };
    if ($('#rs-new')) $('#rs-new').onclick = async () => { await connectSync(makeSyncCode(), { created: true }); renderHome(); };
  }
  // 브라우저가 저장공간을 정리할 때 Allez 기록은 지우지 않도록 요청 (Chrome은 자주 여는 사이트면 허락)
  function askPersist() {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then((p) => p || navigator.storage.persist()).catch(() => {});
    } catch (e) { /* 지원 안 함 */ }
  }

  // 연결 링크(#sync=코드)로 열었을 때
  function handleSyncLink() {
    const m = location.hash.match(/^#sync=([a-z]+-[a-z]+-[a-z]+-\d{4})$/);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    if (S.sync && S.sync.code === m[1]) return;
    if (confirm(`이 기기를 동기화 코드 ${m[1]}에 연결할까요?\n두 기기의 기록이 합쳐져요.`)) connectSync(m[1]);
  }

  // ================================================================ boot
  async function loadContent() {
    const r = await fetch('content.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  async function boot() {
    applyTheme();
    TTS.init();
    app.innerHTML = '<div class="loading">🥐</div>';
    try {
      C = await loadContent();
    } catch (e) {
      app.innerHTML = `<div class="empty" style="margin-top:30vh"><div class="e">📡</div><p>문제를 불러오지 못했어요.<br>인터넷에 한 번 연결한 뒤 다시 열어주세요.</p><button class="btn" onclick="location.reload()" style="max-width:240px;margin:16px auto 0">다시 시도</button></div>`;
      return;
    }
    indexContent();
    const ids = allLessons().map((l) => l.id);
    if (!S.seenLessons) S.seenLessons = ids.slice();
    else if (S.lastVersion !== C.version) {
      const added = allLessons().filter((l) => !S.seenLessons.includes(l.id));
      if (added.length) setTimeout(() => toast(`🎉 새 레슨 ${added.length}개 도착! ${added.map((l) => l.emoji || '').join('')}`, 3500), 600);
    }
    S.lastVersion = C.version;
    save();
    renderHome();
    handleSyncLink();
    askPersist();
    if (S.sync && S.sync.code) syncNow().then((ok) => { if (ok && view === 'home') renderHome(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !S.sync || view === 'player') return;
      if (Date.now() - (S.sync.at || 0) > 60000) syncNow().then((ok) => { if (ok && view === 'home') renderHome(); });
    });
    if (/[?&]debug\b/.test(location.search)) window.__allez = { syncNow, connectSync, deviceId, ownLedger, setS: (x) => { S = x; }, setDay: (n) => { DAY_OFFSET = n; }, grade, needFor, isGrad, progressOf, reset: () => { S = fresh(); S.seenLessons = []; }, sanitizeHint, hintSteps, allCards, makeQuestion, buildSession, buildExam, examQuestion, classifyMiss, weakItems, startExam, GEN, genFor, skillReport, weakSkills, S: () => S, norm, blocksOf, startSession, play: (qs) => { P = { mode: 'review', queue: qs, i: 0, phase: 'answer', combo: 0, bestCombo: 0, xp: 0, ok: 0, answered: 0, mistakes: 0, retried: new Set(), start: Date.now(), finished: false }; openView('player', renderPlayer); } };

    if ('serviceWorker' in navigator && location.protocol === 'https:') { // 로컬 미리보기(http)에선 캐시 안 씀
      navigator.serviceWorker.register('sw.js').catch(() => {});
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || view !== 'home') return;
        reloading = true;
        location.reload();
      });
    }
  }
  boot();
})();
