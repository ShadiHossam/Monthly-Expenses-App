import { storage } from './storage';
import { API_BASE, api } from './api';

export async function* fetchSSEMobile(
  path: string,
  signal?: AbortSignal,
): AsyncGenerator<{ event: string; data: unknown }> {
  const token = await storage.getToken();
  let streamSucceeded = false;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal,
      // React Native flag to enable streaming body
      // @ts-ignore
      reactNative: { textStreaming: true },
    });

    if (!res.ok) throw new Error(`SSE failed: ${res.status}`);

    if (res.body) {
      const reader = (res.body as any).getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamSucceeded = true;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const raw = line.slice(5).trim();
            try { yield { event: currentEvent, data: JSON.parse(raw) }; }
            catch { yield { event: currentEvent, data: raw }; }
            currentEvent = 'message';
          }
        }
      }
      return;
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    if (streamSucceeded) return;
    // Fall through to polling
  }

  // Polling fallback: poll GET /statements/{id} every 2 seconds (max 120s)
  const match = path.match(/\/statements\/(\d+)\/progress/);
  if (!match) return;
  const sid = Number(match[1]);

  for (let i = 0; i < 60; i++) {
    if (signal?.aborted) return;
    await new Promise(r => setTimeout(r, 2000));
    try {
      const stmt = await api.getStatement(sid);
      if (stmt.verify_status === 'passed') {
        yield { event: 'complete', data: { transaction_count: stmt.transaction_count } };
        return;
      }
      if (stmt.verify_status === 'failed') {
        yield { event: 'error', data: { message: stmt.verify_errors } };
        return;
      }
      // Still processing — synthesize progress event
      yield {
        event: 'progress',
        data: {
          step: i < 10 ? 'preprocessing' : i < 20 ? 'ocr' : i < 30 ? 'parsing' : i < 45 ? 'verifying' : 'categorizing',
          percentage: Math.min(5 + i * 1.5, 90),
          message: 'Processing…',
        },
      };
    } catch { /* retry */ }
  }
}
