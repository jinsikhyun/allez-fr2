#!/usr/bin/env node
// content/ 의 유닛·레슨 JSON을 검증하고 app/content.json 으로 묶는다.
// 사용: node tools/build.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'content');
const outFile = path.join(root, 'app', 'content.json');
const checkOnly = process.argv.includes('--check');
const allowErrors = process.argv.includes('--allow-errors'); // 로컬 미리보기 전용

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const PERSONS = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];
const TYPES = ['word', 'verb', 'pp', 'choice', 'build', 'error', 'listen', 'type'];
const NOTE_BLOCKS = ['p', 'table', 'ex', 'list', 'warn', 'memo'];
let SKILLS = new Set();
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const norm = (s) => s.normalize('NFC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err(path.relative(root, file), `JSON 파싱 실패 — ${e.message}`);
    return null;
  }
}

function checkOptions(where, a, wrong, min = 2) {
  if (!str(a)) err(where, '`a` 없음');
  if (!Array.isArray(wrong) || wrong.length < min) {
    err(where, `\`wrong\`은 ${min}개 이상 필요`);
    return;
  }
  const seen = new Set([norm(a || '')]);
  for (const w of wrong) {
    if (!str(w)) err(where, 'wrong에 빈 값');
    else if (seen.has(norm(w))) err(where, `wrong "${w}"가 정답 또는 다른 오답과 같음`);
    else seen.add(norm(w));
  }
}

