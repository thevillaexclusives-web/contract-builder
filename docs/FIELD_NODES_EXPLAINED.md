# Field Nodes: Why Custom Nodes Solve PDF Export Problems

## 🔴 The Old Approach (String-Based) - What You Had

### How It Worked

1. **Template Mode**: Users typed underlines (`_____________`)
2. **Contract Mode**: System detected underlines and replaced them with string markers:
   ```typescript
   "The tenant {{__FILLABLE__:field-123}} agrees..."
   ```
3. **Rendering**: Regex parsing to find markers and replace with `<input>` elements
4. **PDF Export**: Complex string parsing, position calculation, manual underline drawing

### The Problems

#### 1. **String Parsing Complexity**
```typescript
// ❌ Had to parse strings everywhere
const newPattern = /\{\{__FILLABLE__:([^}]+)\}\}/g;
const oldPattern = /\{\{_+FILLABLE_+\}\}/g;

// Complex logic to find and replace markers
text.replace(newPattern, (match, fieldId) => {
  const value = fillableFieldValues?.[fieldId];
  return value || '____________________';
});
```

#### 2. **PDF Export Nightmare**
```typescript
// ❌ Had to manually calculate positions
fillablePositions.forEach((info, startChar) => {
  // Calculate text width before field
  const beforeText = line.substring(0, overlapStart);
  const beforeWidth = doc.getTextWidth(beforeText);
  
  // Calculate underline position
  const underlineStartX = textStartX + beforeWidth + leadingSpacesWidth;
  
  // Manually draw underline
  drawUnderline(underlineStartX, yPosition, trimmedWidth);
});
```

**Issues:**
- ❌ Word wrapping breaks field positions
- ❌ Font size changes break calculations
- ❌ Text alignment breaks positioning
- ❌ Complex edge cases (spaces, line breaks, etc.)
- ❌ Hard to maintain and debug

#### 3. **State Management Issues**
```typescript
// ❌ Auto-generating IDs during render
if (!(fieldId in currentValues)) {
  const newValues = { ...currentValues };
  newValues[fieldId] = '';
  handleChange(newValues); // Side effect during render!
}
```

#### 4. **Data Transformation**
- Template → Contract: String replacement
- Contract → PDF: String parsing
- Multiple transformation steps = multiple failure points

---

## ✅ The New Approach (Custom Field Nodes) - How It Works

### Core Concept

**Fields are structured nodes in the JSON, not string markers.**

### How It Works

#### 1. **Template JSON Structure**
```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "The tenant " },
        {
          "type": "field",
          "attrs": {
            "id": "tenant-name",
            "label": "Tenant Name",
            "value": "",
            "type": "text"
          }
        },
        { "type": "text", "text": " agrees..." }
      ]
    }
  ]
}
```

#### 2. **Contract JSON Structure** (Same Structure!)
```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "The tenant " },
        {
          "type": "field",
          "attrs": {
            "id": "tenant-name",
            "label": "Tenant Name",
            "value": "John Doe",  // ← Only difference!
            "type": "text"
          }
        },
        { "type": "text", "text": " agrees..." }
      ]
    }
  ]
}
```

#### 3. **Mode-Based Rendering**

The **same JSON** renders differently based on editor mode:

**Template Mode:**
```typescript
// Field node renders as placeholder
renderHTML({ node, HTMLAttributes }) {
  return [
    'span',
    {
      class: 'field-placeholder',
      'data-field-id': node.attrs.id,
      style: 'border-bottom: 2px dashed #ccc; min-width: 100px;'
    },
    node.attrs.value || '________'
  ];
}
```

**Contract Mode:**
```typescript
// Field node renders as input
addNodeView() {
  return {
    dom: document.createElement('input'),
    contentDOM: null,
    update: (node) => {
      // Update input value when node changes
      this.dom.value = node.attrs.value || '';
    }
  };
}
```

**Read-only Mode:**
```typescript
// Field node renders as plain text
renderHTML({ node }) {
  return node.attrs.value || '';
}
```

#### 4. **PDF Export - Simple Mapping**

```typescript
// ✅ Direct mapping - no string parsing!
function mapTipTapToPDFMake(tiptapJSON: JSONContent) {
  return tiptapJSON.content.map(node => {
    if (node.type === 'field') {
      // Just use the value - no parsing needed!
      return {
        text: node.attrs.value || '',
        fontSize: 12,
        // ... other styles
      };
    }
    if (node.type === 'paragraph') {
      return {
        text: node.content.map(mapNode).join(''),
        // ... styles
      };
    }
    // ... other node types
  });
}
```

**No more:**
- ❌ String parsing
- ❌ Position calculations
- ❌ Manual underline drawing
- ❌ Word wrapping edge cases

---

## 🎯 Key Benefits

### 1. **Single Source of Truth**
- JSON structure is consistent
- No data transformation needed
- Same structure for template and contract

