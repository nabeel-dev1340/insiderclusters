export type DirectoryParams = Record<string, string | string[] | undefined>;
export type DirectorySort = "recent" | "name" | "clusters";
export const DIRECTORY_PAGE_SIZE = 50;

export function directoryQuery(params: DirectoryParams) {
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const pageNumber = (key: string) => {
    const value = first(key) ?? "1";
    return /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
  };
  const rawSort = first("sort");
  const page = pageNumber("page");
  return {
    q: (first("q") ?? "").trim().slice(0, 100),
    sort: (rawSort === "name" || rawSort === "clusters"
      ? rawSort
      : "recent") as DirectorySort,
    page,
    // Keep one section beyond page one at a time, avoiding a Cartesian
    // product of indexable URLs for the two stock directory sections.
    buysPage: page > 1 ? 1 : pageNumber("buysPage"),
  };
}

export type DirectoryQuery = ReturnType<typeof directoryQuery>;

export function directoryUrl(path: string, query: DirectoryQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.sort !== "recent") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.buysPage > 1 && query.page <= 1)
    params.set("buysPage", String(query.buysPage));
  return params.size ? `${path}?${params}` : path;
}

export function directorySlice<T>(items: T[], page: number) {
  const pages = Math.max(1, Math.ceil(items.length / DIRECTORY_PAGE_SIZE));
  const offset = (page - 1) * DIRECTORY_PAGE_SIZE;
  return {
    items: items.slice(offset, offset + DIRECTORY_PAGE_SIZE),
    page,
    pages,
    offset,
  };
}

export function matchesDirectoryQuery(q: string, ...values: string[]): boolean {
  return values.join(" ").toLowerCase().includes(q.toLowerCase());
}
