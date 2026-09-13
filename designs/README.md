# Designs

Working files for the CSA Lins design canvas. Each `*.dc.html` under
`landing/` is one artboard; `canvas.json` lays them out on two pages.

## Landing page (`landing/`, page "Landing page")

| Artboard | What it is |
|---|---|
| `Main.dc.html` | The landing page, **Sticker Festival on cream**, 1440 wide |
| `Mobile.dc.html` | The same page at phone width (390) |
| `StyleGuide.dc.html` | Site-wide tokens and components in this direction |

Explorations kept on the "Explorations" page: `LanternNight`, `ClubPoster`,
`StickerSheet`, `Zine`, `FestivalPoster`, `StickerFestival` (red) and
`StickerFestivalCream` (the hero the final page grew from).

Bracketed copy such as `[N]`, `[YEAR]`, `[Big]` marks values to fill in
with real data. The landing page assumes it is shown to signed-out
visitors; the only action is "Sign in with Penn Google", which the auth
hook already restricts to `upenn.edu` accounts.

## Style standards (apply everywhere in `web/`)

Cream paper, deep-red ink, vermilion shadows, one gold highlight.
Everything is a sticker: a thick outline, a hard offset shadow, and a
slight tilt only when it is decoration. Lin colors belong to nodes,
sidebar dots and tabs, never to buttons.

### Tokens

Drop these into `web/src/app/globals.css` under `@theme` so they become
Tailwind utilities (`bg-cream`, `text-ink`, `border-ink`, `bg-accent`,
`shadow-sticker`).

```css
@theme {
  --color-cream: #FFF4E4;        /* page background */
  --color-white: #FFFFFF;        /* cards, nodes, inputs */
  --color-ink: #7A2A1F;          /* text, outlines, shadows on vermilion */
  --color-ink-body: #8C4A40;     /* paragraphs */
  --color-ink-muted: #A0524A;    /* captions, grad years, placeholders */
  --color-blush: #FFE1DB;        /* text on vermilion, alert fill */
  --color-accent: #C63D2F;       /* vermilion: primary action, shadows, bands */
  --color-accent-hover: #A83226;
  --color-gold: #F2C466;         /* highlight stickers, gold button */
  --color-gold-tint: #FBE6C8;    /* pending, avatar fill */
  --color-success: #1F8A70;      /* confirmed */
  --color-success-tint: #E6F2EE;

  --font-display: "Syne", "Helvetica Neue", Arial, sans-serif;
  --font-sans: "Manrope", "Helvetica Neue", Arial, sans-serif;

  --radius-tag: 8px;
  --radius-input: 12px;
  --radius-card: 16px;
  --radius-section: 24px;

  --shadow-sticker: 4px 4px 0 var(--color-accent);      /* cards */
  --shadow-sticker-sm: 3px 3px 0 var(--color-accent);   /* buttons, chips */
  --shadow-sticker-lg: 6px 6px 0 var(--color-ink);      /* primary button, on vermilion */
  --shadow-focus: 4px 4px 0 var(--color-gold);
}
```

Load the fonts with `next/font/google` (`Syne` weights 700/800,
`Manrope` weights 500/700) in `layout.tsx`.

### Type

| Role | Face | Size / weight | Notes |
|---|---|---|---|
| Display | Syne | 104 / 80 / 64 / 44 / 26 (phone 60 / 46 / 42 / 34), 800 | letter-spacing -0.04em; one word per heading gets the gold sticker |
| Lead | Manrope | 20 / 500 | hero and section intros, color `ink-body` |
| Body | Manrope | 16 / 500 | line-height 1.55, color `ink-body` |
| Control | Manrope | 15 / 700 | buttons, nav, tabs |
| Secondary | Manrope | 14 / 500 | color `ink-muted` |
| Eyebrow | Manrope | 12 / 700 | uppercase, letter-spacing 0.08em |

Nothing lighter than weight 500.

### Components

- **Buttons**: 3px `ink` border. Primary = accent fill, cream text,
  height 56, radius 16, `shadow-sticker-lg`. Gold and Outline = height 44,
  pill, `shadow-sticker-sm`. Compact = height 36, 2px shadow. Hover moves
  the button 2px down-right and shrinks the shadow by 2; press moves it
  onto the shadow and removes it. One primary per section.
- **Inputs**: height 48, radius 12, 3px `ink` border, white fill. Focus =
  `shadow-focus`, no glow ring. Placeholder in `ink-muted` weight 500.
- **Person node**: keep 180×40 pill, 2px border and 3px offset shadow in
  the lin color, 28px avatar on `gold-tint` with a 2px ink ring. Selected
  = gold fill, 5px shadow, lifted 2px. Unclaimed = dashed border, cream
  fill, no shadow. Nodes never tilt.
- **Lin tabs**: rail on `cream` with a 3px ink border. Selected tab is a
  white pill sticker with `shadow-sticker-sm`; others are borderless and
  fill white on hover. 14px dot in the lin color with a 2px ink ring.
- **Badges**: 28 tall, pill, 2px ink ring, tint fill (`gold-tint` pending,
  `success-tint` confirmed, gold admin). The pending-count badge is the
  only solid accent one.
- **Alerts**: `blush` fill, 3px ink border, radius 12, `shadow-sticker-sm`.
- **Cards**: white, 3px ink border, radius 16, `shadow-sticker`.
- **Spacing**: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **Tilt**: ±2–5° on decorative stickers (eyebrow tags, headline
  highlights, confetti, hero pills) only. Never on cards, text blocks,
  nodes or controls.
- **Shadows**: always hard offsets, never blurred. Vermilion on white,
  cream and gold; ink on vermilion.
- **Icons**: stroke on a 24px grid, 2.5px stroke, round caps. No emoji.
- **Motion**: buttons press in; stickers may wiggle ±2° on hover. Nothing
  fades or blurs.

### Suggested lin colors

Admins may pick any hex, but these six stay legible as 2px borders on
white and sit well next to vermilion: vermilion `#C63D2F`, gold
`#D9971F`, moss `#5E8A2E`, jade `#1F8A70`, indigo `#4F55C9`, plum
`#9B4A9E`.

### Voice

Warm, direct, a little cheeky. Talk about bigs, littles and lins the way
members do. Short sentences. The fun comes from the stickers, not from
exclamation points.
