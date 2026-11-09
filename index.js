import catalog from './catalog.json' with { type: 'json' };

const operations = new Map(catalog.operations.map(operation => [operation.name, operation]));
export const API_BASE_URL = 'https://api.postor.com.mx/api/member/v1';
export const operationNames = Object.freeze([...operations.keys()]);

export class PostorError extends Error {
  constructor(message, { code, status = 0, requestId, retryAfter, recovery, cause } = {}) {
    super(message, { cause });
    this.name = 'PostorError'; this.code = code; this.status = status;
    this.requestId = requestId; this.retryAfter = retryAfter; this.recovery = recovery;
  }
}

export class Postor {
  #key;
  #fetch;
  #base;
  #timeout;
  constructor({ apiKey, baseUrl = API_BASE_URL, timeoutMs = 30000, fetch: transport = globalThis.fetch } = {}) {
    if (typeof window !== 'undefined') throw new TypeError('Use Postor on a server. Never expose your API key in browser code.');
    if (typeof apiKey !== 'string' || !/^postor_sk_[A-Za-z0-9_-]{43}$/.test(apiKey)) throw new TypeError('Set POSTOR_API_KEY to a valid member API key.');
    const url = new URL(baseUrl);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
      || url.username || url.password || url.search || url.hash) throw new TypeError('baseUrl must use HTTPS (HTTP is allowed only on loopback).');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) throw new TypeError('timeoutMs must be between 1 and 300000.');
    if (typeof transport !== 'function') throw new TypeError('A fetch implementation is required.');
    this.#key = apiKey; this.#fetch = transport; this.#base = url.href.replace(/\/$/, ''); this.#timeout = timeoutMs;
  }
  async call(operation, input = {}, { signal } = {}) {
    const definition = operations.get(operation);
    if (!definition) throw new TypeError('Unknown Postor operation. Consult catalog.json.');
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Operation input must be an object.');
    if (!definition.readOnly && (typeof input.requestKey !== 'string' || input.requestKey.length < 8 || input.requestKey.length > 80)) {
      throw new TypeError('Writes require requestKey (8–80 characters). Reuse it only for the identical action.');
    }
    if (!definition.readOnly && definition.destructive && input.confirmed !== true) throw new TypeError('This action requires confirmed: true after approval.');
    const timeout = AbortSignal.timeout(this.#timeout);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response;
    try {
      response = await this.#fetch(`${this.#base}/operations/${encodeURIComponent(operation)}`, {
        method: 'POST', redirect: 'error', credentials: 'omit', signal: combined,
        headers: { authorization: `Bearer ${this.#key}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(input),
      });
    } catch {
      throw new PostorError(timeout.aborted ? 'Postor request timed out.' : signal?.aborted ? 'Postor request cancelled.' : 'Postor request failed.', {
        code: timeout.aborted ? 'TIMEOUT' : signal?.aborted ? 'ABORTED' : 'NETWORK_ERROR',
        recovery: definition.readOnly ? 'retry_read' : 'inspect_resource',
      });
    }
    const requestId = response.headers.get('x-request-id') ?? undefined;
    const retry = response.headers.get('retry-after');
    const retryAfter = retry && /^\d+$/.test(retry) ? Number(retry) : undefined;
    let body;
    try { body = await response.json(); }
    catch { throw new PostorError('Postor returned an invalid JSON response.', { code: 'INVALID_RESPONSE', status: response.status, requestId,
      recovery: definition.readOnly ? 'retry_read' : 'inspect_resource' }); }
    if (!response.ok || body?.success !== true) {
      throw new PostorError(typeof body?.error?.message === 'string' ? body.error.message : 'Postor rejected the request.', {
        code: typeof body?.error?.code === 'string' ? body.error.code : 'HTTP_ERROR', status: response.status,
        requestId, retryAfter, recovery: body?.error?.recovery,
      });
    }
    if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw new PostorError('Postor returned an invalid data envelope.', {
      code: 'INVALID_RESPONSE', status: response.status, requestId });
    return body.data;
  }
}
