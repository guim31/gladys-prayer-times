// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys: discovery,
// location, states, the minute clock, scene events, the widget, the actions,
// and the logs.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { HOUSE, TZ, addDevice, captureLogs, createClock, createWorld } from './helpers/world.js';
import { FEATURE } from '../src/device.js';
import { MESSAGES } from '../src/i18n.js';
import { UPCOMING_OFFSETS } from '../src/events.js';
import { normalizeConfig } from '../src/config.js';
import { formatTime, timesForDate } from '../src/prayer/schedule.js';

// Paris, 15 October 2026, Muslim World League: Dhuhr 13:36, Asr 16:28 (UTC+2).
const DHUHR = Date.parse('2026-10-15T11:36:00Z');
const ASR = Date.parse('2026-10-15T14:28:00Z');
const MINUTE = 60000;

const textOf = (world, key) => world.gladys.fake.lastState(world.ids.feature(key));

test('publishes one device and reports the house as found', async () => {
  const world = await createWorld();
  const devices = world.gladys.fake.discoveredDevices;
  assert.equal(devices.length, 1);
  assert.equal(devices[0].external_id, world.ids.device);
  assert.equal(devices[0].name, 'Horaires de prière');
  assert.deepEqual(world.gladys.fake.connectionStatus.connected, true);
  assert.equal(world.app.location.source, 'house');
  world.app.stop();
});

test('without any location: disconnected status that says what to do, no state, no event', async () => {
  const world = await createWorld({ houses: [{ ...HOUSE, latitude: null, longitude: null }] });
  const status = world.gladys.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.deepEqual(status.message, MESSAGES.noLocation);
  await addDevice(world);
  world.clock.set(DHUHR + 500);
  await world.app.tick();
  assert.equal(world.gladys.fake.states.length, 0);
  assert.equal(world.gladys.fake.sceneEvents.length, 0);
  const widget = await world.gladys.fake.widgetGet('prayer_times', { language: 'de' });
  assert.equal(widget.data.content.components[0].text, MESSAGES.noLocation.de);
  const action = await world.gladys.fake.action('show_times', {});
  assert.deepEqual(action.data.message, MESSAGES.noLocation);
  world.app.stop();
});

test('typed coordinates win over the house, a chosen house over the first one', async () => {
  const second = {
    ...HOUSE,
    id: 'house-2',
    name: 'Chalet',
    selector: 'chalet',
    latitude: 45.9,
    longitude: 6.87,
  };
  const chosen = await createWorld({ houses: [HOUSE, second], config: { house: 'chalet' } });
  assert.equal(chosen.app.location.houseName, 'Chalet');
  chosen.app.stop();

  const typed = await createWorld({ config: { latitude: '43,2965', longitude: '5,3698' } });
  assert.deepEqual(
    { ...typed.app.location },
    { latitude: 43.2965, longitude: 5.3698, source: 'config' },
  );
  typed.app.stop();

  const missing = await createWorld({ houses: [HOUSE], config: { house: 'gone' } });
  assert.equal(missing.app.location, null);
  missing.app.stop();
});

test('states are sent once the device is added, then only what changes', async () => {
  const world = await createWorld();
  assert.equal(world.gladys.fake.states.length, 0, 'nothing before the device exists');

  await addDevice(world);
  assert.equal(textOf(world, 'fajr'), '06:26');
  assert.equal(textOf(world, 'dhuhr'), '13:36');
  assert.equal(textOf(world, 'midnight'), '01:36');
  assert.equal(textOf(world, FEATURE.NEXT_PRAYER), 'Dhuhr');
  assert.equal(textOf(world, FEATURE.NEXT_PRAYER_TIME), '13:36');
  assert.equal(textOf(world, FEATURE.MINUTES_TO_NEXT), 216);
  const sent = world.gladys.fake.states.length;
  assert.equal(sent, 11);

  // A minute later: only the time left changes.
  world.clock.advance(MINUTE);
  await world.app.tick();
  assert.equal(world.gladys.fake.states.length, sent + 1);
  assert.equal(textOf(world, FEATURE.MINUTES_TO_NEXT), 215);

  // After Dhuhr, the next prayer is Asr.
  world.clock.set(DHUHR + 500);
  await world.app.tick();
  assert.equal(textOf(world, FEATURE.NEXT_PRAYER), 'Asr');
  assert.equal(textOf(world, FEATURE.MINUTES_TO_NEXT), (ASR - DHUHR) / MINUTE);
  world.app.stop();
});

