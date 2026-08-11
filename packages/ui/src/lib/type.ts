/**
 * The type scale.
 *
 * Before this file the app used **12 distinct sizes across 199 usages** —
 * `text-xs` (61), `text-2xs` (52), `text-[13px]` (50), plus eight more — and
 * the top three were used interchangeably for the same roles. Nothing told an
 * author which to reach for, so every route invented its own hierarchy and
 * none of them agreed. That is what made the type read as confusing.
 *
 * Six roles. If a new piece of text does not fit one, the answer is almost
 * always that it belongs to an existing role, not that the scale needs a
 * seventh entry.
 *
 * THE RULE, which the first restyle pass got wrong:
 *   machine data is mono, human voice is Inter.
 * A run id, a tool name, a score, a timestamp — mono. A field label, a
 * section heading, a description — Inter. `MICRO` is a micro-eyebrow only
 * (section meta, group headers); it is not a general-purpose label style.
 *
 * Source: akaoss/src/app/globals.css + the /demo type specimens.
 */

/** Page title. One per route, set by `PageHeader`. */
export const DISPLAY = "text-[22px] font-light tracking-tight text-fg-strong";

/** Section heading inside a page. */
export const HEADING = "text-[15px] font-light tracking-tight text-fg-strong";

/** Sub-heading — card titles, rail group titles. */
export const SUBHEADING = "text-[13px] font-light tracking-tight text-fg-strong";

/** Primary prose: prompts, agent output, descriptions the reader must read. */
export const BODY = "text-[13px] leading-relaxed text-fg";

/** Secondary prose and field labels. Human voice, never mono. */
export const MUTED = "text-[13px] leading-relaxed text-fg-muted";

/** Machine data: ids, tool names, scores, latencies, timestamps. */
export const MONO = "font-mono text-[12px] text-fg-muted";

/** Micro-eyebrow: section meta, group headers, table headers. The `.label`
 *  global (mono / 11px / 0.18em / uppercase). Not for field labels. */
export const MICRO = "label";

/** Smallest supporting text — counts, hints, timestamps in dense rows. */
export const META = "text-[11px] text-fg-muted-2";
