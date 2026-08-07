(() => {
  const DATA_URL = "data/projects.json";
  const SLIDE_MS = 7000;
  const GLITCH_MS = 720;

  const bgStage = document.getElementById("bg-stage");
  const noiseEl = document.getElementById("bg-noise");
  const rgbEl = document.getElementById("rgb-split");
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

    window.setTimeout(() => {
      current.classList.remove("is-active", "is-leaving", "is-glitching");
      if (noiseEl) noiseEl.classList.remove("is-flashing");
      if (rgbEl) rgbEl.classList.remove("is-active");
      currentIndex = nextIndex;
      transitioning = false;
    }, GLITCH_MS);
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
    label.textContent = kind === "games" ? "Quit" : "Bail";
  }

  function openModal(kind) {
    if (!modal || !data) return;
    activeKind = kind;
    const titles = { about: "About", games: "Games", music: "Music" };
    const stamps = {
      about: "// WHO DIS",
      games: "// BOOT SEQUENCE",
      music: "// PRESS PLAY",
    };

    modalTitle.textContent = titles[kind] || "Portfolio";
    if (modalGhost) modalGhost.textContent = titles[kind] || "PORTFOLIO";
    if (modalStamp) modalStamp.textContent = stamps[kind] || "// SIGNAL";
    modalPanel?.setAttribute("data-kind", kind);
    setCloseLabel(kind);

    setModalMeta(kind);
    modalBody.innerHTML = renderModalBody(kind);
    wireStrip();

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    modalOpen = true;
    modalClose?.focus();
  }

  function closeModal() {
    if (!modal) return;
    unwireStrip();
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    modalOpen = false;
    activeKind = null;
    setCloseLabel(null);
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
        ? `${items.length} tracks`
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
      modalHint.textContent = kind === "games" ? "← SELECT →" : "drag / scroll →";
    }
    if (modalScrub) modalScrub.hidden = false;
  }

  function renderModalBody(kind) {
    if (kind === "about") {
      const about = data.about || {};
      return `
        <div class="about-chaos">
          <div class="about-sticker about-sticker-a" aria-hidden="true">ONE FLOW</div>
          <div class="about-sticker about-sticker-b" aria-hidden="true">TREESTYLE</div>
          <section class="about-card about-card-one">
            <img
              class="about-avatar"
              src="images/profile/me.png"
              alt="One Flow Man"
              width="108"
              height="108"
            />
            <p class="about-kicker">artist</p>
            <h3>One <span class="accent">Flow</span> Man</h3>
            <p class="about-copy">${escapeHtml(about.oneFlowMan || "")}</p>
          </section>
          <section class="about-card about-card-two">
            <img
              class="about-avatar"
              src="images/profile/ts.png"
              alt="Treestyle Studios"
              width="108"
              height="108"
            />
            <p class="about-kicker">studio</p>
            <h3>Treestyle Studios</h3>
            <p class="about-copy">${escapeHtml(about.treestyleStudios || "")}</p>
          </section>
          <p class="about-marquee" aria-hidden="true">
            <span>Game Dev · Rapper · Freestylist · Horror Enthusiast · Hip Hop Head · Borzoi Lover · Programmer · Gamer · ADHD Dreamer · Self-Disciplined Doer · Lover &amp; Hater · </span>
            <span>Game Dev · Rapper · Freestylist · Horror Enthusiast · Hip Hop Head · Borzoi Lover · Programmer · Gamer · ADHD Dreamer · Self-Disciplined Doer · Lover &amp; Hater · </span>
          </p>
        </div>
      `;
    }

    const items = sortByDateDesc(kind === "games" ? data.games : data.music);
    if (!items.length) {
      return `<p class="empty-state">Nothing in the vault yet.</p>`;
    }

    const kindClass = kind === "music" ? "is-music" : "is-games";
    const endLabel = kind === "games" ? "NO DATA" : "end of tape";
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
