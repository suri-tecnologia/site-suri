import { describe, expect, it } from 'vitest';
import { APP } from '../src/site.config';
import { pagina } from './helpers/dist';

const app = `/apps/${APP.slug}/privacidade/`;

describe.each([
  ['política do app', app],
  ['política da SURI', '/privacidade/'],
])('%s', (_nome, base) => {
  it('mostra versão e data de vigência no formato brasileiro', () => {
    const meta = pagina(base).querySelector('.meta-politica')?.text ?? '';
    expect(meta).toMatch(/Versão 1\.0/);
    expect(meta).toMatch(/vigente desde \d{2}\/\d{2}\/\d{4}/);
  });

  it('enquanto não há revisão jurídica: aviso de minuta e fora dos buscadores', () => {
    const doc = pagina(base);
    expect(doc.querySelector('.aviso-minuta')).not.toBeNull();
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });

  it('o histórico aponta para a página própria de cada versão', () => {
    const links = pagina(base).querySelectorAll('.historico a').map((a) => a.getAttribute('href'));
    expect(links).toContain(`${base}v1.0/`);
    const versao = pagina(`${base}v1.0/`);
    expect(versao.querySelector('.meta-politica')?.text).toMatch(/Versão 1\.0/);
    // v1.0 é a vigente: não pode avisar "versão não está mais em vigor"
    expect(versao.querySelector('.aviso-antiga')).toBeNull();
  });

  it('traz o bloco do encarregado', () => {
    expect(pagina(base).querySelector('[data-encarregado]')).not.toBeNull();
  });
});

describe('anexo de cartórios (só na política do app)', () => {
  it('lista o RISMA', () => {
    const anexo = pagina(app).querySelector('.anexo');
    expect(anexo?.querySelector('h2')?.text).toBe('Anexo — Cartórios atendidos');
    expect(anexo?.text).toMatch(/Registro de Imóveis de Santa Maria/);
  });

  it('não aparece na política da SURI', () => {
    expect(pagina('/privacidade/').querySelector('.anexo')).toBeNull();
  });
});
