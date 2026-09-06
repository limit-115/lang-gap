export function isCurrentPage(pathname: string, href: string): boolean {
  return pathname.replace(/\/$/, "") === href.replace(/\/$/, "");
}
