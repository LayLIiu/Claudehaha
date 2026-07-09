import { describe, it, expect } from 'vitest'
import { parseIncompleteMarkdown } from './parseIncompleteMarkdown'

describe('parseIncompleteMarkdown', () => {
  // 代码块修复
  it('closes unclosed code fences', () => {
    expect(parseIncompleteMarkdown('```js\nconst x = 1')).toBe('```js\nconst x = 1\n```')
  })

  it('does not modify already closed code fences', () => {
    expect(parseIncompleteMarkdown('```js\nconst x = 1\n```')).toBe('```js\nconst x = 1\n```')
  })

  // 粗体修复
  it('closes unclosed bold', () => {
    expect(parseIncompleteMarkdown('hello **world')).toBe('hello **world**')
  })

  it('does not modify closed bold', () => {
    expect(parseIncompleteMarkdown('hello **world**')).toBe('hello **world**')
  })

  // 斜体修复
  it('closes unclosed italic with asterisk', () => {
    expect(parseIncompleteMarkdown('hello *world')).toBe('hello *world*')
  })

  // 链接修复
  it('fixes incomplete links with incomplete-link placeholder', () => {
    const result = parseIncompleteMarkdown('[text](url')
    expect(result).toBe('[text](streamdown:incomplete-link)')
  })

  it('does not modify complete links', () => {
    expect(parseIncompleteMarkdown('[text](url)')).toBe('[text](url)')
  })

  // 行内代码修复
  it('closes unclosed inline code', () => {
    expect(parseIncompleteMarkdown('use `foo')).toBe('use `foo`')
  })

  // 数学公式修复
  it('closes unclosed display math $$', () => {
    expect(parseIncompleteMarkdown('$$\nx^2')).toBe('$$\nx^2\n$$')
  })

  it('closes unclosed inline math $', () => {
    expect(parseIncompleteMarkdown('$x^2')).toBe('$x^2$')
  })

  // 混合场景
  it('handles already-complete markdown as-is', () => {
    const complete = '# Hello\n\n- item1\n- item2\n\n**bold** and *italic*\n'
    expect(parseIncompleteMarkdown(complete)).toBe(complete)
  })

  it('removes trailing single space but preserves double space', () => {
    expect(parseIncompleteMarkdown('hello ')).toBe('hello')
    expect(parseIncompleteMarkdown('hello  ')).toBe('hello  ')
  })
})