// Regras puras de versão das políticas (sem astro:content, para serem testáveis no Vitest).

export interface DadosVersao {
  versao: string;
  vigente_desde: Date;
}

export function compararVersao(a: string, b: string): number {
  const [aMaior, aMenor] = a.split('.').map(Number);
  const [bMaior, bMenor] = b.split('.').map(Number);
  return aMaior - bMaior || aMenor - bMenor;
}

export function ordenarMaisNovaPrimeiro<T extends { data: DadosVersao }>(lista: T[]): T[] {
  return [...lista].sort((x, y) => compararVersao(y.data.versao, x.data.versao));
}

export function escolherVigente<T extends { data: DadosVersao }>(lista: T[], agora: Date): T {
  const vigente = ordenarMaisNovaPrimeiro(lista).find((e) => e.data.vigente_desde.getTime() <= agora.getTime());
  if (!vigente) {
    throw new Error('nenhuma versão da política está vigente na data do build — confira vigente_desde');
  }
  return vigente;
}

export function verificarVersoesUnicas(lista: { data: DadosVersao }[]): void {
  const vistas = new Set<string>();
  for (const entrada of lista) {
    if (vistas.has(entrada.data.versao)) throw new Error(`versão duplicada: ${entrada.data.versao}`);
    vistas.add(entrada.data.versao);
  }
}

// Datas do frontmatter chegam como meia-noite UTC; formatar em UTC evita mostrar o dia anterior no Brasil.
export function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(data);
}
