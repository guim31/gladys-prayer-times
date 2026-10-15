#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Live check against the public Aladhan API, read-only, no account.
//
//   node scripts/probe.mjs <latitude> <longitude> [--date DD-MM-YYYY] [--tz Europe/Paris] [--save]
//
// For every calculation method (and both Asr schools on the first one), asks
// api.aladhan.com for the timings of the date and compares them with what the
// integration computes locally. Prints one line per request and exits with 1
// when a time differs by more than one minute. --save records each answer in
// test/fixtures/aladhan/ (use the coordinates of a city, not of a home: the
// repository is public). Aladhan is free and asks for moderate use: the
// requests are spaced by half a second.
// -----------------------------------------------------------------------------

import { writeFile } from 'node:fs/promises';
import { normalizeConfig } from '../src/config.js';
import { METHODS } from '../src/prayer/methods.js';
import { SHOWN_TIMES, formatTime, timesForDate } from '../src/prayer/schedule.js';
import { API, aladhanQuery, compareTimings } from './aladhan.mjs';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const latitude = Number(args[0]);
const longitude = Number(args[1]);
if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
  console.error(
    'Usage: node scripts/probe.mjs <latitude> <longitude> [--date DD-MM-YYYY] [--tz Zone] [--save]',
  );
  process.exit(2);
}
const timeZone = option('tz') ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
const today = new Intl.DateTimeFormat('en-GB', { timeZone }).format(new Date()).replace(/\//g, '-');
const dateText = option('date') ?? today;
const [day, month, year] = dateText.split('-').map(Number);
const date = { year, month, day };
const location = { latitude, longitude };
const save = args.includes('--save');
const TOLERANCE = 1;

const cases = [
  ...Object.keys(METHODS).map((method) => ({ method })),
  { method: 'mwl', school: 'hanafi' },
  { method: 'uoif', high_latitude_rule: 'middle_of_the_night' },
  { method: 'france_18', high_latitude_rule: 'one_seventh' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;

console.log(`Aladhan ${dateText} at ${latitude}, ${longitude} (${timeZone})`);
for (const raw of cases) {
  const config = normalizeConfig(raw);
  const label = Object.values(raw).join(' / ');
  const ours = timesForDate(config, location, date);
  const oursText = Object.fromEntries(
    SHOWN_TIMES.filter((key) => ours[key]).map((key) => [key, formatTime(ours[key], timeZone)]),
  );
  const query = aladhanQuery(config, location, timeZone);
  let body;
  try {
    const response = await fetch(`${API}/${dateText}?${query}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    body = await response.json();
    if (!response.ok || body.code !== 200) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(body).slice(0, 200)}`);
    }
  } catch (err) {
    console.log(`${label.padEnd(36)} request failed: ${err.message}`);
    failures += 1;
    continue;
  }
  const diffs = compareTimings(oursText, body.data.timings);
  const off = Object.entries(diffs).filter(([, minutes]) => Math.abs(minutes) > TOLERANCE);
  const worst = Math.max(...Object.values(diffs).map(Math.abs));
  console.log(
    `${label.padEnd(36)} ${off.length === 0 ? 'OK' : 'DIFF'} (largest gap ${worst} min)` +
      (off.length
        ? ` ${off.map(([key, minutes]) => `${key} ${minutes > 0 ? '+' : ''}${minutes}`).join(', ')}`
        : ''),
  );
  if (off.length) {
    console.log(`    ours    ${JSON.stringify(oursText)}`);
    console.log(`    aladhan ${JSON.stringify(body.data.timings)}`);
    console.log(`    meta    ${JSON.stringify(body.data.meta?.method)}`);
    failures += 1;
  }
  if (save) {
    const request = Object.fromEntries(
      [...query.entries()].map(([key, value]) => [
        key,
        /^-?[\d.]+$/.test(value) ? Number(value) : value,
      ]),
    );
    const name = `probe-${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-')}.json`;
    await writeFile(
      new URL(`../test/fixtures/aladhan/${name}`, import.meta.url),
      `${JSON.stringify(
        {
          source: `api.aladhan.com, recorded by scripts/probe.mjs on ${new Date().toISOString().slice(0, 10)}`,
          date: dateText,
          request,
          timings: body.data.timings,
        },
        null,
        2,
      )}\n`,
    );
  }
  await sleep(500);
}
console.log(failures === 0 ? 'All methods agree with Aladhan.' : `${failures} case(s) differ.`);
process.exit(failures === 0 ? 0 : 1);
