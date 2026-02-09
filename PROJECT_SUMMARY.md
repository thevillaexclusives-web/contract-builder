Here’s a **clean, complete feature summary** of everything you’ve shared so far, written so you can reuse it as **project scope / product + engineering alignment** (and feed it to Cursor if needed).

---

# 📄 Contract Builder – Feature Summary

## 🎯 Core Goal

Build a **legal-grade contract builder** that allows users to create reusable contract templates, generate contracts from those templates, fill in structured fields, and export **1:1 accurate PDFs** with recurring footers and pages.

---

## 🧱 Core Concepts

### 1️⃣ Templates

* Reusable contract blueprints
* Created and edited in a rich editor
* Contain:

  * Static contract text
  * Tables
  * Structured placeholder fields (not plain text)
* Stored as **TipTap JSON**
* Can define:

  * Default layout (margins, spacing, fonts)
  * Footer/header configuration

---

### 2️⃣ Contracts

* Derived from a template
* Same document structure as template
* All placeholder fields are filled with real values
* No string replacement or HTML duplication
* Stored as **resolved TipTap JSON**
* Can be:

  * Draft
  * Finalized
  * Exported to PDF

---

### 3️⃣ Structured Fields (Key Feature)

* Fields are **custom editor nodes**
* Not CSS underlines or text tokens
* Each field has:

  * Unique ID
  * Label / type
  * Value (empty in templates, filled in contracts)
* Behavior changes by mode:

  * **Template mode:** underline / placeholder
  * **Contract mode:** editable value
  * **PDF export:** resolved text only

---

## ✍️ Editor Capabilities

* Rich text editing with full formatting control
* Users build their own structure (headings, paragraphs, lists) - no complex component blocks
* Tables (for clauses, pricing, schedules)
* Adjustable:

  * Margins
  * Spacing
  * Font family
  * Font size
* Field insertion & management
* Multiple modes:

  * Template
  * Contract
  * Read-only

---

## 📦 Data Model & Persistence

* **Single source of truth:** TipTap JSON
* No HTML stored in DB
* Stored using **Supabase (Postgres JSONB)**
* Foundation supports versioning (not implemented initially, but schema designed for it)
* Audit trail capability built into data model

---

## 📄 PDF Export (Critical Requirement)

* Export must be **1:1 with editor layout**
* No browser printing
* No HTML-to-PDF libraries
* PDFs generated using **PDFMake**
* PDF generation:

  * Runs outside the editor (server-side API route)
  * Uses TipTap JSON → PDF mapping
  * Deterministic output

### PDF Export Pattern (1:1 Accuracy)

**Core Principle:** Map TipTap JSON structure directly to PDFMake document definition, preserving all formatting and layout.

**Implementation Pattern:**

1. **Font Matching**
   * Load same fonts used in editor into PDFMake
   * Map editor font families to PDFMake font definitions
   * Ensure font metrics match (size, line-height, spacing)

2. **Layout Preservation**
   * Extract margins, spacing, and layout settings from TipTap JSON
   * Apply identical measurements to PDFMake document definition
   * Use PDFMake's `margin`, `pageMargins`, and `pageSize` for exact matching

3. **Content Mapping**
   * **Paragraphs/Text**: Map TipTap text nodes → PDFMake `text` blocks with matching styles
   * **Headings**: Preserve font size, weight, spacing → PDFMake `text` with `fontSize`, `bold`
   * **Tables**: Map TipTap table structure → PDFMake `table` with matching column widths and cell styles
   * **Fields**: Replace field nodes with resolved values → PDFMake `text` blocks

4. **Styling Translation**
   * Map TipTap marks (bold, italic, underline) → PDFMake text styles
   * Preserve font sizes, colors, alignment
   * Convert line-height and spacing to PDFMake equivalents

5. **Page Break Handling**
   * Use PDFMake's automatic pagination for natural breaks
   * Respect manual page breaks from editor
   * Calculate page breaks based on content height + margins + footer height

6. **Recurring Footers**
   * Define footer in PDFMake `header`/`footer` functions
   * Access page numbers via PDFMake's page context
   * Apply footer to all pages (or conditionally for last page)

**Example Structure:**
```typescript
// TipTap JSON → PDFMake mapping
function mapTipTapToPDFMake(tiptapJSON: TipTapJSON, options: PDFOptions) {
  const docDefinition = {
    pageSize: options.pageSize,
    pageMargins: options.margins,
    defaultStyle: {
      font: options.fontFamily,
      fontSize: options.fontSize,
      lineHeight: options.lineHeight,
    },
    content: tiptapJSON.content.map(node => mapNode(node)),
    footer: (currentPage: number, pageCount: number) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: 'center',
      margin: [0, 10, 0, 0],
    }),
  };
  return docDefinition;
}
```

**Key Requirements:**
* Measure actual content dimensions, don't estimate
* Use consistent units (points/inches) throughout
* Test PDF output against editor preview for 1:1 matching
* Handle edge cases (long words, table overflow, etc.)

---

