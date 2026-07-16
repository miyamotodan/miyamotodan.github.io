# Hero Stream-Merger Illustration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder hero photo in `NEW_SITE/index.html` with a hand-drawn inline SVG scene ("stream-merger") that visually represents data-integration + governance + leadership, per the approved spec.

**Architecture:** A single inline `<svg>` (no external asset, no build step) replaces the `<img>` inside `.nd-hero__media-frame`. The frame's CSS is re-proportioned from square to landscape (4:3) to fit the scene. A small CSS keyframe animation drives the output stream's flow effect; it inherits the project's existing global `prefers-reduced-motion` override, so no new media query is needed for that. The unused `.nd-hero__doodle` element/CSS is deleted rather than left orphaned.

**Tech Stack:** Plain HTML/CSS (matches `NEW_SITE`'s existing vanilla, no-build approach — see `CLAUDE.md`). Verified with a throwaway Playwright script (Node + `playwright` installed under `/tmp/pwtest`, same approach already used earlier in this session), not a unit-test framework — this static site has none.

## Global Constraints

- No build step, no new dependencies added to the repo. `playwright` used only as an external, ephemeral verification tool (already installed at `/tmp/pwtest/node_modules` in this environment; not added to any repo manifest since none exists).
- SVG colors are literal hex values matching the design tokens (`#2d2d2d` fg/border, `#2d5da1` accent-2, `#6b6558` muted-ink, `#ff4d4d` accent, `#fdfbf7` bg/paper) — matches the existing pattern already used for the other inline SVGs in `NEW_SITE/index.html` (arrow, social icons), which use literal hex rather than `var(--...)` in SVG presentation attributes.
- Per standing project policy, **do not `git commit`** as part of this plan. Each task ends with "ready for review" instead of a commit step; committing happens only if the user explicitly asks afterward.
- Decorative/non-informational graphics get `aria-hidden="true"` — matches how the hero arrow and (soon-removed) doodle are already treated, and is called out explicitly in the spec's Accessibility section.

---

### Task 1: Build and integrate the stream-merger hero illustration

**Files:**
- Modify: `NEW_SITE/css/components.css` (remove `.nd-hero__doodle` + `nd-bob` keyframes; update `.nd-hero__media-frame` and `.nd-hero__media-frame img` rules; add `.nd-hero__flow-output` + `nd-flow` keyframes)
- Modify: `NEW_SITE/index.html` (replace the `.nd-hero__media-frame` contents and remove the `.nd-hero__doodle` div)
- Create (temporary, deleted at the end): `NEW_SITE/.verify-hero-scene.js`

**Interfaces:**
- Consumes: existing design tokens from `NEW_SITE/css/tokens.css` (`--radius-wobbly-lg`, `--shadow-lg`) — unchanged, still referenced by the frame.
- Produces: nothing consumed by later tasks — this is the only task in this plan.

- [ ] **Step 1: Remove the unused doodle CSS**

In `NEW_SITE/css/components.css`, delete this block (currently sits right after `.nd-hero__media-frame img`):

```css
.nd-hero__doodle {
  position: absolute;
  width: 64px;
  height: 64px;
  top: -1.1rem;
  right: -1.1rem;
  background: var(--color-accent);
  border: 3px solid var(--color-border);
  border-radius: var(--radius-rough-circle);
  animation: nd-bob 3s ease-in-out infinite;
}
@keyframes nd-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
```

- [ ] **Step 2: Re-proportion the media frame from square photo to landscape scene**

In `NEW_SITE/css/components.css`, replace:

```css
.nd-hero__media-frame {
  position: relative;
  width: min(100%, 320px);
  border: 3px solid var(--color-border);
  border-radius: var(--radius-wobbly-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  background: var(--color-surface);
}
.nd-hero__media-frame img {
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
}
```

with:

```css
.nd-hero__media-frame {
  position: relative;
  width: min(100%, 420px);
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  border: 3px solid var(--color-border);
  border-radius: var(--radius-wobbly-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  background: var(--color-surface);
}
.nd-hero__media-frame svg {
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 3: Add the flow animation for the illustration's output stream**

In `NEW_SITE/css/components.css`, add this near the other `@keyframes` (e.g. right after the block removed in Step 1's old location):

```css
.nd-hero__flow-output {
  stroke-dasharray: 6 10;
  animation: nd-flow 2.4s linear infinite;
}
@keyframes nd-flow {
  to {
    stroke-dashoffset: -32;
  }
}
```

This is automatically frozen under `prefers-reduced-motion: reduce` by the existing global rule in `NEW_SITE/css/base.css` (`animation-duration: 0.001ms !important` on `*`), so no extra media query is needed here.

- [ ] **Step 4: Replace the hero media markup**

In `NEW_SITE/index.html`, find this block:

```html
          <div class="nd-hero__media">
            <div class="nd-hero__media-frame">
              <img src="assets/profile.jpeg" alt="Ritratto di Miyamotodan" />
            </div>
            <div class="nd-hero__doodle" aria-hidden="true"></div>
          </div>
```

Replace it with:

```html
          <div class="nd-hero__media">
            <div class="nd-hero__media-frame">
              <svg
                class="nd-hero__scene"
                viewBox="0 0 480 360"
                fill="none"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M0,90 C60,88 120,95 170,120 C210,140 240,158 278,168" stroke="#2d2d2d" stroke-width="3" stroke-linecap="round" />
                <path d="M0,180 C70,176 140,183 200,179 C230,177 255,179 278,180" stroke="#2d5da1" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 10" />
                <path d="M0,270 C60,272 120,262 170,238 C205,220 245,200 278,192" stroke="#6b6558" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 9" />

                <path d="M279,152 C283,150 300,151 304,155 C307,175 306,195 303,206 C298,209 282,208 278,205 C275,188 276,168 279,152 Z" fill="#fdfbf7" stroke="#2d2d2d" stroke-width="3" />
                <path d="M285,180 L292,189 L300,167" stroke="#ff4d4d" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />

                <path class="nd-hero__flow-output" d="M304,180 C340,178 380,182 420,179 C440,178 460,180 480,179" stroke="#ff4d4d" stroke-width="3.5" stroke-linecap="round" />

                <circle cx="345" cy="95" r="15" fill="none" stroke="#2d2d2d" stroke-width="3" />
                <path d="M322,150 C325,128 335,116 345,113 C355,116 365,128 368,150" stroke="#2d2d2d" stroke-width="3" stroke-linecap="round" />
                <path d="M330,122 C315,132 300,142 288,155" stroke="#2d2d2d" stroke-width="3" stroke-linecap="round" />
              </svg>
            </div>
          </div>
```

- [ ] **Step 5: Write the verification script**

Create `NEW_SITE/.verify-hero-scene.js`:

```js
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const errors = []

  const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  desktopPage.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[desktop] ${msg.text()}`)
  })
  desktopPage.on('pageerror', (err) => errors.push(`[desktop pageerror] ${err.message}`))
  await desktopPage.goto('http://localhost:8123/NEW_SITE/index.html', { waitUntil: 'networkidle' })
  await desktopPage.waitForSelector('.nd-hero__scene')
  await desktopPage.screenshot({ path: 'NEW_SITE/.verify-hero-scene-desktop.png', clip: { x: 0, y: 0, width: 1440, height: 620 } })
  await desktopPage.close()

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
  mobilePage.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[mobile] ${msg.text()}`)
  })
  mobilePage.on('pageerror', (err) => errors.push(`[mobile pageerror] ${err.message}`))
  await mobilePage.goto('http://localhost:8123/NEW_SITE/index.html', { waitUntil: 'networkidle' })
  await mobilePage.waitForSelector('.nd-hero__scene')
  await mobilePage.screenshot({ path: 'NEW_SITE/.verify-hero-scene-mobile.png', fullPage: true })
  await mobilePage.close()

  await browser.close()
  console.log('CONSOLE_ERRORS:', JSON.stringify(errors))
})()
```

- [ ] **Step 6: Serve the site and run the verification script**

```bash
cd "C:\Users\D.DelPinto\Documents\svil-projects\miyamotodan.github.io"
python3 -m http.server 8123 --directory . >/tmp/httpserver3.log 2>&1 &
echo $! > /tmp/http3.pid
sleep 1
curl -sf http://localhost:8123/NEW_SITE/index.html >/dev/null && echo "server up"
NODE_PATH="/tmp/pwtest/node_modules" node "NEW_SITE/.verify-hero-scene.js"
```

Expected: `server up`, then `CONSOLE_ERRORS: []`.

- [ ] **Step 7: Visually inspect both screenshots**

Read `NEW_SITE/.verify-hero-scene-desktop.png` and `NEW_SITE/.verify-hero-scene-mobile.png`. Confirm against the spec:
- Three visually distinct input strokes (solid black, dashed blue, dotted gray) converge into a wobbly paper-colored gate panel with a red checkmark.
- A single red output line continues to the right edge of the frame.
- A simple round-headed figure with one arm reaching toward the gate sits above/beside it.
- The frame reads as landscape (not square), with the same wobbly border + hard shadow as other frames on the page.
- Nothing overflows or clips awkwardly at either viewport width; no leftover doodle circle.

If any element looks wrong (e.g. paths overlapping badly, checkmark illegible, figure disconnected from the gate), adjust the specific path's coordinates in `NEW_SITE/index.html` and re-run Step 6 until it matches. This is hand-authored SVG art — expect at least one coordinate-tuning pass.

- [ ] **Step 8: Clean up temporary verification files**

```bash
cd "C:\Users\D.DelPinto\Documents\svil-projects\miyamotodan.github.io"
rm -f NEW_SITE/.verify-hero-scene*.png NEW_SITE/.verify-hero-scene.js
kill $(cat /tmp/http3.pid) 2>/dev/null
git status --short
```

Expected: only `NEW_SITE/index.html` and `NEW_SITE/css/components.css` show as modified (plus any pre-existing untracked files from earlier in the session); no `.verify-*` files remain.

- [ ] **Step 9: Ready for review**

Per this project's standing git policy, do not commit. Report the change as ready for the user to review (and, separately, decide about `docs/superpowers/specs/` / `docs/superpowers/plans/` — whether those planning docs should be committed, gitignored, or left untracked is the user's call, not assumed here).

---

## Self-Review

- **Spec coverage:** composition (3 inputs, funnel/gate, checkmark, output, figure) → Step 4; color mapping → Step 4 (literal hex per Global Constraints); placement/landscape reframe → Step 2; motion + reduced-motion → Step 3 (relies on existing global rule, confirmed present in `base.css`); accessibility (`aria-hidden`) → Step 4; responsive → Step 2's `width: min(100%, 420px)` (same pattern as `.nd-showcase`); doodle removal → Step 1. All spec sections have a corresponding step.
- **Placeholder scan:** none — every step has literal code, exact paths, and concrete pass/fail criteria.
- **Type consistency:** N/A (no functions/APIs — markup and CSS only); class names (`nd-hero__scene`, `nd-hero__flow-output`, `nd-hero__media-frame`) are consistent between the CSS steps and the HTML step.
