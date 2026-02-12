# Contract Editor - Project Documentation

This document provides a comprehensive overview of the Contract Editor project, including the tech stack, architecture decisions, coding standards, and implementation patterns.

---

## 📋 Project Overview

**Contract Editor** is a legal-grade contract builder application that enables users to:
- Create reusable contract templates with rich text editing
- Generate contracts from templates with structured fillable fields
- Export contracts to 1:1 accurate PDFs with proper pagination
- Manage templates and contracts with full CRUD operations

### Core Value Proposition
- **Template-based workflow**: Create once, reuse many times
- **Structured fields**: Custom editor nodes (not string placeholders) for reliable PDF export
- **1:1 PDF accuracy**: PDF output matches editor layout exactly
- **Rich editing**: Full formatting control without complex component systems

---

## 🛠 Tech Stack

### Frontend Framework
- **Next.js 15.2.3** (App Router)
  - Server Components by default
  - Client Components only when needed (`'use client'`)
  - Server Actions for mutations
  - API Routes for external integrations

### Rich Text Editor
- **TipTap 2.8.0** (built on ProseMirror)
  - Custom node extensions for fields
  - JSON as source of truth (not HTML)
  - Mode-based rendering (template/contract/readonly)

### UI Framework
- **shadcn/ui** (Radix UI primitives)
  - Accessible component primitives
  - Tailwind CSS for styling
  - Custom components in `/components/ui`

### Styling
- **Tailwind CSS 3.4.17**
  - Utility-first CSS
  - Custom design tokens via CSS variables
  - `@tailwindcss/typography` plugin
  - `tailwindcss-animate` for animations

### Backend & Database
- **Supabase**
  - PostgreSQL with JSONB for document storage
  - Row Level Security (RLS) for access control
  - Authentication via `@supabase/ssr`
  - Server-side and client-side clients

### PDF Generation
- **PDFMake 0.2.12**
  - Server-side PDF generation
  - JSON-based document definition
  - Custom mapper from TipTap JSON to PDFMake

### Type Safety
- **TypeScript 5.7.3**
  - Strict mode enabled
  - Generated types from Supabase
  - Custom types in `/types` directory

### Additional Libraries
- **lucide-react**: Icon library
- **zod**: Schema validation
- **date-fns**: Date utilities
- **clsx** + **tailwind-merge**: Conditional class utilities

---

## 🏗 Architecture Decisions

### 1. JSON as Single Source of Truth
- **Never store HTML** - only TipTap JSON
- All content stored as JSONB in PostgreSQL
- PDF export maps JSON directly (no HTML parsing)

### 2. Custom Field Nodes (Not String Placeholders)
- Fields are **TipTap node extensions**, not CSS underlines or text tokens
- Each field has structured attributes: `id`, `label`, `value`, `type`
- Mode-based rendering:
  - **Template mode**: Placeholder with underline
  - **Contract mode**: Editable input
  - **Read-only mode**: Plain text

### 3. Server Components by Default
- Use Server Components unless interactivity is required
- Client Components only for:
  - Editor components
  - Interactive UI (dropdowns, modals)
  - Real-time updates

### 4. Minimal State Management
- Avoid complex state management libraries
- Use React hooks (`useState`, `useEffect`, `useCallback`)
- TipTap editor manages its own state
- Server state via Supabase queries

### 5. No HTML-to-PDF
- **Never use browser printing** or HTML-to-PDF libraries
- PDF generation via PDFMake server-side
- Direct JSON-to-PDF mapping for accuracy

---

## 📐 Coding Standards

### File Naming
- **kebab-case** for component files: `field-node.ts`, `page-pagination.tsx`
- **PascalCase** for React components: `FieldNode`, `PagePagination`
- **camelCase** for utilities: `mapTipTapToPDFMake`, `usePagination`

### Component Structure
```typescript
'use client' // Only if needed

import { ... } from '...'

interface ComponentProps {
  // Props definition
}

export function Component({ prop }: ComponentProps) {
  // Implementation
}
```

### Type Safety
- **No `any` types** - use proper TypeScript types
- Define nested types separately (not inline)
- Use Supabase generated types from `/types/database.ts`
- Create domain types in `/types` (e.g., `contract.ts`, `editor.ts`)

### React Hooks Rules
- **Always call hooks unconditionally** - no hooks after early returns
- Use `useCallback` for memoized functions passed as props
- Use `useEffect` for side effects, cleanup properly

### Error Handling
- Explicit error types: `catch (error: unknown)`
- Check `error instanceof Error` before accessing properties
- Provide user-friendly error messages

### API Routes
- Use Next.js 15 async params: `params: Promise<{ id: string }>`
- Await params: `const { id } = await params`
- Explicit type assertions for Supabase operations when needed
- Use `@ts-ignore` sparingly and document why

---

## 🎨 Design Principles

### 1. Functionality Over Form
- Simple, functional UI over complex interactions
- Avoid Notion-style editor complexity
- Focus on contract creation, not editor polish

### 2. Measure, Don't Estimate
- Use real DOM measurements for pagination
- ResizeObserver for dynamic content
- No hardcoded height estimates

### 3. Single Source of Truth
- TipTap JSON is the only content format
- No duplicate state
- No manual syncing between formats

### 4. Type Safety First
- Avoid `any` types
- Use proper TypeScript types
- Leverage Supabase generated types

