// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code registers, which options it understands or which
// keys its events carry — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTION } from '../src/app.js';
import { DEFAULT_CONFIG, LANGUAGES } from '../src/config.js';
import { TRIGGER, UPCOMING_OFFSETS } from '../src/events.js';
import { METHODS, METHOD_KEYS, CUSTOM_LABEL } from '../src/prayer/methods.js';
import { HIGH_LATITUDE_RULES } from '../src/prayer/calc.js';
import { SHOWN_TIMES } from '../src/prayer/schedule.js';
import { SCENE_ACTION } from '../src/scenes.js';
import { TIME_NAMES } from '../src/i18n.js';
import { WIDGET } from '../src/widgets.js';
import { createWorld, eventsBeforeDhuhr } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const field = (key) => manifest.config_schema.find((entry) => entry.key === key);
const optionValues = (entry) => entry.options.map((option) => option.value);

// Every list of form fields the manifest declares (same field grammar).
const allFields = [
  ...manifest.config_schema,
  ...[...manifest.actions, ...manifest.scene_triggers, ...manifest.scene_actions].flatMap(
    (item) => item.fields ?? [],
  ),
  ...manifest.widgets.flatMap((widget) => widget.settings ?? []),
];

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

const isAtLeast = (version, required) => {
  for (let i = 0; i < required.length; i += 1) {
    if (version[i] !== required[i]) {
      return version[i] > required[i];
    }
  }
  return true;
};

test('the declared keys are the ones the code handles', () => {
  assert.deepEqual(keysOf(manifest.actions), Object.values(ACTION));
  assert.deepEqual(keysOf(manifest.scene_triggers), Object.values(TRIGGER));
  assert.deepEqual(keysOf(manifest.scene_actions), Object.values(SCENE_ACTION));
  assert.deepEqual(keysOf(manifest.widgets), Object.values(WIDGET));
});

test('the house select needs Gladys 5.2.0, the house coordinates location: true', () => {
  assert.equal(field('house').source, 'houses');
  assert.equal(field('house').options, undefined);
  assert.equal(field('house').default, undefined, 'no default on a dynamic source');
  assert.equal(manifest.location, true);
  assert.ok(isAtLeast(minGladysVersion(), [5, 2, 0]), manifest.gladys_version);
});

test('the method options are the methods of the code, with the same labels', () => {
  assert.deepEqual(optionValues(field('method')), METHOD_KEYS);
  for (const option of field('method').options) {
    const label = option.value === 'custom' ? CUSTOM_LABEL : METHODS[option.value].label;
    assert.deepEqual(option.label, label, option.value);
  }
  assert.deepEqual(optionValues(field('high_latitude_rule')), HIGH_LATITUDE_RULES);
  assert.deepEqual(optionValues(field('school')), ['shafi', 'hanafi']);
  assert.deepEqual(optionValues(field('midnight_mode')), ['auto', 'standard', 'jafari']);
  assert.deepEqual(optionValues(field('language')), LANGUAGES);
});

test('the trigger filters list the times and offsets the code fires', () => {
  for (const trigger of manifest.scene_triggers) {
    const prayer = trigger.fields.find((entry) => entry.key === 'prayer');
    assert.deepEqual(optionValues(prayer), SHOWN_TIMES);
    for (const option of prayer.options) {
      for (const lang of LANGUAGES) {
        assert.equal(option.label[lang], TIME_NAMES[lang][option.value]);
      }
    }
  }
  const upcoming = manifest.scene_triggers.find((t) => t.key === TRIGGER.PRAYER_UPCOMING);
  const minutes = upcoming.fields.find((entry) => entry.key === 'minutes_before');
  assert.equal(minutes.required, true, 'an empty offset would fire seven times per prayer');
  assert.deepEqual(optionValues(minutes), UPCOMING_OFFSETS.map(String));
});

test('the trigger variables are exactly the keys the events carry', async () => {
  const events = await eventsBeforeDhuhr();
  for (const trigger of manifest.scene_triggers) {
    const fired = events.find((event) => event.key === trigger.key);
    assert.ok(fired, `${trigger.key} never fired`);
    assert.deepEqual(keysOf(trigger.variables).sort(), Object.keys(fired.data).sort());
    for (const filter of trigger.fields) {
      assert.ok(filter.key in fired.data, `${trigger.key}: filter ${filter.key} not in the event`);
    }
  }
});

test('the scene action outputs are exactly what the handler returns', async () => {
  const { gladys, app } = await createWorld();
  const ack = await gladys.fake.sceneAction(SCENE_ACTION.GET_TIMES, {});
  const declared = manifest.scene_actions[0].outputs;
  assert.deepEqual(keysOf(declared).sort(), Object.keys(ack.data.outputs).sort());
  for (const output of declared) {
    assert.equal(typeof ack.data.outputs[output.key], output.type, output.key);
  }
  app.stop();
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const entry of manifest.config_schema) {
    if (entry.type === 'section') {
      assert.equal(entry.default, undefined);
      assert.ok(!(entry.key in DEFAULT_CONFIG), entry.key);
      continue;
    }
    assert.ok(entry.key in DEFAULT_CONFIG, `${entry.key} missing from DEFAULT_CONFIG`);
    if (entry.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[entry.key], entry.default, entry.key);
    }
  }
});

test('number fields: integer bounds and defaults (Gladys renders them without step)', () => {
  for (const entry of allFields.filter((f) => f.type === 'number')) {
    for (const bound of ['min', 'max', 'default']) {
      if (entry[bound] !== undefined) {
        assert.ok(Number.isInteger(entry[bound]), `${entry.key}.${bound}`);
      }
    }
  }
});

test('no secret field anywhere, no field required without a default in an action', () => {
  for (const entry of allFields) {
    assert.notEqual(entry.type, 'secret', entry.key);
  }
  for (const action of manifest.scene_actions) {
    for (const entry of action.fields) {
      assert.ok(!entry.required || entry.default !== undefined, entry.key);
    }
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.equal(manifest.docker_image, `ghcr.io/guim31/gladys-prayer-times:${manifest.version}`);
});

test('catalog: name, description, categories, transports', () => {
  assert.equal(typeof manifest.name, 'string');
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
  assert.deepEqual(manifest.categories, ['services']);
  assert.deepEqual(manifest.transports, ['local']);
});

test('field placeholders are multi-language objects', () => {
  const withPlaceholder = allFields.filter((f) => f.placeholder !== undefined);
  assert.ok(withPlaceholder.length > 0);
  for (const entry of withPlaceholder) {
    assert.equal(typeof entry.placeholder, 'object', `field "${entry.key}": placeholder`);
  }
});
