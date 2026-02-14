export const PAGE_CONFIG = {
  width: 794,
  height: 1123,
  gap: 24,
  paddingX: 64,
  paddingTop: 24,
  paddingBottom: 24,
  headerHeight: 96,
  footerHeight: 72,
} as const

// Derived values
export const contentTopOffset = PAGE_CONFIG.paddingTop + PAGE_CONFIG.headerHeight // 120
export const contentUsableHeight =
  PAGE_CONFIG.height -
  PAGE_CONFIG.headerHeight -
  PAGE_CONFIG.footerHeight -
  PAGE_CONFIG.paddingTop -
  PAGE_CONFIG.paddingBottom // 907
