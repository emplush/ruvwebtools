<%@ WebHandler Language="C#" Class="KachelnSpeichern" %>
<%@ Assembly Name="System.Web.Extensions, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35" %>

using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Script.Serialization;

/// Speichert die Kachel-Konfiguration als daten/kacheln.json. Keine Datenbank nötig.
/// Der Ordner "daten" braucht Schreibrechte für die App-Pool-Identität.
///
/// GET  liefert {"bereit":true}, damit die Einstellungen erkennen, dass direktes Speichern eingerichtet ist.
/// POST speichert. Erwartete Kopfzeilen:
///   X-Webtools: 1                    – Schutz gegen Formular-Posts von fremden Seiten
///   X-Webtools-Basis: <stand>        – "stand" der Datei, auf dem die Bearbeitung aufbaut
///   X-Webtools-Ueberschreiben: 1     – optional, speichert trotz abweichendem Stand
/// Bilder, die als Data-URL ankommen, werden als Dateien unter daten/bilder abgelegt.
public class KachelnSpeichern : IHttpHandler
{
    static readonly object Sperre = new object();
    static readonly Regex BildPfad = new Regex(@"daten/bilder/([0-9a-f]{40}\.(?:jpg|png|gif|webp|svg))", RegexOptions.IgnoreCase);
    static readonly Regex Farbe = new Regex(@"^#[0-9a-fA-F]{6}$");
    static readonly Regex KatId = new Regex(@"^[A-Za-z0-9_-]{1,40}$");
    static readonly Regex BildName = new Regex(@"^[0-9a-f]{40}\.(?:jpg|png|gif|webp|svg)$", RegexOptions.IgnoreCase);
    static readonly Dictionary<string, string> Endungen = new Dictionary<string, string> {
        { "image/jpeg", "jpg" }, { "image/png", "png" }, { "image/gif", "gif" },
        { "image/webp", "webp" }, { "image/svg+xml", "svg" }
    };

    class Fehler : Exception
    {
        public readonly int Status;
        public readonly string Grund;
        public Fehler(int status, string text, string grund) : base(text) { Status = status; Grund = grund; }
    }

