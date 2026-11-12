import { describe, expect, it } from 'vitest';
import {
  compararVersao, escolherVigente, formatarData, ordenarMaisNovaPrimeiro, verificarVersoesUnicas,
} from '../src/lib/versao';

const v = (versao: string, data: string) => ({ id: versao, data: { versao, vigente_desde: new Date(data) } });

describe('compararVersao', () => {
  it('compara numericamente, não como texto (1.10 > 1.9)', () => {
    expect(compararVersao('1.10', '1.9')).toBeGreaterThan(0);
    expect(compararVersao('2.0', '1.9')).toBeGreaterThan(0);
    expect(compararVersao('1.0', '1.0')).toBe(0);
  });
});

describe('escolherVigente', () => {
  const lista = [v('1.0', '2026-10-14'), v('1.1', '2026-11-01'), v('2.0', '2027-01-01')];

  it('escolhe a versão mais nova já em vigor', () => {
    expect(escolherVigente(lista, new Date('2026-12-01T12:00:00Z')).data.versao).toBe('1.1');
  });

  it('ignora versão com data futura', () => {
    expect(escolherVigente(lista, new Date('2026-10-20T12:00:00Z')).data.versao).toBe('1.0');
  });

  it('falha se nenhuma versão está em vigor na data do build', () => {
    expect(() => escolherVigente(lista, new Date('2026-01-01T12:00:00Z'))).toThrow(/nenhuma versão/);
  });

  it('ordena da mais nova para a mais antiga', () => {
    expect(ordenarMaisNovaPrimeiro(lista).map((e) => e.data.versao)).toEqual(['2.0', '1.1', '1.0']);
  });
});

describe('verificarVersoesUnicas', () => {
  it('rejeita duas entradas com a mesma versão', () => {
    expect(() => verificarVersoesUnicas([v('1.0', '2026-10-14'), v('1.0', '2026-11-01')])).toThrow(/duplicada/);
  });
});

describe('formatarData', () => {
  it('mostra a data do frontmatter sem voltar um dia por causa do fuso', () => {
    expect(formatarData(new Date('2026-10-14'))).toBe('14/10/2026');
  });
});
