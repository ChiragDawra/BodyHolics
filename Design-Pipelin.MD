# DESIGN-PIPELINE.md

How the UI gets designed, how Stitch is used, and how icons are produced.

The short way is to prompt Stitch, export the HTML, and paste it into the app.
Do not do that. It produces a codebase nobody can change and a design nobody
chose. What follows is longer and holds up.

---

## 1. Write the brief before opening any tool

A vague prompt gets a generic design, and a generic design is the thing you said
you did not want. Before generating anything, write `design/BRIEF.md` answering:

- **Subject.** A single independent gym in an Indian city. Concrete weights,
  chalk, rubber flooring, a whiteboard, a ceiling fan, a register at the desk.
  Not "fitness technology". Not a global wellness brand.
- **Audience.** Members aged roughly 18–35, on mid-range Android phones and
  older iPhones, on patchy 4G, checking the app for maybe fifteen seconds at a
  time in a loud room with sweaty hands.
- **Primary job.** Three questions, answered without tapping: Is the gym open?
  How busy is it? Is my membership still valid?
- **Constraints.** One-handed. Portrait only. Legible under gym lighting.
  Large touch targets. Works with the biggest accessibility text size.
- **Tone.** Direct and local. Not clinical, not a hype brand, not an American
  fitness startup.

The brief is what makes the design specific. Skip it and everything downstream
is interchangeable.

---

## 2. Connect Stitch to Claude Code

Stitch is Google's UI generation tool at `stitch.withgoogle.com`. Free with a
Google account, with a monthly generation allowance. It has an MCP server, which
is why we use it here rather than copy-pasting screenshots.

1. Sign in at `stitch.withgoogle.com` and confirm access.
2. Install the Stitch MCP server following Google's current docs, and register
   it in the project's Claude Code MCP configuration.
3. Authenticate with the same Google account.
4. Verify the connection by listing available tools before generating anything.

If the MCP server will not connect, fall back to using Stitch in the browser and
downloading the export as a zip. The workflow below is unchanged; only the
transport differs. Do not spend an hour debugging MCP when the manual path takes
five minutes.

---

## 3. Generate three directions, not one

Generate the **Home** screen three times, with three genuinely different
directions, before touching any other screen. Home carries the identity; the
rest follow it.

Each prompt states the subject, the audience, the job, and one distinct
aesthetic hypothesis. Vary the hypothesis, keep the rest fixed.

Then pick one. Say in `design/BRIEF.md` which and why, in a sentence.

**Reject any output that lands on these**, because they are what every
generated interface currently looks like and they will make your app read as
untouched machine output:

- Warm cream background near `#F4F1EA` with a high-contrast serif and a
  terracotta accent near `#D97757`
- Near-black background with one acid-green or vermilion accent
- Everything chopped into identical rounded cards with the same border radius
  and the same soft grey shadow under each
- A tracked-out ALL-CAPS eyebrow label above every heading
- Meta strings joined with middle dots
- A `→` glued onto every button and link
- One word in a headline coloured or italicised for emphasis
- Numbered markers `01 / 02 / 03` on content that is not actually a sequence
- Tinted near-black (`#0B0B0B`, `#111`) standing in for black

Any of these is defensible if you chose it for a reason specific to this gym.
None of them is defensible as a default.

**Spend boldness once.** Pick one signature element — the open/closed state, or
the crowd indicator, or the membership card — and make it genuinely
characteristic. Keep everything around it quiet. Then remove one thing.

---

## 4. Extract tokens, do not paste HTML

This is the step that separates a maintainable app from a pile of generated
markup.

Stitch's output is **reference material**. It never enters `app/` or
`components/`. Instead:

1. Save the chosen export under `design/stitch/` in the repo, committed. It is
   documentation of intent, not code that runs.
2. Read the values out of it and write `app/tokens.css` by hand as a Tailwind v4
   `@theme` block. This is the single source of truth for every colour, size,
   and radius in the app.