test('the times are re-sent at least every 6 hours, unchanged or not', async (t) => {
  // The SDK dates its heartbeat with Date.now(): move both clocks together.
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-15T08:00:30Z') });
  const clock = {
    now: () => Date.now(),
    advance: (ms) => t.mock.timers.tick(ms),
  };
  const world = await createWorld({ created: true, clock });
  const fajrStates = () =>
    world.gladys.fake.states.filter(
      (s) => s.device_feature_external_id === world.ids.feature('fajr'),
    );
  assert.equal(fajrStates().length, 1);
  world.clock.advance(3 * 60 * MINUTE);
  await world.app.tick();
  assert.equal(fajrStates().length, 1);
  world.clock.advance(3 * 60 * MINUTE + MINUTE);
  await world.app.tick();
  assert.equal(fajrStates().length, 2);
  world.app.stop();
});

test('the clock refreshes the states by itself, without any onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-10-15T08:00:30Z') });
  const clock = { now: () => Date.now() };
  const world = await createWorld({ created: true, timers: true, clock });
  const polls = world.gladys.fake.wsMessages.length;
  assert.equal(textOf(world, FEATURE.MINUTES_TO_NEXT), 216);
  for (let minute = 1; minute <= 3; minute += 1) {
    t.mock.timers.tick(MINUTE);
    // Let the tick's promises settle.
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(textOf(world, FEATURE.MINUTES_TO_NEXT), 213);
  assert.ok(world.gladys.fake.wsMessages.length >= polls, 'no poll was sent by Gladys');
  world.app.stop();
});

test('onPoll is a fallback: skipped right after a tick, served when the clock stalls', async () => {
  const world = await createWorld({ created: true });
  const device = { external_id: world.ids.device };
  world.clock.advance(MINUTE);
  const before = world.gladys.fake.states.length;
  await world.app.tick();
  const afterTick = world.gladys.fake.states.length;
  assert.equal(afterTick, before + 1);
  world.clock.advance(5000);
  assert.deepEqual(await world.gladys.fake.poll(device), { success: true });
  assert.equal(world.gladys.fake.states.length, afterTick, 'skipped');
  world.clock.advance(2 * MINUTE);
  await world.gladys.fake.poll(device);
  assert.equal(world.gladys.fake.states.length, afterTick + 1, 'served');
  world.app.stop();
});

test('scene events: the prayer at its minute, and each reminder before it', async () => {
  const world = await createWorld({ start: DHUHR - 61 * MINUTE });
  const events = () => world.gladys.fake.sceneEvents;
  assert.equal(events().length, 0, 'nothing replayed on start');

  // Minute by minute up to Dhuhr.
  for (let at = DHUHR - 60 * MINUTE; at <= DHUHR; at += MINUTE) {
    world.clock.set(at + 400);
    await world.app.tick();
  }
  const dhuhr = events().filter((e) => e.data.prayer === 'dhuhr');
  assert.deepEqual(
    dhuhr.map((e) => [e.key, e.data.minutes_before ?? 0]),
    [...[...UPCOMING_OFFSETS].reverse().map((m) => ['prayer_upcoming', m]), ['prayer_time', 0]],
  );
  assert.deepEqual(dhuhr.at(-1).data, { prayer: 'dhuhr', prayer_name: 'Dhuhr', time: '13:36' });
  assert.deepEqual(dhuhr[0].data, {
    prayer: 'dhuhr',
    prayer_name: 'Dhuhr',
    time: '13:36',
    minutes_before: 60,
  });
  // Nothing else falls in that hour.
  assert.equal(events().length, dhuhr.length);

  // A second tick in the same minute fires nothing again.
  world.clock.set(DHUHR + 30000);
  await world.app.tick();
  assert.equal(events().length, dhuhr.length);
  world.app.stop();
});

test('a late tick still fires what it missed, a much later one does not', async () => {
  const world = await createWorld({ start: DHUHR - 30 * MINUTE });
  world.clock.set(DHUHR + 90000);
  await world.app.tick();
  assert.deepEqual(
    world.gladys.fake.sceneEvents.map((e) => e.key),
    ['prayer_time'],
    'Dhuhr fired 1.5 min late, the reminders older than 2 min dropped',
  );

  const late = await createWorld({ start: DHUHR - 30 * MINUTE });
  late.clock.set(DHUHR + 10 * MINUTE);
  await late.app.tick();
  assert.equal(late.gladys.fake.sceneEvents.length, 0);
  world.app.stop();
  late.app.stop();
});

