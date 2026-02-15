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

/**
 * Post-process HTML so empty/whitespace-only paragraphs retain line height.
 * generateHTML produces <p></p> for empty paragraphs, which collapses in
 * Chromium. ProseMirror renders them as <p><br></p> so they keep height.
 * Handles: <p></p>, <p> </p>, <p>\n</p>, and paragraphs with only attributes.
 */
function preserveEmptyParagraphs(html: string): string {
  return html.replace(/<p([^>]*)>(\s*)<\/p>/g, '<p$1>&nbsp;</p>')
}

export function renderContractHtml(
  bodyJson: JSONContent,
  contractName: string,
  headerJson?: JSONContent,
  footerJson?: JSONContent
): string {
  const bodyHtml = preserveEmptyParagraphs(generateHTML(bodyJson, extensions))

  const hasHeader = !isDocEmpty(headerJson)
  const hasFooter = !isDocEmpty(footerJson)

  let headerHtml = ''
  if (hasHeader && headerJson) {
    try {
      headerHtml = preserveEmptyParagraphs(generateHTML(headerJson, hfExtensions))
    } catch {
      headerHtml = ''
    }
  }

  let footerHtml = ''
  if (hasFooter && footerJson) {
    try {
      footerHtml = preserveEmptyParagraphs(generateHTML(footerJson, hfExtensions))
    } catch {
      footerHtml = ''
    }
  }

  // Header/footer always reserve min-height (matching editor's PAGE_CONFIG).
  // When content exists, flex auto-sizes; when empty, min-height holds space.
  const headerFlex = 'flex: 0 0 auto;'
  const footerFlex = 'flex: 0 0 auto;'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(contractName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
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
      font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
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
    #flow > :first-child { margin-top: 0 !important; }
    #flow > :last-child { margin-bottom: 0 !important; }

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
      min-height: 25.4mm; /* 96px — matches editor PAGE_CONFIG.headerHeight */
      padding: 6.35mm 16.9mm 0 16.9mm;
      font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.5;
    }
    /* Header/footer p inherits 12px; inline fontSize span marks override when present */
    section.page > header p,
    section.page > footer p {
      font-size: inherit;
      margin: 0 0 0.5em 0;
      line-height: inherit;
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
      min-height: 19mm; /* 72px — matches editor PAGE_CONFIG.footerHeight */
      padding: 0 16.9mm 6.35mm 16.9mm;
      font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
    }

    /* Fallback page number (shown when no custom footer) */
    section.page > footer.page-number-only {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      font-size: 9pt;
      color: #666;
    }

    /*
     * Body typography — scoped to main/#flow only.
     * Header/footer use 12px inherited from their container.
     * Mirrors editor CSS (.ProseMirror rules in globals.css).
     */

    /* Paragraphs: editor uses margin: 0 0 0.5em 0; line-height: 1.5; font-size: 16px */
    main p,
    #flow p {
      font-size: 16px;
      margin: 0 0 0.5em 0;
      line-height: 1.5;
    }

    /* Empty paragraphs (user spacing) must take up a full line */
    main p:empty::before,
    #flow p:empty::before { content: "\\00a0"; }
    main p:empty,
    #flow p:empty { min-height: 1em; }

    /* Headings: editor uses margin: 1em 0 0.5em 0; line-height: 1.3 */
    main h1, #flow h1 { font-size: 2em; font-weight: 700; margin: 1em 0 0.5em 0; line-height: 1.3; }
    main h2, #flow h2 { font-size: 1.5em; font-weight: 700; margin: 1em 0 0.5em 0; line-height: 1.3; }
    main h3, #flow h3 { font-size: 1.17em; font-weight: 700; margin: 1em 0 0.5em 0; line-height: 1.3; }
    main h4, #flow h4 { font-size: 1em; font-weight: 700; margin: 1em 0 0.5em 0; line-height: 1.3; }
    main h5, #flow h5 { font-size: 0.83em; font-weight: 700; margin: 1em 0 0.5em 0; line-height: 1.3; }
    main h6, #flow h6 { font-size: 0.67em; font-weight: 700; margin: 1em 0 0.5em 0; line-height: 1.3; }

    /* Lists: editor uses margin: 0.5em 0; padding-left: 1.5em; line-height: 1.5 */
    ul, ol {
      margin: 0.5em 0;
      padding-left: 1.5em;
      line-height: 1.5;
    }

    /* List items: editor uses margin: 0.25em 0; line-height: 1.5 */
    li {
      margin: 0.25em 0;
      line-height: 1.5;
    }

    strong { font-weight: 700; }
    em { font-style: italic; }
    u { text-decoration: underline; }

    /* Tables: editor uses margin: 1em 0; td/th padding: 8px 12px; line-height: 1.5 */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid #000;
      padding: 8px 12px;
      text-align: left;
      vertical-align: top;
      line-height: 1.5;
    }
    th {
      font-weight: 700;
    }

    /* Blockquotes: editor uses margin: 1em 0; padding-left: 1em; border-left: 3px solid #ddd */
    blockquote {
      border-left: 3px solid #ddd;
      padding-left: 1em;
      margin: 1em 0;
      line-height: 1.5;
    }

    /* Code */
    code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.875em;
      background: #f4f4f4;
      padding: 1px 3px;
      border-radius: 2px;
    }
    pre {
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.875em;
      background: #f4f4f4;
      padding: 8px;
      margin: 0.5em 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.5;
    }

    /* Horizontal rule */
    hr {
      border: none;
      border-top: 1px solid #000;
      margin: 8px 0;
    }

    /* Field nodes */
    .field-node {
      display: inline-block;
      min-width: 80px;
      max-width: 300px;
      padding: 0 4px;
      vertical-align: baseline;
      font-size: inherit;
      font-family: inherit;
      border-bottom: 1px solid #333;
    }

    /* Header/footer field nodes inherit container font-size */
    section.page > header .field-node,
    section.page > footer .field-node {
      font-size: inherit;
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
          return main.scrollHeight > main.clientHeight + 1;
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
