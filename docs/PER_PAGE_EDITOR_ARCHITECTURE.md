# Per-Page TipTap Editor Architecture

## Overview

Instead of one continuous TipTap editor with pagination hacks (spacers, clip-path, DOM measurement), each page is its own TipTap editor instance with a fixed content height. Content overflow from page N automatically flows into page N+1.

```
┌─────────────────────────────┐
│  Header: "Contract Title"   │  ← Static HTML (not in editor)
│  ───────────────────────── │
│  [TipTap Editor #1]         │  ← Fixed height: 956px
│  max-height: 956px          │
│  ───────────────────────── │
│  Footer: "Page 1 of 3"     │  ← Static HTML
└─────────────────────────────┘
         40px gray gap
┌─────────────────────────────┐
│  Header                     │
│  ───────────────────────── │
│  [TipTap Editor #2]         │  ← Receives overflow from Editor #1
│  max-height: 956px          │
│  ───────────────────────── │
│  Footer: "Page 2 of 3"     │
└─────────────────────────────┘
```

---

## Core Components

### 1. PageManager (Parent Component)

The central orchestrator. Manages the array of pages (editors), handles overflow/underflow, and tracks the active editor for the toolbar.

```typescript
// components/contract-editor/PageManager.tsx

interface PageState {
  id: string            // Unique page ID
  editor: Editor        // TipTap editor instance
  content: JSONContent   // TipTap JSON content for this page
}

interface PageManagerState {
  pages: PageState[]
  activePageIndex: number  // Which editor is currently focused
}
```

**Responsibilities:**
- Create/destroy editor instances as pages are added/removed
- Detect content overflow in each editor
- Move content between editors (overflow/underflow)
- Track which editor is focused (for toolbar routing)
- Provide page count to headers/footers

### 2. PageCard (Per-Page Component)

Renders one page: header, editor, footer, all inside a white card with shadow.

```typescript
// components/contract-editor/PageCard.tsx

interface PageCardProps {
  editor: Editor
  pageNumber: number
  totalPages: number
  header?: React.ReactNode
  footer?: React.ReactNode
  onFocus: () => void        // Tell PageManager this editor is active
  onOverflow: (overflowContent: JSONContent[]) => void
  onUnderflow: () => JSONContent[] | null  // Request content from next page
}
```

**Key CSS:**
```css
.page-card {
  width: 794px;
  height: 1122px;          /* Full A4 height */
  background: white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  position: relative;
  box-sizing: border-box;
  overflow: hidden;          /* CRITICAL: clips content at page boundary */
}

.page-card .page-header {
  height: 83px;              /* 22mm top padding */
  padding: 15px 22mm 0;
}

.page-card .page-editor-area {
  height: 956px;             /* A4_CONTENT_HEIGHT */
  padding: 0 22mm;
  overflow: hidden;          /* Content beyond 956px is hidden */
}

.page-card .page-footer {
  height: 83px;              /* 22mm bottom padding */
  padding: 0 22mm 15px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}
```

### 3. SharedToolbar

One toolbar instance that routes commands to the active editor.

```typescript
// components/contract-editor/SharedToolbar.tsx

interface SharedToolbarProps {
  activeEditor: Editor | null
}
```

**How it works:**
- PageManager passes `pages[activePageIndex].editor` as `activeEditor`
- All toolbar buttons call `activeEditor.chain().focus()...run()`
- When the user clicks into a different page, `activePageIndex` updates
- The toolbar re-renders with the new active editor's state (bold active, etc.)

```typescript
// Example: Bold button
function BoldButton({ activeEditor }: { activeEditor: Editor | null }) {
  if (!activeEditor) return null

  return (
    <button
      onClick={() => activeEditor.chain().focus().toggleBold().run()}
      className={activeEditor.isActive('bold') ? 'is-active' : ''}
    >
      Bold
    </button>
  )
}
```

