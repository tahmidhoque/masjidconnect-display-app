/**
 * Resolves `jamaatInProgressMode: content` + `jamaatInProgressContentId`
 * to a library media asset already on the device (playlist / schedule).
 *
 * Portal persists only the content id. Image, video, and poster (PDF) items
 * render during jamaat-in-progress; anything else (or a missing id) falls
 * back to the default in-progress screen.
 */

import type { DisplaySettings, Schedule, ScheduledPlaylistAssignment } from "@/api/models";
import { resolveMediaFit, type MediaFit } from "@/utils/mediaSlide";

export type JamaatInProgressMediaKind = "image" | "video" | "pdf";

export interface JamaatInProgressMedia {
  kind: JamaatInProgressMediaKind;
  url: string;
  title?: string;
  fit: MediaFit;
  muted: boolean;
}

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const VIDEO_MIME = new Set(["video/mp4", "video/webm"]);

function optTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

/** True when a schedule/playlist row is the library item the portal selected. */
export function itemMatchesContentId(item: unknown, contentId: string): boolean {
  const rec = asRecord(item);
  if (!rec) return false;
  const nested = asRecord(rec.contentItem);
  const candidates = [
    rec.id,
    rec.contentItemId,
    rec.contentId,
    nested?.id,
  ];
  return candidates.some((c) => typeof c === "string" && c === contentId);
}

/**
 * Pull image/video/poster media from a schedule-shaped item.
 * Returns null when the row is not renderable library media.
 */
export function extractJamaatInProgressMedia(
  item: unknown,
): JamaatInProgressMedia | null {
  const rec = asRecord(item);
  if (!rec) return null;
  const nested = asRecord(rec.contentItem);
  const content = asRecord(rec.content) ?? asRecord(nested?.content) ?? {};
  const typeRaw = rec.type ?? nested?.type;
  const type =
    typeof typeRaw === "string" ? typeRaw.trim().toUpperCase() : "";
  const title =
    optTrimmedString(rec.title) ?? optTrimmedString(nested?.title);
  const mimeType = optTrimmedString(content.mimeType) ?? "";
  const fit = resolveMediaFit(content);
  const muted = content.muted !== false;

  if (type === "VIDEO") {
    const videoUrl = optTrimmedString(content.videoUrl);
    if (!videoUrl || !VIDEO_MIME.has(mimeType)) return null;
    return { kind: "video", url: videoUrl, title, fit, muted };
  }

  if (type === "MEDIA_SLIDE") {
    const mediaUrl = optTrimmedString(content.mediaUrl);
    if (!mediaUrl) return null;
    if (mimeType === "application/pdf") {
      return { kind: "pdf", url: mediaUrl, title, fit, muted: true };
    }
    if (!IMAGE_MIME.has(mimeType)) return null;
    return { kind: "image", url: mediaUrl, title, fit, muted: true };
  }

  return null;
}

function collectLibraryItems(args: {
  schedule?: Schedule | null;
  playlists?: ScheduledPlaylistAssignment[] | null;
  screenContent?: unknown;
}): unknown[] {
  const items: unknown[] = [];
  const pushAll = (rows: unknown) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (row) items.push(row);
    }
  };

  pushAll(args.schedule?.items);
  if (Array.isArray(args.playlists)) {
    for (const assignment of args.playlists) {
      pushAll(assignment?.schedule?.items);
    }
  }

  const screen = asRecord(args.screenContent);
  const nested = asRecord(screen?.data);
  const rawSchedule = asRecord(screen?.schedule) ?? asRecord(nested?.schedule);
  pushAll(rawSchedule?.items);
  if (Array.isArray(screen?.schedule)) pushAll(screen.schedule);

  return items;
}

export interface ResolveJamaatInProgressMediaArgs {
  settings: DisplaySettings | null | undefined;
  schedule?: Schedule | null;
  playlists?: ScheduledPlaylistAssignment[] | null;
  screenContent?: unknown;
}

/**
 * Resolve library media for jamaat content mode.
 * Missing mode/id/item, or a non-media type, returns null (caller uses screen).
 */
export function resolveJamaatInProgressMedia(
  args: ResolveJamaatInProgressMediaArgs,
): JamaatInProgressMedia | null {
  const settings = args.settings;
  if (settings?.jamaatInProgressMode !== "content") return null;
  const contentId = optTrimmedString(settings.jamaatInProgressContentId);
  if (!contentId) return null;

  const library = collectLibraryItems(args);
  const match = library.find((item) => itemMatchesContentId(item, contentId));
  if (!match) return null;
  return extractJamaatInProgressMedia(match);
}
