import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { DIST, arquivoDaRota, arquivos, rotaDoArquivo } from './helpers/dist';

const html = arquivos('.html');
const css = arquivos('.css');

it('o build gerou o conjunto esperado de páginas (protege contra teste vazio)', () => {
  // 7 rotas + 2 páginas de versão + 404
  expect(html.length).toBeGreaterThanOrEqual(10);
  expect(css.length).toBeGreaterThanOrEqual(1);
});

describe.each(html.map((f) => [rotaDoArquivo(f), f]))('%s', (_rota, arquivo) => {
  const doc = parse(readFileSync(arquivo, 'utf8'));

  it('sem script, sem <style> e sem style= (CSP sem unsafe-inline)', () => {
    expect(doc.querySelectorAll('script')).toHaveLength(0);
    expect(doc.querySelectorAll('style')).toHaveLength(0);
    expect(doc.querySelectorAll('[style]')).toHaveLength(0);
  });

  it('nenhum recurso carregado de outro domínio', () => {
    const recursos = [
      ...doc.querySelectorAll('link[href]').map((e) => e.getAttribute('href')!),
      ...doc.querySelectorAll('img[src], source[src], audio[src], video[src]').map((e) => e.getAttribute('src')!),
    ];
    expect(recursos.filter((u) => /^(https?:)?\/\//.test(u))).toEqual([]);
    expect(doc.querySelectorAll('iframe, object, embed')).toHaveLength(0);
  });

  it('todo link interno aponta para um arquivo que existe no build', () => {
    const quebrados = doc.querySelectorAll('a[href^="/"], link[href^="/"]')
      .map((a) => a.getAttribute('href')!)
      .filter((href) => {
        const alvo = arquivoDaRota(href);
        return !(existsSync(alvo) && statSync(alvo).isFile());
      });
    expect(quebrados).toEqual([]);
  });
});

describe('CSS', () => {
  it.each(css)('%s não importa nada de fora', (arquivo) => {
    const conteudo = readFileSync(arquivo, 'utf8');
    expect(conteudo).not.toMatch(/url\(\s*['"]?(https?:)?\/\//);
    expect(conteudo).not.toMatch(/@import/);
  });

  it('declara as duas famílias da marca com arquivos locais', () => {
    const tudo = css.map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(tudo).toMatch(/font-family:\s*['"]?Sora/);
    expect(tudo).toMatch(/font-family:\s*['"]?IBM Plex Sans/);
    for (const [, url] of tudo.matchAll(/url\(([^)]+\.woff2)\)/g)) {
      expect(existsSync(join(DIST, url.replace(/^['"]?\//, '').replace(/['"]$/, '')))).toBe(true);
    }
  });
});
