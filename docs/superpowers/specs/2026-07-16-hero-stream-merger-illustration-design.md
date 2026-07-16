# Hero "stream-merger" illustration — design

**Date:** 2026-07-16
**Scope:** `NEW_SITE/index.html` hero section only (Hand-Drawn design system pilot)

## Problem

The hero's right-column visual currently reuses the site owner's existing
logo/avatar photo (a toy robot figurine) scaled up large. It was flagged as
not fitting the hero's role: the hero should visually reinforce the tagline
*"A SME and Team Leader with a passion for data-governance and
data-integration"* rather than just repeat the header's small logo at a
bigger size.

## Concept: the stream-merger

A hand-drawn SVG scene, inline in the page (no external asset, no build
step), replacing the current photo in the hero's right column.

**Composition** (viewBox ~480×340, landscape):
- Three input lines enter from the left, each drawn in a visually distinct
  style to represent heterogeneous data sources/systems:
  - solid pencil-black
  - dashed ballpoint-blue (`--color-accent-2`)
  - dotted muted-gray (`--color-muted-ink`)
  - all paths use multi-point cubic beziers with small asymmetric wobbles —
    never perfectly smooth curves — consistent with the wobbly-border
    language used elsewhere.
- The three lines converge into a hand-drawn funnel (two converging wobbly
  strokes, not a geometric cone).
- At the funnel's narrow point sits a small wobbly "gate" rectangle
  containing a red checkmark (`--color-accent`) — the governance checkpoint.
- A single output line in accent red continues from the gate to the right
  edge, with a slow (~3s) stroke-dashoffset animation suggesting flow.
  Respects `prefers-reduced-motion` automatically via the existing global
  rule in `base.css` (no extra media query needed in this component).
- A simple stylized figure (circle head, minimal line body/limbs — no
  facial detail, no realism) stands beside the gate with one arm raised,
  as if directing the merge.

**Color mapping:** three distinct input strokes (black / blue / gray) →
red gate + checkmark → red output stroke. Red carries the "resolved,
important" meaning it already has elsewhere in the design system (CTAs,
active nav state).

## Placement

Replaces `.nd-hero__media-frame` content in `NEW_SITE/index.html`. The
frame's aspect ratio changes from the current square/portrait polaroid to
a landscape ratio (~4:3) so the left-to-right flow reads naturally. Same
wobbly border + hard-offset shadow treatment as the current frame
(`--radius-wobbly-lg`, `--shadow-lg`), just re-proportioned.

The existing floating red `.nd-hero__doodle` circle is removed — its
decorative "red accent" role is now carried by the gate/checkmark/output
stroke inside the scene, so the separate doodle became redundant.

## Accessibility

The SVG is purely illustrative — the hero's lede paragraph already states
the same message in words. The SVG (and its container) is marked
`aria-hidden="true"`, matching how the existing hero arrow and doodle are
already treated. No new text alternative is introduced.

## Responsive behavior

Same pattern as other frames already built in `NEW_SITE` (`.nd-showcase`,
project cards): `width: min(100%, <max>)`, so it shrinks cleanly in the
mobile stacked layout. A landscape scene reads fine even at reduced width,
unlike the previous square portrait crop.

## Out of scope

- `.nd-hero__doodle` and its `nd-bob` keyframes are removed from
  `components.css` entirely, since removing its only usage in
  `index.html` would otherwise leave dead CSS.
- No changes to `martial-arts.html`, `project-1.html`, `project-2.html`.
- No changes to the original (pre-redesign) site outside `NEW_SITE/`.
