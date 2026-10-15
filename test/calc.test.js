// -----------------------------------------------------------------------------
// The local calculation, checked three ways:
//   1. official timetables published by the authorities (test/fixtures/official,
//      collected by batoulapps/adhan-js, MIT): within the tolerance each table
//      declares, since an authority rounds and adjusts by hand;
//   2. adhan-js itself (a devDependency, never shipped), over a year of eight
//      cities: the two implementations use different solar models, a minute
//      apart at most, two for Asr;
//   3. the behaviours that matter to a user: Hanafi Asr later, Ramadan Isha,
//      adjustments, high latitudes, polar night, daylight saving.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import * as adhan from 'adhan';
import { computeTimes, julianDay } from '../src/prayer/calc.js';
import { METHODS, methodFromConfig } from '../src/prayer/methods.js';
import { normalizeConfig } from '../src/config.js';
import {
  addDays,
  formatTime,
  hijriMonth,
  localDate,
  snapshot,
  timesForDate,
} from '../src/prayer/schedule.js';

const officialDir = new URL('./fixtures/official/', import.meta.url);
const ADHAN_METHODS = {
  Turkey: 'turkey',
  Qatar: 'qatar',
  Dubai: 'dubai',
  Kuwait: 'kuwait',
  UmmAlQura: 'umm_al_qura',
  Singapore: 'singapore',
  Tehran: 'tehran',
};

const clockMinutes = (text) => {
  const match = text.match(/(\d+):(\d+) (AM|PM)/);
  return ((Number(match[1]) % 12) + (match[3] === 'PM' ? 12 : 0)) * 60 + Number(match[2]);
};
const localMinutes = (date, timeZone) => {
  const [hours, minutes] = formatTime(date, timeZone).split(':').map(Number);
  return hours * 60 + minutes;
};

for (const name of await readdir(officialDir)) {
  const table = JSON.parse(await readFile(new URL(name, officialDir), 'utf8'));
  const methodKey = ADHAN_METHODS[table.params.method];
  test(`official timetable: ${name}`, () => {
    assert.ok(methodKey, `no method for ${table.params.method}`);
    // The tables without a declared variance round by hand: one minute.
    const tolerance = table.variance ?? 1;
    for (const row of table.times) {
      const [year, month, day] = row.date.split('-').map(Number);
      const date = { year, month, day };
      const times = computeTimes({
        date,
        latitude: table.params.latitude,
        longitude: table.params.longitude,
        method: METHODS[methodKey],
        school: table.params.madhab.toLowerCase(),
        highLatitudeRule: 'middle_of_the_night',
        ramadan: hijriMonth(date) === 9,
      });
      for (const key of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        const gap = localMinutes(times[key], table.params.timezone) - clockMinutes(row[key]);
        assert.ok(
          Math.abs(gap) <= tolerance,
          `${row.date} ${key}: ours ${formatTime(times[key], table.params.timezone)}, official ${row[key]}`,
        );
      }
    }
  });
}

const CITIES = [
  ['Paris', 48.8566, 2.3522],
  ['Marseille', 43.2965, 5.3698],
  ['Lille', 50.6292, 3.0573],
  ['Cairo', 30.0444, 31.2357],
  ['Jakarta', -6.2088, 106.8456],
  ['Montreal', 45.5019, -73.5674],
  ['Cape Town', -33.9249, 18.4241],
  ['Tokyo', 35.6762, 139.6503],
];
const ORACLE_RULES = {
  angle_based: adhan.HighLatitudeRule.TwilightAngle,
  one_seventh: adhan.HighLatitudeRule.SeventhOfTheNight,
};

