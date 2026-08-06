(() => {
  const DATA_URL = "data/projects.json";
  const SLIDE_MS = 7000;
  const GLITCH_MS = 720;

  const bgStage = document.getElementById("bg-stage");
  const noiseEl = document.getElementById("bg-noise");
  const rgbEl = document.getElementById("rgb-split");
  const socialsEl = document.getElementById("socials");
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const navButtons = document.querySelectorAll("[data-modal]");

  let data = null;
  let layers = [];
  let currentIndex = 0;
  let timerId = null;
  let transitioning = false;
  let modalOpen = false;
  let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  }

  function openModal(kind) {
    if (!modal || !data) return;
    const titles = { about: "About", games: "Games", music: "Music" };
    modalTitle.textContent = titles[kind] || "Portfolio";
    modalBody.innerHTML = renderModalBody(kind);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    modalOpen = true;
    modalClose?.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    modalOpen = false;
  }

  function renderModalBody(kind) {
    if (kind === "about") {
      const about = data.about || {};
      return `
        <div class="about-stack">
          <section class="about-block">
            <h3>One <span class="accent">Flow</span> Man</h3>
            <p>${escapeHtml(about.oneFlowMan || "")}</p>
          </section>
          <section class="about-block">
            <h3>Treestyle Studios</h3>
            <p>${escapeHtml(about.treestyleStudios || "")}</p>
          </section>
        </div>
      `;
    }

    const items = sortByDateDesc(kind === "games" ? data.games : data.music);
    if (!items.length) {
      return `<p class="empty-state">No projects yet.</p>`;
    }

    return `<div class="project-grid">${items.map(projectTile).join("")}</div>`;
  }

  function sortByDateDesc(list) {
    return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
      const da = Date.parse(a.date || "") || 0;
      const db = Date.parse(b.date || "") || 0;
      return db - da;
    });
  }

  function projectTile(item) {
    return `
      <a class="project-tile" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">
        <div class="project-media">
          <img src="${escapeAttr(item.image)}" alt="${escapeAttr(item.title)}" loading="lazy" />
        </div>
        <h3 class="project-title">${escapeHtml(item.title)}</h3>
      </a>
    `;
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
