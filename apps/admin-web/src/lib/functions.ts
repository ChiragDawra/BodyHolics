import { ERROR_MESSAGES, type ErrorCode } from '@gym/domain';
import { createClient } from './supabase/server';

/**
 * The one way the admin app calls an Edge Function (docs/07 §1).
 *
 * Everything trusted happens on the other side of this call — the client only
 * ever sends intent. A response is never assumed to be a success: an Edge
 * Function returns its failures as a 4xx with an envelope, and both the HTTP
 * error and the envelope error are unwrapped here so a caller cannot mistake
 * one for the other.
 */

export type ApiSuccess<T> = { data: T; requestId: string };
export type ApiFailure = {
  error: { code: ErrorCode; message: string; details: Record<string, string> | null };
  requestId: string;
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, string> | null;

  constructor(code: ErrorCode, message: string, details: Record<string, string> | null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

function isFailure(body: unknown): body is ApiFailure {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as ApiFailure).error?.code === 'string'
  );
}

export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  const supabase = await createClient();

  const headers: Record<string, string> = {
    // Echoed back by the function, so a support request can be traced to one
    // server-side log line without the user reading anything sensitive.
    'X-Request-Id': crypto.randomUUID(),
  };
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const { data, error } = await supabase.functions.invoke<ApiSuccess<T> | ApiFailure>(name, {
    body,
    headers,
  });

  // A non-2xx arrives here as `error` with the parsed body still on `data`,
  // so the envelope is checked first and the transport error is the fallback.
  if (isFailure(data)) {
    throw new ApiError(
      data.error.code,
      // Prefer the registry text: it is the wording docs/07 §2 fixed, and it
      // cannot contain anything the server should not have sent.
      ERROR_MESSAGES[data.error.code] ?? data.error.message,
      data.error.details,
    );
  }

  if (error) {
    throw new ApiError('INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR, null);
  }

  if (!data || !('data' in data)) {
    throw new ApiError('INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR, null);
  }

  return data.data;
}
