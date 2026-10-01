/* Expression evaluator for the Calculator (precedence, parentheses, unary minus,
 * postfix %, ^, constants and variables for Math Notes). */

export type Vars = Record<string, number>

export function evaluate(src: string, vars: Vars = {}, deg = true): number {
  const s = src
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/,/g, '')
    .replace(/π/g, ' pi ')
    .replace(/\s+/g, ' ')
    .trim()
  let i = 0
  const peek = () => { while (s[i] === ' ') i++; return s[i] }
  const eat = (c: string) => { if (peek() === c) { i++; return true } return false }
  const toRad = (x: number) => (deg ? (x * Math.PI) / 180 : x)
  const FN: Record<string, (x: number) => number> = {
    sin: (x) => Math.sin(toRad(x)), cos: (x) => Math.cos(toRad(x)), tan: (x) => Math.tan(toRad(x)),
    sqrt: Math.sqrt, ln: Math.log, log: Math.log10, abs: Math.abs, exp: Math.exp,
  }
  function primary(): number {
    const c = peek()
    if (c === '(') {
      i++
      const v = expr()
      eat(')')
      return v
    }
    if (c === '-') { i++; return -factor() }
    if (c === '+') { i++; return factor() }
    if (c === '√') { i++; return Math.sqrt(factor()) }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i))
    if (num) { i += num[0].length; return parseFloat(num[0]) }
    const id = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(s.slice(i))
    if (id) {
      i += id[0].length
      const name = id[0]
      if (FN[name.toLowerCase()] && peek() === '(') { i++; const v = expr(); eat(')'); return FN[name.toLowerCase()](v) }
      if (name === 'pi') return Math.PI
      if (name === 'e') return Math.E
      const key = Object.keys(vars).find((k) => k.toLowerCase() === name.toLowerCase())
      if (key !== undefined) return vars[key]
      throw new Error(`Unknown ${name}`)
    }
    throw new Error('Syntax')
  }
  function postfix(): number {
    let v = primary()
    for (;;) {
      if (eat('%')) v = v / 100
      else if (eat('!')) v = fact(v)
      else if (eat('²')) v = v * v
      else if (eat('³')) v = v * v * v
      else break
    }
    return v
  }
  function factor(): number {
    const b = postfix()
    if (eat('^')) return Math.pow(b, factor())
    return b
  }
  function term(): number {
    let v = factor()
    for (;;) {
      if (eat('*')) v *= factor()
      else if (eat('/')) v /= factor()
      else if (peek() === '(' || /[a-zπ√]/i.test(peek() ?? '')) v *= factor() // implicit multiply
      else break
    }
    return v
  }
  function expr(): number {
    let v = term()
    for (;;) {
      if (peek() === '+') { i++; const t = termWithPercent(v); v += t }
      else if (peek() === '-') { i++; const t = termWithPercent(v); v -= t }
      else break
    }
    return v
  }
  /** a + b% means a + a×b/100 (like iOS). */
  function termWithPercent(base: number): number {
    const start = i
    const m = /^\s*(\d+\.?\d*|\.\d+)%\s*(?=$|[+\-)])/.exec(s.slice(i))
    if (m) { i += m[0].length; return (base * parseFloat(m[1])) / 100 }
    i = start
    return term()
  }
  const v = expr()
  if (peek() !== undefined) throw new Error('Syntax')
  return v
}

export function fact(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN
  if (n > 170) return Infinity
  let r = 1
  for (let k = 2; k <= n; k++) r *= k
  return r
}

export function fmtNum(n: number, max = 9): string {
  if (!isFinite(n)) return 'Error'
  if (Number.isNaN(n)) return 'Error'
  const abs = Math.abs(n)
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return n.toExponential(5).replace(/\.?0+e/, 'e')
  const r = +n.toPrecision(12)
  const [int, dec] = String(Math.abs(r)).split('.')
  const intF = Number(int).toLocaleString('en-US')
  const decF = dec ? dec.slice(0, Math.max(0, max - int.length)) : ''
  return `${r < 0 ? '-' : ''}${intF}${decF ? '.' + decF : ''}`
}
