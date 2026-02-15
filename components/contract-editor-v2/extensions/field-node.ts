import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    field: {
      /**
       * Insert a field node
       */
      insertField: (options: { id?: string; label?: string; type?: string }) => ReturnType
    }
  }
}

/**
 * Field Node Extension
 * 
 * Represents a fillable field in contracts/templates.
 * Renders differently based on editor mode:
 * - Template mode: Shows as placeholder underline
 * - Contract mode: Shows as editable input (only editable part)
 * - Readonly mode: Shows as resolved text value
 */
export const FieldNode = Node.create({
  name: 'field',
  
  // Field is inline (flows with text) and atomic (can't be edited directly)
  inline: true,
  atom: true,
  
  // Group it with other inline nodes
  group: 'inline',
  
  // Make field selectable so it can be clicked
  selectable: true,
  
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-field-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {}
          }
          return {
            'data-field-id': attributes.id,
          }
        },
      },
      label: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-field-label') || element.textContent || '',
        renderHTML: (attributes) => {
          return {
            'data-field-label': attributes.label || '',
          }
        },
      },
      value: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-field-value') || '',
        renderHTML: (attributes) => {
          return {
            'data-field-value': attributes.value || '',
          }
        },
      },
      type: {
        default: 'text',
        parseHTML: (element) => element.getAttribute('data-field-type') || 'text',
        renderHTML: (attributes) => {
          return {
            'data-field-type': attributes.type || 'text',
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-field-id]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const { id, label, value } = node.attrs
    
    // Get mode from editor storage
    const mode = 'template' // Default for renderHTML, actual mode handled in addNodeView
    
    const displayText = label || (value ? value : '')
    
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-field-id': id,
        'data-field-label': label,
        'data-field-value': value,
        class: 'field-node',
        style: 'border-bottom: 1px solid #333; min-width: 80px; max-width: 300px; display: inline-block; padding: 0 4px;',
      }),
      displayText,
    ]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      // Get mode from editor storage (set by Editor component)
      const mode = (editor.storage as any).mode || 'template'
      const { id, label, value, type } = node.attrs

      // Create container element
      const dom = document.createElement('span')
      dom.setAttribute('data-field-id', id || '')
      dom.setAttribute('data-field-label', label || '')
      dom.setAttribute('data-field-type', type || 'text')
      dom.className = 'field-node'
      
      // Apply base styles
      Object.assign(dom.style, {
        display: 'inline-block',
        verticalAlign: 'baseline',
        position: 'relative',
      })

      let input: HTMLInputElement | null = null
      let updateInputWidth: ((textLength?: number) => void) | null = null

      // Render based on mode
      if (mode === 'template') {
        // Template mode: Show as placeholder
        const placeholder = label || '________'
        dom.textContent = placeholder
        dom.style.borderBottom = '1px solid #333'
        dom.style.color = '#666'
        dom.style.cursor = 'pointer'
        dom.style.userSelect = 'none'
        dom.style.minWidth = '80px'
        dom.style.padding = '0 4px'
        
        // Make it editable (click to edit label)
        dom.addEventListener('click', (e) => {
          e.stopPropagation()
          const newLabel = prompt('Field label:', label || '')
          if (newLabel !== null && editor && typeof getPos === 'function') {
            const pos = getPos()
            if (typeof pos === 'number') {
              editor.commands.command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  label: newLabel,
                })
                return true
              })
            }
          }
        })
      } else if (mode === 'contract') {
        // Contract mode: Show as input
        input = document.createElement('input')
        input.type = type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'
        input.value = value || ''
        input.placeholder = label || 'Enter value'
        input.className = 'field-input'

        input.style.cssText = `
          border: none;
          border-bottom: 1px solid #333;
          outline: none;
          background: transparent;
          padding: 2px 4px;
          font-size: inherit;
          font-family: inherit;
          color: inherit;
          box-sizing: border-box;
        `

        // Size input to fit table cells or use dynamic px width
        updateInputWidth = (textLength?: number) => {
          const inTable = dom.closest('td,th') != null
          if (inTable) {
            input!.style.width = '100%'
            input!.style.maxWidth = '100%'
            input!.style.minWidth = '0'
            input!.style.display = 'block'
            dom.style.display = 'block'
            dom.style.maxWidth = '100%'
            return
          }
          const len = textLength ?? (input!.value?.length || label?.length || 10)
          const w = Math.max(120, Math.min(300, len * 8))
          input!.style.width = `${w}px`
          input!.style.minWidth = '120px'
          input!.style.maxWidth = '300px'
        }

        updateInputWidth()

        // Prevent ProseMirror from handling events on the input
        input.addEventListener('mousedown', (e) => {
          e.stopPropagation()
        })

        input.addEventListener('click', (e) => {
          e.stopPropagation()
          input?.focus()
        })

        // Update node when input changes
        input.addEventListener('input', (e) => {
          e.stopPropagation()
          const newValue = (e.target as HTMLInputElement).value

          updateInputWidth!(newValue.length)

          if (editor && typeof getPos === 'function') {
            const pos = getPos()
            if (typeof pos === 'number') {
              editor.commands.command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  value: newValue,
                })
                return true
              })
            }
          }
        })

        // Handle focus/blur for better UX
        input.addEventListener('focus', (e) => {
          e.stopPropagation()
          input!.style.borderBottom = '2px solid #0066cc'
          input!.style.borderBottomWidth = '2px'
        })

        input.addEventListener('blur', () => {
          input!.style.borderBottom = '1px solid #333'
          input!.style.borderBottomWidth = '1px'
        })

        // Prevent keyboard events from propagating to ProseMirror
        input.addEventListener('keydown', (e) => {
          e.stopPropagation()
          // Allow normal input behavior
          if (e.key === 'Enter' || e.key === 'Escape') {
            input?.blur()
          }
        })

        dom.appendChild(input)
      } else {
        // Readonly mode: Show as resolved text
        const displayValue = value || label || '________'
        dom.textContent = displayValue
        dom.style.borderBottom = 'none'
        dom.style.color = 'inherit'
        dom.style.padding = '0 4px'
      }

      return {
        dom,
        contentDOM: null, // Field is atomic, no content
        update: (updatedNode) => {
          // Update input value when node changes externally
          if (mode === 'contract' && input && updatedNode.attrs.value !== input.value) {
            input.value = updatedNode.attrs.value || ''
            if (updateInputWidth) {
              updateInputWidth(updatedNode.attrs.value?.length || 10)
            }
          }
          return true
        },
      }
    }
  },

  addCommands() {
    return {
      insertField:
        (options: { id?: string; label?: string; type?: string }) =>
        ({ commands }) => {
          const fieldId = options.id || `field-${Date.now()}`
          return commands.insertContent({
            type: this.name,
            attrs: {
              id: fieldId,
              label: options.label || '',
              value: '',
              type: options.type || 'text',
            },
          })
        },
    }
  },
})
