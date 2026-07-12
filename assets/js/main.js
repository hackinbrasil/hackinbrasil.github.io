// --- Accessible modal management -------------------------------------------
// Scripts (and the handlers below) open/close a modal by toggling the `.open`
// class. A MutationObserver reacts to that single source of truth and applies
// the accessibility behavior — aria-hidden, dialog roles, focus move, focus
// trap and focus restore — so every `.modal` on the site is handled the same
// way without each page having to wire it up.

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Remembers the element focused before each modal opened, so focus can be
// returned there on close.
const modalReturnFocus = new WeakMap();

function getVisibleFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    el => el.offsetParent !== null || el === document.activeElement
  );
}

function closeModal(modal) {
  // Toggling the class triggers the observer, which runs applyModalClosed().
  modal.classList.remove("open");
}

function applyModalOpen(modal) {
  modal.setAttribute("aria-hidden", "false");
  modalReturnFocus.set(modal, document.activeElement);

  const content = modal.querySelector(".modal-content");
  if (!content) return;

  content.setAttribute("role", "dialog");
  content.setAttribute("aria-modal", "true");
  if (!content.hasAttribute("tabindex")) content.setAttribute("tabindex", "-1");

  // Label the dialog with its heading so screen readers announce it on focus.
  if (!content.hasAttribute("aria-labelledby")) {
    const heading = content.querySelector("[id]");
    if (heading && heading.id) content.setAttribute("aria-labelledby", heading.id);
  }

  // Describe the dialog with its message body when present.
  if (!content.hasAttribute("aria-describedby")) {
    const desc = content.querySelector('[id$="-message"], [id$="-description"]');
    if (desc && desc.id) content.setAttribute("aria-describedby", desc.id);
  }

  // Move focus into the dialog (the container itself, so its label is read).
  content.focus();
}

function applyModalClosed(modal) {
  modal.setAttribute("aria-hidden", "true");
  const previous = modalReturnFocus.get(modal);
  modalReturnFocus.delete(modal);
  if (previous && typeof previous.focus === "function" && document.contains(previous)) {
    previous.focus();
  }
}

document.querySelectorAll(".modal").forEach(modal => {
  const syncModalState = () => {
    const isOpen = modal.classList.contains("open");
    const wasOpen = modal.getAttribute("aria-hidden") === "false";
    if (isOpen && !wasOpen) applyModalOpen(modal);
    else if (!isOpen && wasOpen) applyModalClosed(modal);
  };

  new MutationObserver(syncModalState).observe(modal, {
    attributes: true,
    attributeFilter: ["class"]
  });

  // Handle a modal already opened before this script ran (e.g. a load-time
  // configuration error surfaced by a page script).
  if (modal.classList.contains("open")) applyModalOpen(modal);

  // Close on backdrop click.
  modal.addEventListener("click", e => {
    if (e.target === modal) closeModal(modal);
  });
});

// Close buttons (the ✕).
document.querySelectorAll("[data-close]").forEach(btn =>
  btn.addEventListener("click", () => {
    const modal = btn.closest(".modal");
    if (modal) closeModal(modal);
  })
);

// ESC to close, and Tab focus trap within the open modal.
document.addEventListener("keydown", e => {
  const openModal = document.querySelector(".modal.open");
  if (!openModal) return;

  if (e.key === "Escape") {
    e.preventDefault();
    closeModal(openModal);
    return;
  }

  if (e.key !== "Tab") return;

  const content = openModal.querySelector(".modal-content");
  if (!content) return;

  const focusable = getVisibleFocusable(content);
  if (focusable.length === 0) {
    e.preventDefault();
    content.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  // Keep Tab within the dialog. `content` itself is focusable (tabindex -1) but
  // not in the tab order, so wrap when leaving either end or when focus is on
  // the container.
  if (e.shiftKey && (active === first || active === content)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
});
