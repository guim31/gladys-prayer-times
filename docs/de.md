# Gebetszeiten

Die Zeiten der fünf täglichen Gebete (Fajr, Dhuhr, Asr, Maghrib, Isha), dazu
Imsak, Sonnenaufgang und Mitternacht, berechnet für dein Zuhause — wie die
Home-Assistant-Integration `islamic_prayer_times`. Gladys kann sie auf dem
Dashboard zeigen und zur Zeit eines Gebets oder einige Minuten vorher eine
Szene starten.

Die Zeiten werden **lokal berechnet**, aus dem Sonnenstand: kein Konto, keine
Internetverbindung, nichts wird irgendwohin gesendet. Die Berechnung ist die
der öffentlichen [Aladhan](https://aladhan.com)-API (des Dienstes, den Home
Assistant aufruft) und ergibt dieselbe Minute.

> **Ohne echte Gladys-Instanz entwickelt: Rückmeldungen sind willkommen.** Die
> Integration wurde gegen das Test-Gladys des SDK gebaut und mit echten
> Aladhan-Antworten und offiziellen Gebetsplänen geprüft, nicht auf einem
> laufenden Gladys. Wenn etwas nicht wie beschrieben funktioniert, sag es im
> [Gladys-Forum](https://community.gladysassistant.com) oder in den
> [Issues](https://github.com/guim31/gladys-prayer-times/issues).

## Was du brauchst

- Gladys Assistant 5.2.0 oder neuer.
- Die Koordinaten deines Zuhauses in Gladys (_Einstellungen_ → _Zuhause_) oder
  Koordinaten, die du in der Konfiguration der Integration einträgst.
- Die richtige Zeitzone in Gladys: Die Zeiten werden in ihr angezeigt.

Bei der Installation fragt Gladys, ob die Integration den Standort deiner
Häuser lesen darf: Stimme zu, so weiß sie, wo die Sonne für dich steht. Die
Koordinaten verlassen dein Gladys nie und werden nie in die Protokolle
geschrieben.

## Konfiguration

### Standort

- **Zuhause**: das Zuhause, für das gerechnet wird. Leer: das erste Zuhause
  mit Koordinaten.
- **Breitengrad / Längengrad** (optional): Dezimalgrad, mit Komma oder Punkt
  (zum Beispiel `48,8566` und `2,3522`). Wenn beide ausgefüllt sind, ersetzen
  sie das Zuhause.

### Berechnungsmethode

Wähle die Methode deiner Moschee oder deines Landes. Die Winkel geben an, wie
tief die Sonne bei Fajr und Isha unter dem Horizont steht: Je größer der
Winkel, desto früher Fajr und desto später Isha.

| Methode                        | Fajr  | Isha               | Hinweise                                     |
| ------------------------------ | ----- | ------------------ | -------------------------------------------- |
| Islamische Weltliga (Standard) | 18°   | 17°                | Europa, Ferner Osten, Teile der USA          |
| ISNA, Nordamerika              | 15°   | 15°                |                                              |
| Ägyptische Vermessungsbehörde  | 19,5° | 17,5°              | Afrika, Syrien, Libanon                      |
| Umm al-Qura, Mekka             | 18,5° | 90 min             | 120 min im Ramadan                           |
| Universität Karatschi          | 18°   | 18°                | Pakistan, Indien, Bangladesch                |
| Frankreich, UOIF               | 12°   | 12°                | Union des organisations islamiques de France |
| Frankreich, 15°                | 15°   | 15°                |                                              |
| Frankreich, 18°                | 18°   | 18°                | von vielen Moscheen in Frankreich verwendet  |
| Türkei, Diyanet                | 18°   | 17°                | mit den Diyanet-Korrekturen                  |
| Dubai, Awqaf                   | 18,2° | 18,2°              | mit den Awqaf-Korrekturen                    |
| Golfregion                     | 19,5° | 90 min             |                                              |
| Kuwait                         | 18°   | 17,5°              |                                              |
| Katar                          | 18°   | 90 min             |                                              |
| Singapur, MUIS                 | 20°   | 18°                |                                              |
| Malaysia, JAKIM                | 20°   | 18°                |                                              |
| Indonesien, Kemenag            | 20°   | 18°                |                                              |
| Tunesien                       | 18°   | 18°                |                                              |
| Russland                       | 16°   | 15°                |                                              |
| Universität Teheran            | 17,7° | 14°                | Maghrib 4,5°, dschafaritische Mitternacht    |
| Schiitisch, Ghom               | 16°   | 14°                | Maghrib 4°, dschafaritische Mitternacht      |
| Eigene Winkel                  | deine | deine oder Minuten |                                              |

- **Asr (Rechtsschule)**: _Standard_ (schafiitisch, malikitisch, hanbalitisch:
  Schatten gleich dem Gegenstand) oder _Hanafitisch_ (doppelter Schatten,
  etwa eine Stunde später).
- **Hohe Breitengrade**: Im Sommer wird es nördlich von etwa 48° (Paris,
  Lille, Brüssel, London…) nie dunkel genug für ein Fajr bei 18°: Die Zeit
  wird dann auf einen Teil der Nacht begrenzt. _Winkelbasiert_ (Standard, wie
  bei Aladhan), _Mitte der Nacht_ oder _Ein Siebtel der Nacht_.
- **Mitternacht**: halbe Strecke von Sonnenuntergang bis Sonnenaufgang oder
  bis Fajr (dschafaritisch). Standardmäßig die Konvention der Methode.
- **Eigene Methode**: die Fajr- und Isha-Winkel (Dezimalzahlen erlaubt) oder
  Isha eine Anzahl Minuten nach Maghrib (0 behält den Winkel).

### Anpassungen

Minuten, die zu jeder berechneten Zeit addiert werden, damit sie genau dem
Plan deiner Moschee folgt (negativ: früher), von -60 bis +60. **Imsak** liegt
eine Anzahl Minuten vor Fajr (standardmäßig 10), ab dem angepassten Fajr
gezählt.

Die **Sprache der Namen** legt die Namen der Gerätefunktionen fest (beim
Hinzufügen des Geräts fixiert) und die Gebetsnamen, die an die Szenen gehen.

## Das Gerät

Füge es im Tab **Entdecken** hinzu. Ein Gerät, **Gebetszeiten**, mit:

| Funktion                                                           | Wert                                                |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| Imsak, Fajr, Sonnenaufgang, Dhuhr, Asr, Maghrib, Isha, Mitternacht | die heutige Uhrzeit, `HH:MM`                        |
| Nächstes Gebet                                                     | der Name des nächsten der fünf Gebete               |
| Uhrzeit des nächsten Gebets                                        | seine Uhrzeit, `HH:MM`                              |
| Zeit bis zum nächsten Gebet                                        | in Minuten, jede Minute aktualisiert (ohne Verlauf) |

Nach Isha ist das nächste Gebet das Fajr von morgen. Sonnenaufgang, Imsak und
Mitternacht werden angezeigt, sind aber keine Gebete. Die Integration
aktualisiert das Gerät selbst jede Minute.

## Dashboard-Widget

**Gebetszeiten** (unter _Dashboard_ → _Bearbeiten_ → _Widget hinzufügen_): das
nächste Gebet und seine Uhrzeit, die verbleibende Zeit, die acht Zeiten des
Tages (vergangene grau, die nächste mit einer Glocke), das Hidschra-Datum
(Umm-al-Qura-Kalender) und die verwendete Methode. Es folgt der Sprache des
Dashboards.

## Szenen-Auslöser

- **Gebetszeit**: löst zur Minute eines Gebets aus. Filter: die betroffenen
  Zeiten (leer: alle acht, mit Imsak, Sonnenaufgang und Mitternacht).
- **Gebet steht bevor**: löst eine gewählte Anzahl Minuten vorher aus (5, 10,
  15, 20, 30, 45 oder 60). Filter: die Zeiten und die Anzahl Minuten
  (Pflichtfeld).

Beide geben der Szene: den Schlüssel der Zeit (`fajr`…), den **Namen des
Gebets** in der eingestellten Sprache, die **Uhrzeit** (`HH:MM`) und beim
zweiten die **Minuten vorher**.

Ein Neustart von Gladys oder der Integration spielt nie ein vergangenes Gebet
nach; eine durch eine neue Konfiguration verschobene Zeit wird am selben Tag
nicht zweimal angekündigt.

## Szenen-Aktion

**Gebetszeiten abrufen**: die acht Zeiten von heute oder morgen, das nächste
Gebet, seine Uhrzeit und die verbleibenden Minuten, lesbar für die folgenden
Aktionen der Szene.

## Konfigurationsaktion

**Heutige Zeiten anzeigen**, in der Konfiguration: die verwendete Methode und
die acht Zeiten von heute, zum Vergleich mit dem Plan deiner Moschee, bevor du
Szenen anlegst.

## Szenenbeispiele

- **Adhan-Erinnerung**: Auslöser _Gebetszeit_ (Fajr, Dhuhr, Asr, Maghrib,
  Isha), Aktion _Auf einem Lautsprecher sprechen_ mit dem Text „Es ist Zeit
  für {{Name des Gebets}}“.
- **Sich vorbereiten**: Auslöser _Gebet steht bevor_, 15 Minuten, Maghrib:
  das Wohnzimmer beleuchten, eine Nachricht „Maghrib um {{Uhrzeit}}“ senden.
- **Ramadan**: Auslöser _Gebet steht bevor_, 30 Minuten, Imsak: eine
  Nachricht an alle Handys für die letzte Mahlzeit vor der Morgendämmerung.
- **Morgenübersicht**: um 7:00 die Aktion _Gebetszeiten abrufen_, dann
  _Nachricht senden_ mit den Zeiten des Tages.

## Wie die Zeiten berechnet werden

Die Deklination der Sonne und die Zeitgleichung ergeben den Sonnenmittag
(Dhuhr); der Stundenwinkel, bei dem die Sonne eine bestimmte Tiefe unter dem
Horizont erreicht, ergibt Fajr und Isha, -0,833° (Refraktion und
Sonnenscheibe) ergibt Sonnenaufgang und -untergang, und die Länge eines
Schattens ergibt Asr. Die Ergebnisse werden auf die nächste Minute gerundet.
Die Tests der Integration prüfen sie gegen echte Aladhan-Antworten (dieselbe
Minute), die offiziellen Pläne der Türkei, Katars, Dubais, Kuwaits, Mekkas,
Singapurs und Teherans und die Bibliothek adhan-js.

Nichts wird heruntergeladen: Die Integration stellt keine einzige
Netzwerkanfrage.

## Fehlerbehebung

- **Der Status sagt „Kein Standort“**: Gib die Koordinaten deines Zuhauses
  unter _Einstellungen_ → _Zuhause_ ein oder trage sie in der Konfiguration
  ein und speichere.
- **Alle Zeiten sind um ein oder zwei Stunden verschoben**: Die Zeitzone von
  Gladys ist falsch (_Einstellungen_ → _System_).
- **Einige Minuten Abweichung zu deiner Moschee**: Prüfe Methode und
  Asr-Rechtsschule mit _Heutige Zeiten anzeigen_ und nutze dann die
  Anpassungen.
- **Die Szene ist nicht gestartet**: Prüfe die Filter des Auslösers (bei
  _Gebet steht bevor_ ist die Anzahl Minuten Pflicht) und ob die Integration
  läuft. `LOG_LEVEL=debug` zeigt jedes gesendete Ereignis in den Protokollen.
- **Die Namen der Funktionen sind in der falschen Sprache**: Diese werden beim
  Hinzufügen des Geräts fixiert: Ändere die Sprache, lösche das Gerät und füge
  es erneut hinzu.

## Grenzen

- Noch keine Methode „Moonsighting Committee“ (jahreszeitliche Winkel).
- Innerhalb der Polarkreise bleiben diese Zeiten an Tagen ohne Sonnenaufgang
  oder -untergang leer.
- _Auf einem Lautsprecher sprechen_ liest einen Text vor: Für einen
  aufgenommenen Adhan braucht es eine Lautsprecher-Integration, die eine
  Audiodatei abspielt.
- Das Hidschra-Datum folgt dem Umm-al-Qura-Kalender, der um einen Tag von der
  örtlichen Mondsichtung abweichen kann; es entscheidet auch, wann das
  Ramadan-Isha von Umm al-Qura (120 min) gilt.
- Die Zeiten bleiben die des eingestellten Zuhauses: Es gibt keinen Standort
  pro Benutzer.
