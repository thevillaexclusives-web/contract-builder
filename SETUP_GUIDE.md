# Contract Editor - Next.js Setup Guide

This guide walks you through setting up the new Next.js application for the Contract Builder feature.

---

## 📋 Prerequisites

- Node.js 18+ installed
- yarn package manager
- Supabase project with contract builder tables already set up
- Git repository initialized

---

## 🚀 Step 1: Initialize Next.js Project

### Create Next.js App with TypeScript

```bash
# Create Next.js app with TypeScript and App Router
npx create-next-app@latest contract-editor --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"

cd contract-editor
```

**Options selected:**
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ ESLint
- ✅ App Router (not Pages Router)
- ✅ No `src/` directory (root-level app directory)
- ✅ Import alias `@/*`

---

## 📦 Step 2: Install Core Dependencies

### Editor & Rich Text
```bash
yarn add @tiptap/react @tiptap/starter-kit @tiptap/extension-text-style @tiptap/extension-font-family @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
```

### PDF Generation
```bash
yarn add pdfmake
```

### Supabase Client
```bash
yarn add @supabase/supabase-js @supabase/ssr
```

### UI Framework (shadcn/ui)
```bash
# shadcn/ui will be initialized after project setup
# See Step 7 for shadcn/ui initialization
```

### Utilities
```bash
yarn add zod  # For schema validation (also required by shadcn/ui)
yarn add date-fns  # For date formatting
yarn add class-variance-authority clsx tailwind-merge  # Required by shadcn/ui
```

### Development Dependencies
```bash
yarn add -D @types/pdfmake
```

---

## 🗂️ Step 3: Project Structure

Create the following directory structure:

```
contract-editor/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── login/
│   │   └── page.tsx
│   ├── (dashboard)/              # Dashboard route group
│   │   ├── templates/
│   │   │   ├── page.tsx          # Templates list
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx      # Template editor
│   │   │   │   └── edit/
│   │   │   │       └── page.tsx  # Edit template
│   │   ├── contracts/
│   │   │   ├── page.tsx          # Contracts list
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Contract editor
│   │   │       └── edit/
│   │   │           └── page.tsx  # Edit contract
│   │   └── layout.tsx             # Dashboard layout
│   ├── api/
│   │   ├── templates/
│   │   │   ├── route.ts          # GET, POST templates
│   │   │   └── [id]/
│   │   │       └── route.ts      # GET, PUT, DELETE template
│   │   ├── contracts/
│   │   │   ├── route.ts          # GET, POST contracts
│   │   │   └── [id]/
│   │   │       └── route.ts      # GET, PUT, DELETE contract
│   │   └── export/
│   │       └── [id]/
│   │           └── route.ts      # POST - Generate PDF
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                  # Home/redirect page
│
├── components/
│   ├── contract-editor/          # Contract editor components
│   │   ├── Editor.tsx            # Main TipTap editor wrapper
│   │   ├── Toolbar.tsx           # Editor toolbar
│   │   ├── FieldNode.tsx         # Custom field node component
│   │   └── extensions/           # TipTap extensions
│   │       ├── field.ts           # Field node extension
│   │       └── index.ts
│   ├── templates/                 # Template-specific components
│   │   ├── TemplateList.tsx
│   │   ├── TemplateCard.tsx
│   │   └── TemplateForm.tsx
│   ├── contracts/                # Contract-specific components
│   │   ├── ContractList.tsx
│   │   ├── ContractCard.tsx
│   │   └── ContractForm.tsx
│   └── ui/                        # Shared UI components
│       ├── Button.tsx
│       └── Card.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts              # Server client
│   │   └── middleware.ts          # Middleware client
│   ├── pdf/
│   │   ├── mapper.ts              # TipTap JSON → PDFMake mapper
│   │   ├── fonts.ts               # Font definitions
│   │   └── generator.ts          # PDF generation logic
│   └── utils/
│       ├── cn.ts                  # Class name utility
│       └── types.ts               # Shared types
│
├── hooks/                         # Custom React hooks
│   ├── useEditor.ts               # TipTap editor hook
│   ├── useTemplates.ts            # Templates data fetching
│   ├── useContracts.ts            # Contracts data fetching
│   └── usePDFExport.ts            # PDF export hook
│
├── types/                         # TypeScript types
│   ├── database.ts                # Supabase generated types
│   ├── editor.ts                  # TipTap/editor types
│   └── contract.ts                # Contract domain types
│
├── .env.local                     # Environment variables (gitignored)
├── .env.example                   # Example env file
├── next.config.js                 # Next.js config
├── tailwind.config.ts             # Tailwind config
├── tsconfig.json                  # TypeScript config
└── package.json
```

