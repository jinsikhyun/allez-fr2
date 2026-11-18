# Allez! — 교양프랑스어II 복습 앱

등하굣길용 듀오링고식 복습 PWA. 정적 파일(`app/`)을 Vercel에 배포하고, 문제는 `content/`의 JSON에서 나온다.

- `app/` — 배포되는 앱 (index.html, style.css, app.js, mascot.js, sw.js, content.json(생성물), icons/)
- `content/` — 문제·노트 원본. 작성 규칙은 **CONTENT_GUIDE.md** (반드시 먼저 읽기)
- `tools/build.mjs` — 검증 + `app/content.json` 생성 (+ sw.js 캐시 버전 갱신)
- `tools/extract.py` — PDF 텍스트 추출 (`tools/.venv/bin/python` 사용)
- `content/verbs.json` — 동사장(📒 Mes verbes) 기본 목록. 앱이 학생의 추가·수정·삭제·외웠어요(`S.vb`, 기기 연동으로 합쳐짐)를 그 위에 얹는다
- `tools/coverage.mjs` — 수업자료 커버리지 검사 (`content/coverage/*.json` 대조표 → `pipeline/COVERAGE.md`)
- `pipeline/processed.json` — 이미 반영한 자료 목록 / `pipeline/CHANGELOG.md` — 업데이트 기록
- 학생 자료: `../강의자료/` (PDF), 노션 `26-2 / 필기 및 자료 / 교양프랑스어II` (page id `722e4debecb882bda65301cb03f6526f`)

## 학생의 작업 흐름 (2026-09-30 합의)

1. **수업 중 (채팅)**: 학생이 그날 PDF를 채팅에 보내면 Claude는 수업 중 질문을 돕고, 노션 날짜 페이지 아래에 **정리 하위 페이지**(📐 문법 / 🌐 해석·연습문제 정답 / 🔊 발음)를 만든다. 이때 **Allez에는 직접 넣지 않는다** — 레슨이 필요하면 `content/_drafts/`에 초안만 두고 `processed.json`의 `drafts`에 기록한다 (`files`에는 넣지 않음, 배포 안 함).
2. **필기**: 학생은 필기를 **날짜 페이지 본문**에 한다. Claude가 만든 정리 하위 페이지는 참고 자료이지 학생 필기가 아니다.
3. **Allez 반영**: 화·수·목 23시 자동 실행이 그 시점까지의 필기로 반영·배포한다. 이후 날짜 페이지가 더 수정되면 다음 실행에서 기존 레슨에 **추가**로 보강한다.

## 자료 업데이트 절차 ("업데이트해줘" / 화·수·목 23시 자동 실행)

1. **새 자료 찾기**
   - `../강의자료/`의 파일 목록을 `pipeline/processed.json`의 `files`와 비교 (새 파일, 또는 size/mtime 변경).
   - 노션 부모 페이지를 fetch → **월 페이지(9월·10월 …)** → 각 월 페이지의 하위 = 날짜 페이지 목록 (2026-10-01부터 노션 구조가 `교양프랑스어II / <월> / <날짜>`로 바뀜). `notion_processed`에 없는 페이지, 또는 `page_last_edited_at`이 `last_run` 이후인 페이지를 fetch. 빈 템플릿이면 건너뛴다 (`notion_empty_at_last_run`에 기록). 노션은 **읽기 전용** — 절대 수정하지 않는다.
   - `pipeline/processed.json`의 `"drafts"`에 있는 자료는 **수업 중 채팅에서 만든 초안**이 있다는 뜻이다. 그 PDF를 새 자료로 처리하되, `content/_drafts/`의 초안 레슨·대조표를 출발점으로 삼아 슬라이드 + 날짜 페이지 필기(+ Claude 정리 페이지)를 합쳐 완성한 뒤 `content/u*/`로 옮기고(초안은 배포 전이라 id·유닛을 바꿔도 된다 — 예: semaine 5-2는 **Leçon 10**이므로 3단계 규칙대로 `u2`로 옮기고 id를 `u2-…`로), 대조표도 `content/coverage/`로 옮긴 다음 `drafts`에서 그 항목을 지운다.
   - `pipeline/processed.json`에 `"pending_deploy": true`가 있으면 새 자료가 없어도 6단계(검증)·7단계(배포)를 진행하고, 배포 성공 후 그 키를 지운다.
   - 새 것도 바뀐 것도 없으면 여기서 끝 (빌드·배포 안 함). CHANGELOG에 "변경 없음" 한 줄만.
