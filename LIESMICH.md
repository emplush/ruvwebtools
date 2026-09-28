# Webtools-Übersicht – Installation auf IIS

## Inhalt
- `index.html` – Übersicht mit den Kacheln
- `einstellungen.html` – Verwaltung (Knopf „Anpassen“ oben rechts auf der Übersicht)
- `assets/` – Gestaltung und Skripte
- `daten/kacheln.json` – alle Kacheln und Seitentexte (keine Datenbank nötig)
- `daten/bilder/` – Kachelbilder und Logo; wird beim ersten Speichern automatisch angelegt
- `speichern.ashx` – schreibt Änderungen direkt auf den Server (optional)
- `web.config` – IIS-Einstellungen

## Einrichtung
1. Ordnerinhalt in das Verzeichnis der Website kopieren (z. B. `C:\inetpub\wwwroot\webtools`).
2. Für direktes Speichern: In den Windows-Features „ASP.NET 4.x“ unter IIS aktivieren.
3. Dem App-Pool-Benutzer (z. B. `IIS AppPool\DefaultAppPool`) Schreibrechte auf den Ordner `daten` geben
   (inklusive Unterordner).
4. Seite im Browser aufrufen.

Ohne ASP.NET funktioniert alles ebenfalls: Beim Speichern wird dann `kacheln.json`
heruntergeladen und muss manuell in den Ordner `daten` kopiert werden. Die Bilder
stecken in diesem Fall direkt in der Datei. Die Einstellungsseite zeigt an, welcher Modus aktiv ist.

## Zugriff beschränken (optional)
Einstellungen und Speichern sind für alle erreichbar, die die Seite aufrufen können.
Soll nur eine bestimmte Gruppe ändern dürfen, den vorbereiteten Block am Ende der
`web.config` einkommentieren und die Gruppe anpassen. Voraussetzung: In IIS sind die Rolle
„URL-Autorisierung“ installiert und für die Site „Windows-Authentifizierung“ aktiviert.

## Einstellungen öffnen
- Knopf **„Anpassen“** oben rechts auf der Übersicht
- Tastenkürzel **Strg + Alt + M** auf der Übersicht
- **5× schnell** auf die Fußzeile klicken
- oder direkt `einstellungen.html` aufrufen

## Wie gespeichert wird
- **Bilder** werden als Dateien in `daten/bilder` abgelegt (Dateiname = Prüfsumme des Inhalts),
  `kacheln.json` enthält nur die Pfade und bleibt dadurch klein. Nicht mehr benutzte Bilder
  werden beim Speichern automatisch gelöscht.
- Zu jedem Kachelbild wird zusätzlich das **Original** (verkleinert auf max. 1600 px) aufbewahrt.
  „Ausschnitt ändern“ arbeitet mit diesem Original, damit keine Qualität verloren geht.
- Vor jedem Speichern legt der Server eine **Sicherung** als `daten/kacheln.vorher.json` an.
  Bilder, die die Sicherung noch braucht, bleiben erhalten.
- **Gleichzeitiges Bearbeiten:** `kacheln.json` enthält einen Zeitstempel (`stand`). Hat seit dem
  Öffnen der Einstellungen jemand anderes gespeichert, fragt die Seite nach, ob dessen Fassung
  überschrieben werden soll. Das gilt auch für einen im Browser zwischengespeicherten Entwurf.
- Als Kachel-Link sind nur `http://`- und `https://`-Adressen erlaubt.

## Aktualisieren
Beim Einspielen einer neuen Version den Ordner `daten` **nicht** überschreiben – er enthält
die aktuellen Kacheln und Bilder.

## Anpassungen
- Farben und Schrift: oben in `assets/rv.css` unter `:root`
- Logo: in den Einstellungen unter „Seite“ hochladen
- Bildgröße der Kacheln: `AUSGABE` in `assets/zuschnitt.js` (Standard 600 × 600 px)
- Größe der aufbewahrten Originale: `ORIGINAL_MAX` in `assets/einstellungen.js` (Standard 1600 px)