    public void ProcessRequest(HttpContext ctx)
    {
        ctx.Response.ContentType = "application/json; charset=utf-8";
        ctx.Response.Cache.SetCacheability(HttpCacheability.NoCache);
        ctx.Response.TrySkipIisCustomErrors = true;
        var ser = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

        try
        {
            string methode = ctx.Request.HttpMethod;
            if (methode == "GET")
            {
                Antwort(ctx, ser, 200, new Dictionary<string, object> { { "bereit", true } });
                return;
            }
            if (methode != "POST") throw new Fehler(405, "Nur GET und POST erlaubt", "methode");
            if (ctx.Request.Headers["X-Webtools"] != "1") throw new Fehler(400, "Anfrage ohne Kennung", "kennung");

            string inhalt;
            using (var leser = new StreamReader(ctx.Request.InputStream, Encoding.UTF8))
                inhalt = leser.ReadToEnd();

            // Inhalt prüfen, damit keine kaputte Datei geschrieben wird
            Dictionary<string, object> daten;
            try { daten = ser.DeserializeObject(inhalt) as Dictionary<string, object>; }
            catch { daten = null; }
            if (daten == null || !daten.ContainsKey("kacheln") || !(daten["kacheln"] is object[]))
                throw new Fehler(400, "Ungültige Daten", "daten");

            string ordner = ctx.Server.MapPath("~/daten");
            string bildordner = Path.Combine(ordner, "bilder");
            string ziel = Path.Combine(ordner, "kacheln.json");
            string sicherung = Path.Combine(ordner, "kacheln.vorher.json");
            string temp = Path.Combine(ordner, "kacheln.tmp");

            lock (Sperre)
            {
                // Hat inzwischen jemand anderes gespeichert?
                string basis = ctx.Request.Headers["X-Webtools-Basis"] ?? "";
                if (ctx.Request.Headers["X-Webtools-Ueberschreiben"] != "1" && basis != StandLesen(ser, ziel))
                    throw new Fehler(409, "Die Übersicht wurde inzwischen von jemand anderem gespeichert.", "konflikt");

                Directory.CreateDirectory(bildordner);
                // Kategorien prüfen: eindeutige Kennung, Farbton nur #RRGGBB (landet im Stil-Attribut).
                // Jeder Eintrag muss zu einer vorhandenen Kategorie gehören; ohne Einträge darf die Liste leer sein.
                HashSet<string> katIds = null;
                object kategorien;
                if (daten.TryGetValue("kategorien", out kategorien))
                {
                    if (!(kategorien is object[])) throw new Fehler(400, "Ungültige Kategorien", "daten");
                    katIds = new HashSet<string>();
                    foreach (object o in (object[])kategorien)
                    {
                        var kat = o as Dictionary<string, object>;
                        if (kat == null || !KatId.IsMatch(Text(kat, "id")) || !katIds.Add(Text(kat, "id")))
                            throw new Fehler(400, "Ungültige Kategorie", "daten");
                        if (!Farbe.IsMatch(Text(kat, "farbe")))
                            throw new Fehler(400, "Ungültiger Farbton bei Kategorie „" + Text(kat, "name") + "“", "farbe");
                    }
                }

                foreach (object o in (object[])daten["kacheln"])
                {
                    var k = o as Dictionary<string, object>;
                    if (k == null) throw new Fehler(400, "Ungültige Kachel", "daten");
                    string titel = Text(k, "titel");
                    string art = Text(k, "art");
                    if (art != "" && art != "kachel" && art != "chip")
                        throw new Fehler(400, "Unbekannte Art bei „" + titel + "“", "daten");
                    if (katIds != null && !katIds.Contains(Text(k, "kategorie")))
                        throw new Fehler(400, "„" + titel + "“ gehört zu keiner vorhandenen Kategorie", "daten");
                    Uri uri;
                    if (!Uri.TryCreate(Text(k, "link"), UriKind.Absolute, out uri) ||
                        (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
                        throw new Fehler(400, "Ungültiger Link bei Kachel „" + titel + "“. Erlaubt sind nur http- und https-Adressen.", "link");
                    Auslagern(k, "bild", bildordner);
                    Auslagern(k, "original", bildordner);
                }
                Auslagern(daten, "logo", bildordner);


                daten["stand"] = DateTime.UtcNow.ToString("o");
                string json = ser.Serialize(daten);

                File.WriteAllText(temp, json, new UTF8Encoding(false));
                if (!File.Exists(ziel)) File.Move(temp, ziel);
                else
                {
                    try { File.Replace(temp, ziel, sicherung); }
                    catch (IOException)
                    {
                        // Manche Dateisysteme unterstützen kein Replace
                        File.Copy(ziel, sicherung, true);
                        File.Copy(temp, ziel, true);
                        File.Delete(temp);
                    }
                }

                Aufraeumen(bildordner, json, sicherung);
            }

            Antwort(ctx, ser, 200, new Dictionary<string, object> { { "ok", true }, { "daten", daten } });
        }
        catch (Fehler f)
        {
            Antwort(ctx, ser, f.Status, new Dictionary<string, object> { { "fehler", f.Message }, { "grund", f.Grund } });
        }
        catch (UnauthorizedAccessException)
        {
            Antwort(ctx, ser, 403, new Dictionary<string, object> { { "fehler", "Keine Schreibrechte auf den Ordner daten" }, { "grund", "rechte" } });
        }
        catch (Exception ex)
        {
            Antwort(ctx, ser, 500, new Dictionary<string, object> { { "fehler", "Serverfehler: " + ex.Message }, { "grund", "server" } });
        }
    }

    static void Antwort(HttpContext ctx, JavaScriptSerializer ser, int status, object inhalt)
    {
        ctx.Response.StatusCode = status;
        ctx.Response.Write(ser.Serialize(inhalt));
    }

    static string Text(Dictionary<string, object> d, string schluessel)
    {
        object wert;
        return d.TryGetValue(schluessel, out wert) && wert is string ? (string)wert : "";
    }

    static string StandLesen(JavaScriptSerializer ser, string datei)
    {
        if (!File.Exists(datei)) return "";
        try
        {
            var d = ser.DeserializeObject(File.ReadAllText(datei, Encoding.UTF8)) as Dictionary<string, object>;
            return d == null ? "" : Text(d, "stand");
        }
        catch (ArgumentException) { return ""; }        // Datei kaputt: wie ohne Stand behandeln
        catch (InvalidOperationException) { return ""; }
    }

    // Legt ein Bild aus einer Data-URL als Datei ab (Name = SHA-1 des Inhalts) und ersetzt den Wert durch den Pfad
    static void Auslagern(Dictionary<string, object> d, string schluessel, string ordner)
    {
        object wert;
        if (!d.TryGetValue(schluessel, out wert) || wert == null) return;
        string s = wert as string;
        if (s == null) throw new Fehler(400, "Ungültiger Wert für " + schluessel, "daten");
        if (!s.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) return;

        int komma = s.IndexOf(',');
        string kopf = komma > 5 ? s.Substring(5, komma - 5).ToLowerInvariant() : "";
        string endung;
        if (!kopf.EndsWith(";base64") || !Endungen.TryGetValue(kopf.Substring(0, kopf.Length - 7), out endung))
            throw new Fehler(400, "Nicht unterstütztes Bildformat", "bild");

        byte[] bytes;
        try { bytes = Convert.FromBase64String(s.Substring(komma + 1)); }
        catch (FormatException) { throw new Fehler(400, "Beschädigte Bilddaten", "bild"); }

        string name;
        using (var sha = SHA1.Create())
            name = BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant() + "." + endung;
        string pfad = Path.Combine(ordner, name);
        if (!File.Exists(pfad)) File.WriteAllBytes(pfad, bytes);
        d[schluessel] = "daten/bilder/" + name;
    }

    // Entfernt Bilder, die weder im neuen Stand noch in der Sicherung verwendet werden
    static void Aufraeumen(string ordner, string json, string sicherung)
    {
        var benutzt = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (Match m in BildPfad.Matches(json)) benutzt.Add(m.Groups[1].Value);
        if (File.Exists(sicherung))
            foreach (Match m in BildPfad.Matches(File.ReadAllText(sicherung, Encoding.UTF8))) benutzt.Add(m.Groups[1].Value);

        foreach (string datei in Directory.GetFiles(ordner))
        {
            string name = Path.GetFileName(datei);
            if (!BildName.IsMatch(name) || benutzt.Contains(name)) continue;
            try { File.Delete(datei); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
    }

    public bool IsReusable { get { return false; } }
}
