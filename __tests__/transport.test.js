import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Postor, PostorError, operationNames } from '../index.js';
import catalog from '../catalog.json' with { type: 'json' };
const apiKey = 'postor_sk_' + 'a'.repeat(43);
const ok = () => Response.json({ success: true, data: { data: [], truncatedFields: [] } });

describe('Postor SDK', () => {
  it('sends a typed operation to the member API and returns its data', async () => {
    let seen;
    const postor = new Postor({ apiKey, fetch: async (...args) => { seen = args; return ok(); } });
    const result = await postor.call('search_licitaciones', { query: { status: 'vigente' } });
    assert.deepEqual(result, { data: [], truncatedFields: [] });
    assert.equal(seen[0], 'https://api.postor.com.mx/api/member/v1/operations/search_licitaciones');
    assert.equal(seen[1].headers.authorization, `Bearer ${apiKey}`);
    assert.equal(seen[1].redirect, 'error'); assert.equal(seen[1].credentials, 'omit');
    assert.equal(JSON.parse(seen[1].body).query.status, 'vigente');
    assert.equal(JSON.stringify(postor).includes(apiKey), false);
  });
  it('preserves status, error code, request ID and retry guidance without retrying', async () => {
    let calls = 0;
    const postor = new Postor({ apiKey, fetch: async () => { calls++; return Response.json({ success: false,
      error: { code: 'RATE_LIMITED', message: 'Espera', recovery: 'wait' } }, { status: 429, headers: { 'retry-after': '60', 'x-request-id': 'req-1' } }); } });
    await assert.rejects(postor.call('list_projects', {}), error => error instanceof PostorError && error.status === 429
      && error.code === 'RATE_LIMITED' && error.requestId === 'req-1' && error.retryAfter === 60);
    assert.equal(calls, 1);
  });
  it('never retries writes, preserves requestKey, and reports uncertain network state', async () => {
    let calls = 0;
    const postor = new Postor({ apiKey, fetch: async (_url, init) => { calls++; assert.equal(JSON.parse(init.body).requestKey, 'same-action-1'); throw new Error('transport'); } });
    await assert.rejects(postor.call('create_project', { body: { name: 'X' }, requestKey: 'same-action-1' }), error => error.recovery === 'inspect_resource');
    assert.equal(calls, 1);
  });
  it('requires idempotency and explicit confirmation before destructive actions', async () => {
    let calls = 0; const postor = new Postor({ apiKey, fetch: async () => { calls++; return ok(); } });
    await assert.rejects(postor.call('create_project', { body: { name: 'X' } }), /requestKey/);
    await assert.rejects(postor.call('delete_storage_folder', { params: { id: '1' }, requestKey: 'delete-1' }), /confirmed/);
    assert.equal(calls, 0);
  });
  it('supports caller cancellation and bounded timeouts', async () => {
    const transport = async (_url, { signal }) => new Promise((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
    const keepAlive = setInterval(() => {}, 100);
    try {
      const postor = new Postor({ apiKey, fetch: transport, timeoutMs: 5 });
      await assert.rejects(postor.call('list_projects', {}), error => error.code === 'TIMEOUT');
      const controller = new AbortController(); controller.abort();
      await assert.rejects(postor.call('list_projects', {}, { signal: controller.signal }), error => error.code === 'ABORTED');
    } finally { clearInterval(keepAlive); }
  });
  it('rejects invalid JSON, malformed envelopes and unknown operations', async () => {
    for (const response of [new Response('bad'), Response.json({ success: true }), Response.json({})]) {
      await assert.rejects(new Postor({ apiKey, fetch: async () => response }).call('list_projects', {}), PostorError);
    }
    await assert.rejects(new Postor({ apiKey }).call('../admin', {}), /Unknown/);
  });
  it('refuses browser execution, insecure remote URLs and invalid keys', () => {
    assert.throws(() => new Postor({ apiKey: '' }));
    for (const baseUrl of ['http://evil.example', 'https://user:pass@example.com', 'https://example.com?x=1']) assert.throws(() => new Postor({ apiKey, baseUrl }));
    globalThis.window = {};
    try { assert.throws(() => new Postor({ apiKey }), /server/); } finally { delete globalThis.window; }
    assert.doesNotThrow(() => new Postor({ apiKey, baseUrl: 'http://localhost:4000/api/member/v1' }));
  });
  it('ships only regular membership operations with strict input contracts', () => {
    assert.equal(operationNames.length, catalog.operations.length);
    assert.equal(new Set(operationNames).size, operationNames.length);
    for (const operation of catalog.operations) {
      assert.equal(operation.inputSchema.additionalProperties, false);
      assert.ok(operation.plans.length > 0); assert.ok(!operation.plans.includes('enterprise'));
    }
  });
});
