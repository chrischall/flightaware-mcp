import { describe, it, expect } from 'vitest';
import { pageParams } from '../../src/tools/shared.js';

describe('pageParams.max_pages', () => {
  it('accepts a small, in-range page count', () => {
    expect(pageParams.max_pages.safeParse(10).success).toBe(true);
    expect(pageParams.max_pages.safeParse(1).success).toBe(true);
  });

  it('accepts undefined (optional, defers to AeroAPI default)', () => {
    expect(pageParams.max_pages.safeParse(undefined).success).toBe(true);
  });

  it('rejects a page count above the billing cap', () => {
    expect(pageParams.max_pages.safeParse(21).success).toBe(false);
    expect(pageParams.max_pages.safeParse(5000).success).toBe(false);
  });

  it('accepts the cap boundary exactly', () => {
    expect(pageParams.max_pages.safeParse(20).success).toBe(true);
  });

  it('still rejects non-positive page counts', () => {
    expect(pageParams.max_pages.safeParse(0).success).toBe(false);
  });
});
