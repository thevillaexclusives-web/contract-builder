# Contract Builder - Anti-Patterns & Gaps to Avoid

This document outlines all the architectural problems, anti-patterns, and gaps identified in the existing contract builder implementation. **These must be avoided** in the new implementation.

---

## ⚠️ Critical Design Decision: Notion-Style Editor

**Problem:**
- Focused too much on creating a Notion-style editor experience
- Notion took years to build their editor - we tried to replicate it too quickly
- Prioritized UX polish over core functionality
- Complex interactions that weren't necessary for the use case

**What Happened:**
- Spent too much time on drag-and-drop, floating menus, inline editing
- Complex keyboard shortcuts and interactions
- Trying to make it feel "smooth" like Notion
- Lost focus on the actual goal: creating and editing contracts

**Avoid:**
- ❌ Trying to replicate Notion's editor experience
- ❌ Prioritizing UX polish over functionality
- ❌ Complex interactions that don't add value
- ❌ Spending time on "nice-to-have" features before core features work

**Do Instead:**
- ✅ Focus on functionality first - make it work, then make it nice
- ✅ Simple, clear interactions that serve the purpose
- ✅ Prioritize contract creation and editing capabilities
- ✅ Add polish only after core features are solid
- ✅ Remember: users need to create contracts, not a Notion clone

**Key Principle:** 
> **Functionality over Form** - A simple, functional editor that works reliably is better than a fancy editor with bugs.

---

## 🚫 Critical Anti-Patterns to Avoid

### 1. Complex State Management

**Problem:**
- Multiple state sources (`blocks`, `pageFooters` Map, `recurringPageFooter`, `margins`)
- Manual syncing between internal state and `content` prop
- Duplicate state (footers stored separately AND merged into content)
- Risk of state desynchronization

**What Happened:**
```typescript
// ❌ BAD: Multiple state sources
const [blocks, setBlocks] = useState<Component[]>(content);
const [pageFooters, setPageFooters] = useState<Map<number, PageFooterComponent>>(new Map());
const [recurringPageFooter, setRecurringPageFooter] = useState<PageFooterComponent | null>(null);
const [margins, setMargins] = useState<Margins>(...);

// Then manually syncing:
onChange([...updatedBlocks, ...footerComponents]);
```

**Avoid:**
- ❌ Multiple state variables for related data
- ❌ Manual state synchronization
- ❌ Duplicate state storage
- ❌ State that can get out of sync with props

**Do Instead:**
- ✅ Single source of truth (content array)
- ✅ Immutable updates
- ✅ Normalized data structure
- ✅ State derived from props when possible

---

### 2. Overuse of useEffect

**Problem:**
- Too many `useEffect` hooks with complex dependencies
- Side effects during render
- Circular dependencies between effects
- Effects that trigger other effects

**What Happened:**
```typescript
// ❌ BAD: Multiple effects with complex dependencies
useEffect(() => {
  // Sync blocks with content prop
}, [content]);

useEffect(() => {
  // Update article numbers
}, [blocks]);

useEffect(() => {
  // Calculate pagination
}, [blocks, recurringFooter, margins, estimatedFooterHeight]);

useEffect(() => {
  // Global keyboard handler
}, [isContract, blocks, handleInsert]);
```

**Avoid:**
- ❌ Effects that sync props to state unnecessarily
- ❌ Effects that trigger other effects
- ❌ Effects with many dependencies
- ❌ Side effects during render

**Do Instead:**
- ✅ Use `useMemo` for derived state
- ✅ Use `useCallback` for stable references
- ✅ Minimize effects - prefer event handlers
- ✅ Use refs for values that don't need to trigger re-renders

---

### 3. Complex Nested Component Handling

**Problem:**
- Excessive prop drilling (`onUpdate`, `onUpdateNested`, `onDelete`, `onDeleteNested`, etc.)
- Inconsistent handling between nested and top-level blocks
- Complex callback chains
- Deep state updates require traversing nested structures

**What Happened:**
```typescript
// ❌ BAD: Prop drilling hell
<BlockItem
  onUpdate={handleUpdate}
  onUpdateNested={onUpdateNested}
  onDelete={onDelete}
  onDeleteNested={onDeleteNested}
  onInsertNested={onInsertNested}
  onInsertNestedAfter={onInsertNestedAfter}
  onInsertNestedBefore={onInsertNestedBefore}
  // ... more props
/>

// Then in nested components:
onUpdateNested?.(index, updatedComponent);
```

