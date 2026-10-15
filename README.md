# Prayer Times for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com)
that gives the times of the five daily prayers (Fajr, Dhuhr, Asr, Maghrib,
Isha), plus Imsak, sunrise and midnight, for the house of Gladys — the
equivalent of the Home Assistant
[`islamic_prayer_times`](https://www.home-assistant.io/integrations/islamic_prayer_times/)
integration. The times are **computed locally** from the position of the sun:
no account, no Internet connection, no request to any service.

> **Developed without a real Gladys instance: feedback welcome.** The
> integration is built and tested against the SDK's fake Gladys, real answers
> of the Aladhan API and official timetables, not on a running Gladys. Please
> report what works and what does not in the
> [issues](https://github.com/guim31/gladys-prayer-times/issues).

## Features

- **20 calculation methods** with the parameters of the public Aladhan API:
  Muslim World League, ISNA, Egypt, Umm al-Qura (Isha 120 min in Ramadan),
  Karachi, **France UOIF 12°, France 15°, France 18°**, Turkey (Diyanet),
  Dubai, Gulf, Kuwait, Qatar, Singapore, Malaysia, Indonesia, Tunisia,
  Russia, Tehran, Shia Ithna Ashari; or custom Fajr and Isha angles.
- **Asr**: standard (Shafi'i, Maliki, Hanbali) or Hanafi. **High latitudes**:
  angle based, middle of the night or one seventh of the night. **Midnight**:
  standard or Jafari. **Adjustments** per prayer in minutes, Imsak offset.
- **Location**: the house of Gladys (picked in a list, coordinates read with
  the `location` authorization), or coordinates typed in the configuration.
  Times shown in the time zone of Gladys.
- **One device**: today's eight times, the next prayer, its time, and the
  minutes left, refreshed every minute by the integration itself.
- **Scene triggers**: _Prayer time_ (at the minute) and _Prayer coming up_
  (5 to 60 minutes before), with the prayer name and time as variables — to
  announce the adhan on a speaker, light a room, send a message.
- **Scene action** _Get the prayer times_ (today or tomorrow), **dashboard
  widget** _Prayer times_ (next prayer first, the day's times, Hijri date),
  and a **Show today's times** button in the configuration.
- Four languages: English, French, German, Spanish.

## Requirements

- Gladys Assistant **5.2.0** or later (the house select of the configuration).
- The coordinates of the house in Gladys (_Settings_ → _Houses_), or typed in
  the configuration, and the right time zone in Gladys.

## Installation

1. In Gladys, open **Integrations** → **Install from GitHub** and give
   `https://github.com/guim31/gladys-prayer-times` (or install it from the
   catalog once it is listed). The install screen asks for the location of
   the houses: accept.
2. In **Configuration**, pick the method of your mosque, the Asr school, and
   check the result with **Show today's times**.
3. Add the device from the **Discovery** tab, the widget from the dashboard,
   and the triggers from the scene editor.

The user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)); Gladys
links it from the Configuration screen.

## How it works

- The sun's declination and the equation of time give the solar noon; the hour
  angle at which the sun reaches the method's depression angle gives Fajr and
  Isha, -0.833° gives sunrise and sunset, and the shadow length gives Asr
  ([`src/prayer/calc.js`](src/prayer/calc.js)). This is the classical method
  of PrayTimes.org and of the Aladhan API, written from the published
  formulas; it gives the same minute as Aladhan on the recorded answers.
- A clock inside the container ticks once a minute: it publishes the states
  that changed (and every 6 hours the ones that did not), fires the scene
  events whose minute has come, and nudges the widget when the next prayer
  changes. The core's poll is only a fallback (GladysAssistant/Gladys#3198).
- No state is kept on disk, and nothing is fetched: the container makes no
  network request besides talking to Gladys.

## Limitations

- **Developed without a real Gladys instance**: see above.
- No “Moonsighting Committee” method (seasonal angles).
- Within the polar circles, the days without sunrise or sunset leave those
  times empty.
- Gladys' _Talk on a speaker_ reads a text: playing a recorded adhan needs a
  speaker integration able to play an audio file.
- The Hijri date and the Ramadan rule of Umm al-Qura follow the Umm al-Qura
  calendar of Node.js, which may differ by a day from local moon sighting.
- One location for the whole installation.

## Development

Node.js 22+, ESM, no build step. The only runtime dependency is
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js);
[`adhan`](https://github.com/batoulapps/adhan-js) is a development dependency,
used as a reference in the tests.

```bash
npm install
npm test              # node --test, against the SDK's fake Gladys
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store .   # store validator
node scripts/probe.mjs 48.8566 2.3522 --tz Europe/Paris   # live comparison with Aladhan
```

```
index.js                 SDK wiring (src/app.js registers the handlers)
src/app.js               lifecycle, minute clock, states, events, actions, widget
src/prayer/calc.js       the astronomical calculation
src/prayer/methods.js    calculation methods (Aladhan parameters)
src/prayer/schedule.js   dates and times in the Gladys time zone, next prayer
src/events.js            scene events due in a time window
src/device.js            the Gladys device and its states
src/location.js          house or typed coordinates
src/widgets.js           "Prayer times" widget
src/scenes.js            "Get the prayer times" scene action
src/i18n.js              texts in four languages
scripts/probe.mjs        read-only comparison with the live Aladhan API
test/fixtures/aladhan/   real Aladhan answers
test/fixtures/official/  official timetables (from adhan-js)
```

`test/gladys-rules.test.js` checks the device against the category/type table
extracted from the Gladys core.

To run it outside Gladys:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="prayer-times" \
TZ="Europe/Paris" \
npm start
```

Releases are made by the **Release** workflow (Actions → Release); never edit
the versions by hand. A hand-pushed `vX.Y.Z` tag also builds the image and the
GitHub Release, but then `version` in `package.json` and in the manifest (with
the `docker_image` tag) must be bumped and committed before tagging. See
[`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- The calculation follows the method published by
  [PrayTimes.org](http://praytimes.org) (Hamid Zarrabi-Zadeh) and used by the
  [Aladhan](https://aladhan.com) API (Islamic Network); the method parameters
  are Aladhan's.
- [adhan-js](https://github.com/batoulapps/adhan-js) (Batoul Apps, MIT): the
  Diyanet and Awqaf offsets, the official timetables of
  `test/fixtures/official/`, and the reference implementation of the tests.
- Aladhan's [API service](https://github.com/Arabicsource/aladhan-api) tests
  and documentation: the recorded answers of `test/fixtures/aladhan/`.
- The Home Assistant
  [`islamic_prayer_times`](https://github.com/home-assistant/core/tree/dev/homeassistant/components/islamic_prayer_times)
  integration (Apache 2.0) for the set of options.

Not affiliated with Aladhan, Islamic Network, the UOIF or any of the
authorities whose methods are listed.

## License

[Apache-2.0](LICENSE)
