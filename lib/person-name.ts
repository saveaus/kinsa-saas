function capitalisePiece(piece: string) {
  if (piece !== piece.toLowerCase()) return piece
  return piece.charAt(0).toUpperCase() + piece.slice(1)
}

export function formatPersonLabel(value: string) {
  return value
    .trim()
    .split(/(\s+)/)
    .map((part) =>
      /^\s+$/.test(part)
        ? part
        : part
            .split(/(-)/)
            .map((piece) => (piece === "-" ? piece : capitalisePiece(piece)))
            .join("")
    )
    .join("")
}

export function personName(
  first: string | null | undefined,
  last: string | null | undefined
) {
  return formatPersonLabel(
    [first, last].filter((part) => part && part.trim()).join(" ")
  )
}
