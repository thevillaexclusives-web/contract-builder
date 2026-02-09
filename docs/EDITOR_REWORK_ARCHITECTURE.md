## 1️⃣ TipTap (Core Editor)

### Official Docs (start here)

👉 [https://tiptap.dev/docs](https://tiptap.dev/docs)

**Read in this order:**

1. **Introduction**

   * Concepts: Editor, Extensions, JSON content
2. **React Guide**

   * [https://tiptap.dev/docs/editor/react](https://tiptap.dev/docs/editor/react)
3. **Starter Kit**

   * Nodes, marks, schema basics
4. **Extensions**

   * Especially:

     * `Node`
     * `Mark`
     * `Attributes`
5. **Custom Extensions**

   * [https://tiptap.dev/docs/editor/extensions/custom-extensions](https://tiptap.dev/docs/editor/extensions/custom-extensions)

💡 This is where you’ll implement your **Field (placeholder) node**.

---

## 2️⃣ ProseMirror Fundamentals (VERY IMPORTANT)

TipTap is just a wrapper. Understanding this avoids bugs.

### Required reading

👉 [https://prosemirror.net/docs/guide/](https://prosemirror.net/docs/guide/)

Focus on:

* **Document model**
* **Nodes & Marks**
* **Schema**
* **Transactions**

You do **not** need to deep dive plugins at first.

---

## 3️⃣ Implementing “Underline → Input Field”

### TipTap custom node examples

👉 [https://tiptap.dev/docs/editor/extensions/node](https://tiptap.dev/docs/editor/extensions/node)

Key topics:

* `inline: true`
* `atom: true`
* `addAttributes()`
* `renderHTML()`
* `addNodeView()` (for React input rendering)

This lets you do:

* Template → underline placeholder
* Contract → text replacement
* Editor → controlled input

---

## 4️⃣ Tables, Layout, Styling

### TipTap Table Extension

👉 [https://tiptap.dev/docs/editor/extensions/table](https://tiptap.dev/docs/editor/extensions/table)

### Text styles

* Font family
* Font size
* Line height

👉 [https://tiptap.dev/docs/editor/extensions/text-style](https://tiptap.dev/docs/editor/extensions/text-style)
👉 [https://tiptap.dev/docs/editor/extensions/font-family](https://tiptap.dev/docs/editor/extensions/font-family)

---

## 5️⃣ Saving Templates & Contracts (JSON)

### Content serialization

👉 [https://tiptap.dev/docs/editor/api/editor#methods](https://tiptap.dev/docs/editor/api/editor#methods)

Important methods:

* `editor.getJSON()`
* `editor.commands.setContent()`

💡 **Store everything as JSON in DB**

* Template = JSON with field nodes
* Contract = JSON with resolved values

---

## 6️⃣ PDF Export (1:1 Output)

### PDFMake Official Docs

👉 [https://pdfmake.github.io/docs/](https://pdfmake.github.io/docs/)

**Read in this order:**

1. **Document Definition Object**
2. **Text**
3. **Margins & Styles**
4. **Tables**
5. **Headers & Footers**

This is where your layout precision comes from.

---

## 7️⃣ TipTap JSON → PDFMake Mapping

There is **no official doc** (everyone implements this manually), but this guide helps:

👉 [https://pdfmake.github.io/docs/0.1/document-definition-object/](https://pdfmake.github.io/docs/0.1/document-definition-object/)

You’ll write a mapper like:

```
TipTap Node → PDFMake block
paragraph → text
table → table
field → resolved text
```

This is normal and expected.

---

## 8️⃣ Reference Implementations (Study These)

### TipTap custom nodes

👉 [https://github.com/ueberdosis/tiptap/tree/main/packages/extension-](https://github.com/ueberdosis/tiptap/tree/main/packages/extension-)*

### ProseMirror schema examples

👉 [https://github.com/ProseMirror/prosemirror-schema-basic](https://github.com/ProseMirror/prosemirror-schema-basic)

### PDFMake table examples

👉 [https://github.com/bpampuch/pdfmake/tree/master/examples](https://github.com/bpampuch/pdfmake/tree/master/examples)

---

## 🧠 Mental Model (Keep This)

* **Editor is NOT your source of truth**
* **JSON is your source of truth**
* **PDF is generated from JSON, not HTML**
