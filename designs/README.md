# Designs

Working files for the CSA Lins design canvas. Each `*.dc.html` under
`landing/` is one artboard; `canvas.json` lays them out on two pages.

## Landing page (`landing/`, page "Landing page")

| Artboard | What it is |
|---|---|
| `Main.dc.html` | The landing page in the earlier **Sticker Festival** direction, 1440 wide |
| `Mobile.dc.html` | The same page at phone width (390) |
| `StyleGuide.dc.html` | Site-wide tokens and components in that direction |

These artboards record the sticker direction the site launched with. The
site has since moved to the plain style described below; the artboards are
kept as reference and are no longer what `web/` implements.

Explorations kept on the "Explorations" page: `LanternNight`, `ClubPoster`,
`StickerSheet`, `Zine`, `FestivalPoster`, `StickerFestival` (red) and
`StickerFestivalCream` (the hero the final page grew from).

Bracketed copy such as `[N]`, `[YEAR]`, `[Big]` marks values to fill in
with real data. The landing page assumes it is shown to signed-out
visitors; the only action is "Sign in with Penn Google", which the auth
hook already restricts to `upenn.edu` accounts.

## Style standards (apply everywhere in `web/`)

Plain, warm and readable. Paper-toned pages, warm grey ink, thin borders, a
soft serif (Fraunces) for headings and a humanist sans (Instrument Sans) for
everything else, and one red accent used where it means something: the
primary action, links, selection, errors, and the small labels on the landing
page. Nothing tilts, nothing casts an offset shadow, nothing is decoration
for its own sake. Lin and class-year colours belong to nodes, avatars, dots
and chips, never to
buttons.

### Tokens

These live in `web/src/app/globals.css` under `@theme`, so they are Tailwind
utilities (`text-ink`, `border-line`, `bg-surface-muted`, `bg-accent`).

```css
@theme {
  --color-paper: #faf7f2;         /* page background */
  --color-ink: #26211c;           /* headings, primary text */
  --color-ink-body: #4a433c;      /* paragraphs */
  --color-ink-muted: #837a70;     /* captions, placeholders, secondary labels */
  --color-ink-faint: #b3a99d;     /* dashed outlines, tree edges */
  --color-line: #e7e0d6;          /* dividers, card borders */
  --color-line-strong: #d6cec2;   /* input and button borders */
  --color-surface-muted: #f4efe8; /* sidebar, panels, page bands */
  --color-surface-hover: #efe9e1; /* hovered rows and menu items */
  --color-accent: #b5382c;        /* primary action, links, selection, errors */
  --color-accent-hover: #9c2f24;
  --color-accent-tint: #fbeae6;   /* error fill */
  --color-accent-line: #f0c9c1;   /* error border */
  --color-success: #2f7a4f;
  --color-success-tint: #e9f3ec;

  --font-sans: var(--font-instrument-sans), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-fraunces), Georgia, "Times New Roman", serif;
}
```

Fonts load with `next/font/google` in `layout.tsx`: Fraunces (variable, with
its `SOFT` and `opsz` axes) for headings and Instrument Sans (variable, with
italics) for everything else. The `heading` class sets `SOFT` to 100, so the
serif stays rounded and warm at display sizes; optical size follows the font
size automatically.

### Type

| Role | Face | Size / weight | Notes |
|---|---|---|---|
| Page title (landing) | Fraunces | 36 / 48 on desktop, 600 | `heading` class |
| Section heading | Fraunces | 24 / 30, 600 | `heading` |
| Card or panel heading | Fraunces | 14 / 16 / 18, 600 | `heading text-sm` and up |
| Body | Instrument Sans | 16 / 400 (landing), 14 / 400 (app) | colour `ink-body` |
| Control | Instrument Sans | 14 / 500 | buttons, tabs, menu items |
| Secondary | Instrument Sans | 12 / 400 | colour `ink-muted` |
| Label | Instrument Sans | 12 / 500 | `label` class, normal case, `ink-muted` (accent on the landing page) |

Regular weight for reading, medium for controls, semibold serif for headings.
No uppercase tracking.

### Components

- **Buttons**: radius 6, medium weight, 14px text. `btn-primary` = accent
  fill, white text, height 40. `btn-secondary` = white with a
  `shadow-border` ring, height 40. `btn-sm` / `btn-sm-primary` = the same
  at height 32. `icon-btn` = a 32px square ringed button; `icon-btn-plain`
  the borderless dismiss variant. Hover changes the fill; press scales to
  0.96. One primary per view.
- **Links**: `link` = accent, underlined.
- **Inputs**: `input` (height 40) and `input-sm` (height 32), white, 1px
  `line-strong` border, radius 6. Focus = accent border and a 2px translucent
  accent ring.
- **Cards**: `card` = white, radius 8, `shadow-border` (a 1px transparent
  ring plus a soft lift). Floating things (menus, search results, the phone
  bottom sheet) use `shadow-elevated`.
- **Person node**: 180×40 pill, white, 2px border in the class-year colour,
  28px avatar tinted with the same colour at 15%. Selected = `surface-hover`
  fill and a 3px translucent halo in the colour. Unclaimed = dashed border,
  `surface-muted` fill, untinted avatar. Avatars in the member list and the
  profile panel carry the same tint and a 2px ring.
- **Lin tabs**: the sidebar sits on `surface-muted`. The selected tab is a
  white, outlined, medium-weight row; the others are borderless and fill
  `surface-hover` on hover. 10px dot in the lin colour.
- **View switch**: a `surface-hover` track; the selected segment is white
  with a small shadow.
- **Badges**: `badge` = 24 tall, pill, 1px `line` border, `surface-muted`
  fill, 12px medium text.
- **Alerts**: `alert` = `accent-tint` fill, `accent-line` border, accent
  text, for errors. `notice` = `surface-muted` fill, `line` border, for
  information.
- **Spacing**: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **Icons**: stroke on a 24px grid, 2px stroke, round caps. No emoji.
- **Motion**: colour transitions of 150ms or less on hover; buttons press
  in to `scale(0.96)`. Menus and the phone bottom sheet fade in over a few
  pixels on open and leave instantly. The landing hero staggers in once on
  load. Nothing tilts or wiggles, and `prefers-reduced-motion` removes it all.

### Polish rules (from `.claude/skills/make-interfaces-feel-better`)

- Depth is a layered transparent shadow (`shadow-border`, hover
  `shadow-border-hover`, floating `shadow-elevated`); borders are kept for
  structure and state: dividers, inputs, alerts, selection rings.
- Nested corners are concentric: a menu is radius 8 with 4px padding, so
  its rows are radius 4.
- Every control is at least 40px tall to the pointer: the 32px buttons,
  links, tabs and segments extend their hit area with a pseudo-element.
- Numbers that change (counts, badges, stats) use `tabular-nums`; headings
  use `text-wrap: balance` and paragraphs `text-wrap: pretty`.
- Icons come from one outline set in `web/src/components/icons.tsx`, drawn
  with `currentColor` at a 2px stroke (1.5px beside regular body text), so
  states are CSS colour changes, never separate assets.
- Photos carry a 1px inset outline in pure black at 10%.
- A button with a leading icon gets 2px less padding on the icon side.

### Suggested lin colors

Admins may pick any hex, but these stay legible as 2px borders on white and
tell apart from one another: red `#C63D2F`, gold `#D9971F`, moss `#5E8A2E`,
jade `#1F8A70`, indigo `#4F55C9`, plum `#9B4A9E`.

### Voice

Warm and direct. Talk about bigs, littles and lins the way members do. Short
sentences, no exclamation points.
