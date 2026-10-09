import { describe, it, expect } from 'vitest';
import { pageParams, qs } from '../../src/tools/shared.js';

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

describe('cursor handling', () => {
  it('passes a bare cursor token through', () => {
    expect(qs({ max_pages: 2, cursor: 'abc123' })).toBe('?max_pages=2&cursor=abc123');
  });

  it('extracts the cursor when the model passes the whole links.next path', () => {
    expect(qs({ cursor: '/flights/search?query=-airline%20UAL&cursor=abc123' })).toBe('?cursor=abc123');
  });

  it('extracts the cursor from an absolute links.next URL too', () => {
    expect(qs({ cursor: 'https://aeroapi.flightaware.com/aeroapi/operators?cursor=xyz' })).toBe('?cursor=xyz');
  });

  it('describes the cursor as the links.next cursor value, accepting the whole link', () => {
    expect(pageParams.cursor.description).toMatch(/links\.next/);
    expect(pageParams.cursor.description).toMatch(/cursor query parameter|whole links\.next/i);
  });
});
