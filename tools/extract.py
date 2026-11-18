#!/usr/bin/env python3
"""수업자료 PDF → 텍스트 추출. 글자가 거의 없는 페이지(그림 슬라이드)는 PNG로 렌더링해서 눈으로 볼 수 있게 한다.
사용: tools/.venv/bin/python tools/extract.py "../강의자료/[Francais II]semaine 4-1.pdf" [...]
결과: pipeline/extracted/<파일명>.txt (페이지마다 '=== p.N ===' 구분), pipeline/extracted/<파일명>/p<N>.png
"""
import os, sys
import fitz

here = os.path.dirname(os.path.abspath(__file__))
outdir = os.path.join(here, '..', 'pipeline', 'extracted')
os.makedirs(outdir, exist_ok=True)

for path in sys.argv[1:]:
    name = os.path.splitext(os.path.basename(path))[0]
    doc = fitz.open(path)
    lines, imgs = [], []
    for i, page in enumerate(doc, 1):
        text = page.get_text().strip()
        lines.append(f'=== p.{i} ===\n{text}\n')
        # 학생이 PDF에 단 주석(글상자·형광펜·밑줄) — 2026-11부터 필기를 PDF에도 함
        notes = []
        for a in page.annots() or []:
            kind = a.type[1]
            if kind == 'FreeText':
                t = (a.info.get('content') or '').strip()
                if t:
                    notes.append(f'✍️ 글상자: {t}')
            elif kind in ('Highlight', 'Underline', 'StrikeOut', 'Squiggly'):
                v = a.vertices or []
                rects = [fitz.Quad(v[q:q + 4]).rect for q in range(0, len(v) - 3, 4)] or [a.rect]
                words = page.get_text('words')
                parts = []
                for r in rects:
                    r = fitz.Rect(r.x0 - 1, r.y0 - 3, r.x1 + 1, r.y1 + 3)  # 형광펜이 글자 위아래로 살짝 어긋나도 잡히게
                    area = lambda x: max(0.0, x.width) * max(0.0, x.height)
                    hit = [w for w in words if area(fitz.Rect(w[:4])) and area(fitz.Rect(w[:4]) & r) / area(fitz.Rect(w[:4])) > 0.4]
                    parts.append(' '.join(w[4] for w in hit))
                t = ' '.join(p for p in parts if p) or (a.info.get('content') or '').strip() or '(글자 없는 곳에 표시)'
                label = {'Highlight': '형광펜', 'Underline': '밑줄', 'StrikeOut': '취소선', 'Squiggly': '물결'}[kind]
                memo = (a.info.get('content') or '').strip()
                notes.append(f'✍️ {label}: {t}' + (f' (메모: {memo})' if memo and memo != t else ''))
            elif kind in ('Text', 'Ink'):
                memo = (a.info.get('content') or '').strip()
                notes.append(f'✍️ {"메모" if kind == "Text" else "손글씨"}: {memo or "(내용은 그림 — p" + str(i) + "_annot.png 확인)"}')
                if kind == 'Ink':
                    d = os.path.join(outdir, name)
                    os.makedirs(d, exist_ok=True)
                    page.get_pixmap(dpi=110).save(os.path.join(d, f'p{i}_annot.png'))
        if notes:
            lines.append('--- 학생 PDF 필기 ---\n' + '\n'.join(notes) + '\n')
        if len(text) < 40:
            d = os.path.join(outdir, name)
            os.makedirs(d, exist_ok=True)
            png = os.path.join(d, f'p{i}.png')
            page.get_pixmap(dpi=80).save(png)
            imgs.append(png)
    with open(os.path.join(outdir, name + '.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'{name}: {len(doc)}쪽, 그림 페이지 {len(imgs)}개 → pipeline/extracted/')
