/* Einstellungen: Kacheln und Chips verwalten, sortieren, Farbtöne der Kategorien, Bilder zuschneiden, speichern */
(function(){
  var ENTWURF = "webtools-entwurf";
  var SPEICHER_URL = "speichern.ashx";
  var ORIGINAL_MAX = 1600; /* längere Seite des aufbewahrten Originals in Pixeln */
  function $(id){ return document.getElementById(id); }

  var cfg = null;          /* aktueller Bearbeitungsstand */
  var gespeichert = "";    /* zuletzt gespeicherter Stand (JSON) */
  var basis = "";          /* "stand" der Server-Datei, auf dem die Bearbeitung aufbaut */
  var bearbeiteId = null;  /* null = neue Kachel */
  var formBild = "";       /* zugeschnittenes Bild im Formular */
  var formOriginal = "";   /* Original für erneuten Zuschnitt (Pfad oder Data-URL) */
  var entwurfWarnung = false;

  /* ---------- Laden ---------- */
  WT.laden().catch(function(){
    WT.melden("daten/kacheln.json nicht gefunden. Es wird mit einer leeren Liste begonnen.", true);
    return WT.normalisieren({});
  }).then(function(d){
    basis = d.stand; delete d.stand;
    cfg = d;
    gespeichert = JSON.stringify(cfg);
    return entwurfPruefen();
  }).then(alles);

  /* Weist darauf hin, wenn der Speicher-Handler auf dem Server nicht läuft */
  fetch(SPEICHER_URL + "?t=" + Date.now(), {cache:"no-store", credentials:"same-origin"})
    .then(function(r){ return r.ok ? r.json() : null; })
    .catch(function(){ return null; })
    .then(function(d){
      if (d && d.bereit) return;
      var h = $("serverhinweis");
      h.textContent = "Direktes Speichern ist auf diesem Server nicht eingerichtet. „Speichern“ lädt kacheln.json herunter; " +
        "die Datei muss dann von Hand in den Ordner „daten“ kopiert werden.";
      h.classList.remove("versteckt");
    });

  function alles(){ WT.kopfAnwenden(cfg); liste(); kategorienAnzeigen(); seite(); status(); formLeeren(); }
  function geaendert(){ return JSON.stringify(cfg) !== gespeichert; }

  /* ---------- Entwurf im Browser ---------- */
  function entwurfLoeschen(){ try { localStorage.removeItem(ENTWURF); } catch(_){} }

  function entwurfPruefen(){
    var e;
    try { e = JSON.parse(localStorage.getItem(ENTWURF) || "null"); } catch(_){ return; }
    if (!e || typeof e !== "object") return;
    if (!e.cfg) e = { basis: "", cfg: e }; /* Entwurf aus der ersten Version */
    var entwurf = WT.normalisieren(e.cfg); delete entwurf.stand;
    if (JSON.stringify(entwurf) === gespeichert){ entwurfLoeschen(); return; }

    if ((e.basis || "") === basis){
      cfg = entwurf;
      WT.melden("Nicht gespeicherter Entwurf wiederhergestellt.");
      return;
    }
    var wann = e.zeit ? " vom " + new Date(e.zeit).toLocaleString("de-DE") : "";
    return bestaetigen({
      titel: "Veralteter Entwurf",
      text: "Es gibt einen nicht gespeicherten Entwurf" + wann + ". Die Übersicht wurde seitdem aber neu gespeichert – vermutlich von jemand anderem.\n\n" +
        "Wenn du den Entwurf lädst und speicherst, wird dieser neuere Stand überschrieben.",
      ok: "Entwurf laden", abbrechen: "Entwurf verwerfen"
    }).then(function(laden){
      if (laden){ cfg = entwurf; WT.melden("Nicht gespeicherter Entwurf wiederhergestellt."); return; }
      entwurfLoeschen();
      WT.melden("Entwurf verworfen. Es wird der aktuelle Stand angezeigt.");
    });
  }

  /* Rückfrage im eigenen Dialog (statt confirm), liefert true bei Bestätigung */
  function bestaetigen(o){
    return new Promise(function(fertig){
      var dlg = $("frage");
      $("f-titel").textContent = o.titel;
      $("f-text").textContent = o.text;
      $("f-ok").textContent = o.ok || "OK";
      $("f-ok").className = "knopf " + (o.gefahr ? "gefahr-voll" : "primaer");
      $("f-abbrechen").textContent = o.abbrechen || "Abbrechen";
      dlg.returnValue = "";
      dlg.onclose = function(){ dlg.onclose = null; fertig(dlg.returnValue === "ok"); };
      dlg.showModal();
      $("f-abbrechen").focus();
    });
  }

  function aendern(){
    try {
      localStorage.setItem(ENTWURF, JSON.stringify({ basis: basis, zeit: new Date().toISOString(), cfg: cfg }));
    } catch(_){
      if (!entwurfWarnung){
        entwurfWarnung = true;
        WT.melden("Der Entwurf ist zu groß für den Zwischenspeicher des Browsers. Bitte bald speichern.", true);
      }
    }
    WT.kopfAnwenden(cfg);
    liste(); anzahlenAktualisieren(); status();
  }

  /* Eintragsanzahl und Entfernen-Sperre der Kategorien aktuell halten, ohne die Felder neu aufzubauen */
  function anzahlenAktualisieren(){
    if (!cfg.kategorien.every(function(k){ return $("kn-" + k.id); }) || $("kategorien").children.length !== cfg.kategorien.length) return;
    cfg.kategorien.forEach(function(kat){
      var zeile = $("kategorien").querySelector('[data-id="' + kat.id + '"]'), n = anzahlEintraege(kat.id);
      var sperre = n ? "Erst alle Kacheln und Chips dieser Kategorie entfernen oder in eine andere Kategorie verschieben."
        : cfg.kategorien.length === 1 ? "Mindestens eine Kategorie muss bestehen bleiben." : "";
      var b = zeile.querySelector("[data-a=katdel]");
      b.disabled = !!sperre;
      if (sperre) b.title = sperre; else b.removeAttribute("title");
      zeile.querySelector(".katanzahl").textContent = n === 0 ? "keine Einträge" : n === 1 ? "1 Eintrag" : n + " Einträge";
    });
  }

  function status(){
    var g = geaendert();
    $("punkt").classList.toggle("offen", g);
    $("statustext").textContent = g ? "Nicht gespeicherte Änderungen" : "Alle Änderungen gespeichert";
    $("speichern").disabled = !g;
    $("verwerfen").disabled = !g;
  }

  window.addEventListener("beforeunload", function(e){
    if (cfg && geaendert()){ e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- Liste (gruppiert nach Kategorie und Art) ---------- */
  function gruppe(k){ return k.kategorie + "|" + k.art; }
  function artName(art, mehrzahl){ return art === "chip" ? (mehrzahl ? "Chips" : "Chip") : (mehrzahl ? "Kacheln" : "Kachel"); }

  function eintragHtml(k, i, pos, anzahl){
    var bild = k.art === "chip" ? '<span class="mini chipmini" aria-hidden="true"></span>'
      : k.bild ? '<img class="mini" src="' + WT.esc(k.bild) + '" alt="">'
      : '<span class="mini">' + WT.esc((k.titel||"?").charAt(0).toUpperCase()) + '</span>';
    return '<li class="eintrag' + (k.id === bearbeiteId ? ' aktiv' : '') + '" data-i="' + i + '" data-g="' + gruppe(k) + '">' +
      '<span class="griff" title="Zum Verschieben ziehen" aria-hidden="true">⠿</span>' + bild +
      '<div class="texte"><div class="titel">' + WT.esc(k.titel) + '</div><div class="url">' + WT.esc(WT.host(k.link)) + '</div></div>' +
      '<div class="knoepfe">' +
        '<button class="knopf klein symbol" data-a="hoch" aria-label="' + WT.esc(k.titel) + ' nach oben"' + (pos === 0 ? ' disabled' : '') + '>▲</button>' +
        '<button class="knopf klein symbol" data-a="runter" aria-label="' + WT.esc(k.titel) + ' nach unten"' + (pos === anzahl - 1 ? ' disabled' : '') + '>▼</button>' +
        '<button class="knopf klein" data-a="edit">Bearbeiten</button>' +
        '<button class="knopf klein gefahr" data-a="del">Entfernen</button>' +
      '</div></li>';
  }

  function liste(){
    $("liste").innerHTML = cfg.kategorien.map(function(kat){
      var teile = ["kachel", "chip"].map(function(art){
        var eintraege = [];
        cfg.kacheln.forEach(function(k, i){ if (k.kategorie === kat.id && k.art === art) eintraege.push({ k: k, i: i }); });
        if (!eintraege.length) return "";
        return '<div class="untergruppe"><div class="unterkopf">' + artName(art, true) + '</div><ul class="liste">' +
          eintraege.map(function(e, pos){ return eintragHtml(e.k, e.i, pos, eintraege.length); }).join("") + '</ul></div>';
      }).join("");
      return '<div class="gruppe" style="' + WT.farbStil(kat) + '"><h3 class="gruppenkopf">' + WT.esc(kat.name) + '</h3>' +
        (teile || '<p class="gruppe-leer">Noch keine Einträge.</p>') + '</div>';
    }).join("");
  }

  /* Verschiebt einen Eintrag innerhalb seiner Gruppe; die übrigen Einträge behalten ihre Plätze */
  function verschieben(von, nach){
    var g = gruppe(cfg.kacheln[von]);
    if (!cfg.kacheln[nach] || gruppe(cfg.kacheln[nach]) !== g || von === nach) return;
    var mitglieder = cfg.kacheln.filter(function(k){ return gruppe(k) === g; });
    var a = mitglieder.indexOf(cfg.kacheln[von]), b = mitglieder.indexOf(cfg.kacheln[nach]);
    mitglieder.splice(b, 0, mitglieder.splice(a, 1)[0]);
    var n = 0;
    cfg.kacheln = cfg.kacheln.map(function(k){ return gruppe(k) === g ? mitglieder[n++] : k; });
    aendern();
  }
  /* Nachbar innerhalb der Gruppe (richtung -1 = davor, +1 = danach) */
  function nachbar(i, richtung){
    var g = gruppe(cfg.kacheln[i]);
    for (var j = i + richtung; j >= 0 && j < cfg.kacheln.length; j += richtung)
      if (gruppe(cfg.kacheln[j]) === g) return j;
    return -1;
  }

  $("liste").addEventListener("click", function(e){
    var b = e.target.closest("button"); if (!b) return;
    var i = +b.closest("li").dataset.i, k = cfg.kacheln[i];
    if (b.dataset.a === "hoch") verschieben(i, nachbar(i, -1));
    else if (b.dataset.a === "runter") verschieben(i, nachbar(i, 1));
    else if (b.dataset.a === "edit") bearbeiten(k.id);
    else if (b.dataset.a === "del"){
      bestaetigen({ titel: artName(k.art) + " entfernen", text: "„" + k.titel + "“ wird aus der Übersicht entfernt.", ok: "Entfernen", gefahr: true })
        .then(function(ok){
          if (!ok) return;
          cfg.kacheln = cfg.kacheln.filter(function(x){ return x.id !== k.id; });
          if (bearbeiteId === k.id) formLeeren();
          aendern();
          WT.melden(artName(k.art) + " entfernt.");
        });
    }
  });

  /* Ziehen am Griff – mit Pointer-Events, damit es mit Maus, Stift und Touch funktioniert.
     Abgelegt werden kann nur innerhalb derselben Gruppe. */
  var zug = null;
  function zielBei(x, y){
    var el = document.elementFromPoint(x, y);
    var li = el && el.closest(".eintrag");
    return li && $("liste").contains(li) && li.dataset.g === zug.gruppe ? li : null;
  }
  function zielMarkieren(li){
    document.querySelectorAll(".eintrag.ziel").forEach(function(x){ if (x !== li) x.classList.remove("ziel"); });
    if (li && li !== zug.li) li.classList.add("ziel");
  }
  $("liste").addEventListener("pointerdown", function(e){
    var g = e.target.closest(".griff");
    if (!g || e.button > 0) return;
    e.preventDefault();
    var li = g.closest("li");
    zug = { von: +li.dataset.i, li: li, gruppe: li.dataset.g, zeiger: e.pointerId };
    g.setPointerCapture(e.pointerId);
    li.classList.add("ziehen");
  });
  $("liste").addEventListener("pointermove", function(e){
    if (!zug || e.pointerId !== zug.zeiger) return;
    zielMarkieren(zielBei(e.clientX, e.clientY));
    if (e.clientY < 60) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
  });
  function zugEnde(e){
    if (!zug || e.pointerId !== zug.zeiger) return;
    var ziel = e.type === "pointerup" ? zielBei(e.clientX, e.clientY) : null, von = zug.von;
    zug = null;
    document.querySelectorAll(".eintrag.ziehen,.eintrag.ziel").forEach(function(x){ x.classList.remove("ziehen","ziel"); });
    if (ziel) verschieben(von, +ziel.dataset.i);
  }
  $("liste").addEventListener("pointerup", zugEnde);
  $("liste").addEventListener("pointercancel", zugEnde);

  /* ---------- Kategorien (Name, Farbton, hinzufügen, entfernen) ---------- */
  function katVon(id){ return cfg.kategorien.filter(function(k){ return k.id === id; })[0]; }
  function anzahlEintraege(id){ return cfg.kacheln.filter(function(k){ return k.kategorie === id; }).length; }

  function kategorienAnzeigen(){
    var nurEine = cfg.kategorien.length === 1;
    var letzte = cfg.kategorien.length - 1;
    $("kategorien").innerHTML = cfg.kategorien.map(function(kat, i){
      var n = anzahlEintraege(kat.id);
      var sperre = n ? "Erst alle Kacheln und Chips dieser Kategorie entfernen oder in eine andere Kategorie verschieben."
        : nurEine ? "Mindestens eine Kategorie muss bestehen bleiben." : "";
      return '<div class="katzeile" data-id="' + kat.id + '">' +
        '<input type="text" class="katprobe katname" id="kn-' + kat.id + '" value="' + WT.esc(kat.name) + '" maxlength="40" style="' + WT.farbStil(kat) + '" aria-label="Name der Kategorie">' +
        '<input type="color" id="kf-' + kat.id + '" value="' + kat.farbe.toLowerCase() + '" aria-label="Farbton ' + WT.esc(kat.name) + '">' +
        '<input type="text" class="hexfeld" id="kh-' + kat.id + '" value="' + kat.farbe + '" maxlength="7" spellcheck="false" aria-label="Farbwert ' + WT.esc(kat.name) + ' (z. B. #003A7D)">' +
        '<button type="button" class="knopf klein symbol" data-a="kathoch" aria-label="' + WT.esc(kat.name) + ' nach oben"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
        '<button type="button" class="knopf klein symbol" data-a="katrunter" aria-label="' + WT.esc(kat.name) + ' nach unten"' + (i === letzte ? ' disabled' : '') + '>▼</button>' +
        '<button type="button" class="knopf klein gefahr" data-a="katdel"' + (sperre ? ' disabled title="' + WT.esc(sperre) + '"' : '') + '>Entfernen</button>' +
        '<span class="katanzahl">' + (n === 0 ? "keine Einträge" : n === 1 ? "1 Eintrag" : n + " Einträge") + '</span>' +
      '</div>';
    }).join("");
    kategorieOptionen();
  }
  /* Auswahlliste im Formular mit den aktuellen Kategorien füllen, Auswahl beibehalten */
  function kategorieOptionen(){
    var sel = $("k-kategorie"), wert = sel.value;
    sel.innerHTML = cfg.kategorien.map(function(k){ return '<option value="' + k.id + '">' + WT.esc(k.name) + '</option>'; }).join("");
    sel.value = katVon(wert) ? wert : cfg.kategorien[0].id;
  }
  /* Übernimmt geänderten Namen/Farbton und aktualisiert die Zeile, ohne das gerade bearbeitete Feld zu stören */
  function katAktualisieren(kat){
    var id = kat.id;
    $("kn-" + id).setAttribute("style", WT.farbStil(kat));
    if (document.activeElement !== $("kf-" + id)) $("kf-" + id).value = kat.farbe.toLowerCase();
    if (document.activeElement !== $("kh-" + id)) $("kh-" + id).value = kat.farbe;
    kategorieOptionen();
    aendern();
  }
  $("kategorien").addEventListener("input", function(e){
    var zeile = e.target.closest(".katzeile"); if (!zeile) return;
    var kat = katVon(zeile.dataset.id), wert = e.target.value.trim();
    if (e.target.classList.contains("katname")){
      if (!wert) return; /* leerer Name: beim Verlassen des Feldes wird der letzte Name wiederhergestellt */
      kat.name = wert;
    } else {
      if (e.target.classList.contains("hexfeld")){
        if (!/^#/.test(wert)) wert = "#" + wert;
        var gueltig = WT.farbeGueltig(wert);
        e.target.classList.toggle("ungueltig", !gueltig);
        if (!gueltig) return;
      }
      kat.farbe = wert.toUpperCase();
    }
    katAktualisieren(kat);
  });
  $("kategorien").addEventListener("focusout", function(e){
    var zeile = e.target.closest(".katzeile"); if (!zeile) return;
    var kat = katVon(zeile.dataset.id);
    if (e.target.classList.contains("hexfeld")){ e.target.value = kat.farbe; e.target.classList.remove("ungueltig"); }
    if (e.target.classList.contains("katname")) e.target.value = kat.name;
  });
  /* Reihenfolge der Kategorien = Reihenfolge der Reihen auf der Übersicht */
  $("kategorien").addEventListener("click", function(e){
    var b = e.target.closest("[data-a=kathoch],[data-a=katrunter]"); if (!b || b.disabled) return;
    var id = b.closest(".katzeile").dataset.id, i = cfg.kategorien.indexOf(katVon(id));
    var j = b.dataset.a === "kathoch" ? i - 1 : i + 1;
    if (j < 0 || j >= cfg.kategorien.length) return;
    cfg.kategorien.splice(j, 0, cfg.kategorien.splice(i, 1)[0]);
    kategorienAnzeigen(); aendern();
    /* Fokus auf demselben Pfeil der verschobenen Kategorie halten (oder dem anderen, falls dieser jetzt gesperrt ist) */
    var zeile = $("kategorien").querySelector('[data-id="' + id + '"]');
    var ziel = zeile.querySelector('[data-a=' + b.dataset.a + ']');
    (ziel.disabled ? zeile.querySelector('[data-a=' + (b.dataset.a === "kathoch" ? "katrunter" : "kathoch") + ']') : ziel).focus();
  });
  $("kategorien").addEventListener("click", function(e){
    var b = e.target.closest("[data-a=katdel]"); if (!b || b.disabled) return;
    var kat = katVon(b.closest(".katzeile").dataset.id);
    if (anzahlEintraege(kat.id) || cfg.kategorien.length < 2) return;
    bestaetigen({ titel: "Kategorie entfernen", text: "Die Kategorie „" + kat.name + "“ wird entfernt.", ok: "Entfernen", gefahr: true })
      .then(function(ok){
        if (!ok || anzahlEintraege(kat.id)) return;
        cfg.kategorien = cfg.kategorien.filter(function(k){ return k.id !== kat.id; });
        kategorienAnzeigen(); aendern();
        WT.melden("Kategorie entfernt. Zum Veröffentlichen „Speichern“ klicken.");
      });
  });
  $("kat-neu").onclick = function(){
    var kat = { id: WT.neueKategorieId(), name: "Neue Kategorie", farbe: WT.naechsteFarbe(cfg.kategorien) };
    cfg.kategorien.push(kat);
    kategorienAnzeigen(); aendern();
    var feld = $("kn-" + kat.id);
    feld.focus(); feld.select();
  };

  /* ---------- Formular für Kacheln und Chips ---------- */

  function formArt(){ return $("k-art-chip").checked ? "chip" : "kachel"; }
  function formTexte(){
    var art = formArt();
    $("h-editor").textContent = (bearbeiteId ? artName(art) + " bearbeiten" : art === "chip" ? "Neuer Chip" : "Neue Kachel");
    $("k-uebernehmen").textContent = bearbeiteId ? "Änderungen übernehmen" : artName(art) + " hinzufügen";
    $("k-bildbereich").hidden = art === "chip";
  }
  $("k-art-kachel").onchange = $("k-art-chip").onchange = formTexte;

  function vorschau(){
    var v = $("k-vorschau");
    v.innerHTML = formBild ? '<img src="' + WT.esc(formBild) + '" alt="Bildvorschau">' : "Kein Bild";
    $("k-ausschnitt").disabled = !formBild;
    $("k-entfernen").disabled = !formBild;
  }

  function formLeeren(){
    bearbeiteId = null; formBild = ""; formOriginal = "";
    $("k-titel").value = ""; $("k-link").value = "";
    $("k-art-kachel").checked = true;
    $("k-kategorie").value = cfg.kategorien[0].id;
    formTexte(); vorschau(); liste();
  }

  function bearbeiten(id){
    var k = cfg.kacheln.filter(function(x){ return x.id === id; })[0]; if (!k) return;
    bearbeiteId = id; formBild = k.bild || ""; formOriginal = k.original || "";
    $("k-titel").value = k.titel; $("k-link").value = k.link;
    $("k-art-" + k.art).checked = true;
    $("k-kategorie").value = k.kategorie;
    formTexte(); vorschau(); liste();
    if (window.matchMedia("(max-width:920px)").matches) $("editor").scrollIntoView({behavior:"smooth", block:"start"});
    $("k-titel").focus({preventScroll:true});
  }

  $("neu").onclick = function(){ formLeeren(); $("k-titel").focus(); if (window.matchMedia("(max-width:920px)").matches) $("editor").scrollIntoView({behavior:"smooth"}); };
  $("k-abbrechen").onclick = formLeeren;

  $("k-hochladen").onclick = function(){ $("k-datei").click(); };
  $("k-datei").onchange = function(e){
    var d = e.target.files[0]; e.target.value = "";
    if (!d) return;
    if (!/^image\//.test(d.type)){ WT.melden("Bitte eine Bilddatei auswählen.", true); return; }
    /* Das verkleinerte Original wird mitgespeichert, damit der Ausschnitt später
       ohne Qualitätsverlust neu gewählt werden kann. */
    Zuschnitt.verkleinern(d, ORIGINAL_MAX).then(function(original){
      return Zuschnitt.oeffnen(original).then(function(url){
        if (url){ formBild = url; formOriginal = original; vorschau(); }
      });
    }).catch(function(){ WT.melden("Das Bild konnte nicht gelesen werden.", true); });
  };
  $("k-ausschnitt").onclick = function(){
    Zuschnitt.oeffnen(formOriginal || formBild).then(function(url){ if (url){ formBild = url; vorschau(); } })
      .catch(function(){ WT.melden("Das Bild konnte nicht geöffnet werden.", true); });
  };
  $("k-entfernen").onclick = function(){ formBild = ""; formOriginal = ""; vorschau(); };

  $("k-uebernehmen").onclick = function(){
    var titel = $("k-titel").value.trim(), link = $("k-link").value.trim();
    var art = formArt(), kategorie = $("k-kategorie").value;
    if (!titel){ WT.melden("Bitte einen Titel eingeben.", true); $("k-titel").focus(); return; }
    if (!link){ WT.melden("Bitte einen Link eingeben.", true); $("k-link").focus(); return; }
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(link)) link = "https://" + link;
    if (!WT.linkErlaubt(link)){
      WT.melden("Der Link ist ungültig. Erlaubt sind nur Adressen mit http:// oder https://.", true);
      $("k-link").focus(); return;
    }
    /* Chips haben kein Bild */
    var bild = art === "kachel" ? formBild : "", original = bild ? formOriginal : "";
    var daten = { art: art, kategorie: kategorie, titel: titel, link: link, bild: bild, original: original };

    if (bearbeiteId){
      var k = cfg.kacheln.filter(function(x){ return x.id === bearbeiteId; })[0];
      var neueGruppe = gruppe(k) !== kategorie + "|" + art;
      Object.assign(k, daten);
      /* Wechselt der Eintrag Kategorie oder Art, kommt er ans Ende seiner neuen Gruppe */
      if (neueGruppe) cfg.kacheln = cfg.kacheln.filter(function(x){ return x !== k; }).concat([k]);
      WT.melden(artName(art) + " geändert. Zum Veröffentlichen „Speichern“ klicken.");
    } else {
      cfg.kacheln.push(Object.assign({ id: WT.neueId() }, daten));
      WT.melden(artName(art) + " hinzugefügt. Zum Veröffentlichen „Speichern“ klicken.");
    }
    formLeeren(); aendern();
  };

  /* ---------- Seite ---------- */
  function seite(){
    $("s-titel").value = cfg.titel;
    $("s-einleitung").value = cfg.einleitung;
    $("logovorschau").innerHTML = cfg.logo ? '<img src="' + WT.esc(cfg.logo) + '" alt="Logo">' : "Kein Logo";
  }
  $("s-titel").addEventListener("input", function(){ cfg.titel = this.value.trim() || "Webtools"; aendern(); });
  $("s-einleitung").addEventListener("input", function(){ cfg.einleitung = this.value.trim(); aendern(); });

  $("logo-hochladen").onclick = function(){ $("logodatei").click(); };
  $("logo-entfernen").onclick = function(){ cfg.logo = ""; seite(); aendern(); };
  $("logodatei").onchange = function(e){
    var d = e.target.files[0]; e.target.value = "";
    if (!d) return;
    var r = new FileReader();
    r.onload = function(){
      if (d.type === "image/svg+xml"){ cfg.logo = r.result; seite(); aendern(); return; }
      var img = new Image();
      img.onload = function(){
        var f = Math.min(1, 160 / img.height), c = document.createElement("canvas");
        c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        cfg.logo = c.toDataURL("image/png"); seite(); aendern();
      };
      img.onerror = function(){ WT.melden("Das Logo konnte nicht gelesen werden.", true); };
      img.src = r.result;
    };
    r.readAsDataURL(d);
  };

  /* ---------- Speichern ---------- */
  /* Originale als Data-URL werden nicht in heruntergeladene Dateien geschrieben –
     ohne Speicher-Handler würden sie kacheln.json nur unnötig aufblähen. */
  function ohneEingebetteteOriginale(d){
    return Object.assign({}, d, { kacheln: d.kacheln.map(function(k){
      return /^data:/i.test(k.original) ? Object.assign({}, k, { original: "" }) : k;
    }) });
  }

  function herunterladen(){
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(ohneEingebetteteOriginale(cfg), null, 2)], {type:"application/json"}));
    a.download = "kacheln.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  }

  function alsGespeichertMarkieren(){
    gespeichert = JSON.stringify(cfg);
    entwurfLoeschen();
    status();
  }

  /* Übernimmt den vom Server gespeicherten Stand (Bilder sind dort als Dateien abgelegt) */
  function serverStandUebernehmen(daten){
    var d = WT.normalisieren(daten);
    basis = d.stand; delete d.stand;
    cfg = d;
    if (bearbeiteId && !cfg.kacheln.some(function(k){ return k.id === bearbeiteId; })) formLeeren();
    WT.kopfAnwenden(cfg); liste(); seite();
    alsGespeichertMarkieren();
  }

  function senden(ueberschreiben){
    var kopf = { "Content-Type": "application/json; charset=utf-8", "X-Webtools": "1", "X-Webtools-Basis": basis };
    if (ueberschreiben) kopf["X-Webtools-Ueberschreiben"] = "1";
    return fetch(SPEICHER_URL, { method:"POST", headers:kopf, body: JSON.stringify(cfg), credentials:"same-origin" })
      .then(function(r){
        return r.text().then(function(t){
          var d = null; try { d = JSON.parse(t); } catch(_){}
          return { status: r.status, ok: r.ok, d: d && typeof d === "object" ? d : {} };
        });
      });
  }

  function speichern(ueberschreiben){
    var b = $("speichern"); b.disabled = true; b.textContent = "Wird gespeichert …";
    return senden(ueberschreiben).then(function(a){
      if (a.ok && a.d.ok === true){
        serverStandUebernehmen(a.d.daten);
        WT.melden("Gespeichert. Die Übersicht zeigt jetzt den neuen Stand.");
        return;
      }
      /* Handler nicht vorhanden oder nicht ausführbar (z. B. ASP.NET nicht installiert) */
      if (a.ok || a.status === 404 || a.status === 405 || a.status === 501){
        cfg = ohneEingebetteteOriginale(cfg);
        herunterladen();
        alsGespeichertMarkieren();
        WT.melden("Direktes Speichern ist auf dem Server nicht eingerichtet. kacheln.json wurde heruntergeladen – bitte in den Ordner „daten“ kopieren.", true);
        return;
      }
      if (a.status === 409){
        return bestaetigen({
          titel: "Zwischendurch geändert",
          text: "Die Übersicht wurde inzwischen von jemand anderem gespeichert. Wenn du jetzt speicherst, wird diese andere Fassung überschrieben.",
          ok: "Trotzdem speichern", abbrechen: "Nicht speichern", gefahr: true
        }).then(function(ok){
          if (ok) return speichern(true);
          WT.melden("Nicht gespeichert. Tipp: Mit „Datei herunterladen“ deine Fassung sichern, dann die Seite neu laden und die Änderungen erneut vornehmen.", true);
        });
      }
      if (a.status === 413) throw new Error("Die Daten sind zu groß. Bitte weniger oder kleinere Bilder verwenden.");
      if (a.status === 401) throw new Error("Keine Berechtigung zum Speichern.");
      throw new Error(a.d.fehler || "Der Server meldet Fehler " + a.status + ".");
    }).catch(function(err){
      WT.melden("Speichern fehlgeschlagen: " + err.message, true);
    }).then(function(){ b.textContent = "Speichern"; status(); });
  }
  $("speichern").onclick = function(){ speichern(false); };

  $("verwerfen").onclick = function(){
    bestaetigen({ titel: "Änderungen verwerfen", text: "Alle nicht gespeicherten Änderungen gehen verloren.", ok: "Verwerfen", gefahr: true })
      .then(function(ok){
        if (!ok) return;
        cfg = JSON.parse(gespeichert);
        entwurfLoeschen();
        alles();
        WT.melden("Änderungen verworfen.");
      });
  };

  $("export").onclick = herunterladen;
  $("import").onclick = function(){ $("importdatei").click(); };
  $("importdatei").onchange = function(e){
    var d = e.target.files[0]; e.target.value = "";
    if (!d) return;
    d.text().then(function(t){
      var neu = JSON.parse(t);
      if (!neu || !Array.isArray(neu.kacheln)) throw new Error();
      cfg = WT.normalisieren(neu); delete cfg.stand;
      alles(); aendern();
      var ungueltig = cfg.kacheln.filter(function(k){ return !WT.linkErlaubt(k.link); }).length;
      if (ungueltig) WT.melden("Datei importiert. " + ungueltig + " Kachel(n) haben einen ungültigen Link – bitte vor dem Speichern korrigieren.", true);
      else WT.melden("Datei importiert. Zum Übernehmen „Speichern“ klicken.");
    }).catch(function(){ WT.melden("Die Datei ist keine gültige Kachel-Konfiguration.", true); });
  };
})();
