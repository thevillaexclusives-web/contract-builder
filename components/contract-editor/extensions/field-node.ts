import { Node, mergeAttributes } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import React from 'react'

/**
 * Field Node Extension
 * 
 * Represents a fillable field in contracts/templates.
 * Renders differently based on editor mode:
 * - Template mode: Shows as placeholder underline
 * - Contract mode: Shows as editable input
 * - Readonly mode: Shows as resolved text value
 */
export const FieldNode = Node.create({
  name: 'field',
  
  // Field is inline (flows with text) and atomic (can't be edited directly)
  inline: true,
  atom: true,
  
  // Group it with other inline nodes
  group: 'inline',
  
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
    const { id, label, value, type } = node.attrs
    
    // Get mode from editor options (passed via editorProps)
    // For now, render as placeholder - actual mode-based rendering handled by addNodeView
    const displayText = label || (value ? value : '________')
    
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-field-id': id,
        'data-field-label': label,
        'data-field-value': value,
        'data-field-type': type,
        class: 'field-node',
        style: 'border-bottom: 2px dashed #ccc; min-width: 80px; display: inline-block; padding: 0 4px;',
      }),
      displayText,
    ]
  },

  addNodeView() {
    return ({ node, editor, getPos, HTMLAttributes }) => {
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
        minWidth: '80px',
        padding: '0 4px',
        verticalAlign: 'baseline',
      })

      // Render based on mode
      if (mode === 'template') {
        // Template mode: Show as placeholder
        const placeholder = label || '________'
        dom.textContent = placeholder
        dom.style.borderBottom = '2px dashed #ccc'
        dom.style.color = '#666'
        dom.style.cursor = 'pointer'
        dom.style.userSelect = 'none'
        
        // Make it editable (click to edit label)
        dom.addEventListener('click', () => {
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
        const input = document.createElement('input')
        input.type = type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'
        input.value = value || ''
        input.placeholder = label || 'Enter value'
        input.className = 'field-input'
        input.style.cssText = `
          border: none;
          border-bottom: 1px solid #333;
          outline: none;
          background: transparent;
          min-width: 100px;
          padding: 2px 4px;
          font-size: inherit;
          font-family: inherit;
        `
        
        // Update node when input changes
        input.addEventListener('input', (e) => {
          const newValue = (e.target as HTMLInputElement).value
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
        
        dom.appendChild(input)
      } else {
        // Readonly mode: Show as resolved text
        const displayValue = value || label || '________'
        dom.textContent = displayValue
        dom.style.borderBottom = 'none'
        dom.style.color = 'inherit'
      }

      return {
        dom,
        contentDOM: null, // Field is atomic, no content
      }
    }
  },

  addCommands() {
    return {
      insertField: (options: { id?: string; label?: string; type?: string }) => {
        return ({ commands }) => {
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
        }
      },
    }
  },
})