test('an event Gladys refused is retried at the next tick', async (t) => {
  const world = await createWorld({ start: DHUHR - 30000 });
  const publish = world.gladys.publishSceneEvent.bind(world.gladys);
  let refuse = true;
  t.mock.method(world.gladys, 'publishSceneEvent', async (...args) => {
    if (refuse) throw new Error('socket closed');
    return publish(...args);
  });
  world.clock.set(DHUHR + 400);
  await world.app.tick();
  assert.equal(world.gladys.fake.sceneEvents.length, 0);
  refuse = false;
  world.clock.set(DHUHR + MINUTE + 400);
  await world.app.tick();
  assert.deepEqual(
    world.gladys.fake.sceneEvents.map((e) => e.data.prayer),
    ['dhuhr'],
  );
  world.app.stop();
});

test('a new configuration does not announce the same prayer twice', async () => {
  const world = await createWorld({ start: DHUHR - 30000 });
  world.clock.set(DHUHR + 400);
  await world.app.tick();
  assert.equal(world.gladys.fake.sceneEvents.length, 1);
  // The user moves Dhuhr two minutes later.
  await world.gladys.fake.configUpdated({ adjust_dhuhr: 2 });
  for (let i = 1; i <= 3; i += 1) {
    world.clock.set(DHUHR + i * MINUTE + 400);
    await world.app.tick();
  }
  assert.equal(world.gladys.fake.sceneEvents.filter((e) => e.key === 'prayer_time').length, 1);
  world.app.stop();
});

test('events cross midnight and the day boundary', async () => {
  const config = normalizeConfig({});
  const location = { latitude: HOUSE.latitude, longitude: HOUSE.longitude };
  const today = timesForDate(config, location, { year: 2026, month: 10, day: 15 });
  const tomorrow = timesForDate(config, location, { year: 2026, month: 10, day: 16 });
  const world = await createWorld({ start: today.midnight.getTime() - 30000 });
  world.clock.set(today.midnight.getTime() + 400);
  await world.app.tick();
  assert.deepEqual(world.gladys.fake.sceneEvents.at(-1).data.prayer, 'midnight');
  world.clock.set(tomorrow.imsak.getTime() - 15 * MINUTE + 400);
  await world.app.tick();
  const reminder = world.gladys.fake.sceneEvents.at(-1);
  assert.equal(reminder.data.prayer, 'imsak');
  assert.equal(reminder.data.minutes_before, 15);
  assert.equal(reminder.data.time, formatTime(tomorrow.imsak, TZ));
  world.app.stop();
});

test('the widget: next prayer first, the eight times, within the core budget', async () => {
  const world = await createWorld();
  for (const language of ['en', 'fr', 'de', 'es']) {
    const ack = await world.gladys.fake.widgetGet('prayer_times', { language });
    assert.equal(ack.success, true);
    const content = ack.data.content;
    assert.deepEqual(validateWidgetContent(content), [], language);
    const status = content.components.find((c) => c.type === 'status');
    assert.equal(status.items.length, 8);
    const next = status.items.find((item) => item.icon === 'bell');
    assert.equal(next.value, '13:36');
  }
  const fr = (await world.gladys.fake.widgetGet('prayer_times', { language: 'fr' })).data.content;
  assert.equal(fr.components[0].text, 'Prochaine : Dhuhr à 13:36');
  assert.equal(fr.components[1].value, '3 h 36');
  assert.match(fr.components.at(-1).text, /^4 joumada al oula 1448 AH · Ligue islamique mondiale/);
  // An unknown dashboard language falls back to the configured one.
  const it = (await world.gladys.fake.widgetGet('prayer_times', { language: 'it' })).data.content;
  assert.equal(it.components[0].text, 'Prochaine : Dhuhr à 13:36');
  world.app.stop();
});

test('the widget is nudged when the device is added and when the next prayer changes', async () => {
  const world = await createWorld();
  const nudges = () => world.gladys.fake.widgetRefreshes.length;
  const start = nudges();
  await addDevice(world);
  assert.ok(nudges() > start);
  const afterAdd = nudges();
  world.clock.advance(MINUTE);
  await world.app.tick();
  assert.equal(nudges(), afterAdd, 'same next prayer: no nudge');
  world.clock.set(DHUHR + 400);
  await world.app.tick();
  assert.equal(nudges(), afterAdd + 1);
  world.app.stop();
});

test('scene action: today or tomorrow, with the next prayer', async () => {
  const world = await createWorld({ config: { language: 'en' } });
  const today = await world.gladys.fake.sceneAction('get_prayer_times', {});
  assert.equal(today.success, true);
  assert.equal(today.data.outputs.dhuhr, '13:36');
  assert.equal(today.data.outputs.sunrise, '08:11');
  assert.equal(today.data.outputs.next_prayer, 'Dhuhr');
  assert.equal(today.data.outputs.next_prayer_time, '13:36');
  assert.equal(today.data.outputs.minutes_to_next, 216);
  const tomorrow = await world.gladys.fake.sceneAction('get_prayer_times', { day: 'tomorrow' });
  assert.notEqual(tomorrow.data.outputs.fajr, today.data.outputs.fajr);
  world.app.stop();
});

