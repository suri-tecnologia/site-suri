import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { APP } from '../src/site.config';
import { DIST, pagina } from './helpers/dist';
import { ROTAS } from './helpers/rotas';

describe('as 7 rotas da spec', () => {
  it.each(ROTAS)('%s existe, com um único h1', (rota) => {
    expect(pagina(rota).querySelectorAll('h1')).toHaveLength(1);
  });

  it('cada rota tem título próprio', () => {
    const titulos = ROTAS.map((r) => pagina(r).querySelector('title')?.text);
    expect(new Set(titulos).size).toBe(ROTAS.length);
  });
});

describe('página do app', () => {
  it('liga para privacidade, suporte e exclusão de dados', () => {
    const hrefs = pagina(`/apps/${APP.slug}/`).querySelectorAll('main a').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining([
      `/apps/${APP.slug}/privacidade/`, `/apps/${APP.slug}/suporte/`, `/apps/${APP.slug}/excluir-dados/`,
    ]));
  });

  it('suporte traz o bloco de contato', () => {
    expect(pagina(`/apps/${APP.slug}/suporte/`).querySelector('[data-contato]')).not.toBeNull();
  });

  it('exclusão de dados explica o prazo de 90 dias e o que não é apagado', () => {
    const texto = pagina(`/apps/${APP.slug}/excluir-dados/`).text;
    expect(texto).toMatch(/90 dias/);
    expect(texto).toMatch(/6 meses/);
  });
});

describe('LGPD e 404', () => {
  it('/lgpd/ cita o art. 18, o prazo de resposta e o encarregado', () => {
    const doc = pagina('/lgpd/');
    expect(doc.text).toMatch(/art\. 18/);
    expect(doc.text).toMatch(/15 dias/);
    expect(doc.querySelector('[data-encarregado]')).not.toBeNull();
  });

  it('gera 404.html fora dos buscadores', () => {
    expect(existsSync(join(DIST, '404.html'))).toBe(true);
    expect(pagina('/404.html').querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });
});
