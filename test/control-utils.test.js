const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveControlInput } = require('../lib/control-utils');

test('resolveControlInput prefers explicit message values over config defaults', () => {
  const result = resolveControlInput(
    {
      serial: 'SER123',
      key: 'PumpDisable',
      payload: { code: '1' },
    },
    { serial: 'CFG123', key: 'PressureSetpoint' }
  );

  assert.equal(result.serial, 'SER123');
  assert.equal(result.key, 'PumpDisable');
  assert.equal(result.code, '1');
});

test('resolveControlInput falls back to config values and payload objects', () => {
  const result = resolveControlInput(
    {
      payload: {
        serial: 'PAYLOAD123',
        key: 'Setpoint',
        value: 24,
      },
    },
    { serial: 'CFG123', key: 'PressureSetpoint' }
  );

  assert.equal(result.serial, 'PAYLOAD123');
  assert.equal(result.key, 'Setpoint');
  assert.equal(result.value, 24);
});
