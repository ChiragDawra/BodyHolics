/**
 * The one place outside app/globals.css where a colour value is written down.
 *
 * The browser chrome colours — <meta name="theme-color"> and the manifest's
 * background_color / theme_color — are consumed by the operating system before
 * any CSS has parsed, so they cannot read a custom property. They have to be
 * literals in JavaScript.
 *
 * These MUST stay in sync with --color-surface and --color-surface (dark) in
 * app/globals.css. If you change the palette there, change it here too. This
 * file exists so that coupling is in exactly one place instead of six.
 */
export const THEME_COLOR_LIGHT = "#FAFAF8"; // --color-surface
export const THEME_COLOR_DARK = "#141413"; // --color-surface, dark

/** PWA splash background. Always the dark surface, matching the icon ground. */
export const PWA_BACKGROUND = THEME_COLOR_DARK;
