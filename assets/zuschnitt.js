/* Quadratischer Bildzuschnitt: verschieben (Maus, Touch, Pfeiltasten) und zoomen */
(function(){
  var AUSGABE = 600; /* Kantenlänge des gespeicherten Bildes in Pixeln */

  var dlg, buehne, canvas, ctx, zoomRegler, bild, S, basis, zoom, ox, oy, aufloesen;

  function init(){
    dlg = document.getElementById("zuschnitt");
    buehne = document.getElementById("buehne");
    canvas = document.getElementById("z-canvas");
    ctx = canvas.getContext("2d");
    zoomRegler = document.getElementById("z-zoom");

    zoomRegler.addEventListener("input", function(){ zoomSetzen(parseFloat(zoomRegler.value)); });
    buehne.addEventListener("wheel", function(e){ e.preventDefault(); zoomSetzen(zoom * (e.deltaY < 0 ? 1.08 : 1/1.08)); }, {passive:false});

    var zieht = false, lx, ly;
    buehne.addEventListener("pointerdown", function(e){ zieht = true; lx = e.clientX; ly = e.clientY; buehne.setPointerCapture(e.pointerId); buehne.classList.add("aktiv"); });
    buehne.addEventListener("pointermove", function(e){
      if (!zieht) return;
      var f = S / buehne.clientWidth;
      ox += (e.clientX - lx) * f; oy += (e.clientY - ly) * f;
      lx = e.clientX; ly = e.clientY;
      begrenzen(); zeichnen();
    });
    function ende(){ zieht = false; buehne.classList.remove("aktiv"); }
    buehne.addEventListener("pointerup", ende);
    buehne.addEventListener("pointercancel", ende);

    buehne.addEventListener("keydown", function(e){
      var schritt = S * 0.02, genutzt = true;
      if (e.key === "ArrowLeft") ox += schritt;
      else if (e.key === "ArrowRight") ox -= schritt;
      else if (e.key === "ArrowUp") oy += schritt;
      else if (e.key === "ArrowDown") oy -= schritt;
      else if (e.key === "+" || e.key === "=") { zoomSetzen(zoom * 1.08); return e.preventDefault(); }
      else if (e.key === "-") { zoomSetzen(zoom / 1.08); return e.preventDefault(); }
      else genutzt = false;
      if (genutzt){ e.preventDefault(); begrenzen(); zeichnen(); }
    });

    document.getElementById("z-ok").addEventListener("click", function(){ schliessen(ergebnis()); });
    document.getElementById("z-abbrechen").addEventListener("click", function(){ schliessen(null); });
    dlg.addEventListener("cancel", function(e){ e.preventDefault(); schliessen(null); });
  }

  function skala(){ return basis * zoom; }

  function begrenzen(){
    var b = bild.naturalWidth * skala(), h = bild.naturalHeight * skala();
    ox = Math.min(0, Math.max(S - b, ox));
    oy = Math.min(0, Math.max(S - h, oy));
  }

  function zoomSetzen(z){
    z = Math.max(1, Math.min(4, z));
    /* um die Mitte der Bühne zoomen */
    var cx = (S/2 - ox) / skala(), cy = (S/2 - oy) / skala();
    zoom = z;
    ox = S/2 - cx * skala(); oy = S/2 - cy * skala();
    zoomRegler.value = z;
    begrenzen(); zeichnen();
  }

  function zeichnen(){
    ctx.fillStyle = "#0d1b2e";
    ctx.fillRect(0, 0, S, S);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bild, ox, oy, bild.naturalWidth * skala(), bild.naturalHeight * skala());
  }

  function ergebnis(){
    var c = document.createElement("canvas");
    c.width = c.height = AUSGABE;
    var g = c.getContext("2d");
    g.fillStyle = "#FFFFFF";
    g.fillRect(0, 0, AUSGABE, AUSGABE);
    g.imageSmoothingQuality = "high";
    var sx = -ox / skala(), sy = -oy / skala(), sg = S / skala();
    g.drawImage(bild, sx, sy, sg, sg, 0, 0, AUSGABE, AUSGABE);
    return c.toDataURL("image/jpeg", 0.86);
  }

  function schliessen(wert){
    if (dlg.open) dlg.close();
    if (bild && bild.src.indexOf("blob:") === 0) URL.revokeObjectURL(bild.src);
    var f = aufloesen; aufloesen = null;
    if (f) f(wert);
  }

  /* Öffnet den Dialog für eine Datei oder eine Bild-URL; liefert eine Data-URL oder null */
  function oeffnen(quelle){
    if (!dlg) init();
    return new Promise(function(ok, fehler){
      bild = new Image();
      bild.onload = function(){
        if (!bild.naturalWidth){ fehler(new Error("leer")); return; }
        dlg.showModal();
        var dpr = window.devicePixelRatio || 1;
        S = Math.round(buehne.clientWidth * dpr) || 800;
        canvas.width = canvas.height = S;
        basis = Math.max(S / bild.naturalWidth, S / bild.naturalHeight);
        zoom = 1; zoomRegler.value = 1;
        ox = (S - bild.naturalWidth * basis) / 2;
        oy = (S - bild.naturalHeight * basis) / 2;
        zeichnen();
        buehne.focus();
        aufloesen = ok;
      };
      bild.onerror = function(){ fehler(new Error("Bild nicht lesbar")); };
      bild.src = typeof quelle === "string" ? quelle : URL.createObjectURL(quelle);
    });
  }

  window.Zuschnitt = { oeffnen: oeffnen };
})();
