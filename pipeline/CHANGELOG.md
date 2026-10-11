# 콘텐츠 업데이트 기록

## 2026-09-22 — 첫 배포
- 유닛(Leçon) 2개: 교프어I 복습(u0, 레슨 9개) · Leçon 9 복합과거(u1, 레슨 9개)
- 반영 자료: semaine 1-2 ~ 3-3, Revision_Generale 교프어I 최종복습, 노션 9/1 ~ 9/17
- 모든 레슨에 수업자료+노션 필기 종합 노트(note), 스킬 태그, 필기 정정(fixes)

## 2026-09-22 — 힌트 기능
- 💡 2단계 힌트: ① Pipou의 한마디(규칙·단서) ② 범위 좁히기(오답 지우기 / 첫 글자 / 앞 블록 채우기 / 짝 하나)
- 문법·문장 카드 421장에 맞춤 힌트, 단어·동사·과거분사는 앱이 자동 생성, 스킬별 기본 힌트 23개
- 힌트 쓰고 맞히면 XP 절반, 카드 박스 유지(내일 재출제), 약점 통계엔 0.5점

## 2026-09-22 — Semaine 4-1 (Leçon 9 계속)
- 새 레슨 2개 (u1): **u1-10 목적보어 대명사 (COD·COI)** 30장 · **u1-11 텍스트 〈Dans la rue〉** 28장
- 새 스킬 `pron-obj` (목적보어 대명사). 슬라이드 연습 10문항 정답·슬라이드 Q(Jeanne appelle sa mère) 정답을 노트에 수록
- 반영 자료: semaine 4-1 (채팅 업로드). 노션 9/22는 학생 필기 없음
- 빌드 경고 0 · 오류 0 (총 레슨 20 · 카드 658). **배포 대기** — 클라우드 세션에서 Vercel에 직접 배포할 수 없어 `pending_deploy: true`로 남김

## 2026-09-22 — 졸업 시스템 · 감도
- 같은 카드 반복 줄이기: 힌트 없이 **다른 날 n번 연속** 맞히면 졸업 → 일반 출제에서 빠지고 2~3주 뒤 기억 점검 1번(한 판 최대 1장), 틀리면 복귀
- 감도(레슨별 / Leçon 전체 적용): 🤖 자동(기본 3번, 약한 유형·여러 번 틀린 카드는 4~6번) · 🐇 2번 · 🐢 3번 · 🦉 5번
- 판 구성: 오늘 복습할 학습 카드 → 기억 점검 1장 → 나머지는 새 개념 카드(최근 수업 우선). 밀린 복습이 많으면 새 카드 3~5장으로 자동 조절
- 기존 기록은 자동 변환 (맞힌 카드 = 연속 1일)
- semaine 4-1 레슨(u1-10, u1-11) 검수 후 함께 배포 (pending_deploy 해제). 검수: 과한 힌트·복수 정답 문항·본문 과다 인용 수정

## 2026-09-22 — 기기 연동 (컴 ↔ 폰)
- 동기화 코드(단어-단어-단어-숫자4) 또는 연결 링크로 연결, 로그인 없음. 저장소: Vercel Blob 비공개 `allez-sync` + `/api/sync`
- 앱 열 때 · 한 판 끝날 때 · 앱으로 돌아올 때 자동 동기화, 오프라인이면 다음에
- 합치기: XP·판 수·일별 기록은 기기별 장부 합산(중복 없음), 카드는 더 많이 푼 쪽, 감도는 나중에 바꾼 쪽, 스트릭은 합친 기록으로 재계산. 소리·테마·하루 목표는 기기별

## 2026-09-22 — 수업자료 전수 커버리지
- PDF 10개 **249쪽 전부** + 노션 필기 10개 **173개 섹션 전부**를 카드·노트에 연결 (대조표 `content/coverage/`, 결과 `pipeline/COVERAGE.md`). 표지·목차·구분 페이지만 제외(42쪽)
- 빠져 있던 내용 채움: 카드 658 → **987장** (연습문제 문항별 카드, 모든 동사 변화 카드, 슬라이드 예시 단어·표현, 수업 중 문답·교수님 코멘트, OT·평가 방식 등), 노트 섹션 약 30개 추가
- 앱 노트 화면에 "📚 이 레슨이 다루는 수업 자료"(자료·페이지·필기 섹션) 표시
- 업데이트 절차에 커버리지 단계 필수화 (`node tools/coverage.mjs` ✅ 전까지 배포 안 함)

