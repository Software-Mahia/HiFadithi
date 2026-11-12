import { Platform } from "react-native";

import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";

// On web the app is served same-origin with the API, so default to the current
// origin: one web build then works on localhost and the deployed host with no
// baked-in URL. EXPO_PUBLIC_API_URL still overrides (e.g. a split web/API host).
const webOrigin =
  Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : "";

/** The host Metro is served from, e.g. "192.168.2.112:8081" on a phone, or
 * "127.0.0.1:8081" in a simulator. When Metro runs over a LAN, that host is
 * also the laptop running a local API, so following it keeps the app working
 * when DHCP hands out a new address. Under `expo start --tunnel` it is a public
 * tunnel domain instead, which serves only the bundle — never treat that as the
 * API host, or every request fails with "failed to connect to …". */
const metroHost = (Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? "")
  .split(":")[0];

const isPrivateHost = (host: string) =>
  /^(localhost$|127\.|10\.0\.2\.2$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);

const devApiHost = isPrivateHost(metroHost) ? `http://${metroHost}:8000` : "";

// Precedence: on native, a LAN Metro host means the API is on the same machine,
// so it wins over a possibly stale local .env. With a tunnel (or no Metro host)
// EXPO_PUBLIC_API_URL decides — that is the hosted API. Release builds have no
// Metro host at all and always use the baked EXPO_PUBLIC_API_URL.
const configuredHost =
  Platform.OS === "web" ? process.env.EXPO_PUBLIC_API_URL || "" : devApiHost || process.env.EXPO_PUBLIC_API_URL || "";

const fallbackHost =
  webOrigin || (Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://127.0.0.1:8000");

export const API_URL = (configuredHost || fallbackHost).replace(/\/$/, "");

/** On web, photo URIs are blob:/data: URLs that must become real Blobs before
 * they can be attached to requests. The `{uri…}` FormData form is native-only. */
async function toBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

let authToken: string | null = null;

/** Stable, cacheable model stream. Signed bucket URLs change per request and
 * bust the WebView/browser cache; this endpoint keeps its identity across
 * loads so repeat views come from cache. Guests can stream only preview
 * artefacts; the WebView sends no bearer token, so staff screens use the
 * signed `model3d.glb_url` instead. */
export function publicModelUrl(id: string) {
  return `${API_URL}/api/public/artefacts/${id}/model/`;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "error") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  formData?: FormData;
};

function messageFrom(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { message?: unknown } }).error;
    const message = error?.message;
    if (typeof message === "string") return message;
    if (message) return JSON.stringify(message);
  }
  return "Something went wrong. Please try again.";
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = options.token === undefined ? authToken : options.token;
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || (body ? "POST" : "GET"),
    headers,
    body,
  });

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(messageFrom(data), response.status, "request_failed");
  }
  return data as T;
}

export type Role = "researcher" | "curator" | "admin";

export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: Role;
  department: string;
};

export type ArtefactStatus = "draft" | "processing" | "ready" | "published" | "failed";

export type ArtefactImage = {
  slot: "front" | "back" | "left" | "right";
  content_type: string;
  size_bytes: number | null;
  order: number;
  url: string;
};

export type Model3D = {
  glb_url: string;
  scale_factor: number;
  size_bytes: number | null;
  triangles: number | null;
  created_at: string;
};

export type Narration = {
  story_text: string;
  language: "en" | "sw";
  voice: string;
  status: "none" | "generating" | "ready" | "failed";
  status_label?: string;
  error: string;
  audio_url: string | null;
  updated_at: string;
};

