import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const politicas = defineCollection({
  loader: glob({ base: './src/content/politicas', pattern: '*.md' }),
  schema: z.object({
    documento: z.enum(['app', 'suri']),
    versao: z.string().regex(/^\d+\.\d+$/, 'versão no formato MAIOR.MENOR, ex.: 1.0'),
    vigente_desde: z.coerce.date(),
    resumo_das_mudancas: z.string().min(1),
    revisao_juridica: z.boolean(),
  }),
});

const cartorios = defineCollection({
  loader: glob({ base: './src/content/cartorios', pattern: '*.md' }),
  schema: z.object({
    nome: z.string().min(1),
    cidade: z.string().min(1),
    uf: z.string().length(2),
    site: z.string().url(),
    atendido_desde: z.coerce.date(),
  }),
});

export const collections = { politicas, cartorios };
