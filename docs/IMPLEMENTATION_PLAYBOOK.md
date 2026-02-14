# A4 Auto-Flow Pagination Editor Architecture

**Stack:** Next.js + Tiptap + Supabase (jsonb) + Puppeteer
**Mode:** Hybrid (px editor view + mm export view)
**Pagination:** Overlay-based auto flow (single editor instance)

---

# 1. Goals

Build a Word-like A4 document editor with:

* Single Tiptap instance
* Auto-flow pagination (content flows to next page when height exceeded)
* Header + Footer support
* Dynamic page numbers
* Accurate A4 PDF export via Puppeteer
* Store document as `jsonb` in Supabase `templates.content`

---

# 2. High-Level Architecture

```
Editor Mode (Client)
 ├── Tiptap (single instance)
 ├── Overlay Pagination Layer
 └── usePagination() Hook

Export Mode (Server via Puppeteer)
 ├── Render HTML from ProseMirror JSON
 ├── Run pagination script in headless Chromium
 ├── Wrap content into <section class="page">
 └── Generate A4 PDF
```

---

# 3. Core Principles

### 3.1 Single Editor Only

Never split the document into multiple Tiptap instances.

Pagination is a **visual concern**, not a document concern.

---

### 3.2 Overlay-Based Pagination

The editor content remains continuous.

An absolutely positioned overlay renders:

* Page rectangles
* Header
* Footer
* Page numbers
* Optional page boundary lines

The overlay does not modify document state.

---

### 3.3 Hybrid Units

| Context    | Units      |
| ---------- | ---------- |
| Editor UI  | px         |
| PDF Export | mm + @page |

Editor uses px for stable measurement.
Export uses mm for accurate A4 output.

---

# 4. Page Geometry

## 4.1 A4 Dimensions

A4 size:

* 210mm × 297mm

Editor UI approximation (stable px mapping):

```
PAGE_WIDTH  = 794px
PAGE_HEIGHT = 1123px
PAGE_GAP    = 24px
```

## 4.2 Layout Configuration

```ts
export const PAGE_CONFIG = {
  width: 794,
  height: 1123,
  gap: 24,

  paddingX: 64,
  paddingTop: 24,
  paddingBottom: 24,

  headerHeight: 96,
  footerHeight: 72,
}
```

## 4.3 Derived Values

```ts
contentTopOffset =
  paddingTop + headerHeight

contentUsableHeight =
  height
  - headerHeight
  - footerHeight
  - paddingTop
  - paddingBottom
```

---

# 5. Frontend Architecture

## 5.1 Component Structure

```
EditorShell (position: relative)
 ├── PagesOverlay (absolute, pointer-events: none)
 └── TiptapEditor (single instance)
```

---

## 5.2 EditorShell Responsibilities

* Center page
* Provide relative positioning context
* Apply width constraints

---

## 5.3 Tiptap Editor

* Single editor instance
* Continuous document
* No document splitting
* Content width = PAGE_WIDTH
* Horizontal padding = paddingX
* Top padding = contentTopOffset

---

## 5.4 Overlay Layer

Overlay is absolutely positioned over editor.

```css
.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
```

Overlay renders:

For each page:

* A page rectangle
* Header container
* Footer container
* Page number

---

# 6. Pagination Algorithm (Editor Mode)

## 6.1 Trigger Conditions

Recalculate pagination when:

* Editor updates (`editor.on('update')`)
* Window resize
* Fonts loaded (`document.fonts.ready`)
* Images load
* Page config changes

Use debounced `requestAnimationFrame`.

---

## 6.2 Measurement Strategy

1. Select `.ProseMirror` container
2. Collect top-level block elements
3. For each block:

   * getBoundingClientRect()
   * calculate relative Y to editor container
   * measure height

---

## 6.3 Break Rule (v1 Simplified)

Break only **between top-level blocks**.

Do NOT split:

* Paragraphs
* Tables
* Lists

Algorithm:

```
currentPage = 1
currentHeight = 0

for each block:
  if currentHeight + block.height > contentUsableHeight:
      start new page
      currentHeight = 0

  assign block to currentPage
  currentHeight += block.height
```

---

## 6.4 Overlay Output

`usePagination()` returns:

```ts
{
  pageCount: number
  pageBreakOffsets: number[]
}
```

Overlay renders:

* Page rectangles at:
  y = index * (PAGE_HEIGHT + PAGE_GAP)

* Page number = index + 1

---

# 7. Header & Footer Strategy

## 7.1 Editor Mode

Header/Footer are:

* Fixed height containers
* Rendered in overlay
* Not part of document JSON

Supports:

* Static text
* Dynamic variables (title, date)
* Page number

---

## 7.2 Export Mode

Export wraps content into:

```html
<section class="page">
  <header>...</header>
  <main>...</main>
  <footer>Page X</footer>
</section>
```

---

# 8. Supabase Integration

Table: `templates`

```
id uuid
name text
content jsonb
created_at
updated_at
```

Store:

* Full ProseMirror JSON in `content`

Example save:

```ts
const json = editor.getJSON()

await supabase
  .from('templates')
  .update({ content: json })
  .eq('id', templateId)
```

---

# 9. PDF Export via Puppeteer

## 9.1 API Route

`POST /api/export`

Payload:

```
{
  templateId
}
```

---

## 9.2 Export Steps

1. Fetch JSON from Supabase
2. Convert JSON → HTML
3. Inject pagination script
4. Puppeteer loads HTML
5. Script paginates into page sections
6. Puppeteer generates PDF

---

## 9.3 Puppeteer Config

```ts
await page.pdf({
  format: 'A4',
  printBackground: true,
  margin: {
    top: '0mm',
    right: '0mm',
    bottom: '0mm',
    left: '0mm'
  }
})
```

---

## 9.4 Print CSS

```css
@page {
  size: A4;
  margin: 0;
}

.page {
  width: 210mm;
  height: 297mm;
  page-break-after: always;
}
```

---

# 10. Folder Structure (Recommended)

```
/editor
  /components
    EditorShell.tsx
    PagesOverlay.tsx
  /hooks
    usePagination.ts
  /config
    pageConfig.ts

/app/api/export/route.ts

/lib
  renderToHtml.ts
  paginateForExport.ts
```

---

# 11. Known Limitations (v1)

* No paragraph splitting across pages
* Large tables may overflow
* Slight visual differences between editor and export
* Zoom level may affect overlay precision

---

# 12. Future Enhancements

* Table row splitting
* Widow/orphan control
* True block splitting
* Drag-adjustable margins
* Template-based header/footer editing
* Page break node support (manual override)

---

# 13. Non-Goals

* Multiple editor instances
* Canvas-based rendering
* Rebuilding Word-level layout engine
* DOM mutation during editing for pagination

---

# 14. Summary

This architecture provides:

* Stable editing experience
* Word-like A4 visual layout
* Deterministic A4 PDF export
* Clean separation of concerns
* Scalable structure for future improvements

Single editor.
Overlay pagination.
Hybrid px/mm.
Puppeteer export.
JSON in Supabase.

