# Webtools-Übersicht – Installation auf IIS

## Inhalt
- `index.html` – Übersicht mit den Kacheln
- `einstellungen.html` – Verwaltung (nicht verlinkt)
- `assets/` – Gestaltung und Skripte
- `daten/kacheln.json` – alle Kacheln, Bilder und Seitentexte (keine Datenbank nötig)
- `speichern.ashx` – schreibt Änderungen direkt nach `daten/kacheln.json` (optional)
- `web.config` – IIS-Einstellungen

## Einrichtung
1. Ordnerinhalt in das Verzeichnis der Website kopieren (z. B. `C:\inetpub\wwwroot\webtools`).
2. Für direktes Speichern: In den Windows-Features „ASP.NET 4.x“ unter IIS aktivieren.
3. Dem App-Pool-Benutzer (z. B. `IIS AppPool\DefaultAppPool`) Schreibrechte auf den Ordner `daten` geben.
4. Seite im Browser aufrufen.

Ohne ASP.NET funktioniert alles ebenfalls: Beim Speichern wird dann `kacheln.json`
heruntergeladen und muss manuell in den Ordner `daten` kopiert werden.

## Einstellungen öffnen
- Tastenkürzel **Strg + Alt + M** auf der Übersicht
- **5× schnell** auf die Fußzeile klicken
- oder direkt `einstellungen.html` aufrufen

Das Verstecken schützt nicht vor gezieltem Zugriff. Für echten Schutz den
vorbereiteten Block am Ende der `web.config` aktivieren (Windows-Authentifizierung
und URL-Autorisierung nötig).

## Anpassungen
- Farben und Schrift: oben in `assets/rv.css` unter `:root`
- Logo: in den Einstellungen unter „Seite“ hochladen
- Bildgröße der Kacheln: `AUSGABE` in `assets/zuschnitt.js` (Standard 600 × 600 px)

Vor jedem Speichern legt der Server eine Sicherung als `daten/kacheln.vorher.json` an.