**Avoid:**
- ❌ Prop drilling through multiple levels
- ❌ Different APIs for nested vs top-level blocks
- ❌ Complex callback chains
- ❌ Manual index tracking across nested levels

**Do Instead:**
- ✅ Use React Context for shared operations
- ✅ Consistent API for all blocks (nested or not)
- ✅ Path-based updates (e.g., `updateBlock([0, 1], newBlock)`)
- ✅ Immutable update utilities (like Immer)

---

### 4. String-Based Fillable Fields

**Problem:**
- Fillable fields stored as string markers: `{{__FILLABLE__:fieldId}}`
- Complex regex parsing in multiple places
- Auto-generating field IDs during render
- State initialization happens during render (side effects)

**What Happened:**
```typescript
// ❌ BAD: String markers in text
const text = "The tenant {{__FILLABLE__:tenant-name}} agrees...";

// Complex regex parsing:
const newPattern = /\{\{__FILLABLE__:([^}]+)\}\}/g;
const oldPattern = /\{\{_+FILLABLE_+\}\}/g;

// State updates during render:
if (!(fieldId in currentValues)) {
  const newValues = { ...currentValues };
  newValues[fieldId] = '';
  handleChange(newValues); // ❌ Side effect during render!
}
```

**Avoid:**
- ❌ String markers/placeholders in content
- ❌ Regex parsing for structured data
- ❌ State updates during render
- ❌ Auto-generating IDs during render

**Do Instead:**
- ✅ Structured data model (fillable fields as objects)
- ✅ Separate content model from presentation
- ✅ IDs generated at creation time
- ✅ Normalized data structure

---

### 5. Estimated Pagination Heights

**Problem:**
- Hardcoded height estimates (`title: 50px`, `paragraph: 80px`)
- Height estimation doesn't match actual rendered heights
- Complex recursive calculation for nested content
- No real-time measurement

**What Happened:**
```typescript
// ❌ BAD: Hardcoded estimates
const COMPONENT_HEIGHTS: Record<string, number> = {
  title: 50,
  paragraph: 80,
  article: 60,
  // ...
};

// Complex recursive estimation:
function estimateComponentHeight(component: Component): number {
  // Lots of guessing...
  const lines = Math.ceil(text.length / 80) || 1;
  const textHeight = Math.max(50, lines * 25 + 20);
  // ...
}
```

**Avoid:**
- ❌ Hardcoded height estimates
- ❌ Guessing content heights
- ❌ Complex recursive estimation
- ❌ Pagination based on estimates

**Do Instead:**
- ✅ Measure actual DOM heights
- ✅ Use ResizeObserver for dynamic content
- ✅ Cache measurements
- ✅ Virtual scrolling if needed

---

### 6. Complex Text Styling Toolbar Positioning

**Problem:**
- 577 lines of positioning logic
- Multiple position calculation attempts with fallbacks
- Complex click-outside detection with timeouts/delays
- Fragile viewport calculations

**What Happened:**
```typescript
// ❌ BAD: 577 lines of positioning logic
useEffect(() => {
  const updatePosition = () => {
    // Try to get selection position
    // Check for scaled containers
    // Calculate viewport positions
    // Handle edge cases
    // Multiple fallbacks
    // ...
  };
  // Multiple event listeners
  // Timeouts and delays
}, [visible, elementRef]);
```

**Avoid:**
- ❌ Complex positioning calculations
- ❌ Multiple fallback attempts
- ❌ Fragile viewport calculations
- ❌ Timeouts and delays for positioning

**Do Instead:**
- ✅ Use CSS positioning (fixed/sticky)
- ✅ Use portals for overlays
- ✅ Simple, reliable positioning logic
- ✅ Use libraries (like Floating UI) if needed

---

### 7. Dual Footer System

**Problem:**
- Two footer systems (legacy `footer` and new `page-footer`)
- Complex state: Map for page-specific, separate state for recurring
- Footer extraction/merging logic scattered
- State can desync from content

