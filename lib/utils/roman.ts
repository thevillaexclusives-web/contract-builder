// Utility functions for Roman numerals and letters

/**
 * Convert number to Roman numeral
 * @param num - Number to convert (1-3999)
 * @returns Roman numeral string (I, II, III, IV, V, etc.)
 */
export function toRoman(num: number): string {
  if (num < 1 || num > 3999) {
    return num.toString()
  }

  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
  const numerals = [
    'M',
    'CM',
    'D',
    'CD',
    'C',
    'XC',
    'L',
    'XL',
    'X',
    'IX',
    'V',
    'IV',
    'I',
  ]
  
  let result = ''
  for (let i = 0; i < values.length; i++) {
    while (num >= values[i]) {
      result += numerals[i]
      num -= values[i]
    }
  }
  return result
}

/**
 * Convert number to letter (1 -> A, 2 -> B, etc.)
 * @param num - Number to convert (1-26 for A-Z)
 * @returns Letter string (A, B, C, etc.)
 */
export function toLetter(num: number): string {
  if (num < 1 || num > 26) {
    return String.fromCharCode(64 + num) // Fallback
  }
  return String.fromCharCode(64 + num) // A = 65, B = 66, etc.
}