export type Artefact = {
  id: string;
  /** Lightweight flags from the list payloads (cards show feature tags). */
  has_model3d?: boolean;
  narration_ready?: boolean;
  accession_number: string;
  name: string;
  description: string;
  material: string;
  dimensions: string;
  height_mm: string | null;
  width_mm: string | null;
  depth_mm: string | null;
  date_or_period: string;
  provenance: string;
  donor: string;
  location: string;
  status: ArtefactStatus;
  status_label: string;
  cover_image_url: string | null;
  images?: ArtefactImage[];
  model3d?: Model3D | null;
  narration?: Narration | null;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type Job = {
  id: string;
  artefact_id: string;
  engine: string;
  status: "queued" | "running" | "succeeded" | "failed";
  status_label: string;
  progress: number;
  error: string;
  attempts: number;
  credits_used: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type AuthResponse = { access: string; refresh: string };

export type ArtifactDraft = {
  accession_number: string;
  name: string;
  description?: string;
  material?: string;
  dimensions?: string;
  height_mm?: string | null;
  width_mm?: string | null;
  depth_mm?: string | null;
  date_or_period?: string;
  provenance?: string;
  donor?: string;
  location?: string;
};

export async function login(username: string, password: string) {
  return request<AuthResponse>("/api/auth/token/", {
    body: { username, password },
    token: null,
  });
}

/** Preview an invite link (who it is for) before showing the set-password form. */
export async function invitePreview(uid: string, token: string) {
  return request<{ email: string; full_name: string }>(
    `/api/accounts/invite/accept/?uid=${encodeURIComponent(uid)}&token=${encodeURIComponent(token)}`,
    { method: "GET", token: null },
  );
}

/** Set the invited user's first password from an invite link, so they can sign in. */
export async function acceptInvite(uid: string, token: string, password: string) {
  return request<{ profile_id: number }>("/api/accounts/invite/accept/", {
    method: "POST",
    body: { uid, token, password },
    token: null,
  });
}

export function me(token?: string | null) {
  return request<User>("/api/accounts/me/", { token });
}

/** Guest overview card: the server returns at most two, with no private fields. */
export type ArtefactPreview = Pick<Artefact, "id" | "name" | "material" | "cover_image_url" | "has_model3d">;

/** The capped public preview (at most two artefacts). The only list a guest can read. */
export function listPreviewArtefacts() {
  return request<ArtefactPreview[]>("/api/public/artefacts/preview/", { token: null });
}

/** Published gallery. Staff only: sends the signed-in token (401/403 for guests). */
export function listPublicArtefacts(query = "") {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  return request<Artefact[]>(`/api/public/artefacts/${suffix}`);
}

/** One published artefact. Guests get preview artefacts only; staff any they may see. */
export function getPublicArtefact(id: string) {
  return request<Artefact>(`/api/public/artefacts/${id}/`);
}

export function listArtefacts(query = "", status = "") {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request<{ count: number; results: Artefact[] } | Artefact[]>(
    `/api/artefacts/${suffix}`
  ).then((json) => (Array.isArray(json) ? json : (json?.results ?? [])));
}

export function getArtefact(id: string) {
  return request<Artefact>(`/api/artefacts/${id}/`);
}

export function createArtefact(draft: ArtifactDraft) {
  return request<Artefact>("/api/artefacts/", { body: draft });
}

export function updateArtefact(id: string, draft: Partial<ArtifactDraft>) {
  return request<Artefact>(`/api/artefacts/${id}/`, { method: "PATCH", body: draft });
}

export function deleteArtefact(id: string) {
  return request<void>(`/api/artefacts/${id}/`, { method: "DELETE" });
}

export function publishArtefact(id: string) {
  return request<{ id: string; status: ArtefactStatus }>(`/api/artefacts/${id}/publish/`, {
    method: "POST",
  });
}

export function unpublishArtefact(id: string) {
  return request<{ id: string; status: ArtefactStatus }>(`/api/artefacts/${id}/unpublish/`, {
    method: "POST",
  });
}

export type PhotoFile = { uri: string; name: string; type: string };

/** Native-only multipart upload through the legacy FileSystem API. Expo's new
 * fetch refuses `{uri…}` FormData parts ("Unsupported FormDataPart
 * implementation"), so native file parts are sent around fetch entirely;
 * the browser keeps using DOM FormData + Blob. */
async function nativeUploadMultipart<T>(
  path: string,
  fieldName: string,
  file: PhotoFile,
  fields: Record<string, string> = {},
): Promise<T> {
  const result = await FileSystem.uploadAsync(`${API_URL}${path}`, file.uri, {
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName,
    mimeType: file.type,
    parameters: fields,
    headers: {
      Accept: "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  const text = result.body || "";
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (result.status >= 400) {
    throw new ApiError(messageFrom(data), result.status, "upload_failed");
  }
  return data as T;
}

type PresignResponse = {
  slot: string;
  strategy: "direct" | "presigned";
  path: string;
  upload_url: string | null;
  method: "PUT" | "POST";
  headers: Record<string, string>;
};

export async function uploadPhoto(artefactId: string, slot: string, file: PhotoFile) {
  const presign = await request<PresignResponse>(`/api/artefacts/${artefactId}/images/presign/`, {
    body: { slot, content_type: file.type },
  });

  if (presign.strategy === "presigned" && presign.upload_url) {
    if (Platform.OS === "web") {
      // Browser fetch handles the binary PUT directly; uploadAsync is native-only.
      const blob = await toBlob(file.uri);
      const response = await fetch(presign.upload_url, {
        method: presign.method === "POST" ? "POST" : "PUT",
        headers: presign.headers,
        body: blob,
      });
      if (!response.ok) {
        throw new ApiError(`Upload failed (${response.status}).`, response.status, "upload_failed");
      }
    } else {
      await FileSystem.uploadAsync(presign.upload_url, file.uri, {
        httpMethod: presign.method === "POST" ? "POST" : "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: presign.headers,
      });
    }
    return request<ArtefactImage>(`/api/artefacts/${artefactId}/images/confirm/`, {
      body: {
        slot,
        path: presign.path,
        content_type: file.type,
      },
    });
  }

  if (Platform.OS === "web") {
    const form = new FormData();
    form.append("slot", slot);
    form.append("file", await toBlob(file.uri), file.name);
    return request<ArtefactImage>(`/api/artefacts/${artefactId}/images/`, {
      formData: form,
    });
  }
  return nativeUploadMultipart<ArtefactImage>(`/api/artefacts/${artefactId}/images/`, "file", file, {
    slot,
  });
}

export function generate3D(id: string) {
  return request<Job>(`/api/artefacts/${id}/generate-3d/`, { method: "POST" });
}

export function getJob(id: string) {
  return request<Job>(`/api/jobs/${id}/`);
}

export function listJobs(id: string) {
  return request<Job[]>(`/api/artefacts/${id}/jobs/`);
}

export function getNarration(id: string) {
  return request<Narration>(`/api/artefacts/${id}/narration/`);
}

export function saveNarration(id: string, storyText: string, language: "en" | "sw") {
  return request<Narration>(`/api/artefacts/${id}/narration/`, {
    method: "PUT",
    body: { story_text: storyText, language },
  });
}

export type OCRResult = {
  fields: {
    accession_number: string;
    name: string;
    material: string;
    dimensions: string;
    date_or_period: string;
    provenance: string;
    donor: string;
    location: string;
    description: string;
  };
  raw_text: string;
  confidence: number;
};

export async function scanCard(file: PhotoFile) {
  if (Platform.OS !== "web") {
    return nativeUploadMultipart<OCRResult>("/api/ocr/", "image", file);
  }
  const form = new FormData();
  form.append("image", await toBlob(file.uri), file.name);
  return request<OCRResult>("/api/ocr/", { formData: form });
}
