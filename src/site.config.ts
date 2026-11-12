import dados from './config/site.json';

export interface Encarregado {
  nome: string;
  email: string;
}

export interface ConfigSite {
  nome: string;
  url: string;
  contato: { email: string | null; whatsapp: string | null };
  encarregado: Encarregado | null;
  app: { slug: string; nome: string; nomeDefinitivo: boolean };
}

export const SITE: ConfigSite = dados as ConfigSite;
export const APP = SITE.app;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// O que ainda impede publicar uma versão (tag v*) do site. Vazio = pode publicar.
export function pendencias(cfg: ConfigSite = SITE): string[] {
  const p: string[] = [];
  if (!cfg.app.nomeDefinitivo) p.push('nome definitivo do app (app.nome / app.slug em src/config/site.json)');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cfg.app.slug)) p.push(`slug do app inválido: "${cfg.app.slug}"`);
  if (!cfg.encarregado) p.push('encarregado (DPO) da SURI');
  else if (!EMAIL.test(cfg.encarregado.email)) p.push('e-mail do encarregado inválido');
  if (!cfg.contato.email) p.push('e-mail de contato da SURI');
  else if (!EMAIL.test(cfg.contato.email)) p.push('e-mail de contato inválido');
  if (cfg.contato.whatsapp !== null && !/^\d{12,13}$/.test(cfg.contato.whatsapp)) {
    p.push('WhatsApp deve ter só dígitos, com DDI e DDD (ex.: 5555999999999)');
  }
  return p;
}