2. **추출**: `tools/.venv/bin/python tools/extract.py "../강의자료/<파일>.pdf"` → `pipeline/extracted/`. 그림 페이지 PNG는 Read로 확인.
   - **PDF 필기 (2026-11-18부터)**: 학생이 수업자료 PDF에 직접 필기한다(글상자·형광펜·밑줄). 추출 결과의 각 페이지 끝 `--- 학생 PDF 필기 ---` 블록이 그 필기 → 노션 필기와 똑같이 반영(노트에 ✍️, 틀린 건 `fixes`). 형광펜이 문장 덩어리 전체로 잡히면 주석 포함 렌더(`page.get_pixmap(dpi=110, annots=True)`)로 실제 표시한 곳을 확인. 손글씨(Ink)는 `p<N>_annot.png`로 저장됨.
   - 이미 반영한 PDF라도 **size/mtime이 바뀌면 필기가 추가된 것**일 수 있으니 다시 추출해 새 주석을 기존 레슨에 보강한다.
3. **어디에 넣을지 결정**: 유닛 = Leçon. 슬라이드/필기에 새 Leçon 번호(예: Leçon 10)가 시작되면 `content/units.json`에 유닛을 추가(`u2`, `u3`… 제목 `Leçon 10 · <주제>`)하고 `content/u2/`를 만든다. 같은 Leçon이면 기존 유닛에 레슨 파일을 추가한다. 기존 레슨 내용이 보강된 경우엔 그 레슨 파일에 카드/노트를 **추가**만 한다 (기존 카드 id 변경·삭제 금지 — 학습 기록이 id에 묶여 있음).
4. **작성**: CONTENT_GUIDE.md대로 레슨 파일 작성 — 카드 수는 자료 분량만큼 빠짐없이(모든 카드에 `skill`, 문제형 카드엔 `hint`), 수업자료+노션 필기를 대조·종합한 `note`, `tips`, 필기 오류는 고쳐서 `fixes`. 새 문법이면 `content/skills.json`에 스킬 추가. 슬라이드에 정답이 없는 연습문제는 직접 풀어 정답을 만든다. 교수님 자료와 다른 "정정"은 명백한 오류일 때만.
4-1. **동사장**: 새 레슨에 `verb`·`pp` 카드로 나온 동사가 `content/verbs.json`에 없으면 추가한다 (필드: id(악센트 뺀 slug), inf, ko, pron [한글], group "1"|"2"|"3", pronominal, forms 6칸, pp, aux, ppr, note, lessons, since). 빌드가 빠진 동사를 경고로 알려준다. 기존 동사 id는 바꾸지 않는다.
5. **커버리지 (필수 — 학생 요구사항: 수업자료·수업 내용을 빠짐없이)**: 새 PDF는 **모든 페이지**, 새 노션 필기는 **모든 섹션**을 `content/coverage/<파일>.json` 대조표에 카드/노트로 연결한다 (형식은 `tools/coverage.mjs` 머리 주석). 연결할 카드가 없는 내용은 카드·노트를 추가한다. 연습문제는 문항마다 카드. `node tools/coverage.mjs`가 ✅(빠진 페이지 0, 참조 오류 0)일 때까지.
6. **검증**: `node tools/build.mjs` — 오류 0이 될 때까지 고친다. 새 카드 몇 장을 무작위로 골라 프랑스어·정답 유일성을 다시 확인.
7. **배포**: `cd app && npx vercel deploy --prod --yes --scope hyun-4947` (프로젝트는 `app/.vercel`에 연결돼 있지만 `project.json`의 orgId가 현재 팀과 달라서 `--scope` 없이는 "Not authorized"). 배포 후 https://allez-fr2.vercel.app 가 200인지, `/content.json`의 version이 새 빌드인지 확인.
8. **기록**: `pipeline/processed.json` 갱신(`last_run`=지금 UTC, files, notion_processed/empty) + `pipeline/CHANGELOG.md`에 날짜·추가된 레슨·카드 수·정정 사항 추가.
9. 자동 실행이면 마지막에 무엇이 추가됐는지 짧게 요약한다 (학생이 알림으로 봄).

## 시험 출제 방향 (2026-11-18 추가 — 학생 요구: 기말 범위에 반영)