## 2026-09-22 (자동 실행 23시) — 변경 없음

## 2026-09-23 — Semaine 4-2 (Leçon 9 · 감탄문 · 강세형 대명사 · 장소 전치사 · 가족 어휘)

**자료**: `[Francais II]semaine 4-2.pdf` (20쪽, 채팅 업로드). 노션 9/23 페이지는 학생 필기 없음(빈 페이지) —
Claude가 하위 페이지 「Semaine 4-2 정리」를 작성해 채움. p.19는 텍스트 없는 이미지 슬라이드(Les DUBOIS 가계도)라
이미지로 렌더해서 읽음.

**새 레슨 3개**
- `u1-12` 감탄문 · 강세형 대명사 — 29장 / 노트 6섹션 (p.4, p.8, p.11, p.12)
- `u1-13` 장소 전치사 à · en · au(x) — 24장 / 노트 5섹션 (p.5–7, p.15–17)
- `u1-14` 가족 어휘 Les DUBOIS — 30장 / 노트 5섹션 (p.19)

**새 스킬 3개**: `pron-tonic`(강세형 대명사), `prep-lieu`(장소 전치사), `famille`(가족 어휘)

**대조표**: `content/coverage/u1-c.json` 신규. 20쪽 전부 매핑(표지·목차·간지 4쪽 skip).
p.10·p.13·p.14는 어제(4-1)와 같은 대화문이라 기존 u1-11 카드에 연결.

**내용 포인트**
- 감탄문: Que/Qu'est-ce que/Comme 뒤에는 **절**, Quel(le)(s) 뒤에는 **명사구** — 이 구분을 error 카드 2장으로 강화.
- quel·quelle·quels·quelles가 전부 [kɛl]로 같은 소리라는 점을 별도 카드로.
- 강세형: COD·COI 대명사와 형태가 겹치는 lui를 **자리**로 구분하는 카드(`u1-12-c-tonic-vs-coi`).
- `Et vous-même ?`의 -s 없음(존칭 단수)을 대화문과 연결해 star 처리.
- 전치사 연습문제 1번 Genève(도시 → à)와 3번 Pays-Bas(복수 → aux)를 함정으로 star 처리.
- 대화문의 `sur la Côte d'Azur`가 en 규칙의 예외임을 별도 노트 섹션으로.
- 가족: petit-fils(손자)/petits-enfants(손주) vs petits enfants(어린이), grands-parents의 복수 -s,
  le fils [피스] / la fille [피이] 발음 대비를 star 카드로.

**검증**: `node tools/build.mjs` 오류 0 · 경고 0 (카드 1070, 레슨 23) · `node tools/coverage.mjs` 빠진 페이지 0 · 참조 오류 0
**배포**: 대기 (`pending_deploy: true`) — 컨테이너·기기 모두 api.vercel.com 도달 불가

## 2026-09-24 — 노션 9/23 학생 필기 반영 + 배포
- 새 PDF 없음(semaine 4-2는 9/23에 이미 반영, mtime만 채움). 9/23 노션 페이지에 **학생 필기가 새로 작성됨**(9/23 07:50 이후) → 19개 섹션 전부 반영
- 추가: 카드 15장 (1070 → **1085**), 노트 섹션 3개 — u1-10 재귀 vs 상호 se(`se préparer`/`préparer`, `l'un à l'autre`, qqn·qqch), u1-11 텍스트 보충(dernier 위치 규칙, casser/se casser, se sentir mieux), u1-12 « J'ai envie d'aller à Nice » 세트 + Que/Comme 문어체
- 필기 정정 3건 (u1-11 `fixes`): Hélas = '어머나' → **안타까움('아아, 아쉽게도')** · `Il va mieux` 옆 "Se sentir" → 두 구문 구분(Il va mieux / Il se sent mieux) · darnier → **dernier** 철자
- 커버리지 ✅ (PDF 11개 269쪽 · 노션 11개, 빠진 페이지 0 · 참조 오류 0) · `build.mjs` 경고 0 오류 0
- **배포 완료** (9/23 `pending_deploy` 해제): https://allez-fr2.vercel.app 200, content.json version 20260924055009 · 카드 1085
- 참고: CLI가 `vercel deploy --prod --yes`만으로는 "Not authorized" → **`--scope hyun-4947`** 필요 (`app/.vercel/project.json`의 orgId가 현재 팀과 다름)

## 2026-09-29 — Semaine 5-1 (Leçon 9–10 · 현재분사 · 가족 어휘 연습)

