const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}

export function parseAbn(value: string) {
  const digits = digitsOnly(value)
  return digits.length === 0 ? null : digits
}

export function formatAbn(abn: string | null | undefined) {
  if (!abn) return null
  const digits = digitsOnly(abn)
  if (digits.length !== 11) return abn
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
}

export function isValidAbn(value: string) {
  const digits = digitsOnly(value)
  if (digits.length !== 11) return false
  const numbers = digits.split("").map(Number)
  numbers[0] -= 1
  const sum = numbers.reduce((total, number, index) => total + number * WEIGHTS[index], 0)
  return sum % 89 === 0
}
