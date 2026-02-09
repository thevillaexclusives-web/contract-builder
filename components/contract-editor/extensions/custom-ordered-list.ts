import { OrderedList } from '@tiptap/extension-ordered-list'
import { mergeAttributes } from '@tiptap/core'

/**
 * Extended OrderedList that supports different list styles:
 * - decimal (1, 2, 3) - default
 * - upper-roman (I, II, III)
 * - lower-roman (i, ii, iii)
 * - upper-alpha (A, B, C)
 * - lower-alpha (a, b, c)
 * 
 * This extends TipTap's built-in OrderedList extension to add listStyleType support.
 * The extension provides commands that can be called from the toolbar.
 */
export const CustomOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      listStyleType: {
        default: 'decimal',
        parseHTML: (element) => {
          const style = element.style.listStyleType || element.getAttribute('data-list-style')
          return style || 'decimal'
        },
        renderHTML: (attributes) => {
          // Always include the style attribute, even for decimal
          const listStyleType = attributes.listStyleType || 'decimal'
          return {
            'data-list-style': listStyleType,
            style: `list-style-type: ${listStyleType};`,
          }
        },
      },
    }
  },

  addCommands() {
    return {
      ...this.parent?.(),
    }
  },

  renderHTML({ HTMLAttributes, node }) {
    // Get listStyleType from node attributes (the source of truth)
    // node.attrs contains the actual stored attributes
    const listStyleType = node?.attrs?.listStyleType || 'decimal'
    
    // Merge attributes, but override with our computed listStyleType
    // This ensures we use the node's actual stored value, not HTMLAttributes
    return [
      'ol',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        style: `list-style-type: ${listStyleType};`,
        'data-list-style': listStyleType,
      }),
      0,
    ]
  },
})