## 🧾 Recurring Footers & Pages

* Native support for:

  * Page numbers (`Page X of Y`)
  * Contract title on every page
  * Legal disclaimers
  * Dynamic footer content
* Footers are:

  * Configurable per template or contract
  * Generated at PDF level (not in editor content)
* Support for:

  * Signature pages
  * Appendices
  * Last-page-only content

## 📐 Pagination & Page Breaks

**Core Principle:** Measure, don't estimate. Use real DOM measurements for accurate pagination.

**Implementation Approach:**

* **Real-time Measurement**
  * Use ResizeObserver to measure actual content heights
  * Calculate page breaks based on measured content + margins + footer height
  * Cache measurements to avoid recalculation on every render

* **Page Break Calculation**
  * Measure each content block's actual rendered height
  * Account for margins, spacing, and padding
  * Calculate cumulative height to determine page boundaries
  * Handle edge cases (orphaned headings, table splits)

* **Manual Page Breaks**
  * Support manual page break insertion in editor
  * Store as special node type in TipTap JSON
  * Respect manual breaks during PDF generation

* **Footer Height Consideration**
  * Measure actual footer height (not estimate)
  * Subtract footer height from available page height
  * Account for footer in page break calculations

**Avoid:**
* ❌ Hardcoded height estimates
* ❌ Guessing content dimensions
* ❌ Complex recursive estimation logic

**Do Instead:**
* ✅ Real DOM measurements
* ✅ ResizeObserver for dynamic content
* ✅ Cached measurements for performance

---

## 🧩 Architecture Summary

```
Next.js (App Router)
├─ Client Components
│   ├─ TipTap Editor
│   │    ├─ Rich text, tables, styles
│   │    └─ Custom Field nodes (placeholders)
│   ├─ Template Editor UI
│   ├─ Contract Editor UI
│   └─ Role-aware UI (Supabase Auth)
│
├─ Server Components / Server Actions
│   ├─ Load templates & contracts
│   ├─ Validate editor JSON
│   └─ Enforce role-based access
│
├─ API Routes (Server-side)
│   ├─ /api/templates
│   ├─ /api/contracts
│   └─ /api/export (PDF generation)
│
├─ Supabase
│   ├─ Auth (users, sessions, roles)
│   ├─ Postgres (JSONB for documents)
│   ├─ Row Level Security (RLS)
│   └─ Storage (optional PDF persistence)
│
└─ PDF Generation (Server-only)
    ├─ TipTap JSON → PDF mapping layer
    └─ PDFMake (deterministic layout, footers, pages)
```

---

## 🚫 Explicit Non-Features (by design)

* No HTML as source of truth
* No string-based placeholders
* No CSS-based PDF layout
* No browser printing
* No WYSIWYG hacks

---

## 🔄 Template → Contract Conversion Flow

**Core Concept:** Same editor, different node rendering based on mode.

**Implementation Approach:**

1. **Template Mode**
   * Field nodes render as placeholders (underlines/visual indicators)
   * Fields are editable (can rename, delete, reposition)
   * Field values are empty or contain default placeholders

2. **Contract Creation**
   * Load template JSON into editor
   * Switch editor mode to "contract" mode
   * Field nodes automatically render as editable inputs (not placeholders)
   * User fills in field values directly in the editor

3. **Field Node Behavior**
   * **Template mode**: Field node renders as `<span class="field-placeholder">________</span>` or similar
   * **Contract mode**: Field node renders as `<input>` or contenteditable element
   * **Read-only mode**: Field node renders as resolved text value
   * Same JSON structure, different rendering based on editor mode

4. **Mode Switching**
   * Editor accepts `mode` prop: `'template' | 'contract' | 'readonly'`
   * Field node's `renderHTML()` or `addNodeView()` checks mode
   * Conditional rendering based on mode + field value state

5. **Data Persistence**
   * Template: Stores JSON with field nodes (values empty or placeholder)
   * Contract: Stores JSON with field nodes (values filled)
   * No string replacement or data transformation needed
   * Same schema, different data state

**Example Flow:**
```
Template JSON: { type: 'field', attrs: { id: 'tenant-name', value: '' } }
  ↓ (user creates contract)
Contract JSON: { type: 'field', attrs: { id: 'tenant-name', value: 'John Doe' } }
  ↓ (PDF export)
PDF Text: "John Doe" (field node resolved to text)
```

**Key Benefits:**
* No data transformation between template and contract
* Same editor codebase for both modes
* Type-safe field handling
* Easy to add new field types

## 🧠 Design Principles

* Contracts are **structured data**, not formatted text
* Editor is **not** the source of truth — JSON is
* PDF output must be deterministic and legally reliable
* Templates and contracts share one schema
* **Measure, don't estimate** - Use real DOM measurements for pagination
* **Functionality over form** - Focus on making it work reliably first

---

## ✅ Final One-Line Summary

> A structured contract builder using TipTap JSON templates, custom placeholder fields, Supabase auth & storage, and PDFMake for deterministic 1:1 PDF exports with recurring footers and pages.