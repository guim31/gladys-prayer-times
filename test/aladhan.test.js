// -----------------------------------------------------------------------------
// Real Aladhan answers (test/fixtures/aladhan/), computed again locally: the
// integration must give the same minute as the API the Home Assistant
// integration calls. The fixtures come from Aladhan's own published tests and
// documentation; `node scripts/probe.mjs <lat> <lon> --save` records more.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { SHOWN_TIMES, formatTime, timesForDate } from '../src/prayer/schedule.js';
import {
  aladhanQuery,
  compareTimings,
  configFromAladhan,
  minutesBetween,
} from '../scripts/aladhan.mjs';
import { normalizeConfig } from '../src/config.js';

const dir = new URL('./fixtures/aladhan/', import.meta.url);
const fixtures = await Promise.all(
  (await readdir(dir))
    .filter((name) => name.endsWith('.json'))
    .map(async (name) => ({ name, ...JSON.parse(await readFile(new URL(name, dir), 'utf8')) })),
);

test('there are real Aladhan answers to compare with', () => {
  assert.ok(fixtures.length >= 3);
});

for (const fixture of fixtures) {
  test(`same minute as Aladhan: ${fixture.name}`, () => {
    const [day, month, year] = fixture.date.split('-').map(Number);
    const config = configFromAladhan(fixture.request);
    const location = { latitude: fixture.request.latitude, longitude: fixture.request.longitude };
    const tz = fixture.request.timezonestring;
    const times = timesForDate(config, location, { year, month, day });
    const ours = Object.fromEntries(
      SHOWN_TIMES.filter((key) => times[key]).map((key) => [key, formatTime(times[key], tz)]),
    );
    const diffs = compareTimings(ours, fixture.timings);
    assert.ok(Object.keys(diffs).length >= 3, 'nothing compared');
    for (const [key, minutes] of Object.entries(diffs)) {
      assert.equal(minutes, 0, `${key}: ours ${ours[key]}, Aladhan ${fixture.timings}`);
    }
  });
}

test('a configuration reads as the matching Aladhan request', () => {
  const location = { latitude: 48.8566, longitude: 2.3522 };
  const uoif = aladhanQuery(normalizeConfig({ method: 'uoif' }), location, 'Europe/Paris');
  assert.equal(uoif.get('method'), '12');
  assert.equal(uoif.get('latitudeAdjustmentMethod'), '3');
  assert.equal(uoif.get('midnightMode'), '0');
  assert.equal(uoif.get('timezonestring'), 'Europe/Paris');

  const france18 = aladhanQuery(
    normalizeConfig({ method: 'france_18', school: 'hanafi' }),
    location,
    'Europe/Paris',
  );
  assert.equal(france18.get('method'), '99');
  assert.equal(france18.get('methodSettings'), '18,null,18');
  assert.equal(france18.get('school'), '1');

  const turkey = aladhanQuery(normalizeConfig({ method: 'turkey' }), location, 'Europe/Istanbul');
  assert.equal(turkey.get('tune'), '0,0,-7,5,4,7,0,0,0');

  const tehran = aladhanQuery(normalizeConfig({ method: 'tehran' }), location, 'Asia/Tehran');
  assert.equal(tehran.get('midnightMode'), '1');

  const custom = aladhanQuery(
    normalizeConfig({ method: 'custom', custom_fajr_angle: '13,5', custom_isha_minutes: 90 }),
    location,
    'Europe/Paris',
  );
  assert.equal(custom.get('methodSettings'), '13.5,null,90 min');
});

test('an Aladhan request reads as the matching configuration', () => {
  assert.equal(configFromAladhan({ method: 99, methodSettings: '15,null,15' }).method, 'france_15');
  assert.equal(configFromAladhan({ method: 4 }).method, 'umm_al_qura');
  assert.equal(
    configFromAladhan({ method: 3, latitudeAdjustmentMethod: 2 }).high_latitude_rule,
    'one_seventh',
  );
  assert.throws(() => configFromAladhan({ method: 6 }), /No method/);
});

test('minutes between two clock times go the short way around midnight', () => {
  assert.equal(minutesBetween('23:59', '00:01'), 2);
  assert.equal(minutesBetween('00:01', '23:59'), -2);
  assert.equal(minutesBetween('05:41 (GST)', '05:43'), 2);
});