- 분석 원문: `pipeline/exam/midterm-2026-10-21.md` (중간고사 채점 시험지 기반 오답·출제 형태 분석). 레슨을 쓸 때 반드시 참고.
- 시험지 = 8개 대문항, 25점, **객관식 없음**: I 듣기 빈칸(교과서 본문 문장, 단음절 기능어) · II 길 안내 듣기 · III 그림 상황 답하기(수업 표현 그대로) · IV 변환(부정/명령/시제/대명동사) · V 오류 **모두** 고치기(문장당 1–2개) · VI 배열(엘리지옹 전 형태로 쪼갬, 조동사+p.p. 붙이기) · VII 독해(비교·최상급 순위 추론) · VIII 작문(새 문법 주제, 최소 6문장).
- 출제 패턴: 슬라이드 예문·연습문제·퀴즈가 **그대로 또는 한 단어만** 바뀌어 나옴 / 주어·수를 바꿔 일치 함정 / 두세 단원 결합 / 오류 2개 심기.
- 학생 약점: 대명동사(부정 위치·재귀대명사 누락·être 누락) · 명령형 인칭(-s, aie/ayez) · 듣기 단음절(eu, de) · 배열에서 조동사+p.p. 분리 · 첫 오류만 고치고 멈춤.
- **새 Leçon을 반영할 때마다** 그 Leçon 유닛에 「⭐ 기말 예상 문제」 레슨(시험 8개 형식 그대로, `dictate` 듣기 빈칸·오류 모두 고치기 type·배열 build·변환·독해·작문 모범문)을 추가/보강하고, 시험에 그대로 나올 만한 슬라이드 예문 카드에 `star: true`.

## 개발 메모

- 로컬 미리보기: `python3 -m http.server 5178 --directory app` 후 `http://localhost:5178/?debug` (`window.__allez` 디버그 훅).
- 학습 기록은 기기 localStorage(`allez.state.v1`) + 동기화 코드를 연결하면 클라우드(아래 기기 연동). 카드 id를 바꾸면 기록이 끊긴다.
- 복습 스케줄 = 졸업 시스템 (`app.js`의 `grade`/`needFor`/`buildSession`): 힌트 없이 다른 날 n번 연속 정답 → 졸업. 감도는 레슨별 `S.sens`. 디버그 훅 `__allez.setDay(n)`로 날짜를 당겨 시뮬레이션할 수 있다.
- `app/content.json`, sw.js의 VERSION은 빌드가 만든다 — 손으로 고치지 않는다. 빌드는 카드마다 "관련 노트" 섹션 번호(`ns`)도 골라 넣는다 (`NS_DEBUG=카드id,… node tools/build.mjs --check`로 점수 확인).
- 홈: 인사 카드 아래 "최근 수업" 카드 = 가장 최근 수업일의 레슨. 유닛은 **마지막 유닛만 펼침**이 기본이고 학생이 접고 편 상태는 `S.fold`에 기기별로 저장 → 새 유닛(Leçon)을 추가하면 이전 유닛은 자동으로 접힌다.
- 직접 쓰기 채점: `q`와 정답이 같은 주어로 시작하면 주어 뺀 답도 인정(`qType`의 `withoutSubject`). 오답이면 "내 답도 맞아요"로 정답 처리 가능(`overrideAnswer` — 채점 전 상태를 `snapshotAnswer`로 기억했다가 되돌림).
- 📝 실전 연습 (`mode: 'exam'`, `buildExam`/`EX_GEN`): 유닛(Leçon) 여러 개를 골라 20/30/40문제. 파트 순서 듣기 30% → 쓰기 30% → 객관식 40% (소리 꺼지면 듣기 없이 쓰기 43·객관식 57). 레슨을 돌아가며 1장씩 뽑아 범위 전체에 고르게, 같은 레슨에서 이미 나온 노트 주제(`ns`)는 피함. 힌트·재도전 없음. 채점은 「끝나고 한꺼번에」(결과 화면에서 commit, `examOverride`로 내 답도 맞아요) / 「문제마다 바로」 선택(`EX`, localStorage `allez.exam`). 쓰기 빈칸은 뜻(ko)이나 (원형) 단서가 있는 카드만. 기록 `S.exams`.
- 🩹 약점 노트 (`S.wk`): 실전 연습 오답을 `classifyMiss`로 분류(악센트·엘리지옹·성수일치·어순·듣기·동사 형태·어휘·문법). 그 카드를 힌트 없이 맞히면 `grade`가 `{done:true}` 표시로 지움(동기화용 tombstone). 「약점만 다시 풀기」는 틀렸던 파트 형식 그대로 다시 출제.
- 기록 지킴이: 연동 안 된 기기 홈의 `restoreHtml()` 안내 카드(닫으면 `S.restoreOff`) + 부팅 때 `askPersist()`(navigator.storage.persist).
- 기기 연동: `app/api/sync.js` (Vercel 함수) + Vercel Blob 비공개 저장소 `allez-sync`(icn1). 동기화 코드를 `SYNC_SALT`(환경변수)와 해시한 경로에 기록 JSON 저장. 합치기는 `app.js`의 "기기 연동" 섹션(기기별 장부 ledger). `app/.env.local`에는 비밀 토큰이 있으니 출력·공유 금지(.vercelignore로 배포 제외됨). 로컬 테스트: `cd app && npx vercel dev --listen 5179`.
