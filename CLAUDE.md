# CLAUDE.md

# A4 Auto-Flow Document Editor – System Rules

This project implements a **Word-like A4 document editor** using:

* Next.js (App Router)
* Tiptap (single editor instance)
* Supabase (`templates.content` as jsonb)
* Overlay-based pagination (visual only)
* Puppeteer for deterministic A4 PDF export

Claude must strictly follow the architectural constraints defined below.

---

# 1. Core Architectural Principles

## 1.1 Single Editor Rule (Critical)

There must only ever be **ONE Tiptap instance**.

Pagination is purely a **visual overlay concern**.

Claude must NEVER:

* Create multiple Tiptap instances
* Split the document into per-page editors
* Mutate document structure for pagination
* Insert automatic page break nodes during editing

---

## 1.2 Pagination Is Visual (Editor Mode)

Pagination in editor mode is implemented using:

* A continuous ProseMirror document
* An absolutely positioned overlay layer
* Measured block heights
* Virtual page boundaries

The document JSON remains untouched.

---

## 1.3 Hybrid Unit System

| Context    | Units |
| ---------- | ----- |
| Editor UI  | px    |
| PDF Export | mm    |

Editor layout uses px for stable DOM measurement.

PDF export uses `@page { size: A4 }` and mm-based dimensions.

Claude must never mix px logic into export layout or mm logic into editor measurement.

---

# 2. Page Geometry (A4 Constraints)

A4 Dimensions:

* 210mm × 297mm

Editor px mapping:

```
PAGE_WIDTH  = 794px
PAGE_HEIGHT = 1123px
PAGE_GAP    = 24px
```

Layout configuration:

```
paddingX      = 64px
paddingTop    = 24px
paddingBottom = 24px
headerHeight  = 96px
footerHeight  = 72px
```

Derived:

```
contentTopOffset =
  paddingTop + headerHeight

contentUsableHeight =
  PAGE_HEIGHT
  - headerHeight
  - footerHeight
  - paddingTop
  - paddingBottom
```

Claude must not change these values unless explicitly instructed.

---

# 3. Pagination Algorithm (Editor Mode)

Pagination works as follows:

1. Select `.ProseMirror` container.
2. Collect top-level block nodes.
3. Measure each block's height using `getBoundingClientRect()`.
4. Accumulate height until `contentUsableHeight` is exceeded.
5. Start new page when overflow occurs.
6. Only break between top-level blocks.

Important:

* Paragraphs are NOT split.
* Tables are NOT split.
* Lists are treated as atomic blocks.
* No DOM restructuring occurs.

Claude must never implement paragraph splitting or table row splitting unless explicitly requested.

---

# 4. Overlay Rendering Rules

Overlay layer must:

* Be absolutely positioned
* Use `pointer-events: none`
* Not intercept selection or cursor
* Not modify editor DOM

Overlay renders:

* Page rectangles
* Header container
* Footer container
* Page numbers
* Optional boundary lines

Overlay must be pure UI.

---

# 5. Header & Footer Rules

## 5.1 Editor Mode

Header/Footer:

* Are NOT part of document JSON
* Rendered via overlay
* Fixed height
* Page numbers are derived from page index

## 5.2 Export Mode

Export wraps content into:

```
<section class="page">
  <header>...</header>
  <main>...</main>
  <footer>Page X</footer>
</section>
```

Claude must not rely on CSS margin boxes or experimental print features.

---

# 6. Supabase Storage

Table: `templates`

```
id uuid
content jsonb
```

Store full ProseMirror JSON via:

```
editor.getJSON()
```

Claude must never store HTML as source of truth.

---

# 7. PDF Export (Puppeteer)

Export pipeline:

1. Fetch JSON from Supabase
2. Convert JSON → HTML
3. Load HTML into Puppeteer
4. Execute pagination logic inside headless Chromium
5. Wrap content into page sections
6. Generate PDF with:

```
format: 'A4'
printBackground: true
margin: 0
```

Claude must not:

* Screenshot the editor
* Attempt canvas-based PDF
* Attempt client-side PDF rendering

Export must always be Chromium-based.

---

# 8. Recalculation Triggers (Editor Mode)

Pagination must re-run when:

* Editor updates
* Window resizes
* Fonts finish loading
* Images load
* Page configuration changes

Must use debounced `requestAnimationFrame`.

Claude must not introduce heavy synchronous layout loops.

---

# 9. Folder Responsibilities

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

Responsibilities:

* `usePagination` → measurement + page math only
* `PagesOverlay` → rendering only
* `renderToHtml` → JSON to static HTML
* `paginateForExport` → wrap blocks into page sections
* API route → Puppeteer orchestration

Claude must respect separation of concerns.

---

# 10. Non-Negotiable Constraints

Claude must NEVER:

* Use multiple editors
* Inject page breaks into the live document automatically
* Modify document structure for visual pagination
* Use canvas for layout
* Use client-only PDF generation
* Split paragraphs mid-line
* Break tables across pages (v1)
* Rely on browser print preview for logic validation

---

# 11. Acceptable Simplifications (v1)

* Only break between blocks
* Tables may overflow to next page
* Minor pixel mismatch between editor and export is acceptable
* No widow/orphan control

---

# 12. When Making Changes

Before implementing any feature related to layout, Claude must:

1. Determine if change affects editor-only or export-only.
2. Ensure document JSON remains untouched.
3. Maintain deterministic export behavior.
4. Maintain single-editor constraint.

---

# 13. System Summary

This system is:

* Continuous document model
* Overlay-based virtual pagination
* Hybrid px/mm unit strategy
* Deterministic A4 Puppeteer export
* Supabase JSON-backed

It is NOT:

* A true Word layout engine
* A multi-editor system
* A DOM-splitting pagination engine