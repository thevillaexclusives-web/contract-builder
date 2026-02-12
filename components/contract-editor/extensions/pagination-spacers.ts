import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface PageBreakInfo {
  pos: number
  spacerHeight: number
}

const pluginKey = new PluginKey('paginationSpacers')

/**
 * PaginationSpacers Extension
 *
 * Uses ProseMirror widget decorations to inject visual spacer elements
 * at page break positions. Break positions and spacer heights are stored
 * in extension storage and updated externally by the PagePagination component.
 *
 * This works within TipTap's rendering model — no raw DOM manipulation needed.
 */
export const PaginationSpacers = Extension.create({
  name: 'paginationSpacers',

  addStorage() {
    return {
      breakInfos: [] as PageBreakInfo[],
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations(state) {
            const breakInfos = extension.storage.breakInfos as PageBreakInfo[]
            if (!breakInfos.length) return DecorationSet.empty

            const decorations = breakInfos
              .filter(info => info.pos > 0 && info.pos <= state.doc.content.size)
              .map(info =>
                Decoration.widget(
                  info.pos,
                  () => {
                    const spacer = document.createElement('div')
                    spacer.className = 'pagination-spacer'
                    spacer.style.height = `${info.spacerHeight}px`
                    spacer.style.pointerEvents = 'none'
                    spacer.style.userSelect = 'none'
                    spacer.setAttribute('contenteditable', 'false')
                    return spacer
                  },
                  {
                    side: -1,
                    key: `page-spacer-${info.pos}`,
                  }
                )
              )

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
