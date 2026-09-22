// Renders src/app/opengraph-image.png, the card a link to the site shows in a
// group chat. It is a still of the landing hero in the site's own fonts, which
// are fetched from Google Fonts here (as WOFF, which the renderer can read)
// rather than kept in the repo. Run from web/ after changing the copy or the
// palette:  node scripts/render-og-image.mjs
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { writeFileSync } from 'node:fs'

const OUT = new URL('../src/app/opengraph-image.png', import.meta.url)
// An older browser signature makes Google serve WOFF instead of WOFF2.
const UA = 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:5.0) Gecko/20100101 Firefox/5.0'
// `spec` is the css2 axis spec after the family name, e.g. `wght@600`.
async function googleFont(family, spec) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:${spec}&display=swap`, { headers: { 'User-Agent': UA } })).text()
  const url = css.match(/url\((https:[^)]+\.woff)\)/)?.[1]
  if (!url) throw new Error(`No WOFF for ${family} ${spec}`)
  return await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer()
}
// The renderer takes static instances, so the heading asks Google for Fraunces
// at the display optical size and fully soft, as the site's heading class sets it.
const fonts = [
  { name: 'serif', weight: 600, style: 'normal', data: await googleFont('Fraunces', 'opsz,wght,SOFT@144,600,100') },
  { name: 'sans', weight: 400, style: 'normal', data: await googleFont('Instrument+Sans', 'wght@400') },
  { name: 'sans', weight: 600, style: 'normal', data: await googleFont('Instrument+Sans', 'wght@600') },
]
const h = (type, props, ...children) => ({ type, props: { ...props, style: { display: 'flex', ...(props.style ?? {}) }, children: children.length === 1 ? children[0] : children } })

const paper = '#faf7f2', ink = '#26211c', body = '#4a433c', muted = '#837a70', faint = '#b3a99d', line = '#d6cec2', accent = '#b5382c'
// A name pill, as the tree draws them: a small initial disc and a label.
const pill = (initial, label, { border = line, disc = '#f4efe8', discInk = body, fill = '#fff', color = ink, dashed = false } = {}) =>
  h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, height: 56, padding: '0 22px 0 8px', borderRadius: 999, border: `2px ${dashed ? 'dashed' : 'solid'} ${border}`, background: fill, fontFamily: 'sans', fontWeight: 600, fontSize: 24, color } },
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 999, background: disc, color: discInk, fontSize: 18 } }, initial),
    h('div', {}, label))
// A vertical connector between rows.
const stem = (height = 28) => h('div', { style: { width: 2, height, background: faint } })
const row = (...kids) => h('div', { style: { display: 'flex', alignItems: 'center', gap: 28 } }, ...kids)
const col = (...kids) => h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } }, ...kids)

const tree = h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
  pill('F', 'Founder', { border: '#8a7cc9', disc: '#ebe7fa', discInk: '#5b4fa8' }),
  stem(),
  pill('B', 'Big', { border: '#3f8a5c', disc: '#e9f3ec', discInk: '#2f7a4f' }),
  stem(),
  // Two littles under the big: a horizontal bar with two stems.
  h('div', { style: { width: 240, height: 2, background: faint } }),
  row(col(stem(), pill('L', 'Little', { border: '#3f8a5c', disc: '#e9f3ec', discInk: '#2f7a4f' })),
      col(stem(), pill('L', 'Little', { border: '#3f8a5c', disc: '#e9f3ec', discInk: '#2f7a4f' }))),
  stem(),
  h('div', { style: { width: 240, height: 2, background: faint } }),
  row(col(stem(), pill('You', "That's you", { border: accent, disc: accent, discInk: '#fff', fill: accent, color: '#fff' })),
      col(stem(), pill('?', 'Unclaimed', { border: line, disc: '#f4efe8', discInk: muted, color: muted, dashed: true }))),
)

const image = new ImageResponse(
  h('div', { style: { width: 1200, height: 630, display: 'flex', background: paper, color: ink, padding: '0 0 0 80px' } },
    h('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 560, paddingRight: 40 } },
      h('div', { style: { fontFamily: 'sans', fontWeight: 600, fontSize: 24, color: accent, letterSpacing: 0.5 } }, "Penn Chinese Students' Association"),
      h('div', { style: { fontFamily: 'serif', fontWeight: 600, fontSize: 104, lineHeight: 1.05, marginTop: 14, letterSpacing: -2 } }, 'Find your lin.'),
      h('div', { style: { fontFamily: 'sans', fontWeight: 400, fontSize: 32, lineHeight: 1.35, color: body, marginTop: 26 } }, 'Every CSA big and little in one family tree. Sign in to see your lineage.'),
      h('div', { style: { fontFamily: 'sans', fontWeight: 600, fontSize: 24, color: muted, marginTop: 44 } }, 'lins.upenncsa.com'),
    ),
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, borderLeft: `1px solid #e7e0d6`, background: '#f4efe8' } }, tree),
  ),
  { width: 1200, height: 630, fonts },
)
writeFileSync(OUT, Buffer.from(await image.arrayBuffer()))
console.log('wrote', OUT.pathname)
