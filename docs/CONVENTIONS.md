# Documentation Conventions

## File Organization

**All markdown documentation files (except `README.md`) should be placed in the `./docs` directory.**

### Structure

```
contract-editor/
├── README.md                    # Main project README (root level)
└── docs/                        # All other documentation
    ├── SETUP_GUIDE.md
    ├── PROJECT_SUMMARY.md
    ├── PROJECT_GOALS.md
    ├── ANTI_PATTERNS.md
    ├── QUICK_START.md
    └── CONVENTIONS.md           # This file
```

### Rules

- ✅ `README.md` stays at the root level
- ✅ All other `.md` files go in `./docs/`
- ✅ Documentation should be organized by topic/purpose
- ✅ Use descriptive, kebab-case filenames

### Examples

**Correct:**
- `README.md` (root)
- `docs/SETUP_GUIDE.md`
- `docs/API_DOCUMENTATION.md`
- `docs/ARCHITECTURE.md`

**Incorrect:**
- `SETUP_GUIDE.md` (root - should be in docs/)
- `docs/README.md` (README should be at root)

---

*This convention helps keep the project root clean and organized while maintaining easy access to documentation.*