// 힌트가 정답을 그대로 드러내는지: 짧은 답은 단어 단위, 긴 답은 부분 문자열로 검사
function leaks(hint, ans) {
  const h = norm(hint).replace(/[.?!,;:«»"“”()]/g, ' ');
  const a = norm(ans).replace(/[.?!]+$/, '').trim();
  if (!a) return false;
  if (a.length <= 3) return new RegExp(`(^|[\\s'])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s']|$)`).test(h);
  return h.includes(a);
}

function blocks(sentence) {
  return sentence.replace(/\s*[.?!]+\s*$/, '').split(/\s+/).filter(Boolean);
}

function checkCard(c, where, lesson) {
  if (!str(c.id)) return err(where, 'id 없음');
  if (!c.id.startsWith(lesson.id + '-')) warn(where, `id는 "${lesson.id}-"로 시작하는 게 좋음`);
  if (!TYPES.includes(c.t)) return err(where, `알 수 없는 타입 "${c.t}"`);
  if (!str(c.skill)) err(where, 'skill 없음');
  else if (!SKILLS.has(c.skill)) err(where, `skills.json에 없는 skill "${c.skill}"`);
  if (c.explain !== undefined && !str(c.explain)) err(where, 'explain이 비어 있음');
  if (c.explain && c.explain.length > 160) warn(where, `explain이 김 (${c.explain.length}자)`);
  if (['choice', 'build', 'error', 'type', 'listen'].includes(c.t) && !str(c.hint)) warn(where, 'hint 없음');
  if (c.hint !== undefined) {
    if (!str(c.hint)) err(where, 'hint가 비어 있음');
    else {
      if (c.hint.length > 70) warn(where, `hint가 김 (${c.hint.length}자)`);
      const ans = { choice: c.a, build: c.a, type: c.a, listen: c.a, error: c.right }[c.t];
      if (str(ans) && leaks(c.hint, ans)) err(where, `hint에 정답("${ans}")이 드러남`);
    }
  }

  switch (c.t) {
    case 'word':
      if (!str(c.fr) || !str(c.ko)) err(where, 'fr, ko 필요');
      if (c.g !== undefined && !['m', 'f', 'pl'].includes(c.g)) err(where, 'g는 m/f/pl');
      if (/[()]/.test(c.fr || '')) warn(where, 'fr에 괄호 — note로 옮기는 게 좋음');
      break;
    case 'verb':
      if (!str(c.inf) || !str(c.ko)) err(where, 'inf, ko 필요');
      if (!c.forms || typeof c.forms !== 'object') { err(where, 'forms 필요'); break; }
      for (const p of PERSONS) if (!str(c.forms[p])) err(where, `forms.${p} 없음`);
      for (const tr of c.traps || []) {
        if (!PERSONS.includes(tr.p)) err(where, `trap.p "${tr.p}" 잘못됨`);
        if (!str(tr.wrong)) err(where, 'trap.wrong 없음');
        else if (c.forms && norm(tr.wrong) === norm(c.forms[tr.p] || '')) err(where, `trap "${tr.wrong}"가 정답과 같음`);
      }
      break;
    case 'pp':
      if (!str(c.inf) || !str(c.ko) || !str(c.pp)) err(where, 'inf, ko, pp 필요');
      if (!['avoir', 'être'].includes(c.aux)) err(where, 'aux는 avoir/être');
      if (c.ex) {
        if (!str(c.ex.fr)) err(where, 'ex.fr 없음');
        else if (!new RegExp(`(^|[\\s'’])${c.pp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s.,!?]|$)`).test(c.ex.fr))
          err(where, `ex.fr에 과거분사 "${c.pp}"가 그대로 없음`);
      }
      break;
    case 'choice':
      if (!str(c.q)) err(where, 'q 없음');
      checkOptions(where, c.a, c.wrong);
      if ((c.wrong || []).length > 3) warn(where, 'wrong은 3개까지만 쓰임');
      break;
    case 'build': {
      if (!str(c.a)) { err(where, 'a 없음'); break; }
      if (!str(c.prompt)) err(where, 'prompt 없음');
      if (!str(c.from) && !str(c.ko)) err(where, 'from 또는 ko 필요');
      const n = blocks(c.a).length;
      if (n < 2) err(where, '블록이 2개 미만');
      if (n > 10) warn(where, `블록 ${n}개 — 폰에서 길 수 있음`);
      for (const alt of c.alts || []) {
        const x = blocks(alt).map(norm).sort().join('|');
        const y = blocks(c.a).map(norm).sort().join('|');
        if (x !== y) err(where, `alts "${alt}"는 정답과 같은 블록으로 만들 수 없음`);
      }
      const answerBlocks = new Set(blocks(c.a).map(norm));
      for (const e of c.extra || []) if (answerBlocks.has(norm(e))) warn(where, `extra "${e}"가 정답 블록과 같음 (중복 블록이 됨)`);
      break;
    }
    case 'error': {
      if (!str(c.s) || !str(c.wrong) || !str(c.right)) { err(where, 's, wrong, right 필요'); break; }
      const count = c.s.split(c.wrong).length - 1;
      if (count !== 1) err(where, `wrong "${c.wrong}"가 s 안에 ${count}번 등장 (정확히 1번이어야 함)`);
      if (norm(c.wrong) === norm(c.right)) err(where, 'wrong과 right가 같음');
      break;
    }
    case 'listen':
      if (!str(c.say)) err(where, 'say 없음');
      checkOptions(where, c.a, c.wrong, 1);
      break;
    case 'type':
      if (!str(c.prompt)) err(where, 'prompt 없음');
      if (!str(c.a)) err(where, 'a 없음');
      else if (c.a.split(/\s+/).length > 6) warn(where, '타이핑 답이 김 — build 타입 고려');
      break;
  }
}

function checkLesson(lesson, file, unitId) {
  const where = path.relative(root, file);
  if (!lesson) return;
  if (!str(lesson.id)) return err(where, '레슨 id 없음');
  if (path.basename(file, '.json') !== lesson.id) err(where, `파일명과 id(${lesson.id})가 다름`);
  if (lesson.unit !== unitId) err(where, `unit이 "${unitId}"가 아님`);
  if (!str(lesson.title)) err(where, 'title 없음');
  if (!str(lesson.emoji)) warn(where, 'emoji 없음');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lesson.date || '')) err(where, 'date는 YYYY-MM-DD');
  for (const [i, tip] of (lesson.tips || []).entries()) {
    if (!str(tip.h)) err(where, `tips[${i}].h 없음`);
    if (!str(tip.b) && !Array.isArray(tip.rows)) err(where, `tips[${i}]에 b 또는 rows 필요`);
  }
  for (const [i, f] of (lesson.fixes || []).entries()) {
    if (!str(f.was) || !str(f.now)) err(where, `fixes[${i}]에 was, now 필요`);
  }
  if (!Array.isArray(lesson.note) || lesson.note.length === 0) err(where, 'note(종합 노트) 없음');
  for (const [i, sec] of (lesson.note || []).entries()) {
    const w = `${where} note[${i}]`;
    if (!str(sec.h)) err(w, 'h 없음');
    if (sec.skill !== undefined && !SKILLS.has(sec.skill)) err(w, `skills.json에 없는 skill "${sec.skill}"`);
    if (!Array.isArray(sec.src) || !sec.src.length) warn(w, 'src(출처) 없음');
    if (!Array.isArray(sec.body) || !sec.body.length) { err(w, 'body 없음'); continue; }
    for (const [j, blk] of sec.body.entries()) {
      const keys = Object.keys(blk).filter((k) => k !== 'head');
      if (keys.length !== 1 || !NOTE_BLOCKS.includes(keys[0])) err(w, `body[${j}] 블록 형식 오류 (${keys.join(',')})`);
      else if (['table', 'ex', 'list'].includes(keys[0]) && !Array.isArray(blk[keys[0]])) err(w, `body[${j}].${keys[0]}는 배열`);
      else if (keys[0] === 'ex' && blk.ex.some((r) => !Array.isArray(r) || r.length !== 2)) err(w, `body[${j}].ex는 [fr, ko] 쌍 목록`);
    }
  }
  if (!Array.isArray(lesson.cards) || lesson.cards.length === 0) return err(where, 'cards 없음');
  if (lesson.cards.length < 8) warn(where, `카드 ${lesson.cards.length}장 — 적음`);

  const kos = new Map();
  for (const [i, c] of lesson.cards.entries()) {
    checkCard(c, `${where} cards[${i}]${c && c.id ? ' ' + c.id : ''}`, lesson);
    if (c && c.t === 'word' && str(c.ko)) {
      const k = norm(c.ko);
      if (kos.has(k)) warn(where, `word ko "${c.ko}"가 ${kos.get(k)}와 겹침`);
      kos.set(k, c.id);
    }
  }
}

