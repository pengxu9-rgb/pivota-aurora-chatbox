type SlotId = 'daylight' | 'indoor_white';

const SLOT_PRIORITY: SlotId[] = ['daylight', 'indoor_white'];
const FACE_CROP_RENDERABLE_KEYS = [
  'crop_image_url',
  'original_image_url',
  'face_crop_url',
  'source_image_url',
  'image_url',
  'src',
] as const;

export type PhotoModulesFallbackPhotoRef =
  | {
      slot_id?: unknown;
      photo_id?: unknown;
    }
  | null
  | undefined;

export type PhotoModulesFallbackSessionPhotos =
  | {
      daylight?: { preview?: unknown } | null;
      indoor_white?: { preview?: unknown } | null;
    }
  | null
  | undefined;

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const isSlotId = (value: string): value is SlotId => value === 'daylight' || value === 'indoor_white';

const hasRenderableFaceCropImage = (faceCrop: Record<string, unknown>): boolean => {
  return FACE_CROP_RENDERABLE_KEYS.some((key) => asString(faceCrop[key]));
};

const getPreviewBySlot = (sessionPhotos: PhotoModulesFallbackSessionPhotos, slot: string): string => {
  if (!isSlotId(slot)) return '';
  const bucket = asObject(sessionPhotos || null);
  if (!bucket) return '';
  const entry = asObject(bucket[slot]);
  if (!entry) return '';
  return asString(entry.preview);
};

const matchSlotByPhotoId = (
  photoId: string,
  analysisPhotoRefs: PhotoModulesFallbackPhotoRef[] | null | undefined,
): string => {
  if (!photoId || !Array.isArray(analysisPhotoRefs)) return '';
  const matched = analysisPhotoRefs.find((ref) => {
    const refObj = asObject(ref);
    if (!refObj) return false;
    return asString(refObj.photo_id) === photoId;
  });
  const matchedObj = asObject(matched);
  if (!matchedObj) return '';
  return asString(matchedObj.slot_id);
};

export function enrichPhotoModulesPayloadWithSessionPreview(
  payload: unknown,
  analysisPhotoRefs?: PhotoModulesFallbackPhotoRef[] | null,
  sessionPhotos?: PhotoModulesFallbackSessionPhotos,
): unknown {
  const payloadObj = asObject(payload);
  if (!payloadObj) return payload;

  const faceCropObj = asObject(payloadObj.face_crop);
  if (!faceCropObj) return payload;
  if (hasRenderableFaceCropImage(faceCropObj)) return payload;

  const photoIdHint = asString(faceCropObj.photo_id);
  const slotHint = asString(faceCropObj.slot_id);
  const matchedSlotByPhotoId = matchSlotByPhotoId(photoIdHint, analysisPhotoRefs);

  const slotCandidates = [slotHint, matchedSlotByPhotoId, ...SLOT_PRIORITY];
  const seen = new Set<string>();
  let fallbackPreview = '';

  for (const slot of slotCandidates) {
    if (!slot || seen.has(slot)) continue;
    seen.add(slot);
    const preview = getPreviewBySlot(sessionPhotos, slot);
    if (preview) {
      fallbackPreview = preview;
      break;
    }
  }

  if (!fallbackPreview) return payload;

  return {
    ...payloadObj,
    face_crop: {
      ...faceCropObj,
      original_image_url: fallbackPreview,
    },
  };
}
