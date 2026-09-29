# Webtools-Übersicht

Kachel-Übersicht für interne Webtools im R+V-Design. Läuft als statische Website auf IIS, ohne Datenbank.

- `index.html` zeigt je Kategorie (zu Beginn E-Learning, LMS, IDD) eine Reihe mit Kacheln und daneben kleine Chips; `einstellungen.html` verwaltet sie (Hinzufügen, Bearbeiten, Sortieren, Kategorien anlegen/entfernen/umbenennen/umfärben, quadratischer Bildzuschnitt).
- Alle Inhalte liegen in `daten/kacheln.json`, Bilder als Dateien in `daten/bilder/`.
- `speichern.ashx` schreibt Änderungen direkt auf den Server (benötigt ASP.NET 4.x), mit Erkennung gleichzeitiger Bearbeitung.

Installation und Einrichtung: siehe [LIESMICH.md](LIESMICH.md).
