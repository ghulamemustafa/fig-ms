/**
 * Page-size and page-number helpers shared by server pages and client controls.
 * Deliberately free of `server-only` imports so both sides can use it.
 */

export const PAGE_SIZES = [25, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 25;

/** Narrows an untrusted `?pageSize=` value onto an allowed page size. */
export function resolvePageSize(value: string | undefined): PageSize {
  const parsed = Number(value);
  return PAGE_SIZES.find((size) => size === parsed) ?? DEFAULT_PAGE_SIZE;
}

export function pageCountOf(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Narrows an untrusted `?page=` value, clamped to the available pages. */
export function resolvePage(value: string | undefined, pageCount: number) {
  const parsed = Number(value);
  const requested = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  return Math.min(requested, Math.max(1, pageCount));
}
