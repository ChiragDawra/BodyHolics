/**
 * The one place outside app/globals.css where a colour value is written down.
 *
 * The browser chrome colours — <meta name="theme-color"> and the manifest's
 * background_color / theme_color — are consumed by the operating system before
 * any CSS has parsed, so they cannot read a custom property. They have to be
 * literals in JavaScript.
 *
 * These MUST stay in sync with --color-surface in app/globals.css. If you
 * change the palette there, change it here too. This file exists so that
 * coupling is in exactly one place instead of six.
 *
 * The palette is dark-only (see D44), so both values are the same colour —
 * the light/dark pair is kept because the viewport metadata expects two.
 */
export const THEME_COLOR_LIGHT = "#0A0A0C"; // --color-surface
export const THEME_COLOR_DARK = "#0A0A0C"; // --color-surface

/** PWA splash background. Always the dark surface, matching the icon ground. */
export const PWA_BACKGROUND = THEME_COLOR_DARK;
