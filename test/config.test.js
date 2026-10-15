import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, parseDecimal, DEFAULT_CONFIG } from '../src/config.js';

test('normalizeConfig gives the defaults when called with no argument', () => {
  const config = normalizeConfig();
  assert.equal(config.method, 'mwl');
  assert.equal(config.school, 'shafi');
  assert.equal(config.high_latitude_rule, 'angle_based');
  assert.equal(config.midnight_mode, 'auto');
  assert.equal(config.language, 'fr');
  assert.equal(config.imsak_minutes, 10);
  assert.equal(config.custom_fajr_angle, 18);
  assert.equal(config.custom_isha_angle, 17);
  assert.equal(config.latitude, null);
  assert.equal(config.adjust_fajr, 0);
  assert.equal(DEFAULT_CONFIG.custom_fajr_angle, '18');
});

test('decimals typed by hand accept a comma, and nothing else', () => {
  assert.equal(parseDecimal('48,8566'), 48.8566);
  assert.equal(parseDecimal(' -0.1254 '), -0.1254);
  assert.equal(parseDecimal(12), 12);
  for (const bad of ['', '  ', 'abc', '48.8.5', '1e3', null, undefined, NaN]) {
    assert.equal(parseDecimal(bad), null, String(bad));
  }
});

test('coordinates: both or none, within range', () => {
  assert.deepEqual(
    [
      normalizeConfig({ latitude: '48,85', longitude: '2,35' }).latitude,
      normalizeConfig({ latitude: '48,85', longitude: '2,35' }).longitude,
    ],
    [48.85, 2.35],
  );
  assert.equal(normalizeConfig({ latitude: '48.85' }).latitude, null);
  assert.equal(normalizeConfig({ latitude: '91', longitude: '2' }).latitude, null);
  assert.equal(normalizeConfig({ latitude: '45', longitude: '-181' }).longitude, null);
});

test('unknown choices fall back to the defaults', () => {
  const config = normalizeConfig({
    method: 'moonsighting',
    school: 'maliki',
    high_latitude_rule: 'none',
    midnight_mode: 'x',
    language: 'it',
  });
  assert.equal(config.method, 'mwl');
  assert.equal(config.school, 'shafi');
  assert.equal(config.high_latitude_rule, 'angle_based');
  assert.equal(config.midnight_mode, 'auto');
  assert.equal(config.language, 'fr');
});

test('minutes are integers within their bounds, strings from a form included', () => {
  const config = normalizeConfig({
    adjust_fajr: '5',
    adjust_isha: -90,
    adjust_dhuhr: 2.6,
    imsak_minutes: '',
    custom_isha_minutes: 500,
  });
  assert.equal(config.adjust_fajr, 5);
  assert.equal(config.adjust_isha, -60);
  assert.equal(config.adjust_dhuhr, 3);
  assert.equal(config.imsak_minutes, 10);
  assert.equal(config.custom_isha_minutes, 180);
});

test('custom angles: decimals with a comma, out of range falls back', () => {
  const config = normalizeConfig({ custom_fajr_angle: '13,5', custom_isha_angle: '45' });
  assert.equal(config.custom_fajr_angle, 13.5);
  assert.equal(config.custom_isha_angle, 17);
});
