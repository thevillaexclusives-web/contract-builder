# Field Insertion: User Experience Guide

## 🎯 User Workflow

### Scenario: User wants to add a fillable field in a template

**Step 1: Position cursor**
- User clicks where they want the field (e.g., after "The tenant ")

**Step 2: Insert field**
- **Option A**: Click toolbar button "Insert Field" → Field appears
- **Option B**: Use keyboard shortcut (e.g., `Ctrl/Cmd + F`) → Field appears
- **Option C**: Type `/field` → Shows autocomplete → Select → Field appears

**Step 3: Field appears**
- In **template mode**: Shows as placeholder underline (`________`)
- Field is immediately editable (can type to change label, or click to configure)

**Step 4: Configure field (optional)**
- Click on field → Shows popover/menu with options:
  - Field label/name
  - Field type (text, date, number, signature)
  - Field width (auto, fixed)
  - Required/optional

---

## 🎨 UI Design Options

### Option 1: Simple Toolbar Button (Recommended for MVP)

**Visual:**
```
[Bold] [Italic] ... [Table] [Insert Field ▼] [Undo] [Redo]
```

**Behavior:**
- Click button → Inserts default text field at cursor
- Click dropdown arrow → Shows field type menu:
  - Text Field
  - Date Field
  - Number Field
  - Signature Field

**Pros:**
- ✅ Simple and discoverable
- ✅ Matches existing toolbar pattern
- ✅ Quick to implement
- ✅ No modal/dialog needed for basic use

**Cons:**
- ⚠️ Less flexible (can't set label immediately)
- ⚠️ Requires clicking field to configure

---

### Option 2: Toolbar Button + Dialog

**Visual:**
```
[Bold] [Italic] ... [Table] [Insert Field] [Undo] [Redo]
```

**Behavior:**
- Click button → Opens dialog:
  - Field Label: [________]
  - Field Type: [Dropdown: Text ▼]
  - [Cancel] [Insert]
- Click Insert → Field appears at cursor

**Pros:**
- ✅ Can set label before inserting
- ✅ More control upfront
- ✅ Better for power users

**Cons:**
- ⚠️ Extra step (slower)
- ⚠️ More complex to implement
- ⚠️ Interrupts flow

---

### Option 3: Slash Command (Notion-style)

**Visual:**
```
User types: "The tenant /field"
Shows: [Text Field] [Date Field] [Number Field]
```

**Behavior:**
- Type `/field` → Shows autocomplete menu
- Select field type → Field inserted
- Field shows placeholder label

**Pros:**
- ✅ Fast (keyboard-only)
- ✅ Modern UX pattern
- ✅ No toolbar clutter

**Cons:**
- ⚠️ Less discoverable
- ⚠️ Requires autocomplete implementation
- ⚠️ More complex

---

### Option 4: Right-Click Context Menu

**Visual:**
```
Right-click → Context menu appears:
  - Insert Field
    - Text Field
    - Date Field
    - Number Field
```

**Behavior:**
- Right-click at cursor position
- Select field type → Field inserted

**Pros:**
- ✅ Contextual
- ✅ Doesn't clutter toolbar

**Cons:**
- ⚠️ Less discoverable
- ⚠️ Requires right-click handler

---

## 🏆 Recommended Approach: **Option 1 (Simple Toolbar Button)**

### Why?
1. **Matches existing pattern** - Users already know how toolbar buttons work
2. **Discoverable** - Visible in toolbar
3. **Fast to implement** - No dialogs or autocomplete needed
4. **Simple UX** - Click → Field appears → Click field to configure

### Implementation Plan

#### Phase 1: Basic Insertion (MVP)
- Toolbar button with dropdown
- Insert default text field
- Field shows as placeholder in template mode
- Click field to edit label (inline editing)

#### Phase 2: Field Types
- Dropdown shows field types
- Insert different field types
- Each type renders differently

#### Phase 3: Field Configuration
- Click field → Shows popover
- Edit label, type, width, etc.
- Save changes

---

## 📋 Detailed User Flow

### Flow 1: Insert Text Field (Simple)

1. User types: "The tenant "
2. User clicks "Insert Field" button in toolbar
3. Field appears: `________` (placeholder)
4. User continues typing: " agrees to pay..."
5. **Result**: "The tenant `________` agrees to pay..."

### Flow 2: Insert Field with Label

1. User types: "The tenant "
2. User clicks "Insert Field" button
3. Field appears: `________`
4. User clicks on field
5. Popover appears with:
   - Label: [Tenant Name]
   - Type: [Text ▼]
   - Width: [Auto ▼]
6. User types "Tenant Name" in label field
7. User clicks outside → Field now shows: `[Tenant Name]` (styled as placeholder)
8. **Result**: "The tenant `[Tenant Name]` agrees to pay..."

### Flow 3: Insert Date Field

1. User types: "This contract is effective on "
2. User clicks "Insert Field" dropdown → Selects "Date Field"
3. Date field appears: `[Select Date]`
4. User clicks field → Date picker appears
5. User selects date → Field shows: `[01/15/2024]`
6. **Result**: "This contract is effective on `[01/15/2024]`"

---

## 🎨 Visual Examples

### Template Mode (Creating Template)
```
┌─────────────────────────────────────────┐
│ [B] [I] [U] ... [Table] [Field ▼] ... │
├─────────────────────────────────────────┤
│                                         │
│ The tenant ________ agrees to pay...    │
│                                         │
│ This contract is effective on [Date]    │
│                                         │
└─────────────────────────────────────────┘
```

### Contract Mode (Filling Contract)
```
┌─────────────────────────────────────────┐
│ [B] [I] [U] ... [Table] [Field ▼] ... │
├─────────────────────────────────────────┤
│                                         │
│ The tenant [John Doe        ] agrees...│
│                                         │
│ This contract is effective on [01/15]  │
│                                         │
└─────────────────────────────────────────┘
```

---

## ⌨️ Keyboard Shortcuts (Future Enhancement)

- `Ctrl/Cmd + F` - Insert text field
- `Ctrl/Cmd + Shift + F` - Show field type menu
- `Esc` - Close field configuration popover
- `Enter` - Confirm field configuration

---

## 🔧 Technical Implementation

### Toolbar Button Component
```typescript
// components/contract-editor/FieldInsertButton.tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <ToolbarButton>
      <FieldIcon /> Insert Field
    </ToolbarButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={insertTextField}>
      Text Field
    </DropdownMenuItem>
    <DropdownMenuItem onClick={insertDateField}>
      Date Field
    </DropdownMenuItem>
    <DropdownMenuItem onClick={insertNumberField}>
      Number Field
    </DropdownMenuItem>
    <DropdownMenuItem onClick={insertSignatureField}>
      Signature Field
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Field Insertion Command
```typescript
const insertField = (type: 'text' | 'date' | 'number' | 'signature') => {
  const fieldId = `field-${Date.now()}`;
  editor.chain().focus().insertContent({
    type: 'field',
    attrs: {
      id: fieldId,
      label: '', // Empty initially, user can edit
      value: '',
      type: type,
    },
  }).run();
};
```

---

## ✅ Success Criteria

1. **Discoverability**: User can find "Insert Field" button easily
2. **Speed**: Can insert field in < 2 clicks
3. **Clarity**: Field appearance is clear (placeholder vs filled)
4. **Flexibility**: Can configure field after insertion
5. **Consistency**: Matches existing toolbar patterns

---

*This UX design prioritizes simplicity and functionality over complex interactions, aligning with the project's "functionality over form" principle.*
