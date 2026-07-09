import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ShikiProvider } from './ShikiContext'
import { MarkdownRenderer } from './MarkdownRenderer'

// ── Mock ShikiCodeBlock dependencies ──
vi.mock('../chat/MermaidRenderer', () => ({
  MermaidRenderer: ({ code }: { code: string }) => (
    <div data-testid="mermaid-renderer">{code}</div>
  ),
}))

vi.mock('../shared/CopyButton', () => ({
  CopyButton: ({ text }: { text: string }) => (
    <button data-testid="copy-button" data-code={text}>Copy</button>
  ),
}))

// ── Helper: render with ShikiProvider ──
function renderWithProvider(ui: React.ReactElement) {
  return render(<ShikiProvider>{ui}</ShikiProvider>)
}

describe('MarkdownRenderer (react-markdown + Shiki)', () => {
  // ── Basic text rendering ──
  it('renders plain paragraph text', () => {
    const { container } = renderWithProvider(<MarkdownRenderer content="Hello world" />)
    expect(container.textContent).toContain('Hello world')
  })

  it('renders multiple paragraphs', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="Paragraph one.\n\nParagraph two." />,
    )
    expect(container.textContent).toContain('Paragraph one.')
    expect(container.textContent).toContain('Paragraph two.')
  })

  // ── Headings ──
  it('renders heading h1-h6', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6" />,
    )
    expect(container.textContent).toContain('H1')
    expect(container.textContent).toContain('H2')
    expect(container.textContent).toContain('H3')
    expect(container.textContent).toContain('H4')
    expect(container.textContent).toContain('H5')
    expect(container.textContent).toContain('H6')
  })

  it('renders heading with data-streamdown attributes', () => {
    const { container } = renderWithProvider(<MarkdownRenderer content="# Title" />)
    expect(container.querySelector('[data-streamdown="heading-1"]')).toBeInTheDocument()
  })

  // ── Inline code ──
  it('renders inline code with <code> element', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="Use `npm install` to install." />,
    )
    const code = container.querySelector('code')
    expect(code).toBeInTheDocument()
    expect(code?.textContent).toContain('npm install')
  })

  // ── Code blocks ──
  it('renders fenced code block with ShikiCodeBlock container', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content={'```ts\nconst x = 1\n```'} />,
    )
    const codeBlock = container.querySelector('[data-streamdown="code-block"]')
    expect(codeBlock).toBeInTheDocument()
    expect(codeBlock?.getAttribute('data-language')).toBe('ts')
  })

  it('renders code block content as text', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content={'```python\nprint("hello")\n```'} />,
    )
    expect(container.textContent).toContain('print("hello")')
  })

  // ── Mermaid diagrams ──
  it('renders mermaid fenced blocks with the Mermaid renderer', () => {
    renderWithProvider(<MarkdownRenderer content={'```mermaid\ngraph TB\nA-->B\n```'} />)
    expect(screen.getByTestId('mermaid-renderer')).toBeInTheDocument()
  })

  // Note: Code blocks without language tags are rendered as inline <code>
  // by react-markdown, so Mermaid auto-detection from untagged fences
  // is not available in the current StreamdownComponents implementation.

  // ── Mermaid streaming ──
  it('renders incomplete mermaid as diagram when streaming (fence auto-closed)', () => {
    // parseIncompleteMarkdown closes the open fence, making it a valid block
    renderWithProvider(
      <MarkdownRenderer content={'```mermaid\ngraph TB\nA-->B'} streaming />,
    )
    expect(screen.getByTestId('mermaid-renderer')).toBeInTheDocument()
  })

  // ── Links ──
  it('renders links with target=_blank and rel attributes', () => {
    renderWithProvider(<MarkdownRenderer content={'[OpenAI](https://openai.com)'} />)
    const link = screen.getByRole('link', { name: 'OpenAI' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('calls onLinkClick callback when link is clicked', () => {
    const onLinkClick = vi.fn().mockReturnValue(true)
    renderWithProvider(
      <MarkdownRenderer
        content={'[Manual](notes/manual.md)'}
        onLinkClick={onLinkClick}
      />,
    )
    fireEvent.click(screen.getByRole('link', { name: 'Manual' }))
    expect(onLinkClick).toHaveBeenCalledWith(
      'notes/manual.md',
      expect.objectContaining({ type: 'click' }),
    )
  })

  // ── Tables ──
  it('wraps tables in md-table-wrap container', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content={'| A | B |\n| --- | --- |\n| 1 | 2 |'} />,
    )
    expect(container.querySelector('.md-table-wrap')).toBeInTheDocument()
  })

  it('renders table header and data cells', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content={'| Name | Value |\n| --- | --- |\n| foo | bar |'} />,
    )
    expect(container.textContent).toContain('Name')
    expect(container.textContent).toContain('Value')
    expect(container.textContent).toContain('foo')
    expect(container.textContent).toContain('bar')
  })

  // ── Bold and emphasis ──
  it('renders bold text', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="This is **bold** text." />,
    )
    expect(container.querySelector('strong')).toBeInTheDocument()
    expect(container.textContent).toContain('bold')
  })

  it('renders italic text', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="This is *italic* text." />,
    )
    expect(container.querySelector('em')).toBeInTheDocument()
    expect(container.textContent).toContain('italic')
  })

  // ── Lists ──
  it('renders unordered lists', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="- Item 1\n- Item 2\n- Item 3" />,
    )
    expect(container.querySelector('ul')).toBeInTheDocument()
    expect(container.textContent).toContain('Item 1')
    expect(container.textContent).toContain('Item 2')
    expect(container.textContent).toContain('Item 3')
  })

  it('renders ordered lists', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="1. First\n2. Second\n3. Third" />,
    )
    expect(container.querySelector('ol')).toBeInTheDocument()
    expect(container.textContent).toContain('First')
    expect(container.textContent).toContain('Second')
    expect(container.textContent).toContain('Third')
  })

  // ── Blockquote ──
  it('renders blockquotes', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="> This is a quote." />,
    )
    expect(container.querySelector('blockquote')).toBeInTheDocument()
    expect(container.textContent).toContain('This is a quote.')
  })

  // ── Horizontal rule ──
  it('renders horizontal rules', () => {
    const { container } = renderWithProvider(<MarkdownRenderer content="---" />)
    expect(container.querySelector('hr')).toBeInTheDocument()
  })

  // ── Variant classes ──
  it('applies document variant classes', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="# Title" variant="document" className="mx-auto" />,
    )
    const root = container.firstChild as HTMLDivElement
    expect(root.className).toContain('mx-auto')
    expect(root.className).toContain('prose-p:text-[15px]')
  })

  it('applies compact variant classes', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="**Bold**" variant="compact" />,
    )
    const root = container.firstChild as HTMLDivElement
    expect(root.className).toContain('prose-p:text-xs')
    expect(container.textContent).toContain('Bold')
  })

  it('default variant does not include document-specific classes', () => {
    const { container } = renderWithProvider(<MarkdownRenderer content="# Title" />)
    const root = container.firstChild as HTMLDivElement
    expect(root.className).not.toContain('prose-p:text-[15px]')
  })

  // ── LaTeX / Math (rehype-katex) ──
  it('renders inline LaTeX with KaTeX', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="Formula: $E = mc^2$" />,
    )
    expect(container.querySelector('.katex')).toBeInTheDocument()
    expect(container.textContent).not.toContain('$E = mc^2$')
  })

  it('renders display LaTeX with KaTeX', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content={'$$\nx = 1\n$$'} />,
    )
    // rehype-katex renders display math with .katex-display inside .katex
    expect(container.querySelector('.katex')).toBeInTheDocument()
    // Original $$ delimiters should not appear
    expect(container.textContent).not.toContain('$$')
  })

  it('renders both inline and display math on the same page', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content={'Inline: $x^2$ and display:\n\n$$\ny^3\n$$'} />,
    )
    const katexElements = container.querySelectorAll('.katex')
    // Two KaTeX elements: one inline, one display
    expect(katexElements.length).toBeGreaterThanOrEqual(2)
    // Original delimiters should not appear
    expect(container.textContent).not.toContain('$x^2$')
    expect(container.textContent).not.toContain('$$')
  })

  // ── Streaming mode ──
  it('renders content in streaming mode', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="Streaming text" streaming />,
    )
    expect(container.textContent).toContain('Streaming text')
  })

  it('handles streaming with partial code block', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content={'```js\nconst a ='} streaming />,
    )
    const root = container.querySelector('[class*="markdown-prose"]')
    expect(root).toBeInTheDocument()
  })

  // ── No dangerouslySetInnerHTML ──
  it('does not use dangerouslySetInnerHTML (component-based rendering)', () => {
    const { container } = renderWithProvider(
      <MarkdownRenderer content="<script>alert('xss')</script>" />,
    )
    expect(container.textContent).not.toContain('alert')
  })

  // ── Empty content ──
  it('renders empty content without errors', () => {
    const { container } = renderWithProvider(<MarkdownRenderer content="" />)
    expect(container.firstChild).toBeInTheDocument()
  })
})