// ---- main
const units = readJson(path.join(contentDir, 'units.json')) || [];
const skills = readJson(path.join(contentDir, 'skills.json')) || [];
SKILLS = new Set(skills.map((x) => x.id));
const bundle = { version: '', built: '', skills, units: [] };
const allIds = new Map();
const typeCount = {};
let cardTotal = 0;

for (const u of units) {
  if (!str(u.id) || !str(u.title)) { err('units.json', '유닛에 id, title 필요'); continue; }
  const dir = path.join(contentDir, u.id);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
  const lessons = [];
  for (const f of files) {
    const file = path.join(dir, f);
    const lesson = readJson(file);
    checkLesson(lesson, file, u.id);
    if (!lesson || !Array.isArray(lesson.cards)) continue;
    for (const c of lesson.cards) {
      if (!c || !str(c.id)) continue;
      if (allIds.has(c.id)) err(path.relative(root, file), `카드 id "${c.id}" 중복 (${allIds.get(c.id)})`);
      allIds.set(c.id, lesson.id);
      typeCount[c.t] = (typeCount[c.t] || 0) + 1;
      cardTotal++;
    }
    lessons.push(lesson);
  }
  bundle.units.push({ ...u, lessons });
}

// 커버리지 대조표(content/coverage/*.json) → 레슨별 "다루는 자료 범위"
const covDir = path.join(contentDir, 'coverage');
if (fs.existsSync(covDir)) {
  const lessonOfCard = new Map();
  for (const u of bundle.units) for (const l of u.lessons) for (const c of l.cards) lessonOfCard.set(c.id, l);
  const byId = new Map(bundle.units.flatMap((u) => u.lessons.map((l) => [l.id, l])));
  for (const f of fs.readdirSync(covDir).filter((x) => x.endsWith('.json'))) {
    const data = readJson(path.join(covDir, f)) || {};
    for (const [src, pages] of Object.entries(data)) {
      for (const [pg, refs] of Object.entries(pages)) {
        for (const r of [].concat(refs)) {
          if (typeof r !== 'string' || r.startsWith('skip:')) continue;
          const l = /^(note|tip):/.test(r) ? byId.get(r.slice(r.indexOf(':') + 1).split('#')[0]) : lessonOfCard.get(r);
          if (!l) continue;
          l.covers = l.covers || {};
          (l.covers[src] = l.covers[src] || new Set()).add(pg);
        }
      }
    }
  }
  for (const u of bundle.units) for (const l of u.lessons) {
    if (!l.covers) continue;
    l.covers = Object.fromEntries(Object.entries(l.covers).map(([src, set]) => [src, [...set].sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0))]));
  }
}

// ---- 관련 노트: 카드마다 같은 레슨에서 가장 관련 깊은 노트 섹션 번호(ns)를 골라 둔다
// 틀렸을 때 "📖 관련 노트 보기"가 이 섹션을 띄운다. 카드에 ns를 직접 적으면 그걸 쓴다.
// 점수 = 카드와 섹션이 함께 가진 낱말(프랑스어 단어 + 한글 두 글자 조각)을 드문 것일수록 크게 쳐서 더한 값
//      + 대조표에서 같은 페이지에 묶인 섹션 가산점 + 같은 skill 가산점
const FR_STOP = new Set(('les des une est pas que qui dans pour avec sur par son ses mon mes ton tes nous vous ils elles elle '
  + 'lui leur eux moi toi cette ces cet aux ont sont avoir être très bien tout mais plus').split(' '));