**What Happened:**
```typescript
// ❌ BAD: Two footer systems
const [pageFooters, setPageFooters] = useState<Map<number, PageFooterComponent>>(new Map());
const [recurringPageFooter, setRecurringPageFooter] = useState<PageFooterComponent | null>(null);

// Extract footers from content:
content.forEach((comp) => {
  if (comp.type === 'page-footer') {
    footerComponents.push(comp);
  }
});

// Then merge back:
onChange([...updatedBlocks, ...footerComponents]);
```

**Avoid:**
- ❌ Multiple footer systems
- ❌ Separate state for footers
- ❌ Extraction/merging logic
- ❌ State that can desync

**Do Instead:**
- ✅ Single footer system
- ✅ Footers stored in content array like other blocks
- ✅ Consistent data model
- ✅ No special handling needed

---

### 8. Type Safety Issues

**Problem:**
- Excessive use of `as any` casts
- Union types make type narrowing difficult
- Inconsistent component interfaces
- Missing type guards

**What Happened:**
```typescript
// ❌ BAD: Type casts everywhere
const articleBlock = block as any;
const footerComp = footer as any;
const itemWithContent = item as any;

// Inconsistent interfaces:
interface SomeProps {
  index?: number; // Optional in some places
  // ...
}
```

**Avoid:**
- ❌ `as any` casts
- ❌ Inconsistent interfaces
- ❌ Missing type guards
- ❌ Union types without discriminators

**Do Instead:**
- ✅ Proper type guards
- ✅ Discriminated unions
- ✅ Consistent interfaces
- ✅ Strict TypeScript configuration

---

### 9. Console.logs in Production

**Problem:**
- Many `console.log` statements left in production code
- Debug logging scattered throughout
- No proper logging system

**What Happened:**
```typescript
// ❌ BAD: Console logs everywhere
console.log('📄 [BlockEditor] Calculating pages', {...});
console.log('📝 [BlockEditor] handleInsert called', {...});
console.log('📏 [estimateComponentHeight] Article', {...});
```

**Avoid:**
- ❌ Console.logs in production code
- ❌ Debug logging scattered everywhere
- ❌ No logging levels

**Do Instead:**
- ✅ Use proper logging library
- ✅ Environment-based logging
- ✅ Log levels (debug, info, error)
- ✅ Remove debug logs before production

---

### 10. Performance Issues

**Problem:**
- Pagination recalculated on every change (no debouncing)
- Missing memoization in many places
- Height estimation runs on every render
- No virtualization for long documents

**What Happened:**
```typescript
// ❌ BAD: Recalculates on every change
const pages = useMemo(() => {
  return calculatePageBreaks(contentWithoutRecurringFooter, ...);
}, [blocks, recurringFooter, margins, estimatedFooterHeight]);

// Runs on every render:
function estimateComponentHeight(component: Component): number {
  // Complex calculation...
}
```

**Avoid:**
- ❌ Recalculating expensive operations on every change
- ❌ Missing memoization
- ❌ Calculations during render
- ❌ No virtualization

**Do Instead:**
- ✅ Debounce expensive calculations
- ✅ Memoize derived values
- ✅ Use React.memo for components
- ✅ Virtual scrolling for long lists

---

### 11. Inconsistent Block Rendering

**Problem:**
- Registry pattern exists but props passed inconsistently
- Different handling for nested vs top-level blocks
- Complex BlockItem wrapper with positioning logic
- Menu generation logic mixed with rendering

**What Happened:**
```typescript
// ❌ BAD: Inconsistent prop passing
if (component.type === 'article' || component.type === 'section') {
  return (
    <BlockComponent
      component={component}
      index={index}
      isNested={isNested}
      onUpdate={adaptedOnUpdate}
      onUpdateNested={onUpdateNested}
      // ... many props
    />
  );
} else {
  return (
    <BlockComponent
      component={component}
      isNested={isNested}
      onUpdate={adaptedOnUpdate}
      // ... fewer props
    />
  );
}
```

**Avoid:**
- ❌ Inconsistent prop interfaces
- ❌ Different handling for different block types
- ❌ Mixed concerns (rendering + menu + positioning)

**Do Instead:**
- ✅ Consistent prop interface for all blocks
- ✅ Single rendering path
- ✅ Separate concerns (rendering, menu, positioning)

---

### 12. Complex Menu Generation

