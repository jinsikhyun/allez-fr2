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
        if len(text) < 40:
            d = os.path.join(outdir, name)
            os.makedirs(d, exist_ok=True)
            png = os.path.join(d, f'p{i}.png')
            page.get_pixmap(dpi=80).save(png)
            imgs.append(png)
    with open(os.path.join(outdir, name + '.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'{name}: {len(doc)}쪽, 그림 페이지 {len(imgs)}개 → pipeline/extracted/')
