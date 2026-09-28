<%@ WebHandler Language="C#" Class="KachelnSpeichern" %>
<%@ Assembly Name="System.Web.Extensions, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35" %>

using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;

/// Speichert die Kachel-Konfiguration als daten/kacheln.json.
/// Keine Datenbank nötig. Der Ordner "daten" braucht Schreibrechte für die App-Pool-Identität.
public class KachelnSpeichern : IHttpHandler
{
    public void ProcessRequest(HttpContext ctx)
    {
        ctx.Response.ContentType = "application/json; charset=utf-8";
        ctx.Response.Cache.SetCacheability(HttpCacheability.NoCache);

        if (ctx.Request.HttpMethod != "POST")
        {
            ctx.Response.StatusCode = 405;
            ctx.Response.Write("{\"fehler\":\"Nur POST erlaubt\"}");
            return;
        }

        string inhalt;
        using (var leser = new StreamReader(ctx.Request.InputStream, Encoding.UTF8))
            inhalt = leser.ReadToEnd();

        // Inhalt prüfen, damit keine kaputte Datei geschrieben wird
        try
        {
            var ser = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
            var daten = ser.DeserializeObject(inhalt) as Dictionary<string, object>;
            if (daten == null || !daten.ContainsKey("kacheln") || !(daten["kacheln"] is object[]))
                throw new InvalidDataException();
        }
        catch
        {
            ctx.Response.StatusCode = 400;
            ctx.Response.Write("{\"fehler\":\"Ungültige Daten\"}");
            return;
        }

        string ordner = ctx.Server.MapPath("~/daten");
        string ziel = Path.Combine(ordner, "kacheln.json");
        string sicherung = Path.Combine(ordner, "kacheln.vorher.json");
        string temp = Path.Combine(ordner, "kacheln.tmp");

        try
        {
            Directory.CreateDirectory(ordner);
            File.WriteAllText(temp, inhalt, new UTF8Encoding(false));
            if (File.Exists(ziel)) File.Copy(ziel, sicherung, true);
            File.Copy(temp, ziel, true);
            File.Delete(temp);
        }
        catch (UnauthorizedAccessException)
        {
            ctx.Response.StatusCode = 403;
            ctx.Response.Write("{\"fehler\":\"Keine Schreibrechte auf den Ordner daten\"}");
            return;
        }

        ctx.Response.Write("{\"ok\":true}");
    }

    public bool IsReusable { get { return false; } }
}
