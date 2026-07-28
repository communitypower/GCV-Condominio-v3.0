import { Billing, Unit } from '../types';

export function findUnit(units: Unit[], unitId: string): Unit | undefined {
  return units.find(unit => unit.id === unitId);
}

export function unitNumberById(units: Unit[], unitId: string): string {
  if (unitId === 'COMMON') return 'Área comum';
  return findUnit(units, unitId)?.number || 'Não identificada';
}

export function unitLabelById(units: Unit[], unitId: string): string {
  if (unitId === 'COMMON') return 'Área comum';

  const unit = findUnit(units, unitId);
  if (!unit) return 'Unidade não identificada';

  return `${unit.block} · Unidade ${unit.number}`;
}

export function billingReference(billing: Billing, units: Unit[]): string {
  const unit = findUnit(units, billing.unitId);
  const unitPart = (unit ? `${unit.block}-${unit.number}` : 'SEM-UNIDADE')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
  return `COB-${billing.monthString.replace('-', '')}-${unitPart.toUpperCase()}`;
}
