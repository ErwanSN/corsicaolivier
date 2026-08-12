import assert from 'node:assert/strict';
import test from 'node:test';

import { currentDateInTimeZone, zonedLocalToIso } from '../src/lib/dates.ts';

test('calcule la date civile dans le fuseau de la zone', () => {
  const instant = new Date('2026-08-11T01:00:00.000Z');

  assert.equal(currentDateInTimeZone('Europe/Paris', instant), '2026-08-11');
  assert.equal(
    currentDateInTimeZone('America/New_York', instant),
    '2026-08-10',
  );
});

test('convertit une heure locale normale en instant exact', () => {
  assert.equal(
    zonedLocalToIso('2026-08-11T12:00', 'Europe/Paris'),
    '2026-08-11T10:00:00.000Z',
  );
});

test('refuse les heures inexistantes ou ambiguës lors du changement DST', () => {
  assert.equal(zonedLocalToIso('2026-03-29T02:30', 'Europe/Paris'), null);
  assert.equal(zonedLocalToIso('2026-10-25T02:30', 'Europe/Paris'), null);
});

test('refuse un calendrier invalide et un fuseau inconnu', () => {
  assert.equal(zonedLocalToIso('2026-02-31T12:00', 'Europe/Paris'), null);
  assert.equal(zonedLocalToIso('2026-08-11T12:00', 'Unknown/Zone'), null);
});
