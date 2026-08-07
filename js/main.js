(() => {
  const DATA_URL = "data/projects.json";
  const SLIDE_MS = 7000;
  const GLITCH_MS = 720;

  const bgStage = document.getElementById("bg-stage");
  const noiseEl = document.getElementById("bg-noise");
  const rgbEl = document.getElementById("rgb-split");
  const brandEl = document.getElementById("brand");
  const socialsEl = document.getElementById("socials");
  const modal = document.getElementById("modal");
  const modalPanel = document.getElementById("modal-panel");
  const modalTitle = document.getElementById("modal-title");
  const modalMeta = document.getElementById("modal-meta");
  const modalGhost = document.getElementById("modal-ghost");
  const modalStamp = document.getElementById("modal-stamp");
  const modalHint = document.getElementById("modal-hint");
  const modalBody = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modalScrub = document.getElementById("modal-scrub");
  const modalScrubThumb = document.getElementById("modal-scrub-thumb");
  const modalScrubLabel = document.getElementById("modal-scrub-label");
  const navButtons = document.querySelectorAll("[data-modal]");

  let data = null;
  let layers = [];
  let currentIndex = 0;
  let timerId = null;
  let transitioning = false;
  let modalOpen = false;
  let activeKind = null;
  let stripEl = null;
  let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // drag state for horizontal strip
  let dragging = false;
  let dragStartX = 0;
  let dragScrollLeft = 0;
  let dragMoved = false;

  // about ink canopy parallax
  let aboutEl = null;
  let onAboutPointerMove = null;

  async function init() {
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);
      data = await res.json();
    } catch (err) {
      console.error(err);
      data = {
        backgrounds: [],
        about: { oneFlowMan: "Content unavailable.", treestyleStudios: "" },
        socials: [],
        games: [],
        music: [],
      };
    }

    renderSocials();
    setupBackgrounds();
    bindNav();
    bindModalChrome();
  }

  function renderSocials() {
    if (!socialsEl) return;
    const socials = Array.isArray(data.socials) ? data.socials : [];
    if (!socials.length) {
      socialsEl.hidden = true;
      return;
    }
    socialsEl.hidden = false;
    socialsEl.innerHTML = socials
      .map(
        (s) =>
          `<a href="${escapeAttr(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
            s.label
          )}</a>`
      )
      .join("");
  }

  function setupBackgrounds() {
    if (!bgStage) return;
    const paths = Array.isArray(data.backgrounds) ? data.backgrounds.filter(Boolean) : [];
    if (!paths.length) {
      bgStage.style.background = "#070709";
      return;
    }

    layers = paths.map((src, i) => {
      const el = document.createElement("div");
      el.className = "bg-layer" + (i === 0 ? " is-active" : "");
      el.style.backgroundImage = `url("${src}")`;
      el.setAttribute("aria-hidden", "true");
      bgStage.insertBefore(el, bgStage.firstChild);
      return el;
    });

    currentIndex = 0;
    if (layers.length > 1 && !reduceMotion) startCarousel();
  }

  function startCarousel() {
    stopCarousel();
    timerId = window.setInterval(() => {
      if (!modalOpen) goNext();
    }, SLIDE_MS);
  }

  function stopCarousel() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function goNext() {
    if (transitioning || layers.length < 2) return;
    const nextIndex = (currentIndex + 1) % layers.length;
    transitionTo(nextIndex);
  }

  function transitionTo(nextIndex) {
    transitioning = true;
    const current = layers[currentIndex];
    const next = layers[nextIndex];

    next.classList.add("is-active");
    current.classList.add("is-leaving", "is-glitching");
    if (noiseEl) noiseEl.classList.add("is-flashing");
    if (rgbEl) rgbEl.classList.add("is-active");
    pulseBrand();

    window.setTimeout(() => {
      current.classList.remove("is-active", "is-leaving", "is-glitching");
      if (noiseEl) noiseEl.classList.remove("is-flashing");
      if (rgbEl) rgbEl.classList.remove("is-active");
      currentIndex = nextIndex;
      transitioning = false;
    }, GLITCH_MS);
  }

  function pulseBrand() {
    if (!brandEl || reduceMotion || modalOpen) return;
    brandEl.classList.remove("is-glitching");
    // force reflow so repeated glitches retrigger
    void brandEl.offsetWidth;
    brandEl.classList.add("is-glitching");
    window.setTimeout(() => brandEl.classList.remove("is-glitching"), GLITCH_MS);
  }

  function bindNav() {
    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => openModal(btn.dataset.modal));
    });
  }

  function bindModalChrome() {
    if (!modal) return;
    modalClose?.addEventListener("click", closeModal);
    modalBackdrop?.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalOpen) closeModal();
    });

    modalPanel?.addEventListener("wheel", onPanelWheel, { passive: false });

    modalScrub?.addEventListener("pointerdown", (e) => {
      if (!stripEl) return;
      scrubToPointer(e);
      const move = (ev) => scrubToPointer(ev);
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  function onPanelWheel(e) {
    if (!stripEl || activeKind === "about") return;
    const delta = e.deltaY + e.deltaX;
    if (!delta) return;
    e.preventDefault();
    stripEl.scrollLeft += delta;
    updateScrub();
  }

  function scrubToPointer(e) {
    if (!stripEl || !modalScrub) return;
    const track = modalScrub.querySelector(".modal-scrub-track");
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const max = stripEl.scrollWidth - stripEl.clientWidth;
    stripEl.scrollLeft = ratio * max;
    updateScrub();
  }

  function setCloseLabel(kind) {
    const label = modalClose?.querySelector("span") || modalClose;
    if (!label) return;
    label.textContent =
      kind === "games" ? "Quit" : kind === "about" ? "Flip" : "Bail";
  }

  function openModal(kind) {
    if (!modal || !data) return;
    activeKind = kind;
    const titles = { about: "About", games: "Games", music: "Music" };
    const stamps = {
      about: "// INK & ROOT",
      games: "// BOOT SEQUENCE",
      music: "// FROM THE CRATES",
    };

    modalTitle.textContent = titles[kind] || "Portfolio";
    const ghosts = { about: "INK", games: "READY", music: "CIPHER" };
    if (modalGhost) modalGhost.textContent = ghosts[kind] || "PORTFOLIO";
    if (modalStamp) modalStamp.textContent = stamps[kind] || "// SIGNAL";
    modalPanel?.setAttribute("data-kind", kind);
    setCloseLabel(kind);
    syncMusicTags(kind);

    setModalMeta(kind);
    modalBody.innerHTML = renderModalBody(kind);
    wireStrip();
    wireAbout();

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    modalOpen = true;
    modalClose?.focus();
  }

  function closeModal() {
    if (!modal) return;
    unwireStrip();
    unwireAbout();
    syncMusicTags(null);
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    modalOpen = false;
    activeKind = null;
    setCloseLabel(null);
  }

  function syncMusicTags(kind) {
    const fx = modalPanel?.querySelector(".modal-fx");
    if (!fx) return;
    let tags = fx.querySelector(".music-tags");
    if (kind === "music") {
      if (!tags) {
        tags = document.createElement("div");
        tags.className = "music-tags";
        tags.setAttribute("aria-hidden", "true");
        tags.innerHTML = `
          <span class="tag-a">BOOM BAP</span>
          <span class="tag-b">MASK UP</span>
          <span class="tag-c">RAW TAPES</span>
          <span class="tag-d">UNDERGROUND</span>
          <span class="tag-e">ALL CAPS</span>
        `;
        fx.appendChild(tags);
      }
      return;
    }
    tags?.remove();
  }

  function wireAbout() {
    unwireAbout();
    aboutEl = document.querySelector(".about-ink");
    if (!aboutEl || reduceMotion) return;

    onAboutPointerMove = (e) => {
      const rect = aboutEl.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      aboutEl.style.setProperty("--gaze-x", x.toFixed(3));
      aboutEl.style.setProperty("--gaze-y", y.toFixed(3));
    };

    modalPanel?.addEventListener("pointermove", onAboutPointerMove);
  }

  function unwireAbout() {
    if (onAboutPointerMove) {
      modalPanel?.removeEventListener("pointermove", onAboutPointerMove);
      onAboutPointerMove = null;
    }
    if (aboutEl) {
      aboutEl.style.removeProperty("--gaze-x");
      aboutEl.style.removeProperty("--gaze-y");
      aboutEl = null;
    }
  }

  function inkLeafMarkup(index, side) {
    const n = vibe(index, side + 1);
    const n2 = vibe(index, side + 7);
    const n3 = vibe(index, side + 13);
    const n4 = vibe(index, side + 19);
    // denser stacking: multiple layers along the border axis
    const layer = index % 3;
    const along = Math.floor(index / 3);
    const size = 22 + Math.round(n * 38) + layer * 4;
    let x;
    let y;
    let rot;
    if (side === 0) {
      x = `${(-18 + layer * 28 + n2 * 18).toFixed(1)}%`;
      y = `${((along * 7.2 + n3 * 4) % 108) - 4}%`;
      rot = `${(-55 + n4 * 90).toFixed(1)}deg`;
    } else if (side === 1) {
      x = `${(42 + layer * 22 + n2 * 20).toFixed(1)}%`;
      y = `${((along * 7.2 + n3 * 4) % 108) - 4}%`;
      rot = `${(95 + n4 * 90).toFixed(1)}deg`;
    } else if (side === 2) {
      x = `${((along * 6.5 + n2 * 4) % 108) - 4}%`;
      y = `${(-24 + layer * 26 + n3 * 16).toFixed(1)}%`;
      rot = `${(-30 + n4 * 50).toFixed(1)}deg`;
    } else {
      x = `${((along * 6.5 + n2 * 4) % 108) - 4}%`;
      y = `${(28 + layer * 24 + n3 * 18).toFixed(1)}%`;
      rot = `${(150 + n4 * 50).toFixed(1)}deg`;
    }

    const tone = n > 0.7 ? "is-tech" : n > 0.38 ? "is-bright" : "is-deep";
    const sc = (0.85 + n2 * 0.65).toFixed(2);
    const dur = `${(2.8 + n3 * 3.2).toFixed(2)}s`;
    const delay = `${(-n4 * 4.5).toFixed(2)}s`;
    const op = (0.8 + n * 0.2).toFixed(2);
    const z = 10 + layer * 3 + Math.round(n * 4);
    const showTech = n > 0.58;

    return `
      <span
        class="ink-leaf ${tone}"
        style="--x:${x};--y:${y};--rot:${rot};--s:${size}px;--sc:${sc};--dur:${dur};--delay:${delay};--op:${op};z-index:${z}"
        aria-hidden="true"
      >
        <svg viewBox="0 0 40 64" focusable="false">
          <path class="blade" d="M20 2 C30 14 38 26 35 42 C32 54 24 61 20 62 C16 61 8 54 5 42 C2 26 10 14 20 2Z" />
          <path class="vein" d="M20 12 L20 54" />
          <path class="vein" d="M20 28 C14 32 11 38 10 44" />
          <path class="vein" d="M20 34 C26 38 29 43 30 48" />
          ${
            showTech
              ? `<path class="tech" d="M27 24 L34 24 L34 31 M31 24 L31 20" />`
              : ""
          }
        </svg>
      </span>
    `;
  }

  function buildInkCanopy(side, count) {
    let html = "";
    for (let i = 0; i < count; i += 1) html += inkLeafMarkup(i, side);
    return html;
  }

  function setModalMeta(kind) {
    if (!modalMeta) return;
    if (kind === "about") {
      modalMeta.hidden = true;
      modalMeta.textContent = "";
      if (modalHint) modalHint.hidden = true;
      if (modalScrub) modalScrub.hidden = true;
      return;
    }

    const items = sortByDateDesc(kind === "games" ? data.games : data.music);
    if (!items.length) {
      modalMeta.hidden = true;
      modalMeta.textContent = "";
      if (modalHint) modalHint.hidden = true;
      if (modalScrub) modalScrub.hidden = true;
      return;
    }

    const years = items
      .map((item) => yearFromDate(item.date))
      .filter(Boolean)
      .map(Number);
    const countLabel =
      kind === "music"
        ? `${items.length} joints`
        : `${items.length} GAMES`;
    let range = "";
    if (years.length) {
      const min = Math.min(...years);
      const max = Math.max(...years);
      range = min === max ? `${min}` : `${min}–${max}`;
    }

    modalMeta.hidden = false;
    modalMeta.textContent = range ? `${countLabel} · ${range}` : countLabel;
    if (modalHint) {
      modalHint.hidden = false;
      modalHint.textContent =
        kind === "games" ? "← SELECT →" : kind === "music" ? "flip the racks →" : "drag / scroll →";
    }
    if (modalScrub) modalScrub.hidden = false;
  }

  function renderModalBody(kind) {
    if (kind === "about") {
      const about = data.about || {};
      const traits = [
        "Game Dev",
        "Rapper",
        "Freestylist",
        "Horror Enthusiast",
        "Hip Hop Head",
        "Borzoi Lover",
        "Programmer",
        "Gamer",
        "ADHD Dreamer",
        "Self-Disciplined Doer",
        "Lover & Hater",
      ];
      const traitHtml = traits
        .map((trait, i) => {
          const tilt = ((vibe(i, 9) - 0.5) * 8).toFixed(1);
          return `<span class="ink-trait" style="--i:${i};--tilt:${tilt}deg">${escapeHtml(
            trait
          )}</span>`;
        })
        .join("");

      return `
        <div class="about-ink" style="--gaze-x:0; --gaze-y:0">
          <div class="ink-speed" aria-hidden="true"></div>

          <svg class="ink-circuit" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <path class="trace-root" style="animation-delay:0.05s" d="M120 120 C220 200 260 320 300 420 C340 520 300 620 220 720" />
            <path class="trace-root" style="animation-delay:0.2s" d="M1080 80 C980 180 940 300 900 420 C860 540 920 640 1040 740" />
            <path class="trace-root" style="animation-delay:0.35s" d="M300 420 C420 390 560 400 700 430 C820 455 940 440 1040 400" />
            <path class="trace" d="M180 260 L260 260 L260 340 L340 340" />
            <path class="trace" d="M960 220 L880 220 L880 300 L800 300 L800 360" />
            <path class="trace" d="M420 560 L520 560 L520 640 L640 640" />
            <circle class="node" cx="260" cy="260" r="3.5" />
            <circle class="node" cx="880" cy="300" r="3.5" style="animation-delay:-0.4s" />
            <circle class="node" cx="520" cy="560" r="3.5" style="animation-delay:-0.9s" />
            <circle class="node" cx="700" cy="430" r="4" style="animation-delay:-1.2s" />
          </svg>

          <div class="ink-canopy ink-canopy-l" aria-hidden="true">${buildInkCanopy(0, 42)}</div>
          <div class="ink-canopy ink-canopy-r" aria-hidden="true">${buildInkCanopy(1, 42)}</div>
          <div class="ink-canopy ink-canopy-t" aria-hidden="true">${buildInkCanopy(2, 36)}</div>
          <div class="ink-canopy ink-canopy-b" aria-hidden="true">${buildInkCanopy(3, 36)}</div>

          <div class="ink-page">
            <figure class="ink-panel ink-panel-hero">
              <img src="assets/profile/me.png" alt="One Flow Man" width="480" height="640" />
              <span class="ink-halftone" aria-hidden="true"></span>
              <p class="ink-nameplate">One <span>Flow</span> Man</p>
            </figure>

            <section class="ink-panel ink-panel-bio">
              <p class="ink-label">Chapter 01</p>
              <h3>One <span>Flow</span> Man</h3>
              <p class="ink-copy">${escapeHtml(about.oneFlowMan || "")}</p>
            </section>

            <section class="ink-panel ink-panel-studio">
              <div class="ink-studio-row">
                <img
                  class="ink-studio-mark"
                  src="assets/profile/ts.png"
                  alt="Treestyle Studios"
                  width="96"
                  height="96"
                />
                <div>
                  <p class="ink-label">Chapter 02</p>
                  <h3>Treestyle Studios</h3>
                  <p class="ink-copy">${escapeHtml(about.treestyleStudios || "")}</p>
                </div>
              </div>
            </section>

            <div class="ink-panel ink-panel-traits" aria-hidden="true">
              ${traitHtml}
            </div>
          </div>
        </div>
      `;
    }

    const items = sortByDateDesc(kind === "games" ? data.games : data.music);
    if (!items.length) {
      return `<p class="empty-state">Nothing in the vault yet.</p>`;
    }

    const kindClass = kind === "music" ? "is-music" : "is-games";
    const endLabel = kind === "games" ? "NO DATA" : "side B";
    return `
      <div class="chaos-strip ${kindClass}" id="chaos-strip" tabindex="0">
        ${items.map((item, index) => projectTile(item, index, kind)).join("")}
        <div class="chaos-end" aria-hidden="true">
          <span>${endLabel}</span>
        </div>
      </div>
    `;
  }

  function sortByDateDesc(list) {
    return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
      const da = Date.parse(a.date || "") || 0;
      const db = Date.parse(b.date || "") || 0;
      return db - da;
    });
  }

  function yearFromDate(value) {
    if (!value) return "";
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return String(new Date(parsed).getFullYear());
    const match = String(value).match(/\d{4}/);
    return match ? match[0] : "";
  }

  // Stable pseudo-random from index for collage vibes
  function vibe(index, salt) {
    const x = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function projectTile(item, index, kind) {
    const featured = index === 0;
    const year = yearFromDate(item.date);
    const isGames = kind === "games";
    const rot = isGames
      ? "0.00"
      : ((vibe(index, 1) - 0.5) * (featured ? 4 : 14)).toFixed(2);
    const lift = isGames
      ? "0.0"
      : ((vibe(index, 2) - 0.5) * 48).toFixed(1);
    let size;
    if (featured) {
      size = "xl";
    } else if (isGames) {
      size = vibe(index, 3) > 0.5 ? "lg" : "md";
    } else {
      size = vibe(index, 3) > 0.66 ? "lg" : vibe(index, 3) > 0.33 ? "md" : "sm";
    }
    const delay = Math.min(index, 12) * 60;
    const tape = !isGames && vibe(index, 4) > 0.55 ? " has-tape" : "";
    const stamp = String(item.tag || "").trim();
    const stampHtml = stamp
      ? `<span class="chaos-stamp" aria-hidden="true">${escapeHtml(stamp.toUpperCase())}</span>`
      : "";

    return `
      <a
        class="chaos-card size-${size}${featured ? " is-featured" : ""}${tape}"
        href="${escapeAttr(item.url)}"
        target="_blank"
        rel="noopener noreferrer"
        style="--rot: ${rot}deg; --lift: ${lift}px; --stagger: ${delay}ms; --z: ${20 - index}"
        data-index="${index}"
      >
        ${stampHtml}
        <div class="chaos-media">
          <img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.title)}" loading="lazy" draggable="false" />
          <div class="chaos-glitch" aria-hidden="true"></div>
        </div>
        <div class="chaos-caption">
          ${year ? `<span class="chaos-year">${escapeHtml(year)}</span>` : ""}
          <h3 class="chaos-title">${escapeHtml(item.title)}</h3>
        </div>
      </a>
    `;
  }

  function wireStrip() {
    unwireStrip();
    stripEl = document.getElementById("chaos-strip");
    if (!stripEl) {
      if (modalScrub) modalScrub.hidden = true;
      return;
    }

    stripEl.scrollLeft = 0;
    // Force layout so overflow exists before first scrub update
    void stripEl.offsetWidth;
    updateScrub();

    stripEl.addEventListener("scroll", updateScrub, { passive: true });
    stripEl.addEventListener("wheel", onPanelWheel, { passive: false });
    stripEl.addEventListener("pointerdown", onStripPointerDown);
    stripEl.addEventListener("pointermove", onStripPointerMove);
    stripEl.addEventListener("pointerup", onStripPointerUp);
    stripEl.addEventListener("pointercancel", onStripPointerUp);
    stripEl.addEventListener("pointerleave", onStripPointerUp);
    stripEl.addEventListener("click", onStripClickCapture, true);
  }

  function unwireStrip() {
    if (!stripEl) return;
    stripEl.removeEventListener("scroll", updateScrub);
    stripEl.removeEventListener("wheel", onPanelWheel);
    stripEl.removeEventListener("pointerdown", onStripPointerDown);
    stripEl.removeEventListener("pointermove", onStripPointerMove);
    stripEl.removeEventListener("pointerup", onStripPointerUp);
    stripEl.removeEventListener("pointercancel", onStripPointerUp);
    stripEl.removeEventListener("pointerleave", onStripPointerUp);
    stripEl.removeEventListener("click", onStripClickCapture, true);
    stripEl = null;
    dragging = false;
  }

  function onStripPointerDown(e) {
    if (!stripEl || e.button !== 0) return;
    dragging = true;
    dragMoved = false;
    dragStartX = e.clientX;
    dragScrollLeft = stripEl.scrollLeft;
    stripEl.classList.add("is-dragging");
    stripEl.setPointerCapture?.(e.pointerId);
  }

  function onStripPointerMove(e) {
    if (!dragging || !stripEl) return;
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 4) dragMoved = true;
    stripEl.scrollLeft = dragScrollLeft - dx;
    updateScrub();
  }

  function onStripPointerUp() {
    if (!stripEl) return;
    dragging = false;
    stripEl.classList.remove("is-dragging");
  }

  function onStripClickCapture(e) {
    if (dragMoved) {
      e.preventDefault();
      e.stopPropagation();
      dragMoved = false;
    }
  }

  function updateScrub() {
    if (!stripEl || !modalScrubThumb) return;
    const max = stripEl.scrollWidth - stripEl.clientWidth;
    const ratio = max > 0 ? stripEl.scrollLeft / max : 0;
    modalScrubThumb.style.transform = `scaleX(${Math.max(0.08, ratio)})`;
    if (modalScrubLabel) {
      modalScrubLabel.textContent = String(Math.round(ratio * 100)).padStart(2, "0");
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  init();
})();
