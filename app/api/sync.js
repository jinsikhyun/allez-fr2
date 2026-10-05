// 기기 간 학습 기록 동기화. 동기화 코드 = 비밀번호.
// 코드는 요청 본문으로만 받고(URL·로그에 남지 않게), 저장 위치는 서버 비밀값(SYNC_SALT)을 섞은 해시로 정한다.
import { get, put } from '@vercel/blob';
import { createHash } from 'node:crypto';

const CODE_RE = /^[a-z]+-[a-z]+-[a-z]+-\d{4}$/;
const MAX_BYTES = 800_000;

const pathFor = (code) => `sync/${createHash('sha256').update(`${process.env.SYNC_SALT || ''}:${code}`).digest('hex')}.json`;
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const code = String(body?.code || '').trim().toLowerCase();
  if (!CODE_RE.test(code)) return json({ error: 'bad-code' }, 400);
  const path = pathFor(code);

  if (body.op === 'get') {
    try {
      const r = await get(path, { access: 'private', useCache: false });
      if (!r || r.statusCode !== 200) return json({ data: null });
      return json({ data: JSON.parse(await new Response(r.stream).text()) });
    } catch (e) {
      if (e && /not.?found/i.test(`${e.name} ${e.message}`)) return json({ data: null });
      return json({ error: 'read-failed' }, 502);
    }
  }

  if (body.op === 'put') {
    const data = body.data;
    const text = JSON.stringify(data ?? null);
    if (!data || typeof data !== 'object' || text.length > MAX_BYTES) return json({ error: 'bad-data' }, 400);
    try {
      await put(path, text, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
      return json({ ok: true, at: Date.now() });
    } catch {
      return json({ error: 'write-failed' }, 502);
    }
  }

  return json({ error: 'bad-op' }, 400);
}

export function GET() {
  return json({ error: 'use-post' }, 405);
}