function textTokens(s) {
  const out = new Set();
  const t = String(s || '').normalize('NFC').toLowerCase().replace(/[’‘]/g, "'");
  for (const w of t.match(/[a-zàâäçéèêëîïôöûùüÿœæ]+/g) || []) if (w.length >= 3 && !FR_STOP.has(w)) out.add(w);
  for (const run of t.match(/[가-힣]{2,}/g) || []) for (let i = 0; i + 1 < run.length; i++) out.add('ㄱ' + run.slice(i, i + 2));
  return out;
}
const flat = (x) => (x == null ? [] : typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(flat) : typeof x === 'object' ? Object.values(x).flatMap(flat) : []);
function cardTokens(c) {
  const key = [c.a, c.right, c.wrong, c.fr, c.inf, c.pp, c.forms, (c.traps || []).map((t) => t.wrong), c.alts];
  const ctx = [c.q, c.s, c.from, c.ko, c.explain, c.hint, c.note, c.ex, c.say];
  const w = new Map();
  const add = (strs, wt) => { for (const tok of textTokens(flat(strs).join(' '))) w.set(tok, Math.max(w.get(tok) || 0, tok.startsWith('ㄱ') ? wt * 0.6 : wt)); };
  add(ctx, 1);
  add(key, 2);
  return w;
}
const coPage = new Map(); // 카드 id → 같은 페이지에 묶인 "레슨#섹션" 집합
if (fs.existsSync(covDir)) {
  for (const f of fs.readdirSync(covDir).filter((x) => x.endsWith('.json'))) {
    const data = readJson(path.join(covDir, f)) || {};
    for (const pages of Object.values(data)) for (const refs of Object.values(pages)) {
      const list = [].concat(refs).filter((r) => typeof r === 'string');
      const secs = list.filter((r) => r.startsWith('note:')).map((r) => r.slice(5));
      for (const r of list) if (!/^(note|tip|skip):/.test(r)) for (const s of secs) (coPage.get(r) || coPage.set(r, new Set()).get(r)).add(s);
    }
  }
}
let nsAuto = 0, nsNone = 0;
for (const u of bundle.units) for (const l of u.lessons) {
  const secs = (l.note || []).map((s) => ({ all: textTokens(flat([s.h, s.body]).join(' ')), head: textTokens(s.h), skill: s.skill }));
  const df = new Map();
  for (const s of secs) for (const t of s.all) df.set(t, (df.get(t) || 0) + 1);
  const idf = (t) => Math.log((secs.length + 1) / ((df.get(t) || 0) + 0.5));
  for (const c of l.cards) {
    if (Array.isArray(c.ns)) {
      if (!c.ns.every((i) => Number.isInteger(i) && i >= 0 && i < secs.length)) err(`${l.id} ${c.id}`, `ns ${JSON.stringify(c.ns)}가 note 범위 밖`);
      continue;
    }
    if (!secs.length) continue;
    const toks = cardTokens(c);
    const co = coPage.get(c.id) || new Set();
    const scored = secs.map((s, i) => {
      let sc = 0;
      for (const [t, wt] of toks) if (s.all.has(t)) sc += wt * idf(t) * (s.head.has(t) ? 1.5 : 1);
      if (co.has(`${l.id}#${i}`)) sc += 1;
      if (s.skill && s.skill === c.skill) sc = sc * 1.35 + 0.5;
      return { i, sc };
    }).sort((a, b) => b.sc - a.sc);
    if (process.env.NS_DEBUG && process.env.NS_DEBUG.split(',').includes(c.id)) {
      console.log(`[ns] ${c.id} (${c.skill})`, scored.map((x) => `#${x.i}:${x.sc.toFixed(1)}`).join(' '));
    }
    const best = scored[0].sc;
    if (best < 1.5) { nsNone++; continue; }
    c.ns = scored.filter((x, k) => k === 0 || (k < 2 && x.sc >= best * 0.6)).map((x) => x.i);
    nsAuto++;
  }
}

for (const w of warnings) console.warn('⚠️ ', w);
for (const e of errors) console.error('❌', e);

const lessonTotal = bundle.units.reduce((n, u) => n + u.lessons.length, 0);
console.log(`\n유닛 ${bundle.units.length} · 레슨 ${lessonTotal} · 카드 ${cardTotal}`);
console.log('타입별:', Object.entries(typeCount).map(([k, v]) => `${k} ${v}`).join(', '));
console.log(`관련 노트 자동 연결: ${nsAuto}장 · 못 찾음 ${nsNone}장 (그 카드는 같은 skill 섹션으로 대신)`);
console.log(`경고 ${warnings.length} · 오류 ${errors.length}`);

if (errors.length && !allowErrors) process.exit(1);
if (!checkOnly) {
  const now = new Date();
  bundle.built = now.toISOString();
  bundle.version = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  fs.writeFileSync(outFile, JSON.stringify(bundle));
  // 서비스워커 캐시 이름을 버전에 맞춰 갱신 → 폰에서 새 버전을 확실히 받음
  const swFile = path.join(root, 'app', 'sw.js');
  if (fs.existsSync(swFile)) {
    const sw = fs.readFileSync(swFile, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${bundle.version}';`);
    fs.writeFileSync(swFile, sw);
  }
  console.log(`✅ app/content.json 생성 (version ${bundle.version})`);
}
