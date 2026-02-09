# Contract Editor

A Next.js application for building and managing legal contracts with TipTap editor and PDF export.

## Getting Started

### Prerequisites

- Node.js 18+
- yarn package manager
- Supabase project with contract builder tables

### Installation

1. Install dependencies:
```bash
yarn install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

3. Initialize shadcn/ui:
```bash
npx shadcn@latest init
npx shadcn@latest add button card input label dialog dropdown-menu table toast form
```

4. Generate Supabase types:
```bash
supabase gen types typescript --linked > types/database.ts
```

5. Run the development server:
```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
contract-editor/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes
│   ├── (dashboard)/       # Dashboard routes
│   └── api/               # API routes
├── components/            # React components
├── docs/                  # Documentation (all .md files except README.md)
├── lib/                   # Utilities and helpers
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript types
```

## Features

- ✅ Next.js 15 with App Router
- ✅ TypeScript
- ✅ Tailwind CSS + shadcn/ui
- ✅ Supabase integration
- ✅ TipTap editor setup (to be implemented)
- ✅ PDF export (to be implemented)

## Documentation

All documentation files are located in the [`./docs`](./docs) directory:

- [PROJECT_STATUS.md](./docs/PROJECT_STATUS.md) - **Current project status and what's ready**
- [SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) - Detailed setup instructions
- [QUICK_START.md](./docs/QUICK_START.md) - Quick start checklist
- [PROJECT_SUMMARY.md](./docs/PROJECT_SUMMARY.md) - Project overview and architecture
- [PROJECT_GOALS.md](./docs/PROJECT_GOALS.md) - Project goals and purpose
- [ANTI_PATTERNS.md](./docs/ANTI_PATTERNS.md) - Anti-patterns to avoid
- [CONVENTIONS.md](./docs/CONVENTIONS.md) - Documentation and code conventions

**Note:** All markdown files (except `README.md`) should be placed in the `./docs` directory.
