import { marked } from 'marked'

/**
 * Split Markdown into independent renderable blocks.
 * Ported from ZCode Streamdown's `jb` function.
 *
 * Each block can be rendered as an independent React component.
 * In streaming mode, unchanged blocks can be memoized while only
 * the last block(s) re-render.
 */

const FOOTNOTE_REF = /\[\^[\w-]{1,200}\](?!:)/
const FOOTNOTE_DEF = /\[\^[\w-]{1,200}\]:/

function countTagOccurrences(html: string, tagName: string): number {
  const openRe = new RegExp(`<${tagName}[\\s>]`, 'gi')
  const closeRe = new RegExp(`</${tagName}\\s*>`, 'gi')
  return (html.match(openRe) || []).length - (html.match(closeRe) || []).length
}

export function parseMarkdownIntoBlocks(text: string): string[] {
  if (!text) return [text]

  // If footnotes are present, don't split — they need global context
  if (FOOTNOTE_REF.test(text) || FOOTNOTE_DEF.test(text)) {
    return [text]
  }

  const tokens = marked.lexer(text, { gfm: true })
  const blocks: string[] = []
  const htmlTagStack: string[] = []
  let prevWasCode = false

  for (const token of tokens) {
    const raw = token.raw

    // If we have unclosed HTML tags, append to the last block
    if (htmlTagStack.length > 0) {
      const lastIdx = blocks.length - 1
      blocks[lastIdx] = (blocks[lastIdx] ?? '') + raw
      const tag = htmlTagStack[htmlTagStack.length - 1]!
      const opens = countTagOccurrences(raw, tag)
      for (let i = 0; i < opens; i++) htmlTagStack.push(tag)
      while (htmlTagStack.length > 0 && htmlTagStack[htmlTagStack.length - 1] === tag) {
        htmlTagStack.pop()
      }
      continue
    }

    // Detect HTML block with unclosed tags
    if (token.type === 'html' && (token as any).block) {
      const match = raw.match(/<(\w+)[\s>]/)
      if (match) {
        const tagName = match[1]!.toLowerCase()
        const selfClosing = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
        if (!selfClosing.has(tagName)) {
          const net = countTagOccurrences(raw, tagName)
          if (net > 0) htmlTagStack.push(tagName)
        }
      }
    }

    // If previous block has odd $$ count, append to it (incomplete display math)
    const lastBlock = blocks[blocks.length - 1]
    if (lastBlock && !prevWasCode) {
      const dollarCount = (lastBlock.match(/\$\$/g) || []).length
      if (dollarCount % 2 !== 0) {
        blocks[blocks.length - 1] = lastBlock + raw
        continue
      }
    }

    // Skip space tokens (blank lines between blocks)
    if (token.type !== 'space') {
      blocks.push(raw)
      prevWasCode = token.type === 'code'
    }
  }

  return blocks.length > 0 ? blocks : [text]
}