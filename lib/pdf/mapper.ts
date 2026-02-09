import type { JSONContent } from '@tiptap/core'
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import { mapFontFamilyToPDFMake, defaultPDFSettings } from './fonts'

/**
 * TipTap JSON → PDFMake Mapper
 * 
 * Converts TipTap editor JSON content into PDFMake document definition.
 * Preserves formatting, styling, and layout for 1:1 PDF output.
 */

interface TextStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: string | number
  fontFamily?: string
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  color?: string
}

/**
 * Extract text style from TipTap marks
 */
function extractTextStyle(node: JSONContent): TextStyle {
  const style: TextStyle = {}
  
  // Check for marks (bold, italic, underline)
  if (node.marks) {
    for (const mark of node.marks) {
      if (mark.type === 'bold') {
        style.bold = true
      } else if (mark.type === 'italic') {
        style.italic = true
      } else if (mark.type === 'underline') {
        style.underline = true
      } else if (mark.type === 'textStyle' || mark.type === 'fontSize') {
        // Font size can be in textStyle mark or fontSize mark
        const fontSize = mark.attrs?.fontSize || mark.attrs?.fontSize
        if (fontSize) {
          // Convert px to pt (1px ≈ 0.75pt, but we'll parse the number)
          const sizeMatch = fontSize.toString().match(/(\d+(?:\.\d+)?)/)
          if (sizeMatch) {
            const px = parseFloat(sizeMatch[1])
            // Convert px to pt (1pt = 1.33px, so px / 1.33 ≈ pt)
            style.fontSize = Math.round(px / 1.33)
          }
        }
        // Font family
        if (mark.attrs?.fontFamily) {
          style.fontFamily = mark.attrs.fontFamily
        }
      }
    }
  }
  
  // Check node attributes for text alignment
  if (node.attrs?.textAlign) {
    style.textAlign = node.attrs.textAlign
  }
  
  return style
}

/**
 * Convert TipTap text style to PDFMake text style
 */
function toPDFMakeTextStyle(style: TextStyle): any {
  const pdfStyle: any = {}
  
  if (style.bold) pdfStyle.bold = true
  if (style.italic) pdfStyle.italics = true
  if (style.fontSize) pdfStyle.fontSize = style.fontSize
  if (style.fontFamily) {
    pdfStyle.font = mapFontFamilyToPDFMake(style.fontFamily)
  }
  if (style.textAlign) {
    pdfStyle.alignment = style.textAlign
  }
  if (style.color) {
    // Convert hex color to RGB array for PDFMake
    const hex = style.color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    pdfStyle.color = [r, g, b]
  }
  
  // Handle underline (PDFMake doesn't have native underline, but we can use decoration)
  if (style.underline) {
    pdfStyle.decoration = 'underline'
  }
  
  return pdfStyle
}

/**
 * Map TipTap text node to PDFMake text
 */
function mapTextNode(node: JSONContent): Content {
  const style = extractTextStyle(node)
  const pdfStyle = toPDFMakeTextStyle(style)
  
  const text = node.text || ''
  
  if (Object.keys(pdfStyle).length === 0) {
    return text
  }
  
  return { text, ...pdfStyle }
}

/**
 * Map TipTap paragraph node to PDFMake content
 */
