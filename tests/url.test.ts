import { describe, expect, it } from 'vitest';
import { baseSegment, href, isActive } from '~/lib/url';

describe('baseSegment', () => {
  it('normalizes the deployed base', () => {
    expect(baseSegment('/loop')).toBe('/loop');
    expect(baseSegment('/loop/')).toBe('/loop');
    expect(baseSegment('loop')).toBe('/loop');
  });

  it('collapses a root base to empty', () => {
    expect(baseSegment('/')).toBe('');
    expect(baseSegment('')).toBe('');
  });
});

describe('href', () => {
  it('prefixes internal paths with the base', () => {
    expect(href('/team', '/loop')).toBe('/loop/team');
    expect(href('team', '/loop')).toBe('/loop/team');
    expect(href('/knowledge/trading', '/loop')).toBe('/loop/knowledge/trading');
  });

  it('builds the site root', () => {
    expect(href('/', '/loop')).toBe('/loop/');
    expect(href('/', '/')).toBe('/');
  });

  it('is a no-op prefix when deployed at the domain root', () => {
    expect(href('/team', '/')).toBe('/team');
  });
});

describe('isActive', () => {
  it('matches the dashboard only exactly', () => {
    expect(isActive('/loop/', '/', '/loop')).toBe(true);
    expect(isActive('/loop/team', '/', '/loop')).toBe(false);
  });

  it('matches nested routes by prefix', () => {
    expect(isActive('/loop/knowledge/trading/value', '/knowledge', '/loop')).toBe(true);
    expect(isActive('/loop/news', '/knowledge', '/loop')).toBe(false);
  });

  it('does not treat a shared prefix as a match', () => {
    expect(isActive('/loop/newsletter', '/news', '/loop')).toBe(false);
  });
});