**자료**: `[Francais II]semaine 5-1.pdf` (16쪽, 강의자료 폴더). 노션 9/29는 학생 필기 없음 → Claude가 하위 페이지 「Semaine 5-1 정리」 작성.
p.5는 텍스트 없는 이미지 슬라이드(Moi 기준 가계도: mon/ma + 가족)라 이미지로 렌더해서 읽음.
PARTIE 1(대화문 복습 + pour aller plus loin)은 간지만 있고 내용 슬라이드 없음(구두 진행). 목차 3번은 « Le texte-dialogue »지만 실제 PARTIE 3은 **Le participe présent** — Leçon 10 대화문은 다음 시간 예상.

**새 레슨**: `u1-15` 현재분사 — 31장 / 노트 7섹션 (p.11–15). 새 스킬 `part-pres`.
**기존 레슨 보강**: `u1-14`에 가족 연습문제 5문항 + mon/ma 1장 (30 → 36장), 노트 섹션 1개(관점 뒤집기).

**내용 포인트**
- 만드는 법: nous 현재형 −ons + -ant. mangeant의 e 유지(err 카드), 예외 ayant·étant·sachant 전부 star.
- 🔴 **성수 불변**: parlant(secrétaire 여성)·jouant(enfants 복수)·n'ayant(clients 복수) — 과거분사 일치와 대비해 error 카드 2장.
- 연습문제 3번 prendre → **prenant**(prendant ✗) — nous 형태에서 출발하는 이유를 보여주는 함정.
- 가족 4번 **l'oncle**(le oncle ✗), 5번 관점 뒤집기(Sophie 기준 → nièce).

**검증**: `build.mjs` 경고 0 오류 0 (카드 1122, 레슨 24) · `coverage.mjs` PDF 12개 285쪽 빠진 페이지 0 · 참조 오류 0
**배포**: 대기 (`pending_deploy: true`) — 이 세션의 기기 셸에서 api.vercel.com 도달 불가. 다음 자동 실행에서 7단계로 배포.

## 2026-09-29 (추가) — 9/29 수업 필기: PARTIE 1 대화문 변형 (Olivia–Jean)
- 슬라이드가 없던 PARTIE 1(pour aller plus loin)의 **수업 필기**를 채팅으로 받아 반영. 노션 하위 페이지 「Semaine 5-1 정리」에 「🗣️ PARTIE 1」 섹션 추가.
- **새 레슨** `u1-16` 대화문 변형 — Olivia와 Jean: 30장 / 노트 7섹션. 원본(Mercier–Lambert, vous)과 대비표.
- 핵심: 같은 Olivia가 je suis tombé**e**(일치 O) / je me suis cassé l'épaule(일치 X) — error·choice 카드 star. j'ai **souvent** fait(부사 위치), n'ai pas **pu** + 원형, qu'est-ce **qui**, faire **du** vélo / tomber **de** vélo, en fait [앙 페뜨] t 발음.
- **필기 정정 1건** (u1-16 `fixes`): `droit(e), gauch(e)` → gauche는 남녀 동형.
- 대조표 `u1-d.json`의 「노션 9/29」를 skip → 섹션 8개 매핑으로 교체. 커버리지 ✅ · `build.mjs` 경고 0 오류 0 (카드 1152, 레슨 25)
- **배포**: 대기 유지 (`pending_deploy: true`)

## 2026-09-30 (자동 실행) — 9/29 노션 필기 후반부 반영 + 배포
- 9/29 노션 페이지가 지난 실행 뒤(04:05Z)에 수정됨 → 대화문 뒤 섹션(가계도 메모, 연습 답, 불규칙 현재분사, 부정 de) 대조. 대부분 기존 u1-14/u1-15 카드로 커버돼 있어 대조표 `u1-d.json` 「노션 9/29」에 섹션 6개 매핑 추가.
- **u1-14 보강** (37 → 39장 + 노트 섹션 1개 「arbre généalogique · 합성어의 일치」): `u1-14-w-arbre`, `u1-14-err-grande-mere`(grand-mère는 -e 없음 — "여성이면 -e" 과잉 적용 방지), `u1-14-c-petite-fille-agree`.
- **필기 정정 1건** (u1-14 `fixes`): fils [퓌스] → **[피스]** (모음 [i]).
- 새 PDF 없음 (`semaine 4-1 (1).pdf`는 4-1과 md5 동일한 중복 — 무시). 9/30 페이지는 아직 빈 페이지.
- 커버리지 ✅ (PDF 12개 285쪽 · 노션 12개, 빠진 페이지 0 · 참조 오류 0) · `build.mjs` 경고 0 오류 0 (카드 1155, 레슨 25)
- **배포 완료** (`pending_deploy` 해제 — 9/29의 u1-15·u1-16 포함): https://allez-fr2.vercel.app 200, content.json version 20260929155119

