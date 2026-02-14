import { Node, mergeAttributes } from '@tiptap/core'

export interface PageBreakOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      /**
       * Insert a page break
       */
      setPageBreak: () => ReturnType
    }
  }
}

export const PageBreak = Node.create<PageBreakOptions>({
  name: 'pageBreak',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: 'block',
  
  // Prevent page breaks from being nested inside other blocks
  isolating: true,
  
  // Page breaks should always be at the document level
  selectable: false,
  
  // Define what can contain page breaks (only document, not list items)
  content: '',
  
  // Define where page breaks can be inserted
  defining: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="page-break"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'page-break',
        class: 'page-break',
        style: 'page-break-after: always; break-after: page;',
      }),
    ]
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands, state, dispatch }) => {
          const { selection } = state
          const { $from } = selection
          
          // Check if we're inside a list item and exit all list structures
          let depth = $from.depth
          let exitCount = 0
          
          // Count how many list structures we need to exit
          while (depth > 0) {
            const node = $from.node(depth)
            if (node.type.name === 'listItem' || node.type.name === 'orderedList' || node.type.name === 'bulletList') {
              exitCount++
            }
            depth--
          }
          
          // Exit all list structures to get to document level
          for (let i = 0; i < exitCount; i++) {
            commands.exitCode()
          }
          
          // If we're inside a blockquote, exit it
          depth = $from.depth
          while (depth > 0) {
            const node = $from.node(depth)
            if (node.type.name === 'blockquote') {
              commands.exitCode()
              break
            }
            depth--
          }
          
          // Insert page break as a new block at document level
          const result = commands.insertContent({
            type: this.name,
          })
          
          // Add a new paragraph after the page break for continued editing
          if (result && dispatch) {
            setTimeout(() => {
              commands.insertContent('<p></p>')
            }, 0)
          }
          
          return result
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak(),
    }
  },
})