```css
@theme {
  /* 4–6 named colours. Name them by role, never by hue.
     --color-brand, not --color-orange. */
  --color-surface: ...;
  --color-surface-raised: ...;
  --color-ink: ...;
  --color-ink-muted: ...;
  --color-brand: ...;
  --color-alert: ...;

  /* Crowd buckets are semantic and must survive a palette change */
  --color-crowd-low: ...;
  --color-crowd-mid: ...;
  --color-crowd-high: ...;
  --color-crowd-peak: ...;

  /* One or two typefaces. If two, make them obviously different —
     a subtle contrast reads as an accident. */
  --font-display: ...;
  --font-body: ...;

  /* A real type scale, not arbitrary pixel values */
  --text-xs: ...;  --text-sm: ...;  --text-base: ...;
  --text-lg: ...;  --text-xl: ...;  --text-2xl: ...;

  --radius-sm: ...;  --radius-md: ...;  --radius-lg: ...;
  --space-unit: ...;
}
```

3. Build `components/ui/` primitives from those tokens: `Button`, `Card`,
   `Sheet`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`.
4. Build screens from those primitives.

**A raw hex value, font name, or pixel radius appearing anywhere outside
`tokens.css` is a bug.** It means the design can no longer be changed in one
place, which is the whole reason for doing this.

Dark mode follows automatically because it is one token block override, not a
sweep through every component.

---

## 5. Icons and favicon, the full set

Not one PNG renamed. Six artefacts from one vector master, each solving a
different problem.

**Master.** Design the mark in Stitch or a vector editor and export a clean SVG
at `design/icon-master.svg`. It must read at 32×32. Test by shrinking it before
committing to it. Most marks that look good large become mush small; a single
bold form survives.

**Derived files:**

| File | Size | Purpose | Rule |
|---|---|---|---|
| `app/icon.svg` | vector | Modern browser favicon | Scales cleanly, no text |
| `app/favicon.ico` | 32×32 | Legacy fallback | Still required |
| `app/apple-icon.png` | 180×180 | iOS home screen | **Fully opaque background.** iOS renders transparency as black |
| `public/icons/icon-192.png` | 192×192 | Manifest, `purpose: any` | |
| `public/icons/icon-512.png` | 512×512 | Manifest, `purpose: any` | |
| `public/icons/maskable-512.png` | 512×512 | Manifest, `purpose: maskable` | Mark inside the central 80% safe zone, background bleeding to all edges |

The maskable icon is a separate file, not the same PNG listed twice. Android
crops it to whatever shape the launcher uses, so anything outside the safe
circle is cut off.

Next.js App Router picks up `app/icon.svg`, `app/favicon.ico`, and
`app/apple-icon.png` automatically by file convention. Do not hand-write `<link
rel="icon">` tags; you will end up with duplicates that fight each other.

**iOS splash screens.** Optional, and skip on the first pass. If you do them,
they need one `apple-touch-startup-image` per device resolution with matching
media queries, which is a dozen files. Generate them from the master, do not
hand-craft them.

**Verify on hardware, not in the browser:**
- [ ] Add to Home Screen on a real iPhone — the icon is opaque with no black
      corners and no white halo
- [ ] Install on a real Android — the maskable icon is not cropped through the
      mark
- [ ] The favicon is distinguishable at 16×16 in a crowded tab bar
- [ ] The icon works on both a light and a dark home screen wallpaper

---

## 6. Words are design

Copy is written with the same care as spacing. Vague copy makes a good layout
feel generated.

- Name things as a member would say them. "Membership ends 14 March", not
  "Subscription expiry timestamp".
- Buttons say what happens. "Pay ₹1,200" and "Show my code", not "Submit" and
  "Continue".
- An action keeps its name through the flow. The button that says "Pay" leads
  to a screen that says "Paid".
- Empty states invite action. "No visits yet. Your first check-in shows up
  here."
- Errors say what broke and what to do. "Couldn't reach the gym's server. Check
  your connection and try again." Not "Something went wrong."
- Sentence case throughout. No exclamation marks. No emoji in system copy.

Hindi or Punjabi strings are a real possibility for this audience. Do not
hardcode English into components; route every user-facing string through a
single strings module from the start, even while there is only one language. The
cost now is an afternoon and the cost later is a rewrite.

---

## 7. Critique before you call it done

Screenshot every screen at 375px and look at them side by side.

- Does anything here look like it could belong to any other app? Name what, and
  change it.
- Is the signature element still the most memorable thing, or has decoration
  crept in around it?
- Can the three primary questions be answered without scrolling or tapping?
- Does it survive the largest accessibility text size?
- Is keyboard focus visible?
- Is `prefers-reduced-motion` respected?
- Remove one thing.

Write what you changed and why in `design/BRIEF.md`. The next session will not
remember, and the notes are how it does.