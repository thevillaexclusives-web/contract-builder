import { TFontDictionary } from 'pdfmake/interfaces'

/**
 * PDFMake Font Definitions
 * 
 * These fonts are used to match the editor's typography.
 * PDFMake comes with built-in fonts: Roboto, Courier, Times-Roman, Helvetica
 * 
 * For 1:1 matching, we'll use standard fonts that closely match browser defaults.
 */
export const pdfFonts: TFontDictionary = {
  // Default serif font (matches Times New Roman)
  Times: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italics: 'Times-Italic',
    bolditalics: 'Times-BoldItalic',
  },
  // Default sans-serif font (matches Arial/Helvetica)
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
  // Monospace font
  Courier: {
    normal: 'Courier',
    bold: 'Courier-Bold',
    italics: 'Courier-Oblique',
    bolditalics: 'Courier-BoldOblique',
  },
}

/**
 * Map CSS font-family to PDFMake font name
 */
export function mapFontFamilyToPDFMake(fontFamily: string | undefined): string {
  if (!fontFamily) return 'Times' // Default to serif
  
  const normalized = fontFamily.toLowerCase().trim()
  
  // Check for common font families
  if (normalized.includes('times') || normalized.includes('serif')) {
    return 'Times'
  }
  if (normalized.includes('helvetica') || normalized.includes('arial') || normalized.includes('sans-serif')) {
    return 'Helvetica'
  }
  if (normalized.includes('courier') || normalized.includes('monospace')) {
    return 'Courier'
  }
  
  // Default to Times (serif)
  return 'Times'
}

/**
 * Default PDF document settings
 */
export const defaultPDFSettings = {
  pageSize: 'A4',
  pageOrientation: 'portrait' as const,
  pageMargins: [40, 60, 40, 60], // [left, top, right, bottom] in points (1 inch = 72 points)
  defaultFont: 'Times',
  defaultFontSize: 12, // 12pt = 16px (roughly)
}
