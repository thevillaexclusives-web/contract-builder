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
import { LineHeight } from '@/components/contract-editor-v2/extensions/line-height'

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
  LineHeight,
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
 * Mark empty/whitespace-only paragraphs so CSS can give them a stable line box.
 * generateHTML produces <p></p> for empty paragraphs. We keep them truly empty
 * (no &nbsp; text node) and add data-empty so CSS ::before + min-height applies.
 * This matches ProseMirror's rendered height for empty paragraphs.
 */
function markEmptyParagraphs(html: string): string {
  return html.replace(/<p([^>]*)>(\s*)<\/p>/g, '<p$1 data-empty="true"></p>')
}

export function renderContractHtml(
  bodyJson: JSONContent,
  contractName: string,
  headerJson?: JSONContent,
  footerJson?: JSONContent
): string {
  const bodyHtml = markEmptyParagraphs(generateHTML(bodyJson, extensions))

  const hasHeader = !isDocEmpty(headerJson)
  const hasFooter = !isDocEmpty(footerJson)

  let headerHtml = ''
  if (hasHeader && headerJson) {
    try {
      headerHtml = markEmptyParagraphs(generateHTML(headerJson, hfExtensions))
    } catch {
      headerHtml = ''
    }
  }

  let footerHtml = ''
  if (hasFooter && footerJson) {
    try {
      footerHtml = markEmptyParagraphs(generateHTML(footerJson, hfExtensions))
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
    section.page > footer { 
      font-size: 16px; 
      line-height: 1.5;
    }
    /* Header/footer p inherits 16px; inline fontSize span marks override when present */
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

    /* Empty paragraphs (user spacing) must take up a full line.
       data-empty is added by markEmptyParagraphs(); p:empty is fallback. */
    main p[data-empty]::before,
    main p:empty::before,
    #flow p[data-empty]::before,
    #flow p:empty::before { content: "\\00a0"; }
    main p[data-empty],
    main p:empty,
    #flow p[data-empty],
    #flow p:empty { min-height: 1em; display: block; }

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

    /* Tables: match editor tight padding */
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid #000;
      padding: 1px 2px;
      text-align: left;
      vertical-align: top;
      line-height: 1.5;
      min-width: 1em;
      box-sizing: border-box;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    th {
      font-weight: 700;
    }

    /* Remove paragraph margins inside table cells */
    td p, th p {
      margin: 0;
      display: contents;
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

    /* Field nodes inside tables: fit cell width, no underline, no padding */
    td .field-node,
    th .field-node {
      display: block;
      width: 100%;
      max-width: 100%;
      min-width: 0 !important;
      padding: 0;
      margin: 0;
      border-bottom: none !important;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <!-- Header/footer templates for pagination script -->
  <template id="hf-header">${headerHtml}</template>
  <template id="hf-footer">${footerHtml}</template>

  <div id="flow" class="ProseMirror">${bodyHtml}</div>
  <script>
    (async function paginate() {
      var flow = document.getElementById('flow');
      if (!flow) return;

      // Wait for web fonts so text wrapping/heights are final
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Double-RAF: let layout fully settle after fonts load
      await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });

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

      // Pin <main> to an explicit pixel height so scrollHeight/clientHeight
      // comparisons are stable (avoids flex/mm rounding drift).
      function pinMainHeight(page) {
        var h = page.querySelector('header');
        var m = page.querySelector('main');
        var f = page.querySelector('footer');
        var pageH = page.getBoundingClientRect().height;
        var headerH = h.getBoundingClientRect().height;
        var footerH = f.getBoundingClientRect().height;
        m.style.height = (pageH - headerH - footerH) + 'px';
        m.style.flex = '0 0 auto';
      }

      function overflows(main) {
        return (main.scrollHeight - main.clientHeight) > 0.25;
      }

      var pages = [];
      var currentPage = createPage();
      document.body.appendChild(currentPage);
      pinMainHeight(currentPage);
      pages.push(currentPage);

      var currentMain = currentPage.querySelector('main');

      for (var i = 0; i < children.length; i++) {
        var el = children[i];

        if (el.getAttribute('data-type') === 'page-break') {
          currentPage = createPage();
          document.body.appendChild(currentPage);
          pinMainHeight(currentPage);
          pages.push(currentPage);
          currentMain = currentPage.querySelector('main');
          continue;
        }

        currentMain.appendChild(el);

        if (overflows(currentMain)) {
          currentMain.removeChild(el);

          currentPage = createPage();
          document.body.appendChild(currentPage);
          pinMainHeight(currentPage);
          pages.push(currentPage);
          currentMain = currentPage.querySelector('main');

          currentMain.appendChild(el);
          // If a single block is taller than a page, accept it (don't loop)
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
