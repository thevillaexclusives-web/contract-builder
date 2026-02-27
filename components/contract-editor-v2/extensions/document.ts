import { Node } from '@tiptap/core'

/**
 * Custom Document node whose top-level content is one or more Page nodes.
 * Replaces the default TipTap Document so the editor schema becomes:
 *   doc -> page+ -> block+
 */
export const Document = Node.create({
  name: 'doc',

  topNode: true,

  content: 'page+',
})
