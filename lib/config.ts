/**
 * This build serves exactly one gym. Its slug is the only place that
 * assumption is written down, so a multi-gym version replaces reads of this
 * constant with a route parameter and nothing else changes.
 */
export const GYM_SLUG = "bodyholics";
