import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  pageCountOf,
  resolvePage,
  resolvePageSize,
} from "@/lib/pagination";

describe("resolvePageSize", () => {
  it("accepts every allowed page size", () => {
    for (const size of PAGE_SIZES) {
      expect(resolvePageSize(String(size))).toBe(size);
    }
  });

  it("falls back to the default for values outside the allowed set", () => {
    for (const value of ["10", "1000", "0", "-25", "25.5", "abc", "", undefined]) {
      expect(resolvePageSize(value)).toBe(DEFAULT_PAGE_SIZE);
    }
  });
});

describe("pageCountOf", () => {
  it("rounds a partial last page up", () => {
    expect(pageCountOf(51, 25)).toBe(3);
    expect(pageCountOf(50, 25)).toBe(2);
  });

  it("reports one page when there is nothing to show", () => {
    expect(pageCountOf(0, 25)).toBe(1);
  });
});

describe("resolvePage", () => {
  it("keeps a page that exists", () => {
    expect(resolvePage("3", 5)).toBe(3);
  });

  it("clamps a page past the end onto the last page", () => {
    expect(resolvePage("99", 5)).toBe(5);
  });

  it("falls back to page 1 for junk and out-of-range low values", () => {
    for (const value of ["0", "-2", "1.5", "abc", "", undefined]) {
      expect(resolvePage(value, 5)).toBe(1);
    }
  });

  it("never returns page 0 when there are no results", () => {
    expect(resolvePage("4", 0)).toBe(1);
  });
});