**Problem:**
- Menu generation logic mixed with component rendering
- Complex conditional logic for menu items
- Menu items depend on component state
- Hard to test menu logic separately

**What Happened:**
```typescript
// ❌ BAD: Complex menu generation
const menuItems = useMemo(() => {
  if (isContract) return [];
  if (isNestable) {
    // One set of menu items
  } else if (isNested) {
    // Another set
  } else {
    // Yet another set
  }
  // Complex conditional logic...
}, [component, index, isNested, isContract, ...]);
```

**Avoid:**
- ❌ Complex conditional menu generation
- ❌ Menu logic mixed with rendering
- ❌ Menu depends on many state variables

**Do Instead:**
- ✅ Simple menu generation
- ✅ Separate menu logic from rendering
- ✅ Menu based on block type only

---

### 13. Fragile Height Calculations

**Problem:**
- Height calculations depend on CSS classes and spacing
- Assumptions about line heights and font sizes
- Doesn't account for dynamic content
- Breaks when styling changes

**What Happened:**
```typescript
// ❌ BAD: Assumptions about spacing
const spaceNeeded = componentHeight + 10; // 8px spacing + 2px buffer
const maxPageHeight = contentHeight * 0.98; // 98% of available height
```

**Avoid:**
- ❌ Assumptions about CSS spacing
- ❌ Hardcoded multipliers
- ❌ Calculations that break with styling changes

**Do Instead:**
- ✅ Measure actual spacing
- ✅ Use CSS variables for spacing
- ✅ Account for dynamic content

---

### 14. Page Break Handling Inconsistencies

**Problem:**
- Page breaks filtered out during render but used in calculation
- Page breaks can cause incorrect page assignments
- Complex logic for handling page breaks

**What Happened:**
```typescript
// ❌ BAD: Filtered out but used in calculation
{page.components
  .filter((block) => block.type !== 'page-break') // Don't render
  .map((block, blockIndex) => {
    // But page breaks affect pagination calculation
  })}
```

**Avoid:**
- ❌ Filtering out components that affect logic
- ❌ Inconsistent handling of page breaks
- ❌ Complex page break logic

**Do Instead:**
- ✅ Consistent handling of page breaks
- ✅ Page breaks as first-class components
- ✅ Simple, clear logic

---

### 15. Auto-Resizing Textareas

**Problem:**
- Multiple `useEffect` hooks for auto-resizing
- Height calculations during render
- Can cause layout shifts

**What Happened:**
```typescript
// ❌ BAD: Multiple effects for resizing
useEffect(() => {
  if (textareaRef.current) {
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }
}, [component.text, isEditing]);
```

**Avoid:**
- ❌ Multiple effects for resizing
- ❌ Direct DOM manipulation
- ❌ Layout shifts

**Do Instead:**
- ✅ CSS-based solutions when possible
- ✅ Single resize handler
- ✅ Use libraries (like react-textarea-autosize)

---

## 📋 Summary Checklist

When building the new contract builder, ensure:

- [ ] **Single source of truth** - No duplicate state
- [ ] **Minimal useEffect** - Prefer event handlers and memoization
- [ ] **No prop drilling** - Use Context or state management
- [ ] **Structured data** - No string markers for fillable fields
- [ ] **Real measurements** - No height estimates
- [ ] **Simple positioning** - No complex calculations
- [ ] **Consistent APIs** - Same interface for all blocks
- [ ] **Type safety** - No `as any` casts
- [ ] **No debug logs** - Proper logging system
- [ ] **Performance** - Memoization and debouncing
- [ ] **Consistent rendering** - Single path for all blocks
- [ ] **Simple menus** - Separate from rendering
- [ ] **Measured spacing** - No assumptions
- [ ] **Consistent page breaks** - First-class components
- [ ] **CSS-based resizing** - Minimal DOM manipulation

---

## 🎯 Principles for New Implementation

1. **Simplicity over cleverness** - Prefer simple, clear code
2. **Measure, don't estimate** - Use real DOM measurements
3. **Single responsibility** - Each component/hook does one thing
4. **Type safety** - Strict TypeScript, no casts
5. **Performance by default** - Memoize, debounce, virtualize
6. **Testability** - Easy to test in isolation
7. **Maintainability** - Easy to understand and modify

---

*This document should be referenced during development to avoid repeating past mistakes.*
