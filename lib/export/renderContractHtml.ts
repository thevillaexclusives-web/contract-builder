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

    /* Pre-pagination: flow container holds raw content */
    #flow {
      width: 210mm;
      padding: 24mm 20mm;
    }

    /* Post-pagination: hide flow, show pages */
    body.paginated #flow { display: none; }

    section.page {
      width: 210mm;
      height: 297mm;
      position: relative;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    section.page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    section.page > header {
      height: 25.4mm;
      padding: 6.35mm 16.9mm 0 16.9mm;
    }

    section.page > main {
      height: calc(297mm - 25.4mm - 19.0mm - 6.35mm - 6.35mm);
      padding: 0 16.9mm;
      overflow: hidden;
    }

    section.page > footer {
      height: 19.0mm;
      padding: 0 16.9mm 6.35mm 16.9mm;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9pt;
      color: #666;
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
  <script>
    (function paginate() {
      var flow = document.getElementById('flow');
      if (!flow) return;

      // Collect all top-level child nodes from flow
      var children = Array.from(flow.childNodes);

      // Helper: create a new page section
      function createPage() {
        var section = document.createElement('section');
        section.className = 'page';

        var header = document.createElement('header');
        var main = document.createElement('main');
        var footer = document.createElement('footer');

        section.appendChild(header);
        section.appendChild(main);
        section.appendChild(footer);

        return section;
      }

      // Build pages
      var pages = [];
      var currentPage = createPage();
      document.body.appendChild(currentPage);
      pages.push(currentPage);

      var currentMain = currentPage.querySelector('main');

      for (var i = 0; i < children.length; i++) {
        var node = children[i];

        // Skip whitespace-only text nodes
        if (node.nodeType === 3 && !node.textContent.trim()) continue;

        // Check for page-break node
        if (node.nodeType === 1 && node.getAttribute('data-type') === 'page-break') {
          // Force new page, do not render the page-break marker
          currentPage = createPage();
          document.body.appendChild(currentPage);
          pages.push(currentPage);
          currentMain = currentPage.querySelector('main');
          continue;
        }

        // Append node to current main
        currentMain.appendChild(node);

        // Check overflow
        if (currentMain.scrollHeight > currentMain.clientHeight) {
          // Remove from current, start new page
          currentMain.removeChild(node);

          currentPage = createPage();
          document.body.appendChild(currentPage);
          pages.push(currentPage);
          currentMain = currentPage.querySelector('main');

          currentMain.appendChild(node);
        }
      }

      // Write page numbers
      var totalPages = pages.length;
      for (var p = 0; p < totalPages; p++) {
        var footer = pages[p].querySelector('footer');
        footer.textContent = 'Page ' + (p + 1) + ' of ' + totalPages;
      }

      // Mark body as paginated to swap visibility
      document.body.classList.add('paginated');
    })();
  </script>
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
