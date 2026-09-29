/* Gemeinsame Funktionen für Übersicht und Einstellungen */
(function(){
  var DATEI = "daten/kacheln.json";

  /* Feste Kategorien in Anzeigereihenfolge mit Standard-Name und -Farbton; beides ist in den Einstellungen änderbar */
  var KATEGORIEN = [
    { id: "elearning", name: "E-Learning", farbe: "#003A7D" },
    { id: "lms",       name: "LMS",        farbe: "#00787A" },
    { id: "idd",       name: "IDD",        farbe: "#7A3E9D" }
  ];
  var ARTEN = { kachel: "Kachel", chip: "Chip" };

  var STANDARD = {
    titel: "Webtools",
    einleitung: "Alle Werkzeuge an einem Ort. Ein Klick auf eine Kachel öffnet das Tool in einem neuen Fenster.",
    logo: "",
    kategorien: KATEGORIEN,
    kacheln: []
  };

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function host(u){ try { return new URL(u).hostname.replace(/^www\./,""); } catch(e){ return u; } }

  /* Nur http- und https-Adressen sind als Link erlaubt (kein javascript: o. Ä.).
     Mit relativOk werden auch relative Adressen akzeptiert (z. B. von Hand in der JSON eingetragen). */
  function linkErlaubt(u, relativOk){
    try {
      var p = (relativOk ? new URL(u, location.href) : new URL(u)).protocol;
      return p === "http:" || p === "https:";
    } catch(e){ return false; }
  }

  function neueId(){ return "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function farbeGueltig(f){ return typeof f === "string" && /^#[0-9a-f]{6}$/i.test(f); }

  /* Schriftfarbe mit dem besseren Kontrast zum Farbton (WCAG-Leuchtdichte) */
  function textFarbe(hex){
    var l = [1, 3, 5].map(function(i){
      var c = parseInt(hex.substr(i, 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    var lum = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    var dunkel = 0.0171; /* Leuchtdichte von #1A2433 */
    return (1.05) / (lum + 0.05) >= (lum + 0.05) / (dunkel + 0.05) ? "#FFFFFF" : "#1A2433";
  }

  /* CSS-Variablen für den Farbton einer Kategorie */
  function farbStil(kat){
    return "--kat:" + kat.farbe + ";--kat-text:" + textFarbe(kat.farbe);
  }

  /* Bringt geladene oder importierte Daten in eine einheitliche Form */
  function normalisieren(d){
    d = d && typeof d === "object" ? d : {};
    var gespeichert = {};
    (Array.isArray(d.kategorien) ? d.kategorien : []).forEach(function(k){
      if (k && typeof k === "object" && typeof k.id === "string") gespeichert[k.id] = k;
    });
    var kategorien = KATEGORIEN.map(function(s){
      var g = gespeichert[s.id] || {};
      var name = typeof g.name === "string" ? g.name.trim().slice(0, 40) : "";
      return { id: s.id, name: name || s.name, farbe: farbeGueltig(g.farbe) ? g.farbe.toUpperCase() : s.farbe };
    });
    var ids = {};
    var kacheln = (Array.isArray(d.kacheln) ? d.kacheln : []).filter(function(k){
      return k && typeof k === "object";
    }).map(function(k){
      var id = typeof k.id === "string" && k.id && !ids[k.id] ? k.id : neueId();
      ids[id] = true;
      var art = k.art === "chip" ? "chip" : "kachel";
      return {
        id: id,
        art: art,
        kategorie: kategorieVon(k.kategorie).id,
        titel: String(k.titel || ""),
        link: String(k.link || ""),
        bild: art === "kachel" && typeof k.bild === "string" ? k.bild : "",
        original: art === "kachel" && typeof k.original === "string" ? k.original : ""
      };
    });
    return {
      titel: typeof d.titel === "string" && d.titel ? d.titel : STANDARD.titel,
      einleitung: typeof d.einleitung === "string" ? d.einleitung : STANDARD.einleitung,
      logo: typeof d.logo === "string" ? d.logo : "",
      kategorien: kategorien,
      kacheln: kacheln,
      stand: typeof d.stand === "string" ? d.stand : ""
    };
  }

  /* Unbekannte oder fehlende Kategorie → erste Kategorie (E-Learning) */
  function kategorieVon(id){
    return KATEGORIEN.filter(function(k){ return k.id === id; })[0] || KATEGORIEN[0];
  }

  /* Lädt daten/kacheln.json ohne Browser-Cache */
  function laden(){
    return fetch(DATEI + "?t=" + Date.now(), {cache:"no-store"})
      .then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(normalisieren);
  }

  function kopfAnwenden(cfg){
    var l = document.getElementById("logo");
    if (l) l.innerHTML = cfg.logo ? '<img src="' + esc(cfg.logo) + '" alt="Logo">' : "";
    var t = document.getElementById("seitentitel");
    if (t) t.textContent = cfg.titel;
    var j = document.getElementById("jahr");
    if (j) j.textContent = new Date().getFullYear();
  }

  function sichererLink(k){ return linkErlaubt(k.link, true) ? k.link : "#"; }

  function kachelHtml(k){
    var bild = k.bild
      ? '<img src="' + esc(k.bild) + '" alt="" loading="lazy">'
      : '<span class="initiale" aria-hidden="true">' + esc((k.titel || "?").charAt(0).toUpperCase()) + '</span>';
    return '<a class="kachel" href="' + esc(sichererLink(k)) + '" target="_blank" rel="noopener noreferrer" title="' + esc(k.titel) + ' in neuem Fenster öffnen">' +
      '<div class="bild">' + bild + '</div>' +
      '<div class="inhalt"><h3>' + esc(k.titel) + '</h3></div></a>';
  }

  function chipHtml(k){
    return '<li><a class="chip" href="' + esc(sichererLink(k)) + '" target="_blank" rel="noopener noreferrer" title="' + esc(k.titel) + ' in neuem Fenster öffnen">' +
      '<span>' + esc(k.titel) + '</span></a></li>';
  }

  /* Übersicht: je Kategorie eine Reihe mit Kacheln (waagerecht blätterbar) und Chips rechts daneben */
  function uebersichtHtml(cfg){
    var html = cfg.kategorien.map(function(kat){
      var eintraege = cfg.kacheln.filter(function(k){ return k.kategorie === kat.id; });
      var kacheln = eintraege.filter(function(k){ return k.art === "kachel"; });
      var chips = eintraege.filter(function(k){ return k.art === "chip"; });
      if (!eintraege.length) return "";
      return '<section class="kategorie' + (chips.length ? '' : ' ohne-chips') + (kacheln.length ? '' : ' ohne-kacheln') + '" style="' + farbStil(kat) + '" aria-labelledby="kat-' + kat.id + '">' +
        '<h2 class="kat-titel" id="kat-' + kat.id + '">' + esc(kat.name) + '</h2>' +
        '<div class="kat-inhalt">' +
          (kacheln.length ?
            '<div class="reihe">' +
              '<button type="button" class="blaettern zurueck" aria-label="' + esc(kat.name) + ': zurückblättern" hidden>‹</button>' +
              '<div class="spur">' + kacheln.map(kachelHtml).join("") + '</div>' +
              '<button type="button" class="blaettern vor" aria-label="' + esc(kat.name) + ': weiterblättern" hidden>›</button>' +
            '</div>' : '') +
          (chips.length ? '<ul class="chips" aria-label="' + esc(kat.name) + ': weitere Links">' + chips.map(chipHtml).join("") + '</ul>' : '') +
        '</div></section>';
    }).join("");
    return html || '<div class="leer">Hier erscheinen bald die ersten Tools.</div>';
  }

  /* Pfeiltasten der Reihen ein- und ausblenden, je nachdem ob sich die Reihe weiterblättern lässt */
  function reihenAktivieren(wurzel){
    var reihen = [].slice.call(wurzel.querySelectorAll(".reihe"));
    function pruefen(){
      reihen.forEach(function(r){
        var s = r.querySelector(".spur");
        r.querySelector(".zurueck").hidden = s.scrollLeft <= 2;
        r.querySelector(".vor").hidden = s.scrollLeft + s.clientWidth >= s.scrollWidth - 2;
      });
    }
    reihen.forEach(function(r){
      var s = r.querySelector(".spur");
      s.addEventListener("scroll", pruefen, { passive: true });
      r.querySelector(".zurueck").onclick = function(){ s.scrollBy({ left: -s.clientWidth * 0.8, behavior: "smooth" }); };
      r.querySelector(".vor").onclick = function(){ s.scrollBy({ left: s.clientWidth * 0.8, behavior: "smooth" }); };
    });
    window.addEventListener("resize", pruefen);
    pruefen();
    [].forEach.call(wurzel.querySelectorAll(".kachel img"), function(i){ i.addEventListener("load", pruefen); });
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

  window.WT = { DATEI:DATEI, STANDARD:STANDARD, KATEGORIEN:KATEGORIEN, ARTEN:ARTEN, esc:esc, host:host,
    linkErlaubt:linkErlaubt, neueId:neueId, farbeGueltig:farbeGueltig, textFarbe:textFarbe, farbStil:farbStil,
    kategorieVon:kategorieVon, normalisieren:normalisieren, laden:laden, kopfAnwenden:kopfAnwenden,
    kachelHtml:kachelHtml, uebersichtHtml:uebersichtHtml, reihenAktivieren:reihenAktivieren, melden:melden };
})();
