import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { resolveOutputDir, writePng, pageParams } from '../../src/tools/shared.js';

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

describe('resolveOutputDir', () => {
  it('creates an absolute output dir that does not exist yet', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'fa-')), 'nested', 'out');
    expect(existsSync(dir)).toBe(false);
    const resolved = resolveOutputDir(dir);
    expect(resolved).toBe(dir);
    expect(existsSync(dir)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('falls back to the current working directory when no dir or env is set', () => {
    const prev = process.env.AEROAPI_OUTPUT_DIR;
    delete process.env.AEROAPI_OUTPUT_DIR;
    try {
      expect(resolveOutputDir()).toBe(process.cwd());
    } finally {
      if (prev !== undefined) process.env.AEROAPI_OUTPUT_DIR = prev;
    }
  });

  it('resolves a relative dir against the current working directory', () => {
    const base = mkdtempSync(join(tmpdir(), 'fa-'));
    const cwd = process.cwd();
    try {
      process.chdir(base);
      const resolved = resolveOutputDir(`sub${sep}out`);
      expect(resolved.endsWith(`sub${sep}out`)).toBe(true);
      expect(existsSync(resolved)).toBe(true);
    } finally {
      process.chdir(cwd);
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe('writePng', () => {
  it('writes the bytes and avoids overwriting with a numeric suffix', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fa-'));
    const b64 = Buffer.from('fake-png').toString('base64');
    try {
      const p1 = writePng(dir, 'map', b64);
      const p2 = writePng(dir, 'map', b64);
      expect(p1).toBe(join(dir, 'map.png'));
      expect(p2).toBe(join(dir, 'map-1.png'));
      expect(readFileSync(p1).toString()).toBe('fake-png');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