test("action show_times: the method and today's times, in every language", async () => {
  const world = await createWorld({ config: { method: 'uoif' } });
  const ack = await world.gladys.fake.action('show_times', {});
  assert.equal(ack.success, true);
  assert.deepEqual(Object.keys(ack.data.message).sort(), ['de', 'en', 'es', 'fr']);
  assert.equal(
    ack.data.message.fr,
    'France, UOIF (12° / 12°) — Imsak 06:52 · Fajr 07:02 · Lever du soleil 08:11 · Dhuhr 13:36 · ' +
      'Asr 16:28 · Maghrib 19:01 · Isha 20:09 · Minuit 01:36',
  );
  world.app.stop();
});

test('a new configuration changes the times at once', async () => {
  const world = await createWorld({ created: true });
  assert.equal(textOf(world, 'fajr'), '06:26');
  await world.gladys.fake.configUpdated({ method: 'uoif' });
  assert.equal(textOf(world, 'fajr'), '07:02');
  world.app.stop();
});

test('feature names follow the configured language', async () => {
  const names = {};
  for (const language of ['en', 'fr', 'de', 'es']) {
    const world = await createWorld({ config: { language } });
    names[language] = world.gladys.fake.discoveredDevices[0].name;
    world.app.stop();
  }
  assert.deepEqual(names, {
    en: 'Prayer times',
    fr: 'Horaires de prière',
    de: 'Gebetszeiten',
    es: 'Horarios de oración',
  });
});

test('quiet logs: a normal day writes nothing at info, and never the coordinates', async (t) => {
  const config = { latitude: '43.296512', longitude: '5.369812', language: 'en' };
  let world;
  const startup = await captureLogs(t, 'info', async () => {
    world = await createWorld({ config, created: true, start: DHUHR - 70 * MINUTE });
  });
  assert.deepEqual(
    startup.map((line) => line.replace(/^\S+ /, '')),
    ['[INFO] [prayer-times] Location: the coordinates typed in the configuration'],
  );

  const day = await captureLogs(t, 'info', async () => {
    // A whole day, minute by minute: states, reminders, prayers, widget pulls.
    for (let i = 0; i < 24 * 60; i += 1) {
      world.clock.advance(MINUTE);
      await world.app.tick();
      if (i % 30 === 0) {
        await world.gladys.fake.widgetGet('prayer_times', { language: 'en' });
        await world.gladys.fake.poll({ external_id: world.ids.device });
      }
    }
  });
  assert.ok(world.gladys.fake.sceneEvents.length >= 60, 'the day fired its events');
  assert.deepEqual(day, []);

  const debug = await captureLogs(t, 'debug', async () => {
    world.clock.advance(MINUTE);
    await world.app.tick();
    await world.gladys.fake.configUpdated({ ...config, method: 'isna' });
    await world.gladys.fake.action('show_times', {});
  });
  assert.ok(debug.some((line) => line.includes('[DEBUG]')));
  assert.ok(debug.some((line) => line.includes('Configuration updated: method isna')));
  for (const line of [...startup, ...day, ...debug]) {
    assert.ok(!line.includes('43.29') && !line.includes('5.36'), `coordinates logged: ${line}`);
  }
  world.app.stop();
});

test('a repeated failure is logged once, and its end once', async (t) => {
  const world = await createWorld({ created: true });
  let fail = true;
  const publish = world.gladys.publishChangedStates.bind(world.gladys);
  t.mock.method(world.gladys, 'publishChangedStates', async (...args) => {
    if (fail) throw new Error('HTTP 503');
    return publish(...args);
  });
  const lines = await captureLogs(t, 'info', async () => {
    for (let i = 0; i < 5; i += 1) {
      world.clock.advance(MINUTE);
      await world.app.tick();
    }
    fail = false;
    world.clock.advance(MINUTE);
    await world.app.tick();
  });
  assert.equal(lines.length, 2, lines.join('\n'));
  assert.match(lines[0], /\[WARN\].*Publishing the states failed \(HTTP 503\)/);
  assert.match(lines[1], /\[INFO\].*Publishing the states works again/);
  world.app.stop();
});

test('a reconnection re-reads the houses and keeps a single clock', async () => {
  const clock = createClock('2026-10-15T08:00:30Z');
  const world = await createWorld({ clock });
  world.gladys.fake.houses = [{ ...HOUSE, name: 'Appartement', latitude: 43.3, longitude: 5.37 }];
  await world.gladys.disconnect();
  await world.gladys.connect();
  assert.equal(world.app.location.houseName, 'Appartement');
  world.app.stop();
});