---

## ⚙️ Step 4: Configuration Files

### `.env.local` (Create this file)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # For server-side operations

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### `.env.example` (Create this file)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb', // For large contract JSON
    },
  },
  // Enable PDFMake fonts
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
}

module.exports = nextConfig
```

### `tsconfig.json` (Update paths)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 🔧 Step 5: Supabase Setup

### Create `lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Create `lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
```

### Create `lib/supabase/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it so that the
  // middleware never runs.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser to create a new
  // session, which will break the auth flow.

  return supabaseResponse
}
```

### Create `middleware.ts` (root level)

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

## 📝 Step 6: Generate Supabase Types

### Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

### Generate Types

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Generate types
supabase gen types typescript --linked > types/database.ts
```

**Or manually:** Copy types from your existing `thevillaexclusive/src/types/supabase.ts` and adapt to the new structure.

---

## 🎨 Step 7: shadcn/ui Setup

### Initialize shadcn/ui

```bash
# Initialize shadcn/ui (interactive CLI)
npx shadcn@latest init

# When prompted, select:
# - Would you like to use TypeScript? Yes
# - Which style would you like to use? Default
# - Which color would you like to use as base color? Slate
# - Where is your global CSS file? app/globals.css
# - Would you like to use CSS variables for colors? Yes
# - Where is your tailwind.config.js located? tailwind.config.ts
# - Configure the import alias for components? @/components
# - Configure the import alias for utils? @/lib/utils
```

### Install Common Components

```bash
# Install commonly used components
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add table
npx shadcn@latest add toast
npx shadcn@latest add form
```

**Note:** shadcn/ui uses `npx` to add components, which doesn't require yarn/npm install. Components are copied directly into your project.

### `app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Contract Editor',
  description: 'Legal contract builder and editor',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
```

**Note:** shadcn/ui components will be available in `components/ui/` directory after initialization.

---

## ✅ Step 8: Verification Checklist

- [ ] Next.js app created and runs (`yarn dev`)
- [ ] All dependencies installed
- [ ] shadcn/ui initialized and components installed
- [ ] Environment variables set up
- [ ] Supabase clients created (browser, server, middleware)
- [ ] Middleware configured
- [ ] Project structure created
- [ ] TypeScript types generated
- [ ] Basic layout renders
- [ ] shadcn/ui components accessible in `components/ui/`

---

## 🚦 Step 9: First Implementation Steps

### Phase 1: Foundation (Week 1)

1. **Set up TipTap Editor**
   - Create basic editor component
   - Configure starter kit extensions
   - Test basic rich text editing

2. **Create Custom Field Node**
   - Implement TipTap field node extension
   - Add field insertion UI
   - Test field rendering in template mode

3. **Database Integration**
   - Create API routes for templates (GET, POST)
   - Create API routes for contracts (GET, POST)
   - Test CRUD operations

### Phase 2: Core Features (Week 2-3)

4. **Template Management**
   - Template list page
   - Template creation page
   - Template editor page

5. **Contract Management**
   - Contract list page
   - Contract creation from template
   - Contract editor page (with field inputs)

6. **Mode Switching**
   - Implement editor mode prop
   - Field node conditional rendering
   - Test template → contract conversion

### Phase 3: PDF Export (Week 4)

7. **PDF Generation**
   - TipTap JSON → PDFMake mapper
   - Font setup
   - Basic PDF export
   - Footer implementation
   - 1:1 layout matching

### Phase 4: Polish (Week 5+)

8. **UI/UX Improvements**
   - Error handling
   - Loading states
   - Form validation
   - User feedback

---

## 📚 Key Resources

- **TipTap Docs**: https://tiptap.dev/docs
- **ProseMirror Guide**: https://prosemirror.net/docs/guide/
- **PDFMake Docs**: https://pdfmake.github.io/docs/
- **Next.js App Router**: https://nextjs.org/docs/app
- **Supabase SSR**: https://supabase.com/docs/guides/auth/server-side/nextjs

---

## 🎯 Next Steps

Once setup is complete:

1. Start with **TipTap Editor** implementation
2. Build **Custom Field Node** extension
3. Create **Template CRUD** API routes
4. Build **Template Management UI**

---

## 💡 Tips

- **Start Simple**: Get basic editor working before adding complexity
- **Test Incrementally**: Test each feature as you build it
- **Reference Documentation**: Keep TipTap and PDFMake docs open
- **Follow Principles**: Remember "Measure, don't estimate" and "Functionality over form"
- **Avoid Anti-Patterns**: Refer to ANTI_PATTERNS.md frequently

---

*Ready to start building! 🚀*
