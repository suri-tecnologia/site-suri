import { getCollection, type CollectionEntry } from 'astro:content';
import { ordenarMaisNovaPrimeiro, verificarVersoesUnicas } from './versao';

export type Politica = CollectionEntry<'politicas'>;

export async function versoes(documento: 'app' | 'suri'): Promise<Politica[]> {
  const lista = await getCollection('politicas', (e) => e.data.documento === documento);
  if (lista.length === 0) throw new Error(`nenhuma versão da política "${documento}" em src/content/politicas`);
  verificarVersoesUnicas(lista);
  return ordenarMaisNovaPrimeiro(lista);
}
