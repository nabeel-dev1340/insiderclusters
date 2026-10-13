// Only authenticated destinations within this application are allowed.
export function safeAuthNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/dashboard";
  const url = new URL(value, "https://insiderclusters.com");
  if (!/^\/(dashboard(?:\/|$)|checkout(?:\/|$)|billing(?:\/|$))/.test(url.pathname)) return "/dashboard";
  return url.pathname + url.search;
}
