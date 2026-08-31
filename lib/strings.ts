/**
 * Every user-facing string in the app lives here.
 *
 * Nothing renders text it hardcodes. This is the seam a second language
 * (Hindi, Punjabi) goes through later without touching a component.
 *
 * House style: sentence case, no exclamation marks, no emoji. Buttons say
 * what happens ("Show my code"), never what the form does ("Submit").
 */

export const strings = {
  app: {
    name: "BodyHolics",
    description: "Membership, check-ins, and payments for one gym.",
  },

  /** (public) — / landing */
  landing: {
    title: "BodyHolics",
    tagline: "Placeholder tagline for the gym landing page.",
    joinCta: "Join the gym",
  },

  /** (public) — /join QR registration */
  join: {
    title: "Join",
    intro: "Placeholder copy for the QR registration flow.",
    submit: "Create my membership",
  },

  /** (member) — /app member PWA */
  member: {
    title: "My membership",
    intro: "Placeholder copy for the member home screen.",
    signIn: "Continue with Google",
    showCode: "Show my code",
  },

  /** (check) — /check owner quick-check PWA */
  check: {
    title: "Quick check",
    intro: "Placeholder copy for the owner quick-check screen.",
    pinPrompt: "Enter your PIN",
    pinWrong: "That PIN is not right. Try again.",
    unlock: "Unlock",
  },

  /** (admin) — /admin dashboard */
  admin: {
    title: "Dashboard",
    intro: "Placeholder copy for the admin dashboard.",
    signIn: "Continue with Google",
  },

  /** Shared states. Errors say what broke and what to do. */
  common: {
    loading: "Loading",
    empty: "Nothing here yet.",
    networkError:
      "Couldn't reach the gym's server. Check your connection and try again.",
    retry: "Try again",
  },
} as const;
