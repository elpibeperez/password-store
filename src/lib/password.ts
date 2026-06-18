export interface PasswordOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
  excludeAmbiguous: boolean
}

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const NUMBERS = '0123456789'
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?'
const AMBIGUOUS = /[0Oo1lI!|]/g

export function generatePassword(options: PasswordOptions): string {
  let chars = ''
  if (options.uppercase) chars += UPPERCASE
  if (options.lowercase) chars += LOWERCASE
  if (options.numbers) chars += NUMBERS
  if (options.symbols) chars += SYMBOLS
  if (options.excludeAmbiguous) chars = chars.replace(AMBIGUOUS, '')
  if (!chars) chars = LOWERCASE

  const array = new Uint32Array(options.length)
  crypto.getRandomValues(array)
  let result = ''
  for (let i = 0; i < options.length; i++) {
    result += chars[array[i] % chars.length]
  }
  return result
}

export const defaultOptions: PasswordOptions = {
  length: 24,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false
}