for (const methodKey of ['mwl', 'isna', 'egypt', 'karachi', 'uoif', 'france_15', 'france_18']) {
  test(`agrees with adhan-js over a year: ${methodKey}`, () => {
    const method = METHODS[methodKey];
    for (const [ruleKey, rule] of Object.entries(ORACLE_RULES)) {
      const params = new adhan.CalculationParameters('Other', method.fajr, method.isha.angle);
      params.highLatitudeRule = rule;
      params.rounding = adhan.Rounding.Nearest;
      for (const [city, latitude, longitude] of CITIES) {
        for (let dayOfYear = 0; dayOfYear < 365; dayOfYear += 4) {
          const date = addDays({ year: 2026, month: 1, day: 1 }, dayOfYear);
          for (const school of ['shafi', 'hanafi']) {
            params.madhab = school === 'shafi' ? adhan.Madhab.Shafi : adhan.Madhab.Hanafi;
            // adhan-js reads the civil date from the local fields of the Date.
            const reference = new adhan.PrayerTimes(
              new adhan.Coordinates(latitude, longitude),
              new Date(date.year, date.month - 1, date.day),
              params,
            );
            const ours = computeTimes({
              date,
              latitude,
              longitude,
              method,
              school,
              highLatitudeRule: ruleKey,
            });
            for (const key of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
              const gap = Math.abs(ours[key] - reference[key]) / 60000;
              assert.ok(
                gap <= (key === 'asr' ? 2 : 1.5),
                `${city} ${date.year}-${date.month}-${date.day} ${school} ${ruleKey} ${key}: ${gap} min`,
              );
            }
          }
        }
      }
    }
  });
}

const PARIS = { latitude: 48.8566, longitude: 2.3522 };

test('Julian day of the J2000 epoch', () => {
  assert.equal(julianDay(2000, 1, 1), 2451544.5);
});

test('the times of a day come in order', () => {
  const times = timesForDate(normalizeConfig({ method: 'uoif' }), PARIS, {
    year: 2026,
    month: 10,
    day: 15,
  });
  const order = ['imsak', 'fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'midnight'];
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(times[order[i]] > times[order[i - 1]], `${order[i - 1]} before ${order[i]}`);
  }
  // Midnight falls in the night after the day.
  assert.ok(times.midnight.getTime() - times.maghrib.getTime() < 12 * 3600000);
});

test('the Hanafi Asr comes later than the standard one', () => {
  const date = { year: 2026, month: 10, day: 15 };
  const standard = timesForDate(normalizeConfig({}), PARIS, date);
  const hanafi = timesForDate(normalizeConfig({ school: 'hanafi' }), PARIS, date);
  assert.ok(hanafi.asr - standard.asr > 30 * 60000);
  assert.equal(hanafi.dhuhr.getTime(), standard.dhuhr.getTime());
});

test('Umm al-Qura: Isha 90 minutes after Maghrib, 120 during Ramadan', () => {
  const config = normalizeConfig({ method: 'umm_al_qura' });
  const makkah = { latitude: 21.4225, longitude: 39.8262 };
  // 1 Ramadan 1448 is 2027-02-08 in the Umm al-Qura calendar.
  const ramadan = { year: 2027, month: 2, day: 15 };
  const before = { year: 2027, month: 1, day: 15 };
  assert.equal(hijriMonth(ramadan), 9);
  assert.notEqual(hijriMonth(before), 9);
  const inRamadan = timesForDate(config, makkah, ramadan);
  const outside = timesForDate(config, makkah, before);
  assert.equal((inRamadan.isha - inRamadan.maghrib) / 60000, 120);
  assert.equal((outside.isha - outside.maghrib) / 60000, 90);
});

test('the adjustments shift each time, and Imsak follows Fajr', () => {
  const date = { year: 2026, month: 10, day: 15 };
  const plain = timesForDate(normalizeConfig({}), PARIS, date);
  const adjusted = timesForDate(
    normalizeConfig({ adjust_fajr: 2, adjust_dhuhr: 5, adjust_isha: -3, imsak_minutes: 15 }),
    PARIS,
    date,
  );
  assert.equal((adjusted.fajr - plain.fajr) / 60000, 2);
  assert.equal((adjusted.dhuhr - plain.dhuhr) / 60000, 5);
  assert.equal((adjusted.isha - plain.isha) / 60000, -3);
  assert.equal((adjusted.fajr - adjusted.imsak) / 60000, 15);
  assert.equal(adjusted.asr.getTime(), plain.asr.getTime());
});

test('the custom method uses the typed angles, or minutes after Maghrib', () => {
  const date = { year: 2026, month: 3, day: 1 };
  const custom = timesForDate(
    normalizeConfig({ method: 'custom', custom_fajr_angle: '12', custom_isha_angle: '12' }),
    PARIS,
    date,
  );
  const uoif = timesForDate(normalizeConfig({ method: 'uoif' }), PARIS, date);
  assert.equal(custom.fajr.getTime(), uoif.fajr.getTime());
  assert.equal(custom.isha.getTime(), uoif.isha.getTime());
  const interval = timesForDate(
    normalizeConfig({ method: 'custom', custom_isha_minutes: 75 }),
    PARIS,
    date,
  );
  assert.equal((interval.isha - interval.maghrib) / 60000, 75);
  assert.deepEqual(methodFromConfig(normalizeConfig({ method: 'custom' })).isha, { angle: 17 });
});

