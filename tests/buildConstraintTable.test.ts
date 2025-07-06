// @ts-ignore
import { describe, it, expect } from 'vitest';
import { buildConstraintTable } from '../src/lib/buildConstraintTable';

const communal = [
  { zone: 'R3', theme: 'Destination de zone', rule: '≥ 80 % logements collectifs' }
] as any;

const plr = {
  restrictions: [
    { theme: 'Inondation', typeCode: 'WFL' }
  ]
} as any;

describe('buildConstraintTable', () => {
  it('should generate markdown table with rows', () => {
    const md = buildConstraintTable(communal, plr, { ibus: 0.7 });
    expect(md).toContain('Destination de zone');
    expect(md).toContain('IBUS');
  });
}); 