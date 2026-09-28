/* Einstellungen: Kacheln verwalten, sortieren, Bilder zuschneiden, speichern */
(function(){
  var ENTWURF = "webtools-entwurf";
  var SPEICHER_URL = "speichern.ashx";
  function $(id){ return document.getElementById(id); }

  var cfg = null;          /* aktueller Bearbeitungsstand */
  var gespeichert = "";    /* zuletzt gespeicherter Stand (JSON) */
  var bearbeiteId = null;  /* null = neue Kachel */
  var formBild = "";       /* zugeschnittenes Bild im Formular */
  var formOriginal = null; /* Originaldatei für erneuten Zuschnitt */

  /* ---------- Laden ---------- */
  WT.laden().catch(function(){
    WT.melden("daten/kacheln.json nicht gefunden. Es wird mit einer leeren Liste begonnen.", true);
    return JSON.parse(JSON.stringify(WT.STANDARD));
  }).then(function(basis){
    gespeichert = JSON.stringify(basis);
    cfg = basis;
    try {
      var e = localStorage.getItem(ENTWURF);
      if (e && e !== gespeichert){ cfg = JSON.parse(e); WT.melden("Nicht gespeicherter Entwurf wiederhergestellt."); }
    } catch(_){}
    alles();
  });

  function alles(){ WT.kopfAnwenden(cfg); liste(); seite(); status(); formLeeren(); }
  function geaendert(){ return JSON.stringify(cfg) !== gespeichert; }

  function aendern(){
    try { localStorage.setItem(ENTWURF, JSON.stringify(cfg)); } catch(_){ }
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
      return '<li class="eintrag' + (k.id === bearbeiteId ? ' aktiv' : '') + '" draggable="true" data-i="' + i + '">' +
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
    else if (b.dataset.a === "del" && confirm("Kachel „" + k.titel + "“ entfernen?")){
      cfg.kacheln.splice(i, 1);
      if (bearbeiteId === k.id) formLeeren();
      aendern();
      WT.melden("Kachel entfernt.");
    }
  });

  var zieh = null;
  $("liste").addEventListener("dragstart", function(e){
    var li = e.target.closest("li"); if (!li) return;
    zieh = +li.dataset.i; li.classList.add("ziehen");
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(zieh)); } catch(_){}
  });
  $("liste").addEventListener("dragover", function(e){
    e.preventDefault();
    var li = e.target.closest("li");
    document.querySelectorAll(".eintrag.ziel").forEach(function(x){ if (x !== li) x.classList.remove("ziel"); });
    if (li) li.classList.add("ziel");
  });
  $("liste").addEventListener("drop", function(e){
    e.preventDefault();
    var li = e.target.closest("li");
    if (li && zieh !== null) verschieben(zieh, +li.dataset.i);
    zieh = null;
  });
  $("liste").addEventListener("dragend", function(){
    zieh = null;
    document.querySelectorAll(".eintrag.ziehen,.eintrag.ziel").forEach(function(x){ x.classList.remove("ziehen","ziel"); });
  });

  /* ---------- Kachel-Formular ---------- */
  function vorschau(){
    var v = $("k-vorschau");
    v.innerHTML = formBild ? '<img src="' + WT.esc(formBild) + '" alt="Bildvorschau">' : "Kein Bild";
    $("k-ausschnitt").disabled = !formBild;
    $("k-entfernen").disabled = !formBild;
  }

  function formLeeren(){
    bearbeiteId = null; formBild = ""; formOriginal = null;
    $("k-titel").value = ""; $("k-link").value = "";
    $("h-editor").textContent = "Neue Kachel";
    $("k-uebernehmen").textContent = "Kachel hinzufügen";
    vorschau(); liste();
  }

  function bearbeiten(id){
    var k = cfg.kacheln.filter(function(x){ return x.id === id; })[0]; if (!k) return;
    bearbeiteId = id; formBild = k.bild || ""; formOriginal = null;
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
    Zuschnitt.oeffnen(d).then(function(url){
      if (url){ formBild = url; formOriginal = d; vorschau(); }
    }).catch(function(){ WT.melden("Das Bild konnte nicht gelesen werden.", true); });
  };
  $("k-ausschnitt").onclick = function(){
    Zuschnitt.oeffnen(formOriginal || formBild).then(function(url){ if (url){ formBild = url; vorschau(); } })
      .catch(function(){ WT.melden("Das Bild konnte nicht geöffnet werden.", true); });
  };
  $("k-entfernen").onclick = function(){ formBild = ""; formOriginal = null; vorschau(); };

  $("k-uebernehmen").onclick = function(){
    var titel = $("k-titel").value.trim(), link = $("k-link").value.trim();
    if (!titel){ WT.melden("Bitte einen Titel eingeben.", true); $("k-titel").focus(); return; }
    if (!link){ WT.melden("Bitte einen Link eingeben.", true); $("k-link").focus(); return; }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(link)) link = "https://" + link;
    try { new URL(link); } catch(_){ WT.melden("Der Link ist ungültig.", true); $("k-link").focus(); return; }

    if (bearbeiteId){
      var k = cfg.kacheln.filter(function(x){ return x.id === bearbeiteId; })[0];
      k.titel = titel; k.link = link; k.bild = formBild;
      WT.melden("Kachel geändert. Zum Veröffentlichen „Speichern“ klicken.");
    } else {
      cfg.kacheln.push({ id: "k" + Date.now().toString(36), titel: titel, link: link, bild: formBild });
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
  function json(){ return JSON.stringify(cfg, null, 2); }

  function herunterladen(){
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json()], {type:"application/json"}));
    a.download = "kacheln.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  }

  function alsGespeichertMarkieren(){
    gespeichert = JSON.stringify(cfg);
    try { localStorage.removeItem(ENTWURF); } catch(_){}
    status();
  }

  $("speichern").onclick = function(){
    var b = this; b.disabled = true; b.textContent = "Wird gespeichert …";
    fetch(SPEICHER_URL, { method:"POST", headers:{"Content-Type":"application/json; charset=utf-8"}, body: json(), credentials:"same-origin" })
      .then(function(r){
        if (r.ok) return "ok";
        if (r.status === 413) throw new Error("Die Daten sind zu groß. Bitte weniger oder kleinere Bilder verwenden.");
        if (r.status === 400 || r.status === 403){
          return r.json().catch(function(){ return {}; }).then(function(d){
            throw new Error(d.fehler || (r.status === 403 ? "Keine Berechtigung zum Speichern." : "Ungültige Daten."));
          });
        }
        return "fehlt"; /* Handler nicht vorhanden oder nicht ausführbar */
      })
      .then(function(ergebnis){
        if (ergebnis === "ok"){
          alsGespeichertMarkieren();
          WT.melden("Gespeichert. Die Übersicht zeigt jetzt den neuen Stand.");
        } else {
          herunterladen();
          alsGespeichertMarkieren();
          WT.melden("Direktes Speichern ist auf dem Server nicht eingerichtet. kacheln.json wurde heruntergeladen – bitte in den Ordner „daten“ kopieren.", true);
        }
      })
      .catch(function(err){
        WT.melden("Speichern fehlgeschlagen: " + err.message, true);
      })
      .then(function(){ b.textContent = "Speichern"; status(); });
  };

  $("verwerfen").onclick = function(){
    if (!confirm("Alle nicht gespeicherten Änderungen verwerfen?")) return;
    cfg = JSON.parse(gespeichert);
    try { localStorage.removeItem(ENTWURF); } catch(_){}
    alles();
    WT.melden("Änderungen verworfen.");
  };

  $("export").onclick = herunterladen;
  $("import").onclick = function(){ $("importdatei").click(); };
  $("importdatei").onchange = function(e){
    var d = e.target.files[0]; e.target.value = "";
    if (!d) return;
    d.text().then(function(t){
      var neu = JSON.parse(t);
      if (!Array.isArray(neu.kacheln)) throw new Error();
      cfg = { titel: neu.titel || "Webtools", einleitung: neu.einleitung || "", logo: neu.logo || "", kacheln: neu.kacheln };
      alles(); aendern();
      WT.melden("Datei importiert. Zum Übernehmen „Speichern“ klicken.");
    }).catch(function(){ WT.melden("Die Datei ist keine gültige Kachel-Konfiguration.", true); });
  };
})();
