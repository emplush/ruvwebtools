# Webtools-Übersicht

Kachel-Übersicht für interne Webtools im R+V-Design. Läuft als statische Website auf IIS, ohne Datenbank.

- `index.html` zeigt die Kacheln, `einstellungen.html` verwaltet sie (Hinzufügen, Bearbeiten, Sortieren, quadratischer Bildzuschnitt).
- Alle Inhalte liegen in `daten/kacheln.json`, Bilder als Dateien in `daten/bilder/`.
- `speichern.ashx` schreibt Änderungen direkt auf den Server (benötigt ASP.NET 4.x), geschützt per Passwort aus der `web.config` oder Windows-Anmeldung, mit Erkennung gleichzeitiger Bearbeitung.

Installation und Einrichtung: siehe [LIESMICH.md](LIESMICH.md).
