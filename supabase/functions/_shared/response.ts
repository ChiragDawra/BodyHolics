// docs/07 §1 — the response envelope, and the request-id wrapper every function
// is mounted behind. Nothing else in a function may construct a Response.

import { ERROR_MESSAGES, type ErrorCode } from './errors.ts';
import { ERROR_STATUS } from './http.ts';

export type Ctx = { requestId: string };

/**
 * CORS. The member app is native and the admin is same-origin in production, so
 * the only browser origins that legitimately call these functions are the admin
 * app's. `*` is used for the local stack only, and the allowlist is read from
 * the environment so a deploy cannot accidentally widen it.
 */
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : (ALLOWED_ORIGINS[0] ?? 'http://localhost:3000');

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-request-id, idempotency-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(req),
    },
  });
}

export function ok<T>(data: T, ctx: Ctx, req: Request, status = 200): Response {
  return json({ data, requestId: ctx.requestId }, status, req);
}

/**
 * `message` comes from the registry, never from a caught exception: an error
 * built from `e.message` is how a SQL string or a provider payload reaches a
 * user's screen. `details` is only ever a field->message map from Zod.
 */
export function fail(
  code: ErrorCode,
  ctx: Ctx,
  req: Request,
  details: Record<string, string> | null = null,
): Response {
  return json(
    { error: { code, message: ERROR_MESSAGES[code], details }, requestId: ctx.requestId },
    ERROR_STATUS[code],
    req,
  );
}

type Handler = (req: Request, ctx: Ctx) => Promise<Response>;

/**
 * Assigns a request id, answers the CORS preflight, and is the last line of
 * defence against an unhandled throw becoming a stack trace in a response body.
 */
export function withRequestId(handler: Handler): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    // Echoed back so a support conversation can name one server-side log line.
    // Client-supplied ids are accepted but bounded, so they cannot be used to
    // write arbitrary volume into the logs.
    const supplied = req.headers.get('X-Request-Id');
    const requestId =
      supplied && /^[A-Za-z0-9_-]{1,64}$/.test(supplied) ? supplied : crypto.randomUUID();
    const ctx: Ctx = { requestId };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    try {
      return await handler(req, ctx);
    } catch (error) {
      // Full detail server-side, nothing useful to the caller (docs/07 §1).
      console.error(JSON.stringify({ requestId, message: String(error) }));
      return fail('INTERNAL_ERROR', ctx, req);
    }
  };
}

/**
 * docs/07 §1 — for a 400, `details` is a field->message map. Only the first
 * message per field is kept: a list of every way a value is wrong is noise to a
 * form and a fingerprint of the schema to anyone probing it.
 */
export function fieldErrors(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}
