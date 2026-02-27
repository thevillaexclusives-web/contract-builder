import type { JSONContent } from '@tiptap/core'

const EMPTY_PAGE_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'page', content: [{ type: 'paragraph' }] }],
}

/**
 * Migrate legacy doc->blocks content to the new doc->page->blocks schema.
 *
 * - If the doc already contains page nodes as direct children, return as-is.
 * - Otherwise wrap all existing top-level children inside a single page node.
 * - Returns a valid empty-page doc for null/undefined/empty input.
 */
export function wrapInPage(content: JSONContent | undefined | null): JSONContent {
  if (!content) return EMPTY_PAGE_DOC

  if (content.type !== 'doc') {
    // Unexpected root type — wrap the whole thing
    console.warn('[wrapInPage] Content root is not "doc", got:', content.type)
    return {
      type: 'doc',
      content: [{ type: 'page', content: [content] }],
    }
  }

  const children = content.content
  if (!children || children.length === 0) {
    return EMPTY_PAGE_DOC
  }

  // Already migrated: first child is a page node
  if (children[0].type === 'page') {
    return content
  }

  // Legacy format: doc -> block+ — wrap in a single page
  return {
    type: 'doc',
    content: [{ type: 'page', content: children }],
  }
}
