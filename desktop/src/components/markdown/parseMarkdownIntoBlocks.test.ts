import { describe, it, expect } from 'vitest'
import { parseMarkdownIntoBlocks } from './parseMarkdownIntoBlocks'

describe('parseMarkdownIntoBlocks', () => {
  it('splits simple paragraphs', () => {
    const result = parseMarkdownIntoBlocks('Hello world\n\nGoodbye world')
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('Hello world')
    expect(result[1]).toContain('Goodbye world')
  })

  it('keeps code fence as single block', () => {
    const md = 'Some text\n\n```js\nconst x = 1\n```\n\nMore text'
    const result = parseMarkdownIntoBlocks(md)
    expect(result.length).toBeGreaterThanOrEqual(2)
    // Code block should be one piece
    const codeBlock = result.find(b => b.includes('```'))
    expect(codeBlock).toBeDefined()
    expect(codeBlock).toContain('const x = 1')
  })

  it('keeps list as single block', () => {
    const md = '- item1\n- item2\n- item3'
    const result = parseMarkdownIntoBlocks(md)
    expect(result).toHaveLength(1)
  })

  it('handles heading + paragraph', () => {
    const md = '# Title\n\nParagraph text'
    const result = parseMarkdownIntoBlocks(md)
    expect(result).toHaveLength(2)
  })

  it('returns single block for empty-like content', () => {
    const result = parseMarkdownIntoBlocks('')
    expect(result).toEqual([''])
  })

  it('does not split when footnotes are present', () => {
    const md = 'Text with footnote[^1]\n\n[^1]: Footnote definition'
    const result = parseMarkdownIntoBlocks(md)
    // With footnotes, return entire content as single block
    expect(result).toHaveLength(1)
  })
})