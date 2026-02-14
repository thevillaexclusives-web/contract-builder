import { generateHTML } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { FontSize } from '@tiptap/extension-font-size'
import { CustomOrderedList } from '@/components/contract-editor-v2/extensions/custom-ordered-list'
import { FieldNode } from '@/components/contract-editor-v2/extensions/field-node'
import { PageBreak } from '@/components/contract-editor-v2/extensions/page-break'

const extensions = [
  StarterKit.configure({
    orderedList: false,
  }),
  CustomOrderedList,
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  TextStyle,
  FontFamily,
  Underline,
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  FontSize,
  FieldNode,
  PageBreak,
]

export function renderContractHtml(
  tiptapJson: JSONContent,
  contractName: string
): string {
  const bodyHtml = generateHTML(tiptapJson, extensions)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(contractName)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      width: 210mm;
      margin: 0 auto;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    #flow {
      width: 210mm;
      padding: 24mm 20mm;
    }

    /* Typography */
    h1 { font-size: 24pt; font-weight: 700; margin-bottom: 8pt; }
    h2 { font-size: 18pt; font-weight: 700; margin-bottom: 6pt; }
    h3 { font-size: 14pt; font-weight: 700; margin-bottom: 4pt; }
    h4 { font-size: 12pt; font-weight: 700; margin-bottom: 4pt; }
    h5 { font-size: 10pt; font-weight: 700; margin-bottom: 2pt; }
    h6 { font-size: 9pt; font-weight: 700; margin-bottom: 2pt; }

    p { margin-bottom: 6pt; }

    ul, ol { padding-left: 24pt; margin-bottom: 6pt; }
    li { margin-bottom: 2pt; }

    strong { font-weight: 700; }
    em { font-style: italic; }
    u { text-decoration: underline; }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8pt;
    }
    th, td {
      border: 1px solid #000;
      padding: 4pt 6pt;
      text-align: left;
      vertical-align: top;
    }
    th {
      font-weight: 700;
      background-color: #f5f5f5;
    }

    /* Page break node */
    div[data-type="page-break"] {
      page-break-after: always;
      break-after: page;
      height: 0;
      margin: 0;
      padding: 0;
      border: none;
    }

    /* Blockquotes */
    blockquote {
      border-left: 3pt solid #ccc;
      padding-left: 10pt;
      margin-left: 0;
      margin-bottom: 6pt;
    }

    /* Code */
    code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      background: #f4f4f4;
      padding: 1pt 3pt;
      border-radius: 2pt;
    }
    pre {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      background: #f4f4f4;
      padding: 8pt;
      margin-bottom: 6pt;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    /* Horizontal rule */
    hr {
      border: none;
      border-top: 1pt solid #000;
      margin: 8pt 0;
    }
  </style>
</head>
<body>
  <div id="flow" class="ProseMirror">${bodyHtml}</div>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
