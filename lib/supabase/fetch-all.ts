const PAGE_SIZE = 1000

type Page<Row> = PromiseLike<{
  data: Row[] | null
  error: { message: string } | null
}>

// PostgREST caps a response at 1000 rows without saying so, which would turn
// compliance reads into a false all-clear. The query needs a stable order.
export async function fetchAll<Row>(
  page: (from: number, to: number) => Page<Row>
) {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE_SIZE) return { data: rows, error: null }
  }
}
