# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- The times of the five daily prayers, plus Imsak, sunrise and midnight,
  computed locally for the house of Gladys (or typed coordinates), in the time
  zone of Gladys: no account, no network request.
- 20 calculation methods with the parameters of the Aladhan API, among them
  France UOIF 12°, France 15° and France 18°, Umm al-Qura with its Ramadan
  Isha, Turkey (Diyanet) and Dubai with their offsets; custom angles; standard
  or Hanafi Asr; three high-latitude rules; standard or Jafari midnight;
  adjustments per prayer and an Imsak offset.
- A "Prayer times" device: today's times, the next prayer, its time and the
  minutes left, refreshed every minute by the integration.
- Scene triggers "Prayer time" and "Prayer coming up" (5 to 60 minutes
  before), with the prayer name and time for the scene.
- Scene action "Get the prayer times" (today or tomorrow).
- Dashboard widget "Prayer times": the next prayer first, the day's times, the
  Hijri date and the method.
- "Show today's times" in the configuration, to compare with a mosque
  timetable.
- Documentation and texts in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-prayer-times/commits/main
