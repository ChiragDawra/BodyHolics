// Called by check-no-secrets.sh tier 3.
// Supabase keys are JWTs: the anon key is safe, the service_role key is not,
// and in a built bundle both look like opaque base64. Decode the payload and
// judge by the `role` claim rather than by the surrounding variable name.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = process.cwd();

/**
 * Paths to scan. Defaults to the repo, but CI passes the built output —
 * `apps/admin-web/.next` and the Expo bundle — because that is where a key that
 * leaked through a bundler would actually surface (docs/08 §4). Those
 * directories are gitignored, so they have to be named explicitly.
 */
const TARGETS = process.argv.slice(2).map((p) => resolve(p)).filter((p) => existsSync(p));
const ROOTS = TARGETS.length > 0 ? TARGETS : [ROOT];
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

for (const scanRoot of ROOTS) {
for (const file of walk(scanRoot)) {
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
      // Relative to the repo where possible, so the output is clickable.
      const label = file.startsWith(ROOT) ? relative(ROOT, file) : file;
      console.log(`${label}:${line}: JWT with role="${claims.role}"`);
    }
  }
}
}
