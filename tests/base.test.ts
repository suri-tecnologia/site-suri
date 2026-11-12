import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { arquivos, pagina } from './helpers/dist';

const versao = JSON.parse(readFileSync('package.json', 'utf8')).version;

describe('casca das páginas', () => {
  it('home existe em pt-BR, com a versão do site no <html>', () => {
    const html = pagina('/').querySelector('html')!;
    expect(html.getAttribute('lang')).toBe('pt-BR');
    expect(html.getAttribute('data-versao')).toBe(versao);
  });

  it('home tem título, descrição, um único h1 e o logo inline', () => {
    const doc = pagina('/');
    expect(doc.querySelector('title')?.text).toBe('SURI Tecnologia');
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')?.length).toBeGreaterThan(20);
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    expect(doc.querySelector('header .marca svg')).not.toBeNull();
  });

  it('fontes da marca são servidas pelo próprio site', () => {
    const woff2 = arquivos('.woff2');
    expect(woff2.some((f) => /sora/i.test(f))).toBe(true);
    expect(woff2.some((f) => /ibm-plex-sans/i.test(f))).toBe(true);
  });
});
