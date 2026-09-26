"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Tiny external store: navigations and in-flight API calls each hold "busy"
// until they finish, and the bar shows while anything is busy.
let navigating = false;
let inflight = 0;
let visible = false;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let failsafe: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const SHOW_DELAY_MS = 120; // skip the bar for instant responses
const FAILSAFE_MS = 20_000;

function emit(next: boolean) {
  if (visible === next) return;
  visible = next;
  listeners.forEach((l) => l());
}

function update() {
  const busy = navigating || inflight > 0;
  if (busy) {
    if (!showTimer && !visible) showTimer = setTimeout(() => emit(true), SHOW_DELAY_MS);
    clearTimeout(failsafe);
    failsafe = setTimeout(() => {
      navigating = false;
      inflight = 0;
      update();
    }, FAILSAFE_MS);
  } else {
    clearTimeout(showTimer);
    clearTimeout(failsafe);
    showTimer = undefined;
    emit(false);
  }
}

function startNavigation() {
  navigating = true;
  update();
}
function endNavigation() {
  if (!navigating) return;
  navigating = false;
  update();
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;

  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      startNavigation();
    },
    true
  );

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(raw, location.href).pathname;
    const track = path.startsWith("/api/") && !path.startsWith("/api/auth/session");
    if (!track) return originalFetch(input, init);
    inflight += 1;
    update();
    try {
      return await originalFetch(input, init);
    } finally {
      inflight = Math.max(0, inflight - 1);
      update();
    }
  };
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function ProgressBar() {
  const show = useSyncExternalStore(subscribe, () => visible, () => false);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    install();
  }, []);

  // A finished navigation (new path or query) ends the busy state.
  useEffect(() => {
    endNavigation();
  }, [pathname, search]);

  if (!show) return null;
  return (
    <div
      role="progressbar"
      aria-busy="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-primary/20"
    >
      <div className="h-full w-1/3 bg-primary" style={{ animation: "progress-slide 1.1s ease-in-out infinite" }} />
    </div>
  );
}
