/* Einstellungen: Kacheln verwalten, sortieren, Bilder zuschneiden, speichern */
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

  function alles(){ WT.kopfAnwenden(cfg); liste(); seite(); status(); formLeeren(); }
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
    liste(); status();
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

  /* ---------- Liste ---------- */
  function liste(){
    var l = $("liste");
    if (!cfg.kacheln.length){
      l.innerHTML = '<li class="leer">Noch keine Kacheln. Lege rechts die erste an.</li>';
      return;
    }
    l.innerHTML = cfg.kacheln.map(function(k, i){
      var bild = k.bild ? '<img class="mini" src="' + WT.esc(k.bild) + '" alt="">'
                        : '<span class="mini">' + WT.esc((k.titel||"?").charAt(0).toUpperCase()) + '</span>';
      return '<li class="eintrag' + (k.id === bearbeiteId ? ' aktiv' : '') + '" data-i="' + i + '">' +
        '<span class="griff" title="Zum Verschieben ziehen" aria-hidden="true">⠿</span>' + bild +
        '<div class="texte"><div class="titel">' + WT.esc(k.titel) + '</div><div class="url">' + WT.esc(WT.host(k.link)) + '</div></div>' +
        '<div class="knoepfe">' +
          '<button class="knopf klein symbol" data-a="hoch" aria-label="' + WT.esc(k.titel) + ' nach oben"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
          '<button class="knopf klein symbol" data-a="runter" aria-label="' + WT.esc(k.titel) + ' nach unten"' + (i === cfg.kacheln.length - 1 ? ' disabled' : '') + '>▼</button>' +
          '<button class="knopf klein" data-a="edit">Bearbeiten</button>' +
          '<button class="knopf klein gefahr" data-a="del">Entfernen</button>' +
        '</div></li>';
    }).join("");
  }

  function verschieben(von, nach){
    if (nach < 0 || nach >= cfg.kacheln.length || von === nach) return;
    var k = cfg.kacheln.splice(von, 1)[0];
    cfg.kacheln.splice(nach, 0, k);
    aendern();
  }

  $("liste").addEventListener("click", function(e){
    var b = e.target.closest("button"); if (!b) return;
    var i = +b.closest("li").dataset.i, k = cfg.kacheln[i];
    if (b.dataset.a === "hoch") verschieben(i, i - 1);
    else if (b.dataset.a === "runter") verschieben(i, i + 1);
    else if (b.dataset.a === "edit") bearbeiten(k.id);
    else if (b.dataset.a === "del"){
      bestaetigen({ titel: "Kachel entfernen", text: "„" + k.titel + "“ wird aus der Übersicht entfernt.", ok: "Entfernen", gefahr: true })
        .then(function(ok){
          if (!ok) return;
          cfg.kacheln = cfg.kacheln.filter(function(x){ return x.id !== k.id; });
          if (bearbeiteId === k.id) formLeeren();
          aendern();
          WT.melden("Kachel entfernt.");
        });
    }
  });

  /* Ziehen am Griff – mit Pointer-Events, damit es mit Maus, Stift und Touch funktioniert */
  var zug = null;
  function zielBei(x, y){
    var el = document.elementFromPoint(x, y);
    var li = el && el.closest(".eintrag");
    return li && $("liste").contains(li) ? li : null;
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
    zug = { von: +li.dataset.i, li: li, zeiger: e.pointerId };
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

  /* ---------- Kachel-Formular ---------- */
  function vorschau(){
    var v = $("k-vorschau");
    v.innerHTML = formBild ? '<img src="' + WT.esc(formBild) + '" alt="Bildvorschau">' : "Kein Bild";
    $("k-ausschnitt").disabled = !formBild;
    $("k-entfernen").disabled = !formBild;
  }

  function formLeeren(){
    bearbeiteId = null; formBild = ""; formOriginal = "";
    $("k-titel").value = ""; $("k-link").value = "";
    $("h-editor").textContent = "Neue Kachel";
    $("k-uebernehmen").textContent = "Kachel hinzufügen";
    vorschau(); liste();
  }

  function bearbeiten(id){
    var k = cfg.kacheln.filter(function(x){ return x.id === id; })[0]; if (!k) return;
    bearbeiteId = id; formBild = k.bild || ""; formOriginal = k.original || "";
    $("k-titel").value = k.titel; $("k-link").value = k.link;
    $("h-editor").textContent = "Kachel bearbeiten";
    $("k-uebernehmen").textContent = "Änderungen übernehmen";
    vorschau(); liste();
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
    if (!titel){ WT.melden("Bitte einen Titel eingeben.", true); $("k-titel").focus(); return; }
    if (!link){ WT.melden("Bitte einen Link eingeben.", true); $("k-link").focus(); return; }
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(link)) link = "https://" + link;
    if (!WT.linkErlaubt(link)){
      WT.melden("Der Link ist ungültig. Erlaubt sind nur Adressen mit http:// oder https://.", true);
      $("k-link").focus(); return;
    }

    if (bearbeiteId){
      var k = cfg.kacheln.filter(function(x){ return x.id === bearbeiteId; })[0];
      k.titel = titel; k.link = link; k.bild = formBild; k.original = formBild ? formOriginal : "";
      WT.melden("Kachel geändert. Zum Veröffentlichen „Speichern“ klicken.");
    } else {
      cfg.kacheln.push({ id: WT.neueId(), titel: titel, link: link, bild: formBild, original: formBild ? formOriginal : "" });
      WT.melden("Kachel hinzugefügt. Zum Veröffentlichen „Speichern“ klicken.");
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
