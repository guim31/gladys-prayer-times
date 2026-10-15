// -----------------------------------------------------------------------------
// Registers every SDK handler on a GladysIntegration (or the SDK's fake Gladys)
// and runs the minute clock, so index.js stays a few lines and the tests drive
// the very same wiring.
//
// The clock: the times only depend on the date, the place and the
// configuration, so nothing is fetched. Once a minute, just after the minute
// turns, the container:
//   - publishes the states of the device, if the user added it (the SDK only
//     sends what changed, plus a heartbeat every 6 h for the times that stay
//     the same from one day to the next);
//   - fires the scene events whose minute has come (src/events.js);
//   - nudges the widget when the next prayer changes.
// The core's onPoll is only a fallback (Gladys#3198: the core cannot be
// trusted to poll), skipped when the clock ticked less than 30 s ago.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { buildDevice, deviceIds, deviceStates } from './device.js';
import { MAX_LATENESS_MS, dueEvents } from './events.js';
import { MESSAGES, TIME_NAMES, allLanguages, pickLanguage } from './i18n.js';
import { createIssueLog } from './issues.js';
import { resolveLocation, sameLocation } from './location.js';
import { methodFromConfig } from './prayer/methods.js';
import { SHOWN_TIMES, formatTime, snapshot, systemTimeZone } from './prayer/schedule.js';
import { SCENE_ACTION, getTimesOutputs } from './scenes.js';
import { WIDGET, buildWidgetContent } from './widgets.js';

const logger = createLogger({ name: 'prayer-times' });

const MINUTE = 60000;
// The core's onPoll is skipped when the clock ticked this recently.
const POLL_FALLBACK_GAP_MS = 30000;
// Re-send an unchanged state this often (the front says "no recent value" past 48 h).
const HEARTBEAT_MS = 6 * 60 * MINUTE;
// The houses have no update event: read again this often.
const HOUSES_REFRESH_MS = 6 * 60 * MINUTE;
// Ticks a little after the minute turns, so the event of 12:47 is never early.
const TICK_DELAY_MS = 250;

// Manifest action key: never renamed.
export const ACTION = { SHOW_TIMES: 'show_times' };

/**
 * @param {object} gladys GladysIntegration instance (or the SDK's fake Gladys)
 * @param {object} [options] test seams
 * @param {() => number} [options.now] clock, epoch ms
 * @param {string} [options.timeZone] defaults to the container's (TZ)
 * @param {boolean} [options.timers] run the minute clock (tests drive tick() instead)
 */
