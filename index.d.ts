import type { OperationInputs, OperationOutputs } from './operations.js';
export type { OperationInputs, OperationOutputs } from './operations.js';
export type OperationName = keyof OperationInputs;
export declare const API_BASE_URL: string;
export declare const operationNames: readonly OperationName[];
export interface PostorOptions {
  apiKey: string;
  /** HTTPS URL. Override only for a trusted proxy; your key is sent to this host. */
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}
export declare class PostorError extends Error {
  code: string; status: number; requestId?: string; retryAfter?: number; recovery?: string;
}
export declare class Postor {
  constructor(options: PostorOptions);
  /** No automatic retries. Each write requires a caller-owned requestKey. */
  call<N extends OperationName>(operation: N, input: OperationInputs[N], options?: { signal?: AbortSignal }): Promise<OperationOutputs[N]>;
}
