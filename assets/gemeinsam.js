/* Gemeinsame Funktionen für Übersicht und Einstellungen */
(function(){
  var DATEI = "daten/kacheln.json";

  var STANDARD = {
    titel: "Webtools",
    einleitung: "Alle Werkzeuge an einem Ort. Ein Klick auf eine Kachel öffnet das Tool in einem neuen Fenster.",
    logo: "",
    kacheln: []
  };

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function host(u){ try { return new URL(u).hostname.replace(/^www\./,""); } catch(e){ return u; } }

  /* Lädt daten/kacheln.json ohne Browser-Cache */
  function laden(){
    return fetch(DATEI + "?t=" + Date.now(), {cache:"no-store"})
      .then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d){
        return {
          titel: d.titel || STANDARD.titel,
          einleitung: d.einleitung != null ? d.einleitung : STANDARD.einleitung,
          logo: d.logo || "",
          kacheln: Array.isArray(d.kacheln) ? d.kacheln : []
        };
      });
  }

  function kopfAnwenden(cfg){
    var l = document.getElementById("logo");
    if (l) l.innerHTML = cfg.logo ? '<img src="' + esc(cfg.logo) + '" alt="Logo">' : "";
    var t = document.getElementById("seitentitel");
    if (t) t.textContent = cfg.titel;
    var j = document.getElementById("jahr");
    if (j) j.textContent = new Date().getFullYear();
  }

  var ICON_EXTERN = '<svg class="extern" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

  function kachelHtml(k){
    var bild = k.bild
      ? '<img src="' + esc(k.bild) + '" alt="" loading="lazy">'
      : '<span class="initiale">' + esc((k.titel || "?").charAt(0).toUpperCase()) + '</span>';
    return '<a class="kachel" href="' + esc(k.link) + '" target="_blank" rel="noopener noreferrer" title="' + esc(k.titel) + ' in neuem Fenster öffnen">' +
      '<div class="bild">' + bild + '</div>' +
      '<div class="inhalt"><div class="texte"><h2>' + esc(k.titel) + '</h2><span class="url">' + esc(host(k.link)) + '</span></div>' + ICON_EXTERN + '</div></a>';
  }

  var meldTimer;
  function melden(text, fehler){
    var m = document.getElementById("meldung");
    if (!m) return;
    m.textContent = text;
    m.classList.toggle("fehler", !!fehler);
    m.classList.add("sichtbar");
    clearTimeout(meldTimer);
    meldTimer = setTimeout(function(){ m.classList.remove("sichtbar"); }, fehler ? 6000 : 3000);
  }

  window.WT = { DATEI:DATEI, STANDARD:STANDARD, esc:esc, host:host, laden:laden, kopfAnwenden:kopfAnwenden, kachelHtml:kachelHtml, melden:melden };
})();
