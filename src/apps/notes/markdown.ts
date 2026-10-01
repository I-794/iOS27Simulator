/* iOS 27 Notes: Copy as Markdown / Paste Markdown. Block <-> Markdown conversion. */
import type { NoteBlock } from '../../os/types'

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'

export const PHOTO_RE = /^!\[([^\]]*)\]\(scene:([a-z0-9-]+)\)$/

export function toMarkdown(blocks: NoteBlock[]): string {
  const out: string[] = []
  let prevList = false
  for (const b of blocks) {
    const isList = b.t === 'check' || b.t === 'bullet'
    if (out.length && !(isList && prevList)) out.push('')
    prevList = isList
    switch (b.t) {
      case 'h1': out.push(`# ${b.text}${b.id ? ` {#${b.id}}` : ''}`); break
      case 'h2': out.push(`## ${b.text}${b.id ? ` {#${b.id}}` : ''}`); break
      case 'h3': out.push(`### ${b.text}${b.id ? ` {#${b.id}}` : ''}`); break
      case 'p': out.push(b.text); break
      case 'quote': out.push(b.text.split('\n').map((l) => `> ${l}`).join('\n')); break
      case 'code': out.push('```\n' + b.text + '\n```'); break
      case 'check': out.push(`- [${b.done ? 'x' : ' '}] ${b.text}`); break
      case 'bullet': out.push(`- ${b.text}`); break
      case 'divider': out.push('---'); break
      case 'link': out.push(`[${b.text}](#${b.target})`); break
      case 'drawing': out.push('![Drawing](drawing.svg)'); break
      case 'table': {
        const [head, ...rows] = b.rows
        if (!head) break
        out.push(`| ${head.join(' | ')} |`)
        out.push(`| ${head.map(() => '---').join(' | ')} |`)
        rows.forEach((r) => out.push(`| ${r.join(' | ')} |`))
        break
      }
    }
  }
  return out.join('\n').trim() + '\n'
}

export function fromMarkdown(md: string): NoteBlock[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const out: NoteBlock[] = []
  let i = 0
  const heading = (level: 1 | 2 | 3, raw: string): NoteBlock => {
    const m = raw.match(/^(.*?)\s*\{#([\w-]+)\}\s*$/)
    const text = (m ? m[1] : raw).trim()
    return { t: (['h1', 'h2', 'h3'] as const)[level - 1], text, id: m ? m[2] : level > 1 ? slug(text) : undefined }
  }
  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()
    if (!t) { i++; continue }
    let m: RegExpMatchArray | null
    if (t.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) buf.push(lines[i++])
      i++
      out.push({ t: 'code', text: buf.join('\n') })
      continue
    }
    if ((m = t.match(/^(#{1,6})\s+(.*)$/))) {
      out.push(heading(Math.min(3, m[1].length) as 1 | 2 | 3, m[2]))
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      out.push({ t: 'divider' })
    } else if ((m = t.match(/^[-*+]\s+\[([ xX])\]\s*(.*)$/))) {
      out.push({ t: 'check', text: m[2], done: m[1].toLowerCase() === 'x' })
    } else if ((m = t.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/))) {
      out.push({ t: 'bullet', text: m[1] })
    } else if (t.startsWith('>')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) buf.push(lines[i++].trim().replace(/^>\s?/, ''))
      out.push({ t: 'quote', text: buf.join('\n') })
      continue
    } else if (t.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      const w = Math.max(...rows.map((r) => r.length))
      out.push({ t: 'table', rows: rows.map((r) => [...r, ...Array(w - r.length).fill('')]) })
      continue
    } else if ((m = t.match(/^\[([^\]]+)\]\(#([\w-]+)\)$/))) {
      out.push({ t: 'link', text: m[1], target: m[2] })
    } else if (/^!\[drawing\]/i.test(t)) {
      out.push({ t: 'drawing', paths: [] })
    } else {
      // paragraph: join soft-wrapped lines
      const buf = [t]
      while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#|[-*+]\s|\d+[.)]\s|>|\||```|-{3,}|!\[|\[[^\]]+\]\(#)/.test(lines[i + 1].trim())) buf.push(lines[++i].trim())
      out.push({ t: 'p', text: buf.join(' ').replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1$2') })
    }
    i++
  }
  return out
}

export const SAMPLE_MD = `# Regional Prep Checklist
Everything to finish before the qualifier.
[→ Pit crew](#pit-crew)

## Robot
- [x] Calibrate swerve modules
- [ ] Replace bumper fabric
- [ ] Charge all 3 batteries

---

## Pit crew {#pit-crew}
| Task | Owner |
| --- | --- |
| Pit banner | Nora |
| Scouting app | Alex |
| Spare parts | Jamie |

> Measure twice, cut once.
`
