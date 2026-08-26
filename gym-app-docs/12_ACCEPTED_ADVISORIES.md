# 12 — Accepted advisories

`pnpm audit --audit-level high` runs in CI and fails the build. This file is the
only place an advisory may be excused from that, and `pnpm.auditConfig.ignoreGhsas`
in the root `package.json` must not contain an id that is not listed here.

Two rules, because an allowlist with neither becomes a way of never fixing
anything:

1. **Every entry has an owner and a review date.** An entry past its review date
   is a CI failure waiting to happen on purpose — re-check it, do not extend it
   by reflex.
2. **Runtime-reachable code is never excused.** These are all build-time
   toolchain dependencies. A vulnerability in something that ships to a device
   or runs in an Edge Function gets fixed or the dependency gets replaced.

---

## GHSA-5p2g-fcmc-qvqq · `image-size` · high

**ICNS parser allows denial of service through an infinite loop.**

Reached via `expo → expo-modules-core → react-native-worklets →
@react-native/metro-config → metro-config → metro`.

- **No patch exists.** The advisory lists `patched_versions: <0.0.0`, meaning
  every published version is affected and there is nothing to upgrade to.
- Metro is the bundler. It parses images at build time on a developer machine or
  a CI runner, never on a member's phone and never on a server.
- Exploiting it requires putting a malicious `.icns` file into the repository,
  which means already having commit access — at which point this is not the
  interesting attack.

**Owner:** mobile · **Review by:** 2026-11-27, or when Expo SDK 58 lands,
whichever is first.

---

## GHSA-w3rx-r6r6-pgpr · `image-size` · high

**JXL and HEIF parsers allow denial of service.**

Same package, same path, same reasoning as above. Also unpatched.

**Owner:** mobile · **Review by:** 2026-11-27, or when Expo SDK 58 lands.

---

## GHSA-w5hq-g745-h8pq · `uuid` · moderate

**Missing buffer bounds check in v3/v5/v6 when a buffer is provided.**

Reached via `expo → @expo/config-plugins → xcode`.

- A fix exists (`>=11.1.1`), but the vulnerable copy is pinned inside Expo's
  config-plugin toolchain. `docs/03` §2 is explicit that the Expo SDK dictates
  its own dependency versions and that overriding them independently is how the
  native build breaks — so a pnpm `override` here trades a build-time DoS for a
  real chance of an unbuildable app.
- The affected code path generates identifiers while writing an Xcode project.
  It does not run at runtime.

**Owner:** mobile · **Review by:** 2026-11-27. Expected to resolve on its own
with the next SDK bump; drop this entry then rather than renewing it.