**Focus tracking:**
- Each PageCard editor listens to the `focus` event
- On focus, it calls `onFocus()` which updates `activePageIndex` in PageManager
- The toolbar automatically reflects the focused editor's state

```typescript
// Inside PageCard setup
editor.on('focus', () => {
  onFocus() // tells PageManager "I'm the active editor now"
})
```

---

## Content Overflow System

This is the core challenge. When content in editor N exceeds the page height, excess blocks must move to editor N+1.

### Detection: How to Know Content Overflows

**Approach: Compare scrollHeight vs clientHeight**

Each editor's `.ProseMirror` element has a fixed container height (956px via CSS). When content exceeds this, `scrollHeight > clientHeight`.

```typescript
function checkOverflow(editor: Editor): boolean {
  const el = editor.view.dom
  return el.scrollHeight > el.clientHeight
}
```

Use a `ResizeObserver` on each editor's `.ProseMirror` element to detect when content height changes.

**When to check:**
- After every editor `update` event (user typed, pasted, etc.)
- After content is moved in from another page
- Debounce with ~50ms to batch rapid changes

### Moving Content: Overflow (Page N → Page N+1)

When editor N overflows:

1. Get the document's top-level nodes (paragraphs, headings, tables, etc.)
2. Walk backwards from the last node, measuring which nodes push content beyond 956px
3. Remove those nodes from editor N
4. Prepend them to editor N+1 (create N+1 if it doesn't exist)

```typescript
function handleOverflow(sourceEditor: Editor, targetEditor: Editor) {
  const doc = sourceEditor.state.doc
  const nodesToMove: { node: Node; pos: number }[] = []

  // Walk top-level nodes in reverse to find which ones overflow
  // Use DOM measurement: check if the node's bottom exceeds the container
  const pmEl = sourceEditor.view.dom
  const containerHeight = pmEl.clientHeight // 956px

  doc.forEach((node, offset) => {
    const dom = sourceEditor.view.nodeDOM(offset) as HTMLElement
    if (!dom) return

    const nodeBottom = dom.offsetTop + dom.offsetHeight
    if (nodeBottom > containerHeight) {
      nodesToMove.push({ node, pos: offset })
    }
  })

  if (nodesToMove.length === 0) return

  // Remove from source (in reverse order to maintain positions)
  const sourceTr = sourceEditor.state.tr
  for (let i = nodesToMove.length - 1; i >= 0; i--) {
    const { node, pos } = nodesToMove[i]
    sourceTr.delete(pos, pos + node.nodeSize)
  }
  sourceEditor.view.dispatch(sourceTr)

  // Prepend to target (insert at position 0, after doc open)
  const targetTr = targetEditor.state.tr
  let insertPos = 0
  for (const { node } of nodesToMove) {
    targetTr.insert(insertPos, node)
    insertPos += node.nodeSize
  }
  targetEditor.view.dispatch(targetTr)
}
```

### Moving Content: Underflow (Page N+1 → Page N)

When content is deleted from page N and there's space, pull content back from page N+1:

1. Measure remaining space on page N
2. Take the first node(s) from page N+1 that fit
3. Remove from N+1, append to N
4. If page N+1 becomes empty, remove it entirely

```typescript
function handleUnderflow(targetEditor: Editor, sourceEditor: Editor): boolean {
  const pmEl = targetEditor.view.dom
  const availableSpace = pmEl.clientHeight - pmEl.scrollHeight

  if (availableSpace <= 0) return false

  const sourceDoc = sourceEditor.state.doc
  if (sourceDoc.content.size <= 2) return false // empty doc (just open/close)

  // Try to pull the first top-level node from the source
  const firstNode = sourceDoc.firstChild
  if (!firstNode) return false

  // Measure if it would fit (heuristic: check node's expected height)
  // For accuracy, temporarily insert and measure, then undo if it doesn't fit
  // Simpler approach: just move it and check, revert if overflow occurs

  // Append to target
  const targetTr = targetEditor.state.tr
  targetTr.insert(targetEditor.state.doc.content.size, firstNode)
  targetEditor.view.dispatch(targetTr)

  // Check if target now overflows
  if (pmEl.scrollHeight > pmEl.clientHeight) {
    // Doesn't fit — undo
    targetEditor.commands.undo()
    return false
  }

  // It fits — remove from source
  const sourceTr = sourceEditor.state.tr
  sourceTr.delete(0, firstNode.nodeSize)
  sourceEditor.view.dispatch(sourceTr)

  return true // signal that we pulled content, try again for more
}
```

### Cascade Logic

Overflow/underflow can cascade across multiple pages:

```
User types in Page 1
  → Page 1 overflows
  → Last paragraph moves to Page 2
  → Page 2 now overflows
  → Last paragraph of Page 2 moves to Page 3 (created if needed)
  → Page 3 fits, cascade stops
```

```
User deletes in Page 1
  → Page 1 has space
  → Pull first paragraph from Page 2
  → Page 2 now has space
  → Pull first paragraph from Page 3
  → Page 3 is now empty → delete Page 3
```

Implement this as a loop:

```typescript
function rebalancePages(pages: PageState[]) {
  let changed = true

  while (changed) {
    changed = false

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]

      // Check overflow
      if (checkOverflow(page.editor)) {
        if (i === pages.length - 1) {
          // Last page — create a new page
          pages.push(createNewPage())
        }
        handleOverflow(page.editor, pages[i + 1].editor)
        changed = true
      }

      // Check underflow (pull from next page if space available)
      if (i < pages.length - 1) {
        const pulled = handleUnderflow(page.editor, pages[i + 1].editor)
        if (pulled) changed = true
      }
    }

    // Remove empty trailing pages (keep at least 1)
    while (pages.length > 1) {
      const lastPage = pages[pages.length - 1]
      if (lastPage.editor.state.doc.content.size <= 2) {
        lastPage.editor.destroy()
        pages.pop()
        changed = true
      } else {
        break
      }
    }
  }
}
```

**Important: Use `requestAnimationFrame` or `setTimeout(0)` between iterations** so the DOM settles and height measurements are accurate after content moves.

---

## Shared Extensions

All editor instances must share the same extension set so content is compatible across pages.

```typescript
// lib/editor/shared-extensions.ts

export function createSharedExtensions(mode: 'template' | 'contract' | 'readonly') {
  return [
    StarterKit,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    FieldNode.configure({ mode }),
    // ... your other extensions
    // DO NOT include PaginationSpacers — no longer needed
  ]
}
```

Each editor instance is created with:

```typescript
function createPageEditor(content: JSONContent, mode: EditorMode): Editor {
  return new Editor({
    extensions: createSharedExtensions(mode),
    content,
    editable: mode !== 'readonly',
  })
}
```

---

## Editor Content Structure

### In-Memory (While Editing)

Each page has its own TipTap JSON document:

```typescript
// Page 1 content
{ type: 'doc', content: [
  { type: 'heading', content: [{ type: 'text', text: 'Agreement' }] },
  { type: 'paragraph', content: [...] },
  { type: 'paragraph', content: [...] },
]}

// Page 2 content
{ type: 'doc', content: [
  { type: 'paragraph', content: [...] },
  { type: 'table', content: [...] },
]}
```

### Storage (Database)

Store as a single unified document. Merge all pages' content on save, split on load:

```typescript
// SAVE: Merge all pages into one document
function mergePages(pages: PageState[]): JSONContent {
  const allNodes: JSONContent[] = []
  for (const page of pages) {
    const json = page.editor.getJSON()
    if (json.content) {
      allNodes.push(...json.content)
    }
  }
  return { type: 'doc', content: allNodes }
}

// LOAD: Start with all content in page 1, let rebalancePages() distribute it
function loadDocument(doc: JSONContent): PageState[] {
  const firstPage = createPageEditor(doc, mode)
  const pages = [{ id: generateId(), editor: firstPage, content: doc }]

  // After DOM renders, rebalance will overflow content into subsequent pages
  requestAnimationFrame(() => rebalancePages(pages))

  return pages
}
```

This means your Supabase schema doesn't change at all — same JSONB column, same format.

---

## Cursor and Selection Across Pages

### Typing at End of Page

When the user is typing at the bottom of page N and content overflows:
- The overflow node moves to page N+1
- But the cursor should stay with the content the user is actively editing
- If the node the cursor is in gets moved, focus should follow it to page N+1

```typescript
function handleOverflowWithCursor(
  sourcePage: PageState,
  targetPage: PageState,
  activePageIndex: number
) {
  const { from } = sourcePage.editor.state.selection
  const movedNodes = handleOverflow(sourcePage.editor, targetPage.editor)

  // Check if cursor was in a moved node
  for (const { pos, node } of movedNodes) {
    if (from >= pos && from < pos + node.nodeSize) {
      // Cursor was in this node — focus the target editor
      const cursorOffsetInNode = from - pos
      targetPage.editor.commands.focus()
      targetPage.editor.commands.setTextSelection(cursorOffsetInNode)
      setActivePageIndex(activePageIndex + 1)
      break
    }
  }
}
```

### Arrow Keys Across Pages

When the user presses ArrowDown at the last line of page N, move focus to page N+1's first position. Similarly ArrowUp at the top of page N+1 goes to page N's last position.

```typescript
// Custom keymap for each editor (pass pageIndex so it knows its position)
function createCrossPageKeymap(pageIndex: number, pages: PageState[]) {
  return Extension.create({
    name: 'crossPageNavigation',
    addKeyboardShortcuts() {
      return {
        ArrowDown: ({ editor }) => {
          const { $head } = editor.state.selection
          const atEnd = $head.pos >= editor.state.doc.content.size - 1

          if (atEnd && pageIndex < pages.length - 1) {
            // Move to first position of next page
            const nextEditor = pages[pageIndex + 1].editor
            nextEditor.commands.focus('start')
            return true // prevent default
          }
          return false // let default ArrowDown handle it
        },
        ArrowUp: ({ editor }) => {
          const { $head } = editor.state.selection
          const atStart = $head.pos <= 1

          if (atStart && pageIndex > 0) {
            // Move to last position of previous page
            const prevEditor = pages[pageIndex - 1].editor
            prevEditor.commands.focus('end')
            return true
          }
          return false
        },
      }
    },
  })
}
```

### Backspace at Start of Page

When the user presses Backspace at position 0 of page N+1, pull the first node back to page N (merge with last node if both are paragraphs).

---

## Tables Spanning Pages

Tables that overflow a page need special handling since you can't split a table mid-row in ProseMirror.

**Strategy: Split at row boundaries.**

```typescript
function handleTableOverflow(editor: Editor, tablePos: number) {
  const tableNode = editor.state.doc.nodeAt(tablePos)
  if (!tableNode || tableNode.type.name !== 'table') return

  // Find which row overflows by measuring each row's DOM position
  const tableDom = editor.view.nodeDOM(tablePos) as HTMLElement
  const containerHeight = editor.view.dom.clientHeight
  let splitAtRow = -1

  const rows = tableDom.querySelectorAll('tr')
  rows.forEach((row, index) => {
    const rowBottom = row.getBoundingClientRect().bottom - editor.view.dom.getBoundingClientRect().top
    if (rowBottom > containerHeight && splitAtRow === -1) {
      splitAtRow = index
    }
  })

  if (splitAtRow <= 0) return // Can't split — first row overflows (table header)

  // Split: rows 0..splitAtRow-1 stay, rows splitAtRow..end move to next page
  // Both halves become separate table nodes
}
```

**Edge case:** If a single row is taller than the page, it can't be split further. In practice this is rare for contract tables. You could either:
- Let it overflow (clipped by the page card)
- Show a warning to the user

---

## Headers and Footers

Each PageCard renders header/footer as static HTML outside the TipTap editor:

```typescript
function PageCard({ pageNumber, totalPages, editor, ...props }: PageCardProps) {
  return (
    <div className="page-card">
      <div className="page-header">
        {/* Render whatever header content you want */}
        <span className="header-title">Contract Agreement</span>
      </div>

      <div className="page-editor-area">
        <EditorContent editor={editor} />
      </div>

      <div className="page-footer">
        <span className="page-number">Page {pageNumber} of {totalPages}</span>
      </div>
    </div>
  )
}
```

Since headers/footers are outside the editor, they:
- Don't interfere with content measurement
- Don't participate in overflow calculations
- Are trivial to style and position
- Map directly to PDF headers/footers in PDFMake

---

## PDF Export

The export pipeline barely changes:

```typescript
async function exportToPDF(pages: PageState[], metadata: ContractMetadata) {
  // 1. Merge all pages into one unified document
  const unifiedDoc = mergePages(pages)

  // 2. Use your existing TipTap JSON → PDFMake mapper
  const pdfContent = mapTipTapToPDFMake(unifiedDoc)

  // 3. Add headers/footers to PDFMake definition
  const docDefinition = {
    content: pdfContent,
    pageSize: 'A4',
    pageMargins: [83, 83, 83, 83],
    header: (currentPage: number, pageCount: number) => ({
      text: metadata.title,
      margin: [83, 15, 83, 0],
      fontSize: 9,
    }),
    footer: (currentPage: number, pageCount: number) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: 'right',
      margin: [83, 0, 83, 15],
      fontSize: 9,
    }),
  }

  // 4. Generate PDF (same as today)
  return pdfMake.createPdf(docDefinition)
}
```

---

## What Gets Deleted

These files/systems are no longer needed:

- `PagePagination.tsx` → replaced by `PageManager.tsx` + `PageCard.tsx`
- `extensions/pagination-spacers.ts` → no more spacer decorations
- All clip-path / mask-image logic → `overflow: hidden` on the page card does the job
- `.page-gaps-overlay` CSS → gaps are just margin/gap between page cards
- `.page-boundaries-overlay` CSS → each page card IS the boundary
- `hooks/usePagination.ts` → no longer needed

## What Carries Over

- `extensions/field-node.ts` → same extension, same modes
- `Toolbar.tsx` → same component, just receives `activeEditor` prop
- `lib/pdf/mapper.ts` → same mapper, receives merged document
- `lib/constants/page.ts` → same constants
- `Editor.tsx` → refactored to use PageManager instead of single editor
- Supabase schema → unchanged, same JSONB storage

---

## Implementation Order

### Phase 1: Basic Multi-Page (No Overflow Yet)
1. Create `PageCard` component with fixed dimensions
2. Create `PageManager` with a single page
3. Wire up `SharedToolbar` to track active editor
4. Verify: single page works identically to current editor

### Phase 2: Overflow Detection + Content Movement
5. Add `ResizeObserver` to detect overflow in each editor
6. Implement `handleOverflow()` — move last node(s) to next page
7. Implement `handleUnderflow()` — pull first node(s) from next page
8. Implement `rebalancePages()` cascade loop
9. Verify: typing enough content creates page 2, deleting removes it

### Phase 3: Cross-Page UX
10. Arrow key navigation across page boundaries
11. Backspace at page start (merge with previous page's last node)
12. Cursor follows content when overflow moves the active node
13. Verify: editing feels seamless across pages

### Phase 4: Headers, Footers, and Polish
14. Add header/footer rendering to PageCard
15. Wire up page numbers (auto-updating)
16. Style page gaps (gray background between cards)
17. Verify: looks like a real document editor

### Phase 5: Table Support
18. Table-aware overflow splitting (split at row boundaries)
19. Test tables at page boundaries
20. Verify: tables work in template and contract modes

### Phase 6: Cleanup
21. Delete old pagination files
22. Update PDF export to use merged document
23. Update save/load to merge/split pages
24. Final testing across all modes
