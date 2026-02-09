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
          if (!attributes.listStyleType || attributes.listStyleType === 'decimal') {
            return {}
          }
          return {
            'data-list-style': attributes.listStyleType,
            style: `list-style-type: ${attributes.listStyleType};`,
          }
        },
      },
    }
  },

  addCommands() {
    return {
      ...this.parent?.(),
      /**
       * Toggle ordered list with a specific style type
       * Usage: editor.chain().focus().toggleOrderedListWithStyle('upper-roman').run()
       */
      toggleOrderedListWithStyle: (listStyleType: string = 'decimal') => {
        return ({ chain }) => {
          if (this.editor.isActive('orderedList')) {
            // If already an ordered list, just update the style
            return chain()
              .focus()
              .updateAttributes('orderedList', { listStyleType })
              .run()
          } else {
            // Create new ordered list with specified style
            return chain()
              .focus()
              .toggleOrderedList()
              .updateAttributes('orderedList', { listStyleType })
              .run()
          }
        }
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    const listStyleType = HTMLAttributes.listStyleType || 'decimal'
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
