// Folder Custom Icons : centrage de l'icône + galerie « Mes images »
(() => {
  console.log("[folder-icons] script chargé");
  const XHTML = "http://www.w3.org/1999/xhtml";
  const CFG = { scale: 1.6, opacity: 1 }; // à ajuster
  const file = () => PathUtils.join(PathUtils.profileDir, "zen-custom-icons.json");

  /* ---------- 1. Centrage de l'icône (mesure) ---------- */
  const center = () => {
    for (const svg of document.querySelectorAll("zen-folder .tab-group-folder-icon svg")) {
      const img = svg.querySelector("g.icon image");
      const vb = svg.viewBox?.baseVal;
      if (!img || !vb || !vb.width) continue;
      img.style.setProperty("--azt-dx", "0px");
      img.style.setProperty("--azt-dy", "0px");
      img.style.setProperty("--azt-scale", "1");
      const s = svg.getBoundingClientRect();
      const i = img.getBoundingClientRect();
      if (!s.width || !i.width) continue;
      const k = vb.width / s.width;
      img.style.setProperty("--azt-dx", (((s.left + s.width / 2) - (i.left + i.width / 2)) * k).toFixed(2) + "px");
      img.style.setProperty("--azt-dy", (((s.top + s.height / 2) - (i.top + i.height / 2)) * k).toFixed(2) + "px");
      img.style.setProperty("--azt-scale", CFG.scale);
      img.style.setProperty("--azt-opacity", CFG.opacity);
    }
  };
  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(center, 80); })
    .observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] });
  center();

  /* ---------- 2. Galerie dans le sélecteur d'icônes ---------- */
  const initGallery = async (p) => {
    if (p.__customGallery) return;
    p.__customGallery = true;

    let images = [];
    let current = null;
    try {
      const d = await IOUtils.readJSON(file());
      if (Array.isArray(d)) images = d.filter((u) => typeof u === "string" && u.startsWith("data:image/"));
    } catch (e) {}
    const save = () => IOUtils.writeJSON(file(), images).catch((e) => console.error("[folder-icons] sauvegarde impossible", e));

    const box = document.createXULElement("vbox");
    box.id = "custom-folder-gallery";
    box.style.cssText = "margin:6px;gap:6px;";
    const title = document.createXULElement("label");
    title.setAttribute("value", "Mes images");
    const grid = document.createElementNS(XHTML, "div");
    grid.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;max-width:260px;";
    const addBtn = document.createXULElement("button");
    addBtn.setAttribute("label", "Ajouter une image par URL…");
    box.append(title, grid, addBtn);
    p.appendChild(box);

    const apply = (uri) => {
      if (!current) return;
      gZenFolders.setFolderUserIcon(current, uri);
      current.dispatchEvent(new CustomEvent("TabGroupUpdate", { bubbles: true }));
      p.hidePopup();
      setTimeout(center, 150);
    };

    const render = () => {
      grid.replaceChildren();
      for (const uri of images) {
        const img = document.createElementNS(XHTML, "img");
        img.src = uri;
        img.style.cssText = "width:32px;height:32px;object-fit:contain;cursor:pointer;padding:3px;border-radius:6px;";
        img.title = "Clic : appliquer • Clic droit : supprimer";
        img.addEventListener("mouseenter", () => (img.style.background = "rgba(128,128,128,.3)"));
        img.addEventListener("mouseleave", () => (img.style.background = ""));
        img.addEventListener("click", () => apply(uri));
        img.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (Services.prompt.confirm(window, "Supprimer", "Supprimer cette image de la liste ?")) {
            images = images.filter((u) => u !== uri);
            save();
            render();
          }
        });
        grid.appendChild(img);
      }
    };
    render();

    p.addEventListener("popupshowing", (e) => {
      if (e.target !== p) return;
      current = p.anchorNode?.closest?.("zen-folder") || null;
      box.hidden = !current;
    });

    addBtn.addEventListener("command", async () => {
      const input = { value: "" };
      const ok = Services.prompt.prompt(window, "Image personnalisée", "Lien direct de l'image (.png, .jpg, .svg…) :", input, null, {});
      if (!ok) return;
      const m = input.value.trim().match(/data:image\/[^\s"'<>]+|https?:\/\/[^\s"'<>]+/);
      if (!m) return Services.prompt.alert(window, "Erreur", "Aucune URL trouvée dans le texte collé.");

      let uri = m[0];
      if (!uri.startsWith("data:")) {
        try {
          const res = await fetch(uri);
          const blob = await res.blob();
          if (!res.ok || !blob.type.startsWith("image/")) throw new Error("Ce lien n'est pas une image (type : " + (blob.type || "inconnu") + ")");
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let bin = "";
          for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          uri = `data:${blob.type};base64,${btoa(bin)}`;
        } catch (err) {
          console.error("[folder-icons] téléchargement impossible", err);
          return Services.prompt.alert(window, "Erreur", "Impossible de récupérer l'image :\n" + err.message);
        }
      }
      if (!images.includes(uri)) { images.push(uri); await save(); render(); }
      apply(uri);
    });

    console.log("[folder-icons] galerie prête :", images.length, "image(s)");
  };

  // Le panneau peut ne pas exister encore au chargement : on réessaie
  let tries = 0;
  const wait = setInterval(() => {
    const p = document.getElementById("PanelUI-zen-emojis-picker");
    if (p && typeof gZenFolders !== "undefined") { clearInterval(wait); initGallery(p); }
    else if (++tries > 60) { clearInterval(wait); console.warn("[folder-icons] panneau introuvable"); }
  }, 500);
})();