export function registerHandlers(gladys, options = {}) {
  const now = options.now ?? (() => Date.now());
  const timeZone = options.timeZone ?? systemTimeZone();
  const timers = options.timers ?? true;
  const issues = createIssueLog(logger);

  let config = normalizeConfig();
  let houses = [];
  let housesReadAt = null;
  let location = null;
  let lastTickAt = null;
  // Events are fired for the instants in (eventsUpTo, now]: none on start, so
  // a restart never replays an adhan.
  let eventsUpTo = null;
  // Event ids already sent, and the ones Gladys could not take yet.
  const fired = new Map();
  const pending = new Map();
  let lastNext = null;
  let timer = null;
  let stopped = false;

  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  const whenReady =
    (fn) =>
    async (...args) => {
      await ready;
      return fn(...args);
    };

  const isOurDevice = (device) => device?.external_id === deviceIds(gladys).device;
  const deviceCreated = () => (gladys.devices ?? []).some(isOurDevice);

  async function readHouses() {
    try {
      houses = await gladys.getHouses();
      housesReadAt = now();
      issues.ok('houses', 'The houses of Gladys can be read again');
    } catch (err) {
      issues.fail('houses', `Reading the houses of Gladys failed (${err.message})`);
    }
  }

  /** Resolve the location again; one log line when it changes, never the coordinates. */
  async function updateLocation() {
    const resolved = resolveLocation(config, houses);
    const changed =
      !sameLocation(resolved, location) || resolved?.houseName !== location?.houseName;
    location = resolved;
    if (changed) {
      if (!resolved) {
        logger.warn('No location: no house of Gladys has coordinates, and none typed');
      } else if (resolved.source === 'config') {
        logger.info('Location: the coordinates typed in the configuration');
      } else {
        logger.info(`Location: the house "${resolved.houseName}"`);
      }
      // Other times: another next prayer, maybe another day of events.
      lastNext = null;
    }
    if (resolved) {
      await gladys.setConnectionStatus(true);
    } else {
      await gladys.setConnectionStatus(false, MESSAGES.noLocation);
    }
  }

  async function applyConfig(raw) {
    config = normalizeConfig(raw);
    await readHouses();
    await gladys.publishDiscoveredDevices([buildDevice(gladys, config)]);
    await updateLocation();
  }

  async function publishStates(snap) {
    if (!deviceCreated()) {
      return;
    }
    try {
      await gladys.publishChangedStates(deviceStates(gladys, snap, config), {
        heartbeat: HEARTBEAT_MS,
      });
      issues.ok('states', 'Publishing the states works again');
    } catch (err) {
      issues.fail('states', `Publishing the states failed (${err.message})`);
    }
  }

  async function fireEvents(at) {
    const from = eventsUpTo ?? at;
    eventsUpTo = at;
    for (const event of dueEvents({ config, location, from, to: at, timeZone })) {
      if (!fired.has(event.id)) {
        pending.set(event.id, event);
      }
    }
    for (const [id, event] of pending) {
      if (at - event.at > MAX_LATENESS_MS) {
        pending.delete(id);
        logger.debug(`${event.key} ${id} dropped: too late`);
        continue;
      }
      try {
        await gladys.publishSceneEvent(event.key, event.data);
        pending.delete(id);
        fired.set(id, event.at);
        logger.debug(`Scene event ${event.key} ${id}`);
        issues.ok('events', 'Scene events are accepted again');
      } catch (err) {
        issues.fail('events', `Firing a scene event failed (${err.message})`);
      }
    }
    // Two days of memory are enough to never announce a time twice.
    for (const [id, eventAt] of fired) {
      if (at - eventAt > 2 * 24 * 60 * MINUTE) {
        fired.delete(id);
      }
    }
  }

  /** One clock tick: states, scene events, widget nudge. Never throws. */
  async function tick() {
    const at = now();
    lastTickAt = at;
    if (!location) {
      return;
    }
    try {
      if (housesReadAt !== null && at - housesReadAt > HOUSES_REFRESH_MS) {
        await readHouses();
        await updateLocation();
      }
      const snap = snapshot(config, location, at, timeZone);
      logger.debug(`Tick: next ${snap.next?.key ?? 'none'} in ${snap.minutesToNext} min`);
      await publishStates(snap);
      await fireEvents(at);
      const next = snap.next ? `${snap.next.key}@${snap.next.at.getTime()}` : null;
      if (next !== lastNext) {
        lastNext = next;
        gladys.requestWidgetRefresh(WIDGET.PRAYER_TIMES);
      }
    } catch (err) {
      logger.error(`Clock tick failed (${err.message})`);
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    const delay = MINUTE - (now() % MINUTE) + TICK_DELAY_MS;
    timer = setTimeout(async () => {
      timer = null;
      await tick();
      schedule();
    }, delay);
  }

  /** Today's times, in one line, for the action message. */
  function todayLine(language) {
    const snap = snapshot(config, location, now(), timeZone);
    const names = TIME_NAMES[language];
    return SHOWN_TIMES.filter((key) => snap.today[key])
      .map((key) => `${names[key]} ${formatTime(snap.today[key], timeZone)}`)
      .join(' · ');
  }

  // --- Lifecycle ---------------------------------------------------------------
  gladys.on('connected', async () => {
    try {
      await applyConfig(await gladys.getConfig());
      await tick();
      schedule();
    } catch (err) {
      logger.error('Initialization failed', err);
      await gladys.setConnectionStatus(false, MESSAGES.initFailed).catch(() => {});
    } finally {
      resolveReady();
    }
  });

  gladys.onScanRequest(
    whenReady(async () => {
      await gladys.publishDiscoveredDevices([buildDevice(gladys, config)]);
    }),
  );

  gladys.onConfigUpdated(
    whenReady(async (newConfig) => {
      await applyConfig(newConfig);
      logger.info(
        `Configuration updated: method ${config.method}, school ${config.school}, ` +
          `high latitudes ${config.high_latitude_rule}`,
      );
      lastNext = null;
      await tick();
    }),
  );

  // --- Polling: the clock does the work, onPoll is the fallback ----------------
  gladys.onPoll(
    whenReady(async (device) => {
      if (!isOurDevice(device)) {
        return;
      }
      if (lastTickAt !== null && now() - lastTickAt < POLL_FALLBACK_GAP_MS) {
        logger.debug('onPoll skipped: the clock ticked a moment ago');
        return;
      }
      await tick();
    }),
  );

  // A device just added: the SDK forgot its states, Gladys dropped the ones
  // sent before the device existed. Send everything now.
  const resend = whenReady(async (device) => {
    if (!isOurDevice(device)) {
      return;
    }
    await tick();
    gladys.requestWidgetRefresh(WIDGET.PRAYER_TIMES);
  });
  gladys.onDeviceCreated(resend);
  gladys.onDeviceUpdated(resend);

  // --- Manifest action: check the times against the mosque's -------------------
  gladys.onAction(
    ACTION.SHOW_TIMES,
    whenReady(async () => {
      logger.info('Action show_times');
      if (!location) {
        return MESSAGES.noLocation;
      }
      const method = methodFromConfig(config);
      return allLanguages((lang) => `${method.label[lang]} — ${todayLine(lang)}`);
    }),
  );

  // --- Scene action -------------------------------------------------------------
  gladys.onSceneAction(
    SCENE_ACTION.GET_TIMES,
    whenReady(async (fields) => {
      if (!location) {
        throw new Error(MESSAGES.noLocation.en);
      }
      return getTimesOutputs({ fields, config, location, now: now(), timeZone });
    }),
  );

  // --- Dashboard widget ---------------------------------------------------------
  gladys.onWidgetGet(
    WIDGET.PRAYER_TIMES,
    whenReady(async ({ language }) => {
      const at = now();
      return buildWidgetContent({
        snap: location ? snapshot(config, location, at, timeZone) : null,
        config,
        language: pickLanguage(language, config.language),
        now: at,
      });
    }),
  );

  return {
    ready,
    tick,
    get location() {
      return location;
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
  };
}
