import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { resolveOutputDir, writePng } from '../../src/tools/shared.js';

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
