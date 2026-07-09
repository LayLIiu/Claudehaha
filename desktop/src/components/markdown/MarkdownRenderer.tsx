// Migrated to Streamdown architecture (remark/rehype + react-markdown)
// Old implementation: see MarkdownRenderer.legacy.tsx

export { StreamdownRenderer as MarkdownRenderer } from './StreamdownRenderer'
export type { StreamdownRendererProps as MarkdownRendererProps } from './StreamdownRenderer'
export { __markdownParseCacheInternals } from './StreamdownRenderer'