### 2. **Type Safety**
```typescript
interface FieldNode {
  type: 'field';
  attrs: {
    id: string;
    label: string;
    value: string;
    type: 'text' | 'date' | 'number' | 'signature';
  };
}
```

### 3. **Simple PDF Export**
- Direct node → PDFMake mapping
- No string parsing
- No position calculations
- Handles word wrapping automatically (PDFMake does it)

### 4. **Easy to Extend**
```typescript
// Want a date field? Just add a type!
{
  type: 'field',
  attrs: {
    id: 'contract-date',
    type: 'date',  // ← New type!
    value: '2024-01-15'
  }
}

// Rendering logic handles it automatically
if (node.attrs.type === 'date') {
  return <DatePicker value={node.attrs.value} />;
}
```

### 5. **Better Performance**
- No regex parsing on every render
- No string replacements
- Direct DOM updates via ProseMirror

---

## 🔄 How It Works With Your Current Setup

### Current State
- ✅ TipTap editor integrated
- ✅ Toolbar with formatting options
- ✅ Mode prop support (`template` | `contract` | `readonly`)
- ✅ JSON storage in Supabase

### What We Need to Add

#### 1. **Custom Field Node Extension**
```typescript
// components/contract-editor/extensions/field-node.ts
import { Node } from '@tiptap/core';

export const FieldNode = Node.create({
  name: 'field',
  inline: true,
  atom: true,
  
  addAttributes() {
    return {
      id: { default: null },
      label: { default: '' },
      value: { default: '' },
      type: { default: 'text' },
    };
  },
  
  renderHTML({ node, HTMLAttributes }) {
    // Mode-based rendering handled by addNodeView
    return ['span', HTMLAttributes, 0];
  },
  
  addNodeView() {
    return ({ node, editor }) => {
      const mode = editor.options.editorProps.mode || 'template';
      
      if (mode === 'template') {
        // Render as placeholder
        return createPlaceholderView(node);
      } else if (mode === 'contract') {
        // Render as input
        return createInputView(node, editor);
      } else {
        // Render as text
        return createTextView(node);
      }
    };
  },
});
```

#### 2. **Field Insertion UI**
```typescript
// Add to Toolbar.tsx
const handleInsertField = () => {
  const fieldId = `field-${Date.now()}`;
  editor.chain().focus().insertContent({
    type: 'field',
    attrs: {
      id: fieldId,
      label: 'Field Label',
      value: '',
      type: 'text',
    },
  }).run();
};
```

#### 3. **PDF Export Mapping**
```typescript
// app/api/export/[id]/route.ts
function mapFieldNode(node: FieldNode): PDFMakeContent {
  return {
    text: node.attrs.value || '',
    // PDFMake handles styling, wrapping, etc.
  };
}
```

---

## 🤔 Alternative Approaches (Why We Chose Custom Nodes)

### Alternative 1: HTML-Based Approach
**How it works:** Store HTML, parse for fields
**Problems:**
- ❌ HTML is not structured data
- ❌ Still need string parsing
- ❌ Harder to validate and transform

### Alternative 2: Separate Field Registry
**How it works:** Store fields separately, reference by ID
**Problems:**
- ❌ Two sources of truth (content + fields)
- ❌ Sync issues
- ❌ Complex queries

### Alternative 3: Mark-Based Approach
**How it works:** Use TipTap marks instead of nodes
**Problems:**
- ❌ Marks can't contain values
- ❌ Can't have nested content
- ❌ Limited flexibility

### Why Custom Nodes Win
- ✅ Single source of truth (JSON)
- ✅ Structured data
- ✅ Type-safe
- ✅ Easy to extend
- ✅ Simple PDF export

---

## 📊 Comparison Summary

| Aspect | Old (String-Based) | New (Custom Nodes) |
|--------|-------------------|-------------------|
| **Data Structure** | String markers in text | Structured JSON nodes |
| **PDF Export** | Complex parsing & calculations | Direct mapping |
| **Type Safety** | None (strings) | Full TypeScript support |
| **Maintenance** | High (regex, edge cases) | Low (structured data) |
| **Extensibility** | Hard (string parsing) | Easy (add node types) |
| **Performance** | Slow (regex on every render) | Fast (direct DOM updates) |
| **Word Wrapping** | Manual calculation | Automatic (PDFMake) |
| **State Management** | Complex (side effects) | Simple (node attributes) |

---

## 🚀 Next Steps

1. **Create Field Node Extension** - Implement the custom node
2. **Add Field Insertion UI** - Toolbar button to insert fields
3. **Test Mode Switching** - Verify template → contract rendering
4. **Implement PDF Mapping** - Map field nodes to PDFMake
5. **Add Field Types** - Date, number, signature fields

---

*This approach eliminates all the PDF export complexity you experienced with string-based fields.*
