import type { MetadataRoute } from 'next'

// Lets the site be added to a phone's home screen with its own name and icon.
// The icons are the CSA logo on the page's paper colour; the maskable one is
// padded so Android's circular and rounded masks don't clip it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CSA Lins',
    short_name: 'Lins',
    description: "Big/little family trees of the Penn Chinese Students' Association",
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7f2',
    theme_color: '#faf7f2',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
