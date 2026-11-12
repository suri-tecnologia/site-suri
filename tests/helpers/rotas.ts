import { APP } from '../../src/site.config';

export const ROTAS = [
  '/',
  `/apps/${APP.slug}/`,
  `/apps/${APP.slug}/privacidade/`,
  `/apps/${APP.slug}/suporte/`,
  `/apps/${APP.slug}/excluir-dados/`,
  '/privacidade/',
  '/lgpd/',
] as const;
