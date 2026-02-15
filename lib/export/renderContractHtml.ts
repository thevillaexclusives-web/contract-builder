import { generateHTML } from '@tiptap/html'
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

// Header/footer use same extensions minus PageBreak
const hfExtensions = extensions.filter((e) => e !== PageBreak)

/** True when doc is empty or contains only a single empty paragraph. */
function isDocEmpty(json: JSONContent | undefined): boolean {
  if (!json) return true
  const c = json.content
  if (!c || c.length === 0) return true
  if (c.length === 1 && c[0].type === 'paragraph' && (!c[0].content || c[0].content.length === 0)) return true
  return false
}

export function renderContractHtml(
  tiptapJson: JSONContent,
  contractName: string,
  headerJson?: JSONContent,
  footerJson?: JSONContent
): string {
  const bodyHtml = generateHTML(tiptapJson, extensions)

  const hasHeader = !isDocEmpty(headerJson)
  const hasFooter = !isDocEmpty(footerJson)

  let headerHtml = ''
  if (hasHeader && headerJson) {
    try {
      headerHtml = generateHTML(headerJson, hfExtensions)
    } catch {
      headerHtml = ''
    }
  }

  let footerHtml = ''
  if (hasFooter && footerJson) {
    try {
      footerHtml = generateHTML(footerJson, hfExtensions)
    } catch {
      footerHtml = ''
    }
  }

  // Decide header/footer flex basis: auto-size if content, else collapse
  const headerFlex = hasHeader ? 'flex: 0 0 auto;' : 'flex: 0 0 0; overflow: hidden;'
  const footerFlex = hasFooter ? 'flex: 0 0 auto;' : 'flex: 0 0 0; overflow: hidden;'

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
      font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Pre-pagination: flow container holds raw content */
    #flow {
      width: 210mm;
      padding: 6.35mm 16.9mm;
    }

    /* Post-pagination: hide flow, show pages */
    body.paginated #flow { display: none; }

    section.page {
      width: 210mm;
      height: 297mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    section.page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    section.page > header {
      ${headerFlex}
      padding: 6.35mm 16.9mm 0 16.9mm;
      font-size: 12px;
    }

    section.page > main {
      flex: 1;
      padding: 6.35mm 16.9mm;
      overflow: hidden;
    }

    section.page > main > :first-child { margin-top: 0 !important; }
    section.page > main > :last-child { margin-bottom: 0 !important; }

    section.page > footer {
      ${footerFlex}
      padding: 0 16.9mm 6.35mm 16.9mm;
      font-size: 12px;
    }

    /* Fallback page number (shown when no custom footer) */
    section.page > footer.page-number-only {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9pt;
      color: #666;
      padding: 0 16.9mm 6.35mm 16.9mm;
    }

    /* Typography */
    h1 { font-size: 24pt; font-weight: 700; margin-bottom: 8pt; }
    h2 { font-size: 18pt; font-weight: 700; margin-bottom: 6pt; }
    h3 { font-size: 14pt; font-weight: 700; margin-bottom: 4pt; }
    h4 { font-size: 12pt; font-weight: 700; margin-bottom: 4pt; }
    h5 { font-size: 10pt; font-weight: 700; margin-bottom: 2pt; }
    h6 { font-size: 9pt; font-weight: 700; margin-bottom: 2pt; }

    p { margin-bottom: 6pt; }

    main p:empty::before,
    #flow p:empty::before { content: "\\00a0"; }

    main p:empty,
    #flow p:empty { min-height: 1em; }

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
  <!-- Header/footer templates for pagination script -->
  <template id="hf-header">${headerHtml}</template>
  <template id="hf-footer">${footerHtml}</template>

  <div id="flow" class="ProseMirror">${bodyHtml}</div>
  <script>
    (function paginate() {
      var flow = document.getElementById('flow');
      if (!flow) return;

      var headerTpl = document.getElementById('hf-header');
      var footerTpl = document.getElementById('hf-footer');
      var hasHeader = ${hasHeader ? 'true' : 'false'};
      var hasFooter = ${hasFooter ? 'true' : 'false'};

      var children = Array.from(flow.children);

      function createPage() {
        var section = document.createElement('section');
        section.className = 'page';

        var header = document.createElement('header');
        if (hasHeader && headerTpl) {
          header.innerHTML = headerTpl.innerHTML;
        }

        var main = document.createElement('main');

        var footer = document.createElement('footer');
        if (hasFooter && footerTpl) {
          footer.innerHTML = footerTpl.innerHTML;
        } else {
          footer.className = 'page-number-only';
        }

        section.appendChild(header);
        section.appendChild(main);
        section.appendChild(footer);

        return section;
      }

      var pages = [];
      var currentPage = createPage();
      document.body.appendChild(currentPage);
      pages.push(currentPage);

      var currentMain = currentPage.querySelector('main');

      for (var i = 0; i < children.length; i++) {
        var el = children[i];

        if (el.getAttribute('data-type') === 'page-break') {
          currentPage = createPage();
          document.body.appendChild(currentPage);
          pages.push(currentPage);
          currentMain = currentPage.querySelector('main');
          continue;
        }

        currentMain.appendChild(el);

        function overflows(main) {
          const r = main.getBoundingClientRect()
          const bottom = r.bottom - 0.5
          const last = main.lastElementChild
          if (!last) return false
          const lr = last.getBoundingClientRect()
          return lr.bottom > bottom
        }

        if (overflows(currentMain)) {
          currentMain.removeChild(el);

          currentPage = createPage();
          document.body.appendChild(currentPage);
          pages.push(currentPage);
          currentMain = currentPage.querySelector('main');

          currentMain.appendChild(el);
        }
      }

      // Write page numbers into footers that don't have custom content
      var totalPages = pages.length;
      for (var p = 0; p < totalPages; p++) {
        var footer = pages[p].querySelector('footer');
        if (!hasFooter) {
          footer.textContent = 'Page ' + (p + 1) + ' of ' + totalPages;
        }
      }

      document.body.classList.add('paginated');
      window.__PAGINATION_DONE__ = true;
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
