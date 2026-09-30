/* "Describe an Extension" (iOS 27): turn a natural-language request into a small
 * content-style extension (CSS scoped to web pages). Deterministic rule matching. */

export interface GeneratedExtension {
  name: string
  css: string
  features: string[]
  manifest: string
}

const COLORS: Record<string, string> = {
  red: '#e5484d', orange: '#f76b15', yellow: '#ffe066', green: '#30a46c', blue: '#0a84ff', purple: '#8e4ec6', pink: '#e93d82', teal: '#12a594', gray: '#8b8d98', black: '#111', white: '#fff',
}

interface Rule { test: RegExp; name: string; feature: string; css: (p: string) => string }

const RULES: Rule[] = [
  {
    test: /\b(sidebar|side bar|side panel|side column|rail)\b/,
    name: 'Sidebar Hider',
    feature: 'Hides sidebars and widens the main column',
    css: () => `.sf-sidebar {\n  display: none !important;\n}\n.sf-layout {\n  grid-template-columns: 1fr !important;\n}`,
  },
  {
    test: /\b(larger|bigger|increase|large|huge|easier to read)\b.*\b(text|font|type|article|words)\b|\b(text|font|article)\b.*\b(larger|bigger|increase)\b/,
    name: 'Big Text',
    feature: 'Makes article text larger with roomier line spacing',
    css: () => `.sf-article p,\n.sf-article li,\n.sf-article td {\n  font-size: 1.22em !important;\n  line-height: 1.62 !important;\n}\n.sf-article h1 { font-size: 2em !important; }`,
  },
  {
    test: /\b(smaller|compact|dense)\b.*\b(text|font)\b/,
    name: 'Compact Text',
    feature: 'Tightens text for denser pages',
    css: () => `.sf-article p,\n.sf-article li {\n  font-size: 0.9em !important;\n  line-height: 1.35 !important;\n}`,
  },
  {
    test: /\b(dark|night|black background|darker)\b/,
    name: 'Dark Mode Everywhere',
    feature: 'Applies a dark appearance to every site',
    css: () => `.sf-page {\n  filter: invert(0.9) hue-rotate(180deg) !important;\n  background: #fff !important;\n}\n.sf-page .sf-media,\n.sf-page img {\n  filter: invert(1) hue-rotate(180deg) !important;\n}`,
  },
  {
    test: /\b(ads?|advert\w*|sponsored|banners?|promo\w*)\b/,
    name: 'Ad Remover',
    feature: 'Removes ads and sponsored banners',
    css: () => `.sf-ad,\n[data-ad],\n.sf-sponsored {\n  display: none !important;\n}`,
  },
  {
    test: /\b(dates?|days?|deadlines?|when)\b/,
    name: 'Date Highlighter',
    feature: 'Highlights dates so they stand out',
    css: (p) => {
      const c = Object.keys(COLORS).find((k) => new RegExp(`\\b${k}\\b`).test(p))
      const bg = c ? COLORS[c] : '#ffe066'
      return `.sf-date {\n  background: ${bg} !important;\n  color: #111 !important;\n  border-radius: 5px;\n  padding: 0 4px;\n  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.08);\n}`
    },
  },
  {
    test: /\b(images?|photos?|pictures?|figures?|media)\b.*\b(hide|remove|no|block)\b|\b(hide|remove|no|block)\b.*\b(images?|photos?|pictures?|figures?)\b/,
    name: 'Text Only',
    feature: 'Hides images and figures',
    css: () => `.sf-media,\n.sf-figure {\n  display: none !important;\n}`,
  },
  {
    test: /\b(comments?|replies|discussion)\b/,
    name: 'Comment Hider',
    feature: 'Hides comment sections',
    css: () => `.sf-comments {\n  display: none !important;\n}`,
  },
  {
    test: /\b(serif|typewriter|bookish|georgia)\b/,
    name: 'Bookish Fonts',
    feature: 'Switches article text to a serif typeface',
    css: () => `.sf-article {\n  font-family: 'New York', Georgia, 'Times New Roman', serif !important;\n}`,
  },
  {
    test: /\b(links?)\b/,
    name: 'Link Spotlight',
    feature: 'Underlines and highlights links',
    css: (p) => {
      const c = Object.keys(COLORS).find((k) => new RegExp(`\\b${k}\\b`).test(p))
      return `.sf-page a {\n  text-decoration: underline !important;\n  text-decoration-thickness: 2px !important;\n  color: ${c ? COLORS[c] : '#0a84ff'} !important;\n}`
    },
  },
  {
    test: /\b(headlines?|headings?|titles?)\b/,
    name: 'Headline Styler',
    feature: 'Restyles page headlines',
    css: (p) => {
      const c = Object.keys(COLORS).find((k) => new RegExp(`\\b${k}\\b`).test(p))
      return `.sf-page h1,\n.sf-page h2,\n.sf-page h3 {\n  color: ${c ? COLORS[c] : '#0a84ff'} !important;\n  letter-spacing: -0.02em;\n}`
    },
  },
  {
    test: /\b(focus|distraction|clean|minimal|declutter)\b/,
    name: 'Focus Mode',
    feature: 'Removes distractions: sidebars, ads and navigation',
    css: () => `.sf-sidebar,\n.sf-ad,\n.sf-nav,\n.sf-comments {\n  display: none !important;\n}\n.sf-layout { grid-template-columns: 1fr !important; }`,
  },
  {
    test: /\b(grayscale|greyscale|black and white|monochrome)\b/,
    name: 'Grayscale',
    feature: 'Shows every page in grayscale',
    css: () => `.sf-page {\n  filter: grayscale(1) !important;\n}`,
  },
  {
    test: /\b(prices?|cost|deals?)\b/,
    name: 'Price Spotlight',
    feature: 'Makes prices easy to spot',
    css: () => `.sf-price {\n  background: #d1fadf !important;\n  color: #05603a !important;\n  padding: 0 6px;\n  border-radius: 6px;\n}`,
  },
]

export const EXTENSION_IDEAS = [
  'Hide the sidebar and make article text larger',
  'Dark mode for every site',
  'Remove ads',
  'Highlight dates in yellow',
  'Hide comments and images',
  'Make headlines purple',
]

export function generateExtension(prompt: string): GeneratedExtension | null {
  const p = prompt.toLowerCase()
  const hits = RULES.filter((r) => r.test.test(p))
  // "Focus Mode" already covers sidebar + ads — avoid duplicate blocks
  const uniq = hits.filter((r, i) => hits.findIndex((x) => x.name === r.name) === i)
  if (!uniq.length) return null
  const name = uniq.length === 1 ? uniq[0].name : uniq.length === 2 ? `${uniq[0].name} + ${uniq[1].name}` : `${uniq[0].name} & ${uniq.length - 1} more`
  const css = `/* ${name} — generated from: "${prompt.trim()}" */\n` + uniq.map((r) => `/* ${r.feature} */\n${r.css(p)}`).join('\n\n')
  const manifest = JSON.stringify(
    {
      manifest_version: 3,
      name,
      version: '1.0',
      description: prompt.trim(),
      content_scripts: [{ matches: ['<all_urls>'], css: ['style.css'] }],
      permissions: [],
    },
    null,
    2,
  )
  return { name, css, features: uniq.map((r) => r.feature), manifest }
}

/** Scope generated CSS so it only applies inside Safari's web view. */
export function scopeCss(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\})\s*([^{}@]+)\{/g, (_m, brace: string, sel: string) => {
    const scoped = sel
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `.sf-webview ${s}`)
      .join(', ')
    return `${brace}\n${scoped} {`
  })
}