function mapParagraph(node: JSONContent): Content {
  if (!node.content || node.content.length === 0) {
    return { text: '\n', margin: [0, 4, 0, 4] }
  }
  
  const style = extractTextStyle(node)
  const pdfStyle = toPDFMakeTextStyle(style)
  
  const content: any[] = []
  
  for (const child of node.content) {
    if (child.type === 'text') {
      const textNode = mapTextNode(child)
      // PDFMake text arrays can contain strings or objects
      if (typeof textNode === 'string') {
        content.push(textNode)
      } else {
        content.push(textNode)
      }
    } else if (child.type === 'field') {
      // Field node: prioritize value, then label, then placeholder
      // In contract mode, value should be filled
      const fieldAttrs = child.attrs || {}
      const fieldValue = fieldAttrs.value
      const fieldLabel = fieldAttrs.label
      
      // Debug logging for fields
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Field mapping:', {
          id: fieldAttrs.id,
          label: fieldLabel,
          value: fieldValue,
          valueType: typeof fieldValue,
          hasValue: fieldValue !== undefined && fieldValue !== null && fieldValue !== '',
          rawAttrs: child.attrs
        })
      }
      
      // Use value if present and not empty, otherwise label, otherwise placeholder
      // Check explicitly for undefined/null/empty string
      let displayValue = '________'
      if (fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== '') {
        displayValue = String(fieldValue).trim()
      } else if (fieldLabel && String(fieldLabel).trim() !== '') {
        displayValue = String(fieldLabel).trim()
      }
      
      const fieldStyle = extractTextStyle(child)
      const fieldPdfStyle = toPDFMakeTextStyle(fieldStyle)
      // Always add underline decoration to fields (they represent fillable fields)
      content.push({ text: displayValue, decoration: 'underline', ...fieldPdfStyle })
    } else if (child.type === 'hardBreak') {
      content.push('\n')
    } else {
      // Recursively map other inline nodes
      const mapped = mapNode(child)
      if (mapped) {
        if (Array.isArray(mapped)) {
          // Flatten arrays into content
          for (const item of mapped) {
            if (typeof item === 'string') {
              content.push(item)
            } else if (item && typeof item === 'object') {
              content.push(item)
            }
          }
        } else {
          if (typeof mapped === 'string') {
            content.push(mapped)
          } else if (mapped) {
            content.push(mapped)
          }
        }
      }
    }
  }
  
  // If no content was generated, return empty paragraph
  if (content.length === 0) {
    return { text: '\n', margin: [0, 4, 0, 4] }
  }
  
  // PDFMake: if content array has only one string, we can simplify
  // Otherwise, use array format
  const result: any = {
    text: content.length === 1 && typeof content[0] === 'string' ? content[0] : content,
    margin: [0, 4, 0, 4], // Vertical spacing between paragraphs
  }
  
  // Apply paragraph-level alignment
  if (style.textAlign) {
    result.alignment = style.textAlign
  }
  
  return result
}

/**
 * Map TipTap heading node to PDFMake content
 */
function mapHeading(node: JSONContent): Content {
  if (!node.content || node.content.length === 0) {
    return { text: '\n', margin: [0, 8, 0, 4] }
  }
  
  const level = node.attrs?.level || 1
  const baseFontSize = defaultPDFSettings.defaultFontSize
  
  // Heading sizes: H1 = 24pt, H2 = 18pt, H3 = 14pt
  const headingSizes: Record<number, number> = {
    1: 24,
    2: 18,
    3: 14,
  }
  
  const fontSize = headingSizes[level] || baseFontSize
  const style = extractTextStyle(node)
  const pdfStyle = toPDFMakeTextStyle({ ...style, fontSize, bold: true })
  
  const content: any[] = []
  
  for (const child of node.content) {
    if (child.type === 'text') {
      const textNode = mapTextNode(child)
      if (typeof textNode === 'string') {
        content.push(textNode)
      } else {
        content.push(textNode)
      }
    } else if (child.type === 'field') {
      // Field in heading: prioritize value
      const fieldAttrs = child.attrs || {}
      const fieldValue = fieldAttrs.value
      const fieldLabel = fieldAttrs.label
      const displayValue = (fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== '')
        ? String(fieldValue).trim()
        : (fieldLabel && String(fieldLabel).trim() !== '')
        ? String(fieldLabel).trim()
        : '________'
      // Add underline decoration to fields
      content.push({ text: displayValue, decoration: 'underline', ...pdfStyle })
    } else if (child.type === 'hardBreak') {
      content.push('\n')
    } else {
      // Handle other inline nodes
      const mapped = mapNode(child)
      if (mapped) {
        if (Array.isArray(mapped)) {
          content.push(...mapped.filter(item => item !== null))
        } else {
          content.push(mapped)
        }
      }
    }
  }
  
  if (content.length === 0) {
    return { text: '\n', margin: [0, 8, 0, 4] }
  }
  
  return {
    text: content.length === 1 && typeof content[0] === 'string' ? content[0] : content,
    fontSize,
    bold: true,
    margin: [0, level === 1 ? 12 : 8, 0, 4],
    ...pdfStyle,
  }
}

