# Contract Builder - New Implementation

This directory contains the new contract builder implementation, rebuilt from scratch to avoid the anti-patterns and architectural issues identified in the existing implementation.

## Directory Structure

```
src/
├── pages/
│   ├── contract-builder/     # New contract builder pages
│   │   ├── ANTI_PATTERNS.md  # Anti-patterns to avoid
│   │   ├── PROJECT_GOALS.md  # Original goals and purpose
│   │   └── README.md          # This file
│   ├── pms/                   # Existing contract builder (legacy)
│   └── crm/                   # CRM pages
└── components/
    ├── contract-builder/      # New contract builder components
    ├── pms/                   # Existing contract builder components (legacy)
    └── crm/                   # CRM components
```

## Purpose

This is a complete rewrite of the contract builder to address:

- Complex state management issues
- Overuse of useEffect hooks
- Prop drilling and nested component complexity
- String-based fillable fields
- Estimated pagination heights
- Complex positioning logic
- Type safety issues
- Performance problems

## Reference Documents

- **ANTI_PATTERNS.md** - Comprehensive list of anti-patterns and gaps to avoid
- **PROJECT_GOALS.md** - Original goals and purpose of the contract builder
- Existing implementation: `src/components/pms/` and `src/pages/pms/`

## Development Guidelines

When building the new implementation:

1. **Read PROJECT_GOALS.md first** - Understand the purpose and goals
2. **Read ANTI_PATTERNS.md** - Understand what to avoid
3. **Reference existing implementation** - Learn from mistakes, not copy them
4. **Follow the principles** - Simplicity, type safety, performance, testability
5. **Measure, don't estimate** - Use real DOM measurements
6. **Single source of truth** - No duplicate state
7. **Functionality over form** - Focus on making it work, not making it fancy

## Status

🚧 **In Development** - This is a new implementation in progress.