test('Shia methods: Maghrib after sunset, Jafari midnight', () => {
  const date = { year: 2026, month: 10, day: 15 };
  const tehran = timesForDate(normalizeConfig({ method: 'tehran' }), PARIS, date);
  const mwl = timesForDate(normalizeConfig({}), PARIS, date);
  assert.ok(tehran.maghrib - tehran.sunset > 10 * 60000);
  // Jafari midnight: halfway from sunset to Fajr, earlier than to sunrise.
  const standard = timesForDate(
    normalizeConfig({ method: 'tehran', midnight_mode: 'standard' }),
    PARIS,
    date,
  );
  assert.ok(tehran.midnight < standard.midnight);
  assert.equal(mwl.maghrib.getTime(), mwl.sunset.getTime());
});

test('high latitudes: an 18° Fajr in a Paris June stays a real time, per rule', () => {
  // The sun never goes 18° below the horizon in Paris around the solstice.
  const date = { year: 2026, month: 6, day: 21 };
  const results = {};
  for (const rule of ['angle_based', 'middle_of_the_night', 'one_seventh']) {
    const times = timesForDate(
      normalizeConfig({ method: 'france_18', high_latitude_rule: rule }),
      PARIS,
      date,
    );
    assert.ok(times.fajr && times.isha, rule);
    assert.ok(times.fajr < times.sunrise && times.isha > times.maghrib, rule);
    results[rule] = times;
  }
  // One seventh of the night is the shortest twilight, the middle the longest.
  assert.ok(results.one_seventh.isha < results.angle_based.isha);
  assert.ok(results.angle_based.isha < results.middle_of_the_night.isha);
});

test('polar night: no sunrise is reported as missing, never as a wrong time', () => {
  const tromso = { latitude: 69.6492, longitude: 18.9553 };
  const times = timesForDate(normalizeConfig({}), tromso, { year: 2026, month: 12, day: 21 });
  assert.equal(times.sunrise, null);
  assert.equal(times.maghrib, null);
  assert.ok(times.dhuhr instanceof Date);
});

test('daylight saving: the clock times follow the change of the night', () => {
  const config = normalizeConfig({});
  // Europe/Paris goes from UTC+1 to UTC+2 on 2026-03-29.
  const before = timesForDate(config, PARIS, { year: 2026, month: 3, day: 28 });
  const after = timesForDate(config, PARIS, { year: 2026, month: 3, day: 29 });
  const gap = (a, b) => {
    const [ha, ma] = formatTime(a, 'Europe/Paris').split(':').map(Number);
    const [hb, mb] = formatTime(b, 'Europe/Paris').split(':').map(Number);
    return hb * 60 + mb - (ha * 60 + ma);
  };
  // Dhuhr moves by about one hour on the clock, not by the day's few seconds.
  assert.ok(Math.abs(gap(before.dhuhr, after.dhuhr) - 60) <= 1);
});

test('the next prayer: the next of the five, then tomorrow Fajr after Isha', () => {
  const config = normalizeConfig({ method: 'uoif' });
  const date = { year: 2026, month: 10, day: 15 };
  const today = timesForDate(config, PARIS, date);
  const tomorrow = timesForDate(config, PARIS, addDays(date, 1));
  const tz = 'Europe/Paris';

  const morning = snapshot(config, PARIS, today.fajr.getTime() - 90 * 60000, tz);
  assert.equal(morning.next.key, 'fajr');
  assert.equal(morning.minutesToNext, 90);

  // At the very minute of Dhuhr, the next one is Asr (the Dhuhr event fires then).
  const noon = snapshot(config, PARIS, today.dhuhr.getTime() + 500, tz);
  assert.equal(noon.next.key, 'asr');

  // Sunrise is not a prayer: between Fajr and Dhuhr the next one is Dhuhr.
  const sunrise = snapshot(config, PARIS, today.sunrise.getTime() + 60000, tz);
  assert.equal(sunrise.next.key, 'dhuhr');

  const night = snapshot(config, PARIS, today.isha.getTime() + 60000, tz);
  assert.equal(night.next.key, 'fajr');
  assert.equal(night.next.at.getTime(), tomorrow.fajr.getTime());
  assert.deepEqual(localDate(new Date(today.isha), tz), date);
});