/**
 * Map TipTap bullet list node to PDFMake content
 */
function mapBulletList(node: JSONContent): Content {
  if (!node.content || node.content.length === 0) {
    return { text: '', margin: [0, 4, 0, 4] }
  }
  
  const items: Content[] = []
  
  for (const listItem of node.content) {
    if (listItem.type === 'listItem' && listItem.content) {
      const itemContent: any[] = []
      
      for (const child of listItem.content) {
        if (child.type === 'paragraph') {
          const para = mapParagraph(child)
          if (Array.isArray(para)) {
            itemContent.push(...para.filter(item => item !== null))
          } else if (para) {
            itemContent.push(para)
          }
        } else if (child.type === 'bulletList' || child.type === 'orderedList') {
          // Nested list
          const nested = mapNode(child)
          if (nested) {
            if (Array.isArray(nested)) {
              itemContent.push(...nested.filter(item => item !== null))
            } else {
              itemContent.push(nested)
            }
          }
        }
      }
      
      if (itemContent.length > 0) {
        items.push({
          text: itemContent.length === 1 && typeof itemContent[0] === 'string' ? itemContent[0] : itemContent,
        })
      }
    }
  }
  
  return {
    ul: items,
    margin: [0, 4, 0, 4],
  }
}

/**
 * Map TipTap ordered list node to PDFMake content
 */
function mapOrderedList(node: JSONContent): Content | Content[] {
  if (!node.content || node.content.length === 0) {
    return { text: '', margin: [0, 4, 0, 4] }
  }
  
  const listStyleType = node.attrs?.listStyleType || 'decimal'
  const items: Content[] = []
  const nestedListsAfterItems: Content[] = []
  
  for (const listItem of node.content) {
    if (listItem.type === 'listItem' && listItem.content) {
      const itemContent: any[] = []
      const nestedListsForThisItem: Content[] = []
      
      for (const child of listItem.content) {
        if (child.type === 'paragraph') {
          const para = mapParagraph(child)
          if (Array.isArray(para)) {
            itemContent.push(...para.filter(item => item !== null && item !== undefined))
          } else if (para) {
            itemContent.push(para)
          }
        } else if (child.type === 'bulletList' || child.type === 'orderedList') {
          // Nested list - extract and add separately with indentation
          const nested = mapNode(child)
          if (nested && typeof nested === 'object') {
            const nestedObj = nested as any
            if (nestedObj.ol || nestedObj.ul) {
              // Create indented nested list
              nestedListsForThisItem.push({
                ...nestedObj,
                margin: [30, 4, 0, 4] as [number, number, number, number],
              })
            } else if (Array.isArray(nested)) {
              // Handle array of nested items
              for (const nestedItem of nested) {
                if (nestedItem && typeof nestedItem === 'object') {
                  const nestedItemObj = nestedItem as any
                  if (nestedItemObj.ol || nestedItemObj.ul) {
                    nestedListsForThisItem.push({
                      ...nestedItemObj,
                      margin: [30, 4, 0, 4] as [number, number, number, number],
                    })
                  }
                }
              }
            }
          }
        }
      }
      
      // Add regular content to list item
      if (itemContent.length > 0) {
        const flattened: any[] = []
        for (const item of itemContent) {
          if (typeof item === 'string') {
            flattened.push(item)
          } else if (item && typeof item === 'object') {
            if (item.text && Array.isArray(item.text)) {
              flattened.push(...item.text)
            } else {
              flattened.push(item)
            }
          }
        }
        
        const finalText = flattened.length === 1 && typeof flattened[0] === 'string'
          ? flattened[0]
          : flattened.length > 0
          ? flattened
          : ''
        
        if (finalText) {
          items.push({ text: finalText })
        }
      }
      
      // Collect nested lists to add after this item
      nestedListsAfterItems.push(...nestedListsForThisItem)
    }
  }
  
  if (items.length === 0) {
    return { text: '', margin: [0, 4, 0, 4] }
  }
  
  const pdfListType = mapListStyleType(listStyleType) as any
  const mainList = {
    ol: items,
    type: pdfListType,
    margin: [0, 4, 0, 4] as [number, number, number, number],
  }
  
  // If there are nested lists, return array with main list and nested lists
  if (nestedListsAfterItems.length > 0) {
    return [mainList, ...nestedListsAfterItems]
  }
  
  return mainList
}

