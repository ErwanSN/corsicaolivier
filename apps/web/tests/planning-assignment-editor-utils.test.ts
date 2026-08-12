import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  EditorBreak,
  EditorSegment,
} from '../src/components/planning-assignment-editor.types.ts';
import {
  appendExactBreak,
  appendPositionChange,
  durationLabel,
  removePositionChange,
  totalBreakMinutes,
  updatePositionChange,
} from '../src/components/planning-assignment-editor.utils.ts';

function baseSegment(): EditorSegment {
  return {
    positionId: 'position-1',
    portCallId: 'call-1',
    staffingRequirementId: 'requirement-1',
    startsAt: '2026-08-12T08:00',
    endsAt: '2026-08-12T16:00',
  };
}

test('calcule la durée de travail affichée sans altérer le libellé métier', () => {
  assert.equal(
    durationLabel('2026-08-12T08:00', '2026-08-12T16:00', 30),
    '7 h 30 de travail planifié',
  );
  assert.equal(
    durationLabel('2026-08-12T16:00', '2026-08-12T08:00', 0),
    'Horaires à vérifier',
  );
});

test('découpe, ajuste puis réunit les segments sans rompre leur continuité', () => {
  const initial = [baseSegment()];
  const split = appendPositionChange(initial);

  assert.equal(split.length, 2);
  assert.equal(split[0]?.endsAt, '2026-08-12T12:00');
  assert.equal(split[1]?.startsAt, '2026-08-12T12:00');
  assert.equal(split[1]?.staffingRequirementId, null);

  const updated = updatePositionChange(split, 1, {
    startsAt: '2026-08-12T13:00',
    positionId: 'position-2',
  });
  assert.equal(updated[0]?.endsAt, '2026-08-12T13:00');
  assert.equal(updated[0]?.staffingRequirementId, null);
  assert.equal(updated[1]?.startsAt, '2026-08-12T13:00');
  assert.equal(updated[1]?.positionId, 'position-2');

  const reunited = removePositionChange(updated, 1);
  assert.equal(reunited.length, 1);
  assert.equal(reunited[0]?.endsAt, '2026-08-12T16:00');
});

test('centre une pause exacte et recalcule sa durée totale', () => {
  const breaks = appendExactBreak(
    [],
    '2026-08-12T08:00',
    '2026-08-12T16:00',
    30,
  );

  assert.deepEqual(breaks, [
    {
      startsAt: '2026-08-12T11:45',
      endsAt: '2026-08-12T12:15',
      label: '',
    },
  ]);
  assert.equal(totalBreakMinutes(breaks), 30);
});

test('ne crée rien lorsque les horaires ne permettent pas une pause', () => {
  const breaks: EditorBreak[] = [];
  assert.equal(
    appendExactBreak(breaks, '2026-08-12T16:00', '2026-08-12T08:00', 30),
    breaks,
  );
});
