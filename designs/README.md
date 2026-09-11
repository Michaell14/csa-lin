# Designs

Working files for the CSA Lins design canvas. Each `*.dc.html` under
`landing/` is one artboard; `canvas.json` lays them out.

## Landing page concepts (`landing/`)

| Artboard | What it is |
|---|---|
| `Main.dc.html` | Lead direction, **Paper & Vermilion**: warm editorial landing page at 1440 wide |
| `Mobile.dc.html` | The same page at phone width (390) |
| `LanternNight.dc.html` | Alternate A, hero only: dark ink, glowing lantern-style nodes |
| `ClubPoster.dc.html` | Alternate B, hero only: bright, blocky, lin-colored bands |
| `StyleGuide.dc.html` | Site-wide tokens and components |

Bracketed copy such as `[N]`, `[YEAR]`, `[Name]` marks values to fill in
with real data. The landing page assumes it is shown to signed-out
visitors; the only action is "Sign in with Penn Google", which the auth
hook already restricts to `upenn.edu` accounts.

## Style standards (apply everywhere in `web/`)

Warm paper background, near-black ink, one vermilion accent for actions
and emphasis. Lin colors belong to trees, sidebar dots and tabs, never to
buttons.

### Tokens

Drop these into `web/src/app/globals.css` under `@theme` so they become
Tailwind utilities (`bg-paper`, `text-ink`, `border-hairline`, `bg-accent`).

```css
@theme {
  --color-paper: #FBF8F3;        /* page background */
  --color-surface: #FFFFFF;      /* cards, nodes, panels */
  --color-sand: #EDE6DC;         /* avatar fill, hover fill */
  --color-rail: #F4EFE7;         /* sidebar background */
  --color-hairline: #E7E0D6;     /* borders, dividers */
  --color-line: #D9D0C4;         /* input and secondary-button borders */
  --color-ink: #1F1B18;          /* text, dark sections */
  --color-ink-body: #443E39;     /* body copy */
  --color-ink-muted: #6B635B;    /* secondary text, grad years */
  --color-accent: #C63D2F;       /* vermilion: primary action, emphasis */
  --color-accent-hover: #A83226;
  --color-accent-tint: #FBEAE6;  /* alert and badge backgrounds */
  --color-accent-on-dark: #E0A47A; /* eyebrows on ink sections */
  --color-success: #1F8A70;      /* confirmed */
  --color-pending: #B07A22;      /* pending */
  --color-pending-text: #8A5E14; /* pending badge text */

  --font-display: "Instrument Serif", Georgia, "Times New Roman", serif;
  --font-sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;

  --radius-control: 8px;   /* buttons, inputs, tabs, menus */
  --radius-card: 12px;
  --radius-section: 16px;
}
```

Load the fonts with `next/font/google` (`Instrument_Serif` weight 400,
`IBM_Plex_Sans` weights 400/500/600) in `layout.tsx`.

### Type

| Role | Face | Size / weight | Notes |
|---|---|---|---|
| Display | Instrument Serif | 84 / 56 / 40 / 28 (phone 50 / 38 / 30), 400 | letter-spacing -0.02em; italics in vermilion for one emphasized phrase |
| Heading | IBM Plex Sans | 22 / 600 | letter-spacing -0.01em |
| Lead | IBM Plex Sans | 18 / 400 | hero and section intros, color `ink-body` |
| Body | IBM Plex Sans | 16 / 400 | line-height 1.55, color `ink-body` |
| Control | IBM Plex Sans | 15 / 500 | buttons, nav, tabs |
| Secondary | IBM Plex Sans | 14 / 400 | color `ink-muted` |
| Eyebrow | IBM Plex Sans | 12 / 500 | uppercase, letter-spacing 0.08em |

### Components

- **Buttons**: heights 52 (hero) / 44 (default) / 36 (compact), radius 8.
  Primary = accent on white text; Ink = ink on paper text; Secondary =
  1px `line` border. One primary per section.
- **Inputs**: height 44, radius 8, 1px `line` border, focus ring
  `0 0 0 3px` accent at 20% alpha.
- **Person node**: keep 180×40 pill, 2px border in the lin color, 28px
  avatar on `sand`, selected ring `0 0 0 3px` lin color at 33% alpha,
  unclaimed avatar dashed `#A89E92`.
- **Lin tabs**: rail on `rail`, selected tab on `surface` with a soft
  shadow, 12px dot in the lin color.
- **Badges**: pill, height 26, tint background at ~8% of the hue, text at
  the hue's dark step (`accent-tint`/`accent-hover`, success, pending).
- **Spacing**: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **Elevation**: hairlines over shadows; one soft shadow
  (`0 8px 24px #1F1B1814, 0 1px 2px #1F1B1814`) for menus and popovers.
- **Icons**: stroke on a 24px grid, 2px stroke, round caps. No emoji.

### Suggested lin colors

Admins may pick any hex, but these six sit at a similar lightness so
trees read as siblings and stay legible as 2px borders on white: vermilion `#C63D2F`, ochre `#B07A22`,
moss `#5E8A2E`, jade `#1F8A70`, indigo `#4F55C9`, plum `#9B4A9E`.

### Voice

Warm and direct. Talk about bigs, littles and lins the way members do.
Short sentences, no exclamation points, no filler.
