// Spreadsheets run cells that start with these, and filenames and names are user text.
const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: string) {
  const safe = value.length > 1 && FORMULA_START.test(value) ? `'${value}` : value
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replaceAll('"', '""')}"`
  }
  return safe
}