### 5. Server-First Architecture
- Prefer Server Components
- Use Server Actions for mutations
- Minimize client-side JavaScript

---

## 📁 Project Structure

```
contract-editor/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Auth routes
│   ├── (dashboard)/             # Protected routes
│   │   ├── contracts/           # Contract pages
│   │   └── templates/           # Template pages
│   ├── api/                     # API routes
│   │   ├── contracts/           # Contract API
│   │   ├── templates/           # Template API
│   │   └── export/              # PDF export API
│   └── globals.css              # Global styles
│
├── components/
│   ├── contract-editor/         # Editor components
│   │   ├── Editor.tsx           # Main editor component
│   │   ├── Toolbar.tsx          # Editor toolbar
│   │   ├── extensions/          # TipTap extensions
│   │   └── ...                  # Editor UI components
│   ├── ui/                      # shadcn/ui components
│   └── Header.tsx               # App header
│
├── hooks/
│   └── usePagination.ts         # Pagination logic
│
├── lib/
│   ├── pdf/                     # PDF generation
│   │   ├── mapper.ts            # TipTap → PDFMake
│   │   └── fonts.ts             # Font definitions
│   ├── supabase/                # Supabase clients
│   │   ├── client.ts            # Browser client
│   │   ├── server.ts            # Server client
│   │   └── middleware.ts        # Middleware client
│   └── utils/                   # Utilities
│
├── types/                       # TypeScript types
│   ├── database.ts              # Supabase types
│   ├── contract.ts              # Contract types
│   └── editor.ts                 # Editor types
│
└── docs/                        # Documentation
    ├── PROJECT_SUMMARY.md       # Project overview
    ├── ANTI_PATTERNS.md         # What to avoid
    └── ...                      # Other docs
```

---

## 🚫 Anti-Patterns to Avoid

### 1. Complex State Management
- ❌ Multiple state sources
- ❌ Manual syncing between state and props
- ✅ Single source of truth (TipTap JSON)

### 2. Overuse of useEffect
- ❌ Multiple effects for related logic
- ❌ Effects that should be event handlers
- ✅ Prefer event handlers and memoization

### 3. String-Based Fields
- ❌ CSS underlines as placeholders
- ❌ String replacement for fields
- ✅ Custom TipTap node extensions

### 4. Estimated Pagination
- ❌ Hardcoded height estimates
- ❌ Guessing content dimensions
- ✅ Real DOM measurements (ResizeObserver)

### 5. HTML as Source of Truth
- ❌ Storing HTML in database
- ❌ HTML-to-PDF conversion
- ✅ JSON storage, direct PDF mapping

### 6. Type Safety Violations
- ❌ `any` types
- ❌ Inline complex types
- ✅ Proper TypeScript types, separate type definitions

---

## 🔧 Development Workflow

### Setup
1. Install dependencies: `yarn install`
2. Set up environment variables (`.env.local`)
3. Run dev server: `yarn dev` (port 3005)

### Code Quality
- Run linter: `yarn lint`
- Fix linting errors before committing
- TypeScript strict mode enabled

### Build
- Production build: `yarn build`
- Start production: `yarn start`

### Key Commands
```bash
yarn dev          # Development server (port 3005)
yarn build        # Production build
yarn start        # Production server
yarn lint         # Run ESLint
```

---

## 📚 Key Concepts

### Templates vs Contracts
- **Templates**: Reusable blueprints with placeholder fields
- **Contracts**: Instances derived from templates with filled fields
- Same JSON structure, different field values

### Editor Modes
- **Template mode**: Create/edit templates, fields show as placeholders
- **Contract mode**: Fill fields, only fields are editable
- **Read-only mode**: View-only, no editing

### Field Nodes
- Custom TipTap extension (`FieldNode`)
- Structured data: `{ id, label, value, type }`
- Mode-based rendering via NodeView
- Direct mapping to PDF (no string parsing)

### PDF Export
- Server-side generation via PDFMake
- TipTap JSON → PDFMake document definition
- 1:1 layout accuracy
- Handles pagination, footers, page breaks

---

## 🔐 Authentication

- Supabase Auth with SSR support
- Token-based redirect from legacy app
- Row Level Security (RLS) for data access
- Server-side and client-side auth clients

---

## 📝 Notes for AI Assistants

### When Making Changes
1. **Always check existing patterns** - follow established conventions
2. **Maintain type safety** - avoid `any`, use proper types
3. **Server Components first** - only use `'use client'` when needed
4. **Follow file naming** - kebab-case for files, PascalCase for components
5. **Read anti-patterns doc** - avoid documented mistakes

### Common Patterns
- API routes: `await params`, explicit types
- Editor: TipTap JSON, custom nodes for fields
- PDF: Direct JSON mapping, no HTML parsing
- State: Minimal, prefer server state

### Testing Considerations
- Test with real content (not placeholders)
- Verify PDF output matches editor
- Check pagination with long content
- Test field insertion and editing

---

## 📖 Additional Documentation

- `docs/PROJECT_SUMMARY.md` - Detailed project overview
- `docs/ANTI_PATTERNS.md` - What to avoid
- `docs/FIELD_NODES_EXPLAINED.md` - Field node architecture
- `docs/SETUP_GUIDE.md` - Setup instructions

---

**Last Updated**: 2025-02-09
**Next.js Version**: 15.2.3
**TipTap Version**: 2.8.0
