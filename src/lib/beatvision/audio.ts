/**
 * Client-side audio helpers for BeatVision.
 * - Validate formats and 25 MB limit (product bible)
 * - Extract real duration via HTMLAudioElement (not fabricated)
 * - Persist the File/Blob in IndexedDB keyed by project id so the same
 *   browser can re-attach audio after refresh. Server stores metadata only
 *   (name + duration_sec). Cross-device binary storage is a later phase.
 */

export const AUDIO_MAX_BYTES = 25 * 1024 * 1024;

export const AUDIO_ACCEPT =
  "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/aac,audio/flac,audio/x-flac,.mp3,.wav,.m4a,.aac,.flac";

const ALLOWED_EXT = new Set([
  "mp3",
  "wav",
  "m4a",
  "aac",
  "flac",
]);

const ALLOWED_MIME_PREFIX = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
];

export type AudioValidation =
  | { ok: true; file: File }
  | { ok: false; error: string };

export function validateAudioFile(file: File): AudioValidation {
  if (file.size > AUDIO_MAX_BYTES) {
    return {
      ok: false,
      error: `File is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Limit is 25 MB.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, error: "File is empty." };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeOk =
    !file.type ||
    ALLOWED_MIME_PREFIX.some(
      (p) => file.type === p || file.type.startsWith(p + ";")
    );
  const extOk = ALLOWED_EXT.has(ext);

  if (!mimeOk && !extOk) {
    return {
      ok: false,
      error: "Unsupported format. Use MP3, WAV, M4A, AAC, or FLAC.",
    };
  }

  return { ok: true, file };
}

/**
 * Read real media duration in seconds.
 * Rejects if the browser cannot decode the file or duration is invalid.
 */
export function extractAudioDurationSec(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
      audio.load();
    };

    audio.onloadedmetadata = () => {
      const d = audio.duration;
      cleanup();
      if (!Number.isFinite(d) || d <= 0) {
        reject(new Error("Could not read a valid duration from this file."));
        return;
      }
      resolve(d);
    };

    audio.onerror = () => {
      cleanup();
      reject(
        new Error(
          "Browser could not decode this audio file. Try MP3 or WAV."
        )
      );
    };

    audio.src = url;
  });
}

const IDB_NAME = "beatvision-audio";
const IDB_STORE = "blobs";
const IDB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

export type StoredAudioMeta = {
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  durationSec: number;
  storedAt: number;
};

/** Store audio blob for a project (same browser only). */
export async function storeProjectAudio(
  projectId: string,
  file: File,
  durationSec: number
): Promise<void> {
  const db = await openDb();
  const meta: StoredAudioMeta = {
    projectId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    durationSec,
    storedAt: Date.now(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({ meta, blob: file }, projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
  db.close();
}

export async function loadProjectAudio(
  projectId: string
): Promise<{ meta: StoredAudioMeta; blob: Blob } | null> {
  const db = await openDb();
  const row = await new Promise<{ meta: StoredAudioMeta; blob: Blob } | null>(
    (resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(projectId);
      req.onsuccess = () => {
        const v = req.result as { meta: StoredAudioMeta; blob: Blob } | undefined;
        resolve(v ?? null);
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB read failed"));
    }
  );
  db.close();
  return row;
}

export async function clearProjectAudio(projectId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
  });
  db.close();
}
