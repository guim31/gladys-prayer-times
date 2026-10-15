// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys (a real GladysIntegration over
// an in-memory Gladys), a controllable clock, and the integration wired on top
// through registerHandlers — the same wiring index.js uses.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { deviceIds } from '../../src/device.js';

// The integration logs its lifecycle; keep the test output readable
// (LOG_LEVEL is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';

export const TZ = 'Europe/Paris';

// A made-up house: the coordinates of central Paris, as on every map.
export const HOUSE = {
  id: 'house-1',
  name: 'Maison',
  selector: 'maison',
  latitude: 48.8566,
  longitude: 2.3522,
};

/** A clock the test moves by hand. */
export function createClock(start) {
  const clock = {
    time: typeof start === 'number' ? start : Date.parse(start),
    now: () => clock.time,
    set(value) {
      clock.time = typeof value === 'number' ? value : Date.parse(value);
    },
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.houses] houses served by GET /house
 * @param {boolean} [options.created] the user already added the device
 * @param {string|number} [options.start] the clock start
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] run the minute clock (with mock timers)
 */
export async function createWorld({
  config = {},
  houses = [HOUSE],
  created = false,
  start = '2026-10-15T08:00:30Z',
  connect = true,
  timers = false,
  clock = createClock(start),
} = {}) {
  const gladys = createFakeGladys({ config, houses });
  const ids = deviceIds(gladys);
  if (created) {
    gladys.fake.devices = [{ external_id: ids.device, features: [] }];
  }
  const app = registerHandlers(gladys, { now: clock.now, timeZone: TZ, timers });
  if (connect) {
    await gladys.connect();
    await app.ready;
  }
  return { gladys, app, clock, ids };
}

/** Add the discovered device to Gladys, as the user does. */
export async function addDevice(world) {
  const [device] = world.gladys.fake.discoveredDevices;
  await world.gladys.fake.deviceCreated(device);
  return device;
}

/** Capture the log lines written while `fn` runs, at the given level. */
export async function captureLogs(t, level, fn) {
  const lines = [];
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.mock.method(console, 'log', (...args) => lines.push(args.join(' ')));
  t.mock.method(console, 'error', (...args) => lines.push(args.join(' ')));
  try {
    await fn();
  } finally {
    process.env.LOG_LEVEL = previous;
    console.log.mock.restore();
    console.error.mock.restore();
  }
  return lines;
}

/** The scene events of the hour before Dhuhr (Paris, 15 October 2026), as fired. */
export async function eventsBeforeDhuhr() {
  const dhuhr = Date.parse('2026-10-15T11:36:00Z');
  const world = await createWorld({ start: dhuhr - 61 * 60000 });
  for (let at = dhuhr - 60 * 60000; at <= dhuhr; at += 60000) {
    world.clock.set(at + 400);
    await world.app.tick();
  }
  world.app.stop();
  return world.gladys.fake.sceneEvents;
}
