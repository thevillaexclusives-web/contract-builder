# Quick Start Checklist

Follow these steps in order to get your Next.js contract editor up and running.

## ✅ Step-by-Step Execution

### 1. Create Next.js Project
```bash
npx create-next-app@latest contract-editor --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
cd contract-editor
```

### 2. Install Dependencies
```bash
# Core editor
yarn add @tiptap/react @tiptap/starter-kit @tiptap/extension-text-style @tiptap/extension-font-family @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header

# PDF generation
yarn add pdfmake

# Supabase
yarn add @supabase/supabase-js @supabase/ssr

# Utilities (required by shadcn/ui)
yarn add zod date-fns class-variance-authority clsx tailwind-merge

# Dev dependencies
yarn add -D @types/pdfmake
```

### 2b. Initialize shadcn/ui
```bash
# Initialize shadcn/ui
npx shadcn@latest init

# Install common components
npx shadcn@latest add button card input label dialog dropdown-menu table toast form
```

### 3. Set Up Environment Variables
```bash
# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

### 4. Create Directory Structure
```bash
mkdir -p app/{api/{templates,contracts,export},\(auth\)/login,\(dashboard\)/{templates,contracts}}
mkdir -p components/{contract-editor/{extensions},templates,contracts,ui}
mkdir -p lib/{supabase,pdf,utils}
mkdir -p hooks types
```

### 5. Copy Configuration Files
- Copy `next.config.js` from SETUP_GUIDE.md
- Copy Supabase client files from SETUP_GUIDE.md
- Copy `middleware.ts` from SETUP_GUIDE.md

### 6. Generate Types
```bash
# Option 1: Using Supabase CLI
supabase gen types typescript --linked > types/database.ts

# Option 2: Copy from existing project
# Copy from thevillaexclusive/src/types/supabase.ts
```

### 7. Verify Setup
```bash
npm run dev
# Should start on http://localhost:3000
```

### 8. Test Database Connection
Create a simple test page to verify Supabase connection works.

---

## 🎯 First Code to Write

1. **Basic Editor Component** (`components/contract-editor/Editor.tsx`)
2. **Custom Field Extension** (`components/contract-editor/extensions/field.ts`)
3. **Template API Route** (`app/api/templates/route.ts`)
4. **Template List Page** (`app/(dashboard)/templates/page.tsx`)

---

## 📝 Notes

- Start with the simplest possible implementation
- Test each piece as you build it
- Refer to SETUP_GUIDE.md for detailed explanations
- Keep ANTI_PATTERNS.md and PROJECT_SUMMARY.md handy
