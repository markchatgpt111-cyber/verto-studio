(() => {
  "use strict";
  const body = document.body;
  const header = document.querySelector("[data-header]");
  const menu = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-navigation]");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-year]").forEach((node) => { node.textContent = String(new Date().getFullYear()); });
  const closeMenu = () => { if (!menu || !nav) return; nav.classList.remove("is-open"); nav.inert = window.innerWidth <= 900; body.classList.remove("menu-open"); menu.setAttribute("aria-expanded", "false"); menu.setAttribute("aria-label", "Открыть меню"); };
  if (nav) nav.inert = window.innerWidth <= 900;
  menu?.addEventListener("click", () => { const open = !nav.classList.contains("is-open"); nav.inert = !open; nav.classList.toggle("is-open", open); body.classList.toggle("menu-open", open); menu.setAttribute("aria-expanded", String(open)); menu.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню"); });
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && nav?.classList.contains("is-open")) { closeMenu(); menu?.focus(); } });
  window.addEventListener("resize", () => { if (window.innerWidth > 900) closeMenu(); else if (nav && !nav.classList.contains("is-open")) nav.inert = true; }, { passive: true });
  const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 10);
  updateHeader(); window.addEventListener("scroll", updateHeader, { passive: true });
  const rocket = document.querySelector("[data-rocket-stage]");
  const routeSections = [...document.querySelectorAll("section")];
  let ticking = false;
  const moveRocket = () => {
    if (!rocket || reduced) return;
    const progress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)));
    const angle = 34 + progress * 68;
    const drift = Math.sin(progress * Math.PI * 3) * 22;
    rocket.style.transform = `translate3d(${drift}px, ${progress * 320}px, 0) rotate(${angle}deg)`;
  };
  window.addEventListener("scroll", () => { if (!ticking) { window.requestAnimationFrame(() => { moveRocket(); ticking = false; }); ticking = true; } }, { passive: true });
  moveRocket();
  if (!reduced && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add("is-visible"); }), { threshold: 0.08 });
    routeSections.forEach((section) => observer.observe(section));
  }
})();
