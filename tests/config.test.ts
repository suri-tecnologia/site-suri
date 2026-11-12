import { describe, expect, it } from 'vitest';
import { pendencias, type ConfigSite } from '../src/site.config';

const completa: ConfigSite = {
  nome: 'SURI Tecnologia',
  url: 'https://suritecnologia.com',
  contato: { email: 'contato@suritecnologia.com', whatsapp: '5555999999999' },
  encarregado: { nome: 'Fulana de Tal', email: 'dpo@suritecnologia.com' },
  app: { slug: 'meu-app', nome: 'Meu App', nomeDefinitivo: true },
};

describe('pendencias', () => {
  it('não acusa nada numa configuração completa', () => {
    expect(pendencias(completa)).toEqual([]);
  });

  it('acusa nome provisório, encarregado e contato ausentes', () => {
    const p = pendencias({ ...completa, contato: { email: null, whatsapp: null }, encarregado: null, app: { ...completa.app, nomeDefinitivo: false } });
    expect(p).toHaveLength(3);
  });

  it('acusa e-mail inválido, WhatsApp fora do formato e slug com maiúscula', () => {
    const p = pendencias({
      ...completa,
      contato: { email: 'contato@', whatsapp: '(55) 9999-9999' },
      app: { ...completa.app, slug: 'Meu_App' },
    });
    expect(p.join(' | ')).toMatch(/contato inválido/);
    expect(p.join(' | ')).toMatch(/WhatsApp/);
    expect(p.join(' | ')).toMatch(/slug/);
  });

  it('aceita WhatsApp ausente (é opcional)', () => {
    expect(pendencias({ ...completa, contato: { ...completa.contato, whatsapp: null } })).toEqual([]);
  });
});
