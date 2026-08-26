import { ERROR_MESSAGES, type ErrorCode } from '@gym/domain';
import { functionsUrl, supabase } from './supabase';

/**
 * The one way the member app calls an Edge Function (docs/07 §1).
 *
 * The client sends intent; everything trusted happens on the other side. A
 * response is never assumed to be a success — an Edge Function returns failures
 * as a 4xx with an envelope, so both the envelope error and the transport error
 * are unwrapped here rather than left for a caller to mistake for data.
 */

export class ApiError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    // The registry wording, never a message the server made up. This is what a
    // member reads, and it must not be able to contain a SQL string or a
    // provider payload (docs/06 §8).
    super(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR);
    this.name = 'ApiError';
    this.code = code;
  }
}

type Envelope<T> =
  | { data: T; requestId: string }
  | { error: { code: ErrorCode; message: string }; requestId: string };

function isFailure<T>(body: unknown): body is Extract<Envelope<T>, { error: unknown }> {
  return typeof body === 'object' && body !== null && 'error' in body;
}

export async function invokeFunction<T>(
  name: string,
  body?: Record<string, unknown>,
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'X-Request-Id': globalThis.crypto.randomUUID(),
  };
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const { data, error } = (await supabase.functions.invoke<Envelope<T>>(name, {
    body: body ?? {},
    headers,
  })) as { data: Envelope<T> | null; error: unknown };

  if (isFailure<T>(data)) throw new ApiError(data.error.code);
  if (error || !data || !('data' in data)) throw new ApiError('INTERNAL_ERROR');

  return data.data;
}

/** GET-shaped functions, which supabase-js invoke() cannot express with a query. */
export async function getFunction<T>(name: string, query: Record<string, string>): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const url = `${functionsUrl}/${name}?${new URLSearchParams(query)}`;

  const response = await fetch(url, {
    headers: {
      ...(session.session ? { Authorization: `Bearer ${session.session.access_token}` } : {}),
      'X-Request-Id': globalThis.crypto.randomUUID(),
    },
  });

  const body = (await response.json()) as Envelope<T>;
  if (isFailure<T>(body)) throw new ApiError(body.error.code);
  return body.data;
}