/**
 * Map CSS list-style-type to PDFMake list type
 */
function mapListStyleType(listStyleType: string): string {
  const mapping: Record<string, string> = {
    'decimal': 'decimal',
    'upper-roman': 'upper-roman',
    'lower-roman': 'lower-roman',
    'upper-alpha': 'upper-alpha',
    'lower-alpha': 'lower-alpha',
  }
  
  return mapping[listStyleType] || 'decimal'
}

/**
 * Map TipTap table node to PDFMake table
 */
function mapTable(node: JSONContent): Content {
  if (!node.content || node.content.length === 0) {
    return { text: '', margin: [0, 4, 0, 4] }
  }
  
  const tableBody: any[][] = []
  
  for (const row of node.content) {
    if (row.type === 'tableRow' && row.content) {
      const tableRow: any[] = []
      
      for (const cell of row.content) {
        if ((cell.type === 'tableCell' || cell.type === 'tableHeader') && cell.content) {
          const cellContent: Content[] = []
          
          for (const child of cell.content) {
            if (child.type === 'paragraph') {
              const para = mapParagraph(child)
              if (Array.isArray(para)) {
                cellContent.push(...para)
              } else {
                cellContent.push(para)
              }
            }
          }
          
          tableRow.push({
            text: cellContent.length > 0 ? cellContent : '',
            ...(cell.type === 'tableHeader' ? { bold: true } : {}),
          })
        }
      }
      
      if (tableRow.length > 0) {
        tableBody.push(tableRow)
      }
    }
  }
  
  return {
    table: {
      headerRows: 0, // We'll detect headers by checking cell type
      widths: Array(tableBody[0]?.length || 0).fill('*'), // Equal widths
      body: tableBody,
    },
    margin: [0, 4, 0, 4],
  }
}

/**
 * Map TipTap blockquote node to PDFMake content
 */
function mapBlockquote(node: JSONContent): Content {
  if (!node.content || node.content.length === 0) {
    return { text: '', margin: [0, 4, 0, 4] }
  }
  
  const content: Content[] = []
  
  for (const child of node.content) {
    if (child.type === 'paragraph') {
      const para = mapParagraph(child)
      if (Array.isArray(para)) {
        content.push(...para)
      } else {
        content.push(para)
      }
    }
  }
  
  return {
    text: content,
    margin: [20, 4, 0, 4], // Left indent for blockquote
    italics: true,
  }
}

/**
 * Map TipTap field node to PDFMake text
 */
function mapField(node: JSONContent): Content {
  // Prioritize value (filled in contract mode), then label, then placeholder
  const value = node.attrs?.value
  const label = node.attrs?.label
  const displayValue = (value && String(value).trim()) || (label && String(label).trim()) || '________'
  
  const style = extractTextStyle(node)
  const pdfStyle = toPDFMakeTextStyle(style)
  
  return {
    text: displayValue,
    decoration: 'underline', // Fields should always have underlines in PDF
    ...pdfStyle,
  }
}

