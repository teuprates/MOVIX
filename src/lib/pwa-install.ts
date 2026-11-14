"use client";
import { useSyncExternalStore } from "react";

/**
 * Estado global de instalação do PWA.
 *
 * O evento `beforeinstallprompt` pode disparar antes de qualquer componente montar, então o listener é
 * registrado quando este módulo é avaliado (ele é importado pelo `ServiceWorkerRegister`, presente em todas
 * as páginas). O evento é guardado e reutilizado quando o usuário toca em "Instalar aplicativo".
 */

type InstallOutcome = "accepted" | "dismissed";
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
}

export type InstallPlatform = "ios" | "android" | "desktop";
export type InstallState = {
  /** true depois da hidratação — antes disso não sabemos nada sobre o navegador. */
  ready: boolean;
  platform: InstallPlatform;
  /** Abrindo como app instalado (standalone) ou instalação concluída nesta sessão. */
  installed: boolean;
  /** O navegador liberou o diálogo nativo de instalação. */
  canPrompt: boolean;
  /** iPhone/iPad fora do Safari (Chrome, Firefox… no iOS). */
  iosNonSafari: boolean;
};

const SERVER_STATE: InstallState = { ready: false, platform: "desktop", installed: false, canPrompt: false, iosNonSafari: false };

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
let snapshot: InstallState = SERVER_STATE;
const listeners = new Set<() => void>();

function detect(): InstallState {
  const ua = navigator.userAgent;
  // iPadOS 13+ se identifica como Mac; o toque denuncia.
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    ready: true,
    platform: ios ? "ios" : android ? "android" : "desktop",
    installed: standalone || installedNow,
    canPrompt: !!deferred,
    iosNonSafari: ios && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua),
  };
}

function emit() {
  const next = detect();
  if (
    next.platform !== snapshot.platform ||
    next.installed !== snapshot.installed ||
    next.canPrompt !== snapshot.canPrompt ||
    next.iosNonSafari !== snapshot.iosNonSafari ||
    !snapshot.ready
  ) {
    snapshot = next;
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Na landing o botão "Instalar aplicativo" assume o convite; nas demais páginas o Chrome mantém a
    // própria mini-barra de instalação. Em ambos os casos o evento fica guardado para `promptPwaInstall`.
    if (window.location.pathname === "/") e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!snapshot.ready) queueMicrotask(emit);
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", emit);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", emit);
  };
}

export function usePwaInstall() {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER_STATE);
}

/** Abre o diálogo nativo. Retorna `null` quando o navegador não liberou o prompt. */
export async function promptPwaInstall(): Promise<InstallOutcome | null> {
  const ev = deferred;
  if (!ev) return null;
  // O evento só pode ser usado uma vez.
  deferred = null;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  if (outcome === "accepted") installedNow = true;
  emit();
  return outcome;
}
