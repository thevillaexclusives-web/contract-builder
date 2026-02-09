import { Extension } from '@tiptap/core'
import { TextStyle } from '@tiptap/extension-text-style'

/**
 * Custom FontWeight extension that allows setting font-weight CSS property
 * Extends TextStyle to add font-weight support
 */
export const FontWeight = Extension.create({
  name: 'fontWeight',

  addOptions() {
    return {
      types: ['textStyle'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (element) => element.style.fontWeight || null,
            renderHTML: (attributes) => {
              if (!attributes.fontWeight) {
                return {}
              }

              return {
                style: `font-weight: ${attributes.fontWeight};`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontWeight:
        (fontWeight: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontWeight }).run()
        },
      unsetFontWeight:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontWeight: null }).removeEmptyTextStyle().run()
        },
    }
  },
})