/**
 * Map a TipTap node to PDFMake content
 */
function mapNode(node: JSONContent): Content | Content[] | null {
  if (!node) return null
  
  switch (node.type) {
    case 'doc':
      // Document root - map all children
      if (!node.content) return null
      const docContent: Content[] = []
      for (const child of node.content) {
        const mapped = mapNode(child)
        if (mapped) {
          if (Array.isArray(mapped)) {
            // Process array items and handle nested lists
            for (const item of mapped) {
              if (item && typeof item === 'object' && (item as any).__isNestedList) {
                // Extract nested list and add with proper formatting
                const { __isNestedList, ...nestedList } = item as any
                docContent.push(nestedList)
              } else if (item !== null && item !== undefined) {
                docContent.push(item)
              }
            }
          } else {
            docContent.push(mapped)
          }
        }
      }
      return docContent
      
    case 'paragraph':
      return mapParagraph(node)
      
    case 'heading':
      return mapHeading(node)
      
    case 'bulletList':
      return mapBulletList(node)
      
    case 'orderedList': {
      const result = mapOrderedList(node)
      // mapOrderedList can return Content or Content[] (when nested lists exist)
      return result
    }
      
    case 'listItem':
      // List items are handled by their parent list
      return null
      
    case 'table':
      return mapTable(node)
      
    case 'blockquote':
      return mapBlockquote(node)
      
    case 'field':
      return mapField(node)
      
    case 'hardBreak':
      return { text: '\n' }
      
    case 'text':
      return mapTextNode(node)
      
    default:
      // Unknown node type - try to extract text if possible
      if (node.content) {
        const content: Content[] = []
        for (const child of node.content) {
          const mapped = mapNode(child)
          if (mapped) {
            if (Array.isArray(mapped)) {
              content.push(...mapped)
            } else {
              content.push(mapped)
            }
          }
        }
        return content.length > 0 ? content : null
      }
      return null
  }
}

/**
 * Convert TipTap JSON to PDFMake document definition
 */
export function mapTipTapToPDFMake(
  tiptapJSON: JSONContent,
  options: {
    title?: string
    pageMargins?: number[]
    pageSize?: string
  } = {}
): TDocumentDefinitions {
  const content = mapNode(tiptapJSON)
  
  // Ensure content is always an array and process nested lists
  let finalContent: Content[] = []
  if (Array.isArray(content)) {
    // Filter and process nested lists
    for (const item of content) {
      if (item && typeof item === 'object' && (item as any).__isNestedList) {
        // Extract nested list
        const { __isNestedList, ...nestedList } = item as any
        finalContent.push(nestedList)
      } else if (item !== null && item !== undefined) {
        finalContent.push(item)
      }
    }
  } else if (content) {
    finalContent = [content]
  }
  
  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('📄 PDF Content Count:', finalContent.length)
    console.log('📄 First few items:', JSON.stringify(finalContent.slice(0, 3), null, 2))
  }
  
  const docDefinition: TDocumentDefinitions = {
    content: finalContent,
    defaultStyle: {
      font: defaultPDFSettings.defaultFont,
      fontSize: defaultPDFSettings.defaultFontSize,
      lineHeight: 1.5,
    },
    // Don't specify fonts here - let PDFMake use standard fonts
    // Fonts will be provided when creating the printer instance
    pageSize: (options.pageSize || defaultPDFSettings.pageSize) as any,
    pageOrientation: defaultPDFSettings.pageOrientation,
    pageMargins: (options.pageMargins || defaultPDFSettings.pageMargins) as [number, number, number, number],
    
    // Footer with page numbers
    footer: (currentPage: number, pageCount: number) => {
      return {
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: 'center',
        fontSize: 9,
        margin: [0, 10, 0, 0],
      }
    },
  }
  
  return docDefinition
}
