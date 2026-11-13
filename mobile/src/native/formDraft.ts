/** Autosaved artefact-form drafts, native app only.
 *
 * Whatever a researcher types into the artefact form is written to the phone as
 * they go, so an error, a crash, leaving the screen, or the scan screen
 * reopening the form never makes them type it all again. A draft is removed once
 * the record saves successfully.
 *
 * Stored under documentDirectory/form-drafts/ (private to the app). Photos picked
 * for a new artefact are copied there too: the image picker's cache files can be
 * deleted by the OS before the researcher comes back.
 */
import * as FileSystem from "expo-file-system/legacy";

import type { PhotoFile } from "../api";

export type FormDraft = {
  form: Record<string, string>;
  story: string;
  language: "en" | "sw";
  heightMm: string;
  pending: Record<string, PhotoFile>;
  /** Set when a new artefact was already created on the server. */
  createdId: string | null;
  savedAt: number;
};

const DIR = `${FileSystem.documentDirectory ?? ""}form-drafts/`;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function safe(key: string) {
  return key.replace(/[^A-Za-z0-9_-]/g, "_");
}

function draftFile(key: string) {
  return `${DIR}${safe(key)}.json`;
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

async function exists(uri: string) {
  try {
    return (await FileSystem.getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

export async function loadDraft(key: string): Promise<FormDraft | null> {
  if (!FileSystem.documentDirectory) return null;
  try {
    const file = draftFile(key);
    if (!(await exists(file))) return null;
    const draft = JSON.parse(await FileSystem.readAsStringAsync(file)) as FormDraft;
    if (!draft || Date.now() - (draft.savedAt || 0) > MAX_AGE_MS) {
      await clearDraft(key);
      return null;
    }
    // Drop photos whose files are gone; the researcher re-adds just those.
    const pending: Record<string, PhotoFile> = {};
    for (const [slot, photo] of Object.entries(draft.pending || {})) {
      if (photo?.uri && (await exists(photo.uri))) pending[slot] = photo;
    }
    return { ...draft, pending };
  } catch {
    return null; // a broken draft must never block the form
  }
}

export async function saveDraft(key: string, draft: Omit<FormDraft, "savedAt">) {
  if (!FileSystem.documentDirectory) return;
  try {
    await ensureDir();
    await FileSystem.writeAsStringAsync(draftFile(key), JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // best effort: never interrupt the researcher over a draft write
  }
}

/** Copy a picked photo into the draft folder so it survives cache clean-up. */
export async function keepPhoto(key: string, slot: string, photo: PhotoFile): Promise<PhotoFile> {
  if (!FileSystem.documentDirectory) return photo;
  try {
    await ensureDir();
    const extension = photo.name.split(".").pop() || "jpg";
    const target = `${DIR}${safe(key)}.photo-${slot}-${Date.now()}.${extension}`;
    await FileSystem.copyAsync({ from: photo.uri, to: target });
    return { ...photo, uri: target };
  } catch {
    return photo;
  }
}

export async function clearDraft(key: string) {
  if (!FileSystem.documentDirectory) return;
  try {
    const prefix = safe(key);
    const names = (await exists(DIR)) ? await FileSystem.readDirectoryAsync(DIR) : [];
    await Promise.all(
      names
        .filter((name) => name === `${prefix}.json` || name.startsWith(`${prefix}.photo-`))
        .map((name) => FileSystem.deleteAsync(`${DIR}${name}`, { idempotent: true })),
    );
  } catch {
    // ignore
  }
}
