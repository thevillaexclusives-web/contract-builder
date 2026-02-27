import { Node, mergeAttributes } from '@tiptap/core'

export const Page = Node.create({
  name: 'page',

  group: 'block',

  content: 'block+',

  defining: true,

  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-page="true"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-page': 'true',
        class: 'pm-page',
      }),
      0,
    ]
  },
})
