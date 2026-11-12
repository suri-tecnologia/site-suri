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
