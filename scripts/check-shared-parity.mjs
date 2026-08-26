#!/usr/bin/env node
// D-012 — Deno cannot resolve a pnpm workspace package, so domain logic the
// server needs is mirrored into supabase/functions/_shared/. Two copies of the
// same rules drift silently and the drift is only discovered when a member and
// the server disagree about what state a payment is in.
//
// This is the thing that stops that. Run by `pnpm test:shared-parity` and in CI.
//
//   node scripts/check-shared-parity.mjs         # verify (fails on drift)
//   node scripts/check-shared-parity.mjs --write # regenerate the mirror
//
// The only permitted difference is the module specifier: TypeScript resolves
// './errors' with moduleResolution Bundler, Deno requires './errors.ts'. Both
// sides are normalised before comparison, so nothing else can hide in there.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIRROR_DIR = join(ROOT, 'supabase/functions/_shared');

/**
 * What the server actually needs. Deliberately a list rather than a glob: a new
 * file in packages/domain should not silently become part of the server's
 * surface, and a file the server does not need should not be copied "just in
 * case" — every mirrored file is one more thing that can drift.
 */
const MIRRORED = [
  // packages/domain — the rules
  ['packages/domain/src', 'errors.ts', 'errors.ts'],
  ['packages/domain/src', 'money.ts', 'money.ts'],
  ['packages/domain/src', 'time.ts', 'time.ts'],
  ['packages/domain/src', 'membership.ts', 'membership.ts'],
  ['packages/domain/src', 'gym-status.ts', 'gym-status.ts'],
  ['packages/domain/src', 'crowd.ts', 'crowd.ts'],
  ['packages/domain/src', 'types.ts', 'types.ts'],
  ['packages/domain/src', 'state/index.ts', 'state/index.ts'],
  ['packages/domain/src', 'state/membership.ts', 'state/membership.ts'],
  ['packages/domain/src', 'state/payment.ts', 'state/payment.ts'],
  ['packages/domain/src', 'state/issue.ts', 'state/issue.ts'],
  ['packages/domain/src', 'state/broadcast.ts', 'state/broadcast.ts'],
  ['packages/domain/src', 'state/qr-token.ts', 'state/qr-token.ts'],

  // packages/validation — the request shapes. These matter most of all: a client
  // that validates against one shape and a server that validates against another
  // is exactly how a field nobody meant to accept gets accepted.
  ['packages/validation/src', 'common.ts', 'schemas/common.ts'],
  ['packages/validation/src', 'requests.ts', 'schemas/requests.ts'],
  ['packages/validation/src', 'index.ts', 'schemas/index.ts'],
];

const BANNER = `// GENERATED MIRROR — do not edit.
//
// Source: %s (D-012).
// Deno cannot import a pnpm workspace package, so this is a copy. Edit the
// source and run \`pnpm test:shared-parity --write\`; CI fails if the two drift.
`;

/** Strip the banner and normalise relative specifiers so only logic is compared. */
function normalise(source) {
  return source
    .replace(/^\/\/ GENERATED MIRROR[\s\S]*?\n\n/, '')
    .replace(/(from\s+['"])(\.\.?\/[^'"]*?)\.ts(['"])/g, '$1$2$3')
    .trimEnd();
}

function mirrorFor(relative, source) {
  const withExtensions = source.replace(
    /(from\s+['"])(\.\.?\/[^'"]*?)(['"])/g,
    (match, open, spec, close) => (spec.endsWith('.ts') ? match : `${open}${spec}.ts${close}`),
  );
  return BANNER.replace('%s', relative) + '\n' + withExtensions;
}

const write = process.argv.includes('--write');
const problems = [];

for (const [sourceDir, sourceFile, mirrorFile] of MIRRORED) {
  const sourcePath = join(ROOT, sourceDir, sourceFile);
  const mirrorPath = join(MIRROR_DIR, mirrorFile);
  const label = `${sourceDir}/${sourceFile}`;

  if (!existsSync(sourcePath)) {
    problems.push(`missing source: ${label}`);
    continue;
  }

  const source = readFileSync(sourcePath, 'utf8');

  if (write) {
    mkdirSync(dirname(mirrorPath), { recursive: true });
    writeFileSync(mirrorPath, mirrorFor(label, source));
    continue;
  }

  if (!existsSync(mirrorPath)) {
    problems.push(`missing mirror: supabase/functions/_shared/${mirrorFile}`);
    continue;
  }

  if (normalise(readFileSync(mirrorPath, 'utf8')) !== normalise(source)) {
    problems.push(`drifted: ${mirrorFile}  (source ${label})`);
  }
}

if (write) {
  console.log(`shared-parity: regenerated ${MIRRORED.length} mirrored files`);
  process.exit(0);
}

if (problems.length > 0) {
  console.error('shared-parity: FAILED');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('\nRun `pnpm test:shared-parity --write` after editing packages/domain.');
  process.exit(1);
}

console.log(`shared-parity: clean (${MIRRORED.length} files)`);
