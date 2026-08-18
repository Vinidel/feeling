import { resolveBaseApiUrl } from './config';

describe('API origin configuration', () => {
  it('preserves split-origin local development', () => {
    expect(resolveBaseApiUrl('http://localhost:3000')).toBe(
      'http://localhost:8080',
    );
  });

  it('uses the browser origin for deployment-style routing', () => {
    expect(resolveBaseApiUrl('http://localhost:3000', 'same-origin')).toBe(
      'http://localhost:3000',
    );
    expect(resolveBaseApiUrl('https://steady.example')).toBe(
      'https://steady.example',
    );
  });

  it('accepts an explicit test endpoint without a trailing slash', () => {
    expect(resolveBaseApiUrl(
      'http://localhost:3000',
      'https://target.example/',
    )).toBe('https://target.example');
  });
});
