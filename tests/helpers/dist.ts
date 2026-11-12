import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse, type HTMLElement } from 'node-html-parser';

export const DIST = join(process.cwd(), 'dist');

export function arquivoDaRota(rota: string): string {
  const limpa = decodeURIComponent(rota.split('#')[0].split('?')[0]);
  return join(DIST, limpa.endsWith('/') ? `${limpa}index.html` : limpa);
}

export function pagina(rota: string): HTMLElement {
  const arquivo = arquivoDaRota(rota);
  if (!existsSync(arquivo)) throw new Error(`página não gerada: ${rota} (esperado ${arquivo})`);
  return parse(readFileSync(arquivo, 'utf8'));
}

export function arquivos(extensao: string, dir: string = DIST): string[] {
  if (!existsSync(dir)) throw new Error(`pasta ${dir} não existe — rode "npm test", que faz o build antes`);
  const saida: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(extensao, caminho));
    else if (caminho.endsWith(extensao)) saida.push(caminho);
  }
  return saida;
}

export function rotaDoArquivo(arquivo: string): string {
  const relativo = relative(DIST, arquivo).split(sep).join('/');
  return `/${relativo.replace(/index\.html$/, '')}`;
}
