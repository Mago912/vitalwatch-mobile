import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatLinkedDeviceStatus,
  parseTelegramLinkCode,
} from '../supabase/functions/_shared/telegram-link.ts';

test('acepta el enlace directo /start con codigo', () => {
  assert.equal(parseTelegramLinkCode('/start AB23CD45'), 'AB23CD45');
  assert.equal(parseTelegramLinkCode('/start@VitalWatchBot ab23cd45'), 'AB23CD45');
});

test('conserva /vincular como alternativa manual', () => {
  assert.equal(parseTelegramLinkCode('/vincular ZX87YU65'), 'ZX87YU65');
});

test('rechaza comandos sin un codigo exacto de ocho caracteres', () => {
  assert.equal(parseTelegramLinkCode('/start'), null);
  assert.equal(parseTelegramLinkCode('/start ABC'), null);
  assert.equal(parseTelegramLinkCode('/otro AB23CD45'), null);
});

test('informa una pulsera sin comunicacion y su ultima hora', () => {
  const message = formatLinkedDeviceStatus({
    connection_status: 'offline',
    last_seen_at: '2026-09-14T13:56:48.136Z',
  });

  assert.match(message, /Pulsera VitalWatch: SIN COMUNICACION\./);
  assert.match(message, /Ultima comunicacion:/);
});

test('no inventa una ultima comunicacion inexistente', () => {
  assert.equal(
    formatLinkedDeviceStatus({
      connection_status: 'unknown',
      last_seen_at: null,
    }),
    'Pulsera VitalWatch: SIN ESTADO TODAVIA.\nUltima comunicacion: sin datos.'
  );
});
