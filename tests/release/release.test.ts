import { expect, it } from 'vitest';
import { pendencias } from '../../src/site.config';

it('nada pendente para publicar uma versão do site', () => {
  expect(pendencias()).toEqual([]);
});
