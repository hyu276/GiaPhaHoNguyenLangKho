/**
 * Load all rows from a PostgREST query without silently accepting its row cap.
 * Callers must order by a stable unique key and request count: "exact".
 * A changed count makes the result fail closed rather than return a partial set.
 */
export type PageResult<T> = {
  data: T[] | null;
  count: number | null;
  error: { message: string } | null;
};

const PAGE_SIZE = 500;

function requireValidPage<T>(page: PageResult<T>, count: number | null) {
  if (page.error || !page.data || page.count === null)
    throw new Error("Unable to read complete paginated data.");
  if (count !== null && count !== page.count)
    throw new Error("Data count changed while fetching pages.");
  return { rows: page.data, count: page.count };
}

function appendPage<T>(all: T[], rows: T[], expected: number) {
  all.push(...rows);
  if (all.length > expected)
    throw new Error("Paginated result has inconsistent row count.");
  if (all.length < expected && rows.length !== PAGE_SIZE)
    throw new Error("Data page truncated before expected row count.");
  return all.length === expected;
}

export async function loadAllPages<T>(
  fetchPage: (start: number, end: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const all: T[] = [];
  let expectedCount: number | null = null;
  for (let start = 0; ; start += PAGE_SIZE) {
    const { rows, count }: { rows: T[]; count: number } = requireValidPage<T>(
      await fetchPage(start, start + PAGE_SIZE - 1),
      expectedCount,
    );
    expectedCount = count;
    if (appendPage(all, rows, count)) return all;
  }
}
