#!/usr/bin/env node
// 수업자료 커버리지 검사: 모든 PDF의 모든 페이지, 노션 필기의 모든 섹션이 카드/노트에 연결돼 있는지 확인한다.
// 대조표: content/coverage/*.json  →  { "<출처>": { "<페이지 또는 섹션>": ["카드id", "note:<레슨id>#<섹션번호>", "skip: 이유"] } }
//   - PDF 출처 이름 = pipeline/extracted/ 의 파일명에서 "[Francais II]" 뗀 것 (예: "semaine 3-2", "Revision_Generale_교프어I_최종복습")
//   - 페이지 키 = "p.12" / 노션 키 = "노션 9/16" 아래 자유로운 섹션 이름
// 결과: 빠진 페이지·잘못된 참조를 출력하고 pipeline/COVERAGE.md 를 만든다. 빠진 게 있으면 exit 1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const covDir = path.join(root, 'content', 'coverage');
const extDir = path.join(root, 'pipeline', 'extracted');

// 카드·노트 목록
const units = JSON.parse(fs.readFileSync(path.join(root, 'content', 'units.json'), 'utf8'));
const cardIds = new Set();
const noteRefs = new Set();
for (const u of units) {
  const dir = path.join(root, 'content', u.id);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const l = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    (l.cards || []).forEach((c) => cardIds.add(c.id));
    (l.note || []).forEach((_, i) => noteRefs.add(`note:${l.id}#${i}`));
    (l.tips || []).forEach((_, i) => noteRefs.add(`tip:${l.id}#${i}`));
  }
}

// PDF 페이지 목록 (추출 텍스트의 === p.N === 표시로)
const pdfPages = {};
if (fs.existsSync(extDir)) {
  for (const f of fs.readdirSync(extDir).filter((x) => x.endsWith('.txt'))) {
    const name = f.replace(/\.txt$/, '').replace(/^\[Francais II\]/, '').trim();
    const n = (fs.readFileSync(path.join(extDir, f), 'utf8').match(/^=== p\.\d+ ===$/gm) || []).length;
    pdfPages[name] = n;
  }
}

// 대조표 합치기
const map = {};
const files = fs.existsSync(covDir) ? fs.readdirSync(covDir).filter((x) => x.endsWith('.json')) : [];
const problems = [];
for (const f of files) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(covDir, f), 'utf8')); } catch (e) { problems.push(`${f}: JSON 오류 ${e.message}`); continue; }
  for (const [src, pages] of Object.entries(data)) {
    for (const [pg, refs] of Object.entries(pages)) {
      const key = `${src}|${pg}`;
      map[key] = [...(map[key] || []), ...(Array.isArray(refs) ? refs : [refs])];
      for (const r of Array.isArray(refs) ? refs : [refs]) {
        if (typeof r !== 'string') { problems.push(`${f} ${src} ${pg}: 참조가 문자열이 아님`); continue; }
        if (r.startsWith('skip:')) continue;
        if (r.startsWith('note:') || r.startsWith('tip:')) { if (!noteRefs.has(r)) problems.push(`${f} ${src} ${pg}: 없는 노트 ${r}`); continue; }
        if (!cardIds.has(r)) problems.push(`${f} ${src} ${pg}: 없는 카드 ${r}`);
      }
    }
  }
}

// 모든 PDF 페이지가 대조표에 있는지
const missing = [];
const rows = [];
for (const [src, n] of Object.entries(pdfPages).sort()) {
  let done = 0, skipped = 0;
  const miss = [];
  for (let p = 1; p <= n; p++) {
    const refs = map[`${src}|p.${p}`];
    if (!refs || !refs.length) miss.push(p);
    else if (refs.every((r) => r.startsWith('skip:'))) skipped++;
    else done++;
  }
  if (miss.length) missing.push(`${src}: p.${miss.join(', p.')}`);
  rows.push(`| ${src} | ${n} | ${done} | ${skipped} | ${miss.length ? '❌ ' + miss.join(', ') : '✅'} |`);
}
const notionKeys = [...new Set(Object.keys(map).filter((k) => k.startsWith('노션')).map((k) => k.split('|')[0]))].sort();
const notionRows = notionKeys.map((src) => {
  const secs = Object.keys(map).filter((k) => k.startsWith(src + '|'));
  const linked = secs.filter((k) => map[k].some((r) => !r.startsWith('skip:'))).length;
  return `| ${src} | ${secs.length} | ${linked} | ${secs.length - linked} |`;
});

const md = `# 수업자료 커버리지

\`node tools/coverage.mjs\`가 만든 파일 (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC).

## PDF (페이지 단위)

| 자료 | 쪽수 | 카드·노트로 연결 | 내용 없음(표지 등) | 빠진 쪽 |
|---|---|---|---|---|
${rows.join('\n')}

## 노션 필기 (섹션 단위)

| 필기 | 섹션 | 연결 | 내용 없음 |
|---|---|---|---|
${notionRows.join('\n')}
`;
fs.writeFileSync(path.join(root, 'pipeline', 'COVERAGE.md'), md);

for (const p of problems) console.error('❌', p);
for (const m of missing) console.error('❌ 대조표에 없는 페이지 —', m);
const totalPages = Object.values(pdfPages).reduce((a, b) => a + b, 0);
console.log(`PDF ${Object.keys(pdfPages).length}개 ${totalPages}쪽 · 노션 ${notionKeys.length}개 · 대조표 파일 ${files.length}개`);
console.log(`빠진 페이지 ${missing.length ? missing.length + '개 자료' : '0'} · 참조 오류 ${problems.length}`);
if (missing.length || problems.length) process.exit(1);
console.log('✅ 모든 페이지·섹션이 카드/노트에 연결됨 → pipeline/COVERAGE.md');
