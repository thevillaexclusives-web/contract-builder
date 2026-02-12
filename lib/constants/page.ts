/**
 * A4 page dimensions at 96 DPI
 *
 * A4 = 210mm x 297mm
 * At 96 DPI: 794px x 1122px
 * 22mm padding = ~83px per side, top+bottom = ~166px
 * Content height = 1122 - 166 = 956px
 */

export const A4_WIDTH = 794
export const A4_PAGE_HEIGHT = 1122
export const A4_PADDING_MM = 22
export const A4_PADDING_PX = 83 // 22mm at 96 DPI
export const A4_CONTENT_HEIGHT = 956 // A4_PAGE_HEIGHT - (A4_PADDING_PX * 2)
export const PAGE_GAP = 40 // Gray gap between pages in px
