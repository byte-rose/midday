// Desktop-only exports - only available in Tauri runtime
// These are lazy-loaded to prevent build errors in web environments

export function invoke(command: string, args?: any): Promise<any> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    throw new Error("invoke is only available in Tauri desktop environment");
  }
  return import("@tauri-apps/api/core").then((m) => m.invoke(command, args));
}

export async function getCurrentWindow(): Promise<any> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    throw new Error("getCurrentWindow is only available in Tauri desktop environment");
  }
  const m = await import("@tauri-apps/api/window");
  return m.getCurrentWindow();
}

export const Window = { label: "" };

export async function openUrl(url: string): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    // Fallback to window.open for web
    window.open(url, "_blank");
    return;
  }
  const m = await import("@tauri-apps/plugin-opener");
  return m.openUrl(url);
}

export async function listen(event: string, handler: (e: any) => void): Promise<() => void> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    throw new Error("listen is only available in Tauri desktop environment");
  }
  const m = await import("@tauri-apps/api/event");
  return m.listen(event, handler);
}

export async function emit(event: string, payload?: any): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI__" in window)) {
    throw new Error("emit is only available in Tauri desktop environment");
  }
  const m = await import("@tauri-apps/api/event");
  return m.emit(event, payload);
}