## 2026-09-30 — 앱 개선: 타이핑 채점 · 관련 노트 · 홈 (학생 요청 1·2·3번)
직접 써 보니 불편했던 점 중 세 가지를 고침 (콘텐츠·카드 id 변경 없음).
1. **직접 쓰기 채점**: `q`와 정답이 같은 주어로 시작하면 주어를 뺀 답도 정답 (`Elle connaît` → `a connu` ✅). 복합과거 변환·부정문 등 34장이 해당. 오답이면 **"🙋 내 답도 맞아요"** 버튼으로 정답 처리 가능 — 오답 기록·재도전 문제를 되돌리고 정답으로 다시 기록 (악센트·엘리지옹 실수엔 버튼 없음).
2. **관련 노트**: 예전엔 같은 skill 섹션을 앞에서 3개 보여줘서 엉뚱한 섹션이 떴음 (예: jouants 오답 → "현재분사란"). 이제 빌드가 카드마다 가장 관련 깊은 섹션(`ns`)을 고름 — 카드·섹션의 겹치는 낱말(드문 것일수록 가중) + 대조표 같은 페이지 + 같은 skill. 1155장 전부 연결.
3. **홈**: 인사 카드 아래 "🆕 최근 수업"(가장 최근 수업일 레슨) 카드 추가. 지난 유닛(교프어I 복습)은 기본으로 접힘 — 머리를 누르면 펼침/접힘, 상태는 기기에 저장. 홈 길이 3866px → 2930px.
- 문서: CONTENT_GUIDE(`type` 주어 생략·내 답도 맞아요, `note` 관련 노트 선택 규칙, 카드 `ns` 필드), CLAUDE.md 개발 메모.
- 검증: jsdom으로 기능 테스트 51개 통과 + 모든 모드 무작위 227문제 스크립트 오류 0 · `build.mjs` 경고 0 오류 0 · 커버리지 ✅ · 앱 브라우저(375×812)에서 홈·채점·버튼 화면 확인.
- **배포 완료**: https://allez-fr2.vercel.app 200, content.json version 20260929164736

## 2026-09-30 — Semaine 5-2 (Leçon 10 · 제롱디프 · 위치 표현)
**자료**: `[Francais II]semaine 5-2.pdf` (20쪽, 채팅 업로드 · 강의자료 폴더에도 있음). p.4–8은 5-1 현재분사 슬라이드 재사용(정의 문구만 valeur verbale → valeur de verbe) → 기존 u1-15 카드에 연결. p.13(노래 가사, 〈알라딘〉 지니)·p.16–19(지도)는 이미지로 확인. 가사는 저작권 때문에 인용하지 않고 en frottant만 다룸.
노션 9/30 부모 페이지에 **이미지 2장**이 있으나 S3 서명 URL이 이 세션에서 차단돼 열지 못함 → `processed.json`의 `notion_pending`에 기록. Claude가 하위 페이지 「Semaine 5-2 정리」 작성.

