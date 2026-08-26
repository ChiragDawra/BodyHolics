// Called by check-no-secrets.sh tier 3.
// Supabase keys are JWTs: the anon key is safe, the service_role key is not,
// and in a built bundle both look like opaque base64. Decode the payload and
// judge by the `role` claim rather than by the surrounding variable name.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.turbo',
  '.pnpm-store',
  'coverage',
  'graphify-out',
]);
// Edge Functions legitimately hold the service key at runtime; they are server-side.
const SKIP_PATHS = ['supabase/functions'];
const PRIVILEGED = new Set(['service_role', 'supabase_admin', 'postgres']);
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const MAX_BYTES = 8 * 1024 * 1024;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (SKIP_PATHS.some((p) => rel === p || rel.startsWith(p + '/'))) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

for (const file of walk(ROOT)) {
  let text;
  try {
    if (statSync(file).size > MAX_BYTES) continue;
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const token of text.match(JWT) ?? []) {
    let claims;
    try {
      claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    } catch {
      continue;
    }
    if (PRIVILEGED.has(claims?.role)) {
      const line = text.slice(0, text.indexOf(token)).split('\n').length;
      console.log(`${relative(ROOT, file)}:${line}: JWT with role="${claims.role}"`);
    }
  }
}
