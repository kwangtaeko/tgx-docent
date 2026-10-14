// 앱 헬스체크용 GET. 리다이렉트는 따라가지 않고 상태 < 500이면 응답한 것으로 본다.
import http from 'node:http';
import https from 'node:https';

export function httpCheck(url, timeoutMs) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode < 500, status: res.statusCode });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', () => resolve({ ok: false }));
  });
}