**새 레슨 2개 · 새 스킬 2개** (`gerondif`, `localisation`)
- `u1-17` 제롱디프 — 32장 / 노트 6섹션. 네 가지 뜻(동시·조건·원인·수단)을 quand/si/parce que 변환으로. 🔴 주어 일치 규칙과 J'ai vu Paul **sortant** / **en sortant** 대비(star). 연습문제 3번 conduire → **conduisant**(conduiant ✗) error 카드.
- `u1-18` 위치 표현 — 30장 / 노트 5섹션. 건물 10개(l'église·l'école f / l'hôpital m 주의), derrière·devant·en face de·à côté de·entre…et. 🔴 de 유무(devant de ✗)와 **à côté du café**(de le ✗) error 카드 star. 지도 문제는 앱에 그림이 없어서 한국어 뜻으로 위치를 제시.

**검증**: `build.mjs` 경고 0 오류 0 (카드 1217, 레슨 27, 관련 노트 자동 연결 1215장) · `coverage.mjs` PDF 13개 305쪽 빠진 페이지 0 · 참조 오류 0
**배포**: 대기 (`pending_deploy: true`) — 이 세션의 기기 셸에서 api.vercel.com 도달 불가.
- 참고: 이미지 받기를 시도하다 생긴 빈 폴더 `pipeline/notion-img/`는 삭제 권한이 없어 남아 있음 (지워도 됨).

## 2026-09-30 (추가) — 작업 흐름 변경: 수업 중에는 초안만
- 학생과 합의: 채팅으로 보내는 수업 자료는 **수업 중 도움 + 노션 정리 페이지**용. Allez 반영은 필기(날짜 페이지 본문)가 들어간 뒤 **화·수·목 23시 자동 실행**이 한다.
- 그래서 오늘 만든 `u1-17`(제롱디프)·`u1-18`(위치 표현)은 **보류** → `content/_drafts/`로 이동(대조표·추출본 포함), 앱 빌드에서 제외. `processed.json`: semaine 5-2를 `files`에서 빼고 `drafts`에 기록, `pending_deploy`·`notion_pending` 해제.
- 현재 빌드 = 배포된 버전과 같은 1155장 (skills.json에 `gerondif`·`localisation` 스킬만 미리 추가돼 있음, 사용 전이라 무해).
- CLAUDE.md: 「학생의 작업 흐름」 섹션 추가, 1단계에 `drafts` 처리 규칙 추가.

## 2026-10-01 — Leçon 10 반영 (제롱디프·위치 표현·9/30 필기)
초안 u1-17/18을 새 유닛 u2(Leçon 10)의 u2-01·u2-02로 옮김, 노션 9/30 필기로 u2-03 추가(12장). 정정: faisons [푸송]→[프종], faisant [푸정]→[프장]. 커버리지 PDF 13개 305쪽 빠진 0. 카드 1229. 배포 완료(version 20261001022059). 노션 9/30 사진 2장은 열지 못함.

## 2026-10-01 (채팅) — 노션 구조 변경 반영
- 노션이 `교양프랑스어II / 9월·10월 / <날짜>` 구조로 바뀜 → CLAUDE.md 1단계를 "월 페이지 → 날짜 페이지" 순서로 수정. 10/1 날짜 페이지 id `3ece4debecb8810ab004f852898bda4b`.
- semaine 5-3은 채팅에서 노션 정리 하위 페이지만 만듦(Allez 초안 없음 — 대부분 5-1·5-2 복습). 새로 나온 건 정의 문구 invariable, aller/rentrer/devoir·dormir/courir/venir/voir 현재분사, 두 문장 합치기, 독립분사구문(Le bus étant en retard…), 제롱디프 3분류(동시·수단/방식·원인), Voyant/En voyant · Étant/En étant(?) 비교. 23시 실행에서 학생 필기와 함께 u2에 보강할 것.


## 2026-10-01 (23시 실행) — semaine 5-3 · 노션 10/1 반영
새 레슨 `u2-04` 현재분사·제롱디프 심화 + 위치 복습: 카드 35장, 노트 5섹션. 필기 정정 없음. 커버리지 PDF 14개 328쪽 빠진 0·참조 오류 0. 카드 1265. 배포 완료(version 20261001160946). 노션 사진은 열지 못함.

## 2026-10-06 — 동사장(Mes verbes) 연결
- 별도 동사장 페이지(claude.ai Artifact): 동사 82개(1군 42 · 2군 8 · 불규칙 32, 대명동사 8)를 Reverso 형식(Présent · Passé composé · 분사)으로. 직접 추가(✨ 자동 채우기)·수정·삭제, 가리기 모드, 외웠어요 표시
- Allez 홈에 「📒 동사장 · Mes verbes」 버튼 추가 (새 탭으로 열림). 페이지 원본은 `verbs/`
- 배포: content.json version 20261006060155

## 2026-10-06 — 동사장을 Allez 안으로
- Artifact 연결 대신 Allez 자체 화면 「📒 동사장」: 기본 82개는 `content/verbs.json` → content.json에 포함
- 추가·수정·삭제(되살리기)·외웠어요는 앱 기록(`S.vb`)에 저장, 기기 연동으로 컴↔폰 합침(항목마다 바꾼 시각이 늦은 쪽)
- 변화형 채우기: 1군·2군·-dre 규칙(철자 변화 포함) + 아는 동사의 파생어(revenir, permettre, découvrir…), 대명동사 자동. 불규칙은 직접 입력
- 빌드: 수업 카드의 동사가 동사장에 없으면 경고. 이전 Artifact용 `verbs/` 폴더 삭제

## 2026-10-06 — 동사장 테스트
- 동사장 머리 「📝 테스트」: 문제 종류(현재형 변화 · 변화표 6칸 · 과거분사·조동사 · 뜻·원형·현재분사), 범위(지금 보는 목록·그룹·대명동사·지난 시험에서 틀린 동사, 「외울 것」만), 문항 수(10·20·동사마다 1문제)
- 객관식·직접 쓰기 섞어서, 변화표는 직접 쓰기(주어 포함 답도 인정, 악센트만 틀리면 안내). Allez 문제 화면·힌트·XP·스트릭·약점 통계 그대로 사용
- 결과: 동사별 ✓/✗ 누적(`S.vb.st`, 기기 연동), 틀린 동사는 「외울 것」으로 되돌림, 다 맞힌 동사는 「외웠어요」 일괄 표시 제안


## 2026-10-06 — semaine 6-1 · 노션 10/6 반영
새 레슨 `u2-05` 명령문 + 길 안내 대화: 카드 67장, 노트 5섹션, 스킬 `imperatif` 추가. 필기 정정 없음(필기 내용 정확). 커버리지 PDF 15개 349쪽 빠진 0·참조 오류 0. 카드 1332. 배포 완료(version 20261006135216). 노션 사진은 열지 못함.

## 2026-10-08 (채팅) — semaine 6-2 · 10/7 결석 수업을 녹음으로 반영
- 학생 결석 → 녹음 2개(각 약 52분)를 sherpa-onnx Whisper turbo로 전사(`../강의자료/녹음전사/20261007_transcript.md`). 음질이 나빠 오류 많음 — 슬라이드와 대조해 확실한 구두 설명만 반영, 추측은 [불확실] 표시.
- 노션 10/7 하위 「Semaine 6-2 정리 (녹음 기반)」 작성 (날짜 페이지 본문은 비어 있음 — 학생 결석).
- **새 레슨** `u2-06` 길 안내 표현 · droit · 판테옹: 42장 / 노트 9섹션. ⭐ 구두 포인트(Soyons patientes 일치, Où se trouve ~?, Je vous en prie / madame, 친구에겐 tu 명령문 Prends·Tourne, d'abord), 시위 팻말 명령문(Sois · tais-toi · bats-toi · Écoutez-nous), droit 네 뜻, 판테옹 역사.
- **새 유닛 u3 (Leçon 11 · 단순미래)** + `u3-01` 단순미래 규칙형(trouver·parler·prendre·écrire): 22장 / 노트 4섹션, 스킬 `futur`. 슬라이드 PARTIE 4 내용 — 녹음상 10/7엔 진도가 나가지 않았고 10/8(semaine 6-3)에서 본격 수업.
- 📌 **오늘 23시 실행 메모**: semaine 6-3(Leçon 11, 단순미래)은 아직 미처리. u3-01이 이미 규칙형(어미·-re 탈락)을 다루므로 **중복 카드를 만들지 말고** 6-3의 새 내용(불규칙 어간 등)은 `u3-02` 이후로, 겹치는 슬라이드는 대조표에서 u3-01 카드에 연결할 것.
- 검증: `build.mjs` 경고 0 오류 0 (카드 1396, 레슨 32, 유닛 4) · `coverage.mjs` PDF 16개 372쪽 빠진 0 · 참조 오류 0
- 배포: 대기 (`pending_deploy: true`) — 이 세션 기기 셸에서 api.vercel.com 도달 불가 시

## 2026-10-06 (23시 실행) — 변경 없음 (새 PDF 없음, 노션 10/6 이후 수정 없음, 새 「midterm」 페이지는 빈 페이지, pending_deploy 없음)

## 2026-10-11 (채팅 요청: "최근 수업까지 반영")
- 배포 대기 중이던 u2-05·u2-06·u3-01(10/6·10/7 녹음 정리) 배포
- **u3-02** 단순미래 — 불규칙 9개 · 예문 · 미래 표지 (semaine 6-3 + 노션 10/8 필기) — 카드 55장, 노트 8섹션. 연습 7번 acheter → achètera는 슬라이드에 정답이 없어 직접 풀이
- **u1-17** Quiz 2 (9/17) 전 문항 (노션 midterm 정리노트) — I 12 · II 5 · III 10(+기존 u1-08 카드 2장) + 어휘 6 + 듣기 1
- 동사장: dîner · répondre · trouver · se préparer · se raser · se maquiller · s'habiller · se rendre · se servir 추가 (82 → 91)
- 커버리지 ✅ (content/coverage/u3-a.json), 빌드 경고 0 · 오류 0, version 20261011141129
