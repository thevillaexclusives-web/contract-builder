import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface PageBreakInfo {
  pos: number
  spacerHeight: number
}

interface PaginationState {
  breakInfos: PageBreakInfo[]
}

export const paginationSpacersKey = new PluginKey<PaginationState>('paginationSpacers')

export const PaginationSpacers = Extension.create({
  name: 'paginationSpacers',

  addProseMirrorPlugins() {
    return [
      new Plugin<PaginationState>({
        key: paginationSpacersKey,

        state: {
          init(): PaginationState {
            return { breakInfos: [] }
          },
          apply(tr, prev): PaginationState {
            const meta = tr.getMeta(paginationSpacersKey) as PageBreakInfo[] | undefined
            if (meta) {
              return { breakInfos: meta }
            }
            return prev
          },
        },

        props: {
          decorations(state) {
            const pluginState = paginationSpacersKey.getState(state)
            if (!pluginState || !pluginState.breakInfos.length) return DecorationSet.empty

            const decorations = pluginState.breakInfos
              .filter((info) => info.pos > 0 && info.pos <= state.doc.content.size)
              .map((info) =>
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
