import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Language, PhotoSlot } from '@/lib/types';
import { t } from '@/lib/i18n';
import {
  Camera,
  X,
  Sun,
  Lightbulb,
  ScanFace,
  Upload,
  AlertTriangle,
  CheckCircle2,
  TriangleAlert,
} from 'lucide-react';
import { PromptFooter, PromptHeader } from '@/components/prompt';

interface PhotoUploadCardProps {
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
  uploading?: boolean;
}

export function PhotoUploadCard({ onAction, language, uploading = false }: PhotoUploadCardProps) {
  type SlotId = 'daylight' | 'indoor_white';
  type FrameCheck = NonNullable<PhotoSlot['frameCheck']>;
  type FrameIssue = FrameCheck['issues'][number];
  type FrameLevel = FrameCheck['level'];
  type PhotoStep = 'selection' | 'consent';

  const SLOT_IDS: SlotId[] = ['daylight', 'indoor_white'];

  const [photos, setPhotos] = useState<Record<SlotId, { file: File; preview: string; frameCheck: FrameCheck } | undefined>>({
    daylight: undefined,
    indoor_white: undefined,
  });
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<PhotoStep>('selection');

  const daylightInputRef = useRef<HTMLInputElement>(null);
  const indoorInputRef = useRef<HTMLInputElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveCheckTimerRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(undefined);
  const detectorBusyRef = useRef(false);

  const [cameraSlot, setCameraSlot] = useState<SlotId | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isLiveAnalyzing, setIsLiveAnalyzing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [liveFrameCheck, setLiveFrameCheck] = useState<FrameCheck | null>(null);

  const [guardNeedsConfirm, setGuardNeedsConfirm] = useState(false);
  const [guardSlots, setGuardSlots] = useState<SlotId[]>([]);

  const copy = useMemo(
    () =>
      language === 'EN'
        ? {
            openCamera: 'Frame camera',
            retakeCamera: 'Retake in frame',
            uploadAlbum: 'Upload image',
            cameraGuideTitle: 'Align your face inside the oval frame',
            cameraGuideTip: 'Keep forehead, cheeks, and chin fully visible. Avoid filters and beauty mode.',
            cameraPermissionDenied: 'Camera permission denied. You can still upload from your album.',
            cameraNotSupported: 'This browser cannot open camera preview. Please upload an image instead.',
            analyzing: 'Checking framing...',
            frameGood: 'Frame good',
            frameWarn: 'Usable but off',
            frameBad: 'High drift risk',
            frameUnknown: 'Frame check unavailable',
            capture: 'Capture',
            cancel: 'Cancel',
            guardTitle: 'Some photos are outside the guide frame.',
            guardBody: 'You can continue, but detection may drift. Recommended: retake in frame first.',
            continueAnyway: 'Continue anyway',
            retakeFirst: 'Retake first',
            noFace: 'No face detected. Move closer and keep your full face inside the oval.',
            offCenter: 'Move your nose toward the center of the frame.',
            tooSmall: 'Move closer so your face fills the oval.',
            tooLarge: 'Step back slightly so forehead and chin stay inside.',
            cutoff: 'Keep forehead, cheeks, and chin fully inside the frame.',
            detectorUnavailable: 'Manual frame mode only on this browser; quality will be checked after upload.',
            frameOkay: 'Framing looks good.',
            warningBanner: 'Framing is not ideal. You can still upload, but a retake may improve accuracy.',
          }
        : {
            openCamera: '框内拍照',
            retakeCamera: '重新框内拍照',
            uploadAlbum: '上传图片',
            cameraGuideTitle: '请将人脸对齐到椭圆框内',
            cameraGuideTip: '确保额头、双颊、下巴完整可见，避免滤镜与美颜。',
            cameraPermissionDenied: '相机权限未开启。你仍可从相册上传。',
            cameraNotSupported: '当前浏览器不支持相机预览，请直接上传图片。',
            analyzing: '正在检查取景...',
            frameGood: '取景良好',
            frameWarn: '可用但有偏移',
            frameBad: '高位移风险',
            frameUnknown: '无法自动取景检测',
            capture: '拍照',
            cancel: '取消',
            guardTitle: '有照片偏离取景框较多。',
            guardBody: '可以继续，但识别可能漂移。建议先按框重拍。',
            continueAnyway: '仍然继续',
            retakeFirst: '先重拍',
            noFace: '未检测到人脸，请靠近并让整张脸都在框内。',
            offCenter: '请把鼻子移到画面中心附近。',
            tooSmall: '请再靠近一点，让脸部更贴合取景框。',
            tooLarge: '请稍微后退，保证额头和下巴完整可见。',
            cutoff: '请保证额头、双颊、下巴都在框内。',
            detectorUnavailable: '当前浏览器仅支持手动框拍，上传后仍会继续质量校验。',
            frameOkay: '取景状态良好。',
            warningBanner: '取景有偏差。仍可上传，但重拍会更稳。',
          },
    [language]
  );

  const slotLabel = useCallback(
    (slot: SlotId) => (slot === 'daylight' ? t('s3.slot.daylight', language) : t('s3.slot.indoor', language)),
    [language]
  );

  const issueToHint = useCallback(
    (issue: FrameIssue): string => {
      switch (issue) {
        case 'no_face':
          return copy.noFace;
        case 'off_center':
          return copy.offCenter;
        case 'too_small':
          return copy.tooSmall;
        case 'too_large':
          return copy.tooLarge;
        case 'cutoff':
          return copy.cutoff;
        case 'detector_unavailable':
          return copy.detectorUnavailable;
        default:
          return copy.frameOkay;
      }
    },
    [copy]
  );

  const buildFrameCheck = useCallback(
    (level: FrameLevel, score: number, issues: FrameIssue[]): FrameCheck => ({
      level,
      score,
      issues,
      hint: issues.length > 0 ? issueToHint(issues[0]) : copy.frameOkay,
    }),
    [copy.frameOkay, issueToHint]
  );

  const ensureDetector = useCallback(() => {
    if (detectorRef.current !== undefined) return detectorRef.current;
    if (typeof window === 'undefined') {
      detectorRef.current = null;
      return null;
    }
    const DetectorCtor = (window as any).FaceDetector;
    if (!DetectorCtor) {
      detectorRef.current = null;
      return null;
    }
    try {
      detectorRef.current = new DetectorCtor({ fastMode: true, maxDetectedFaces: 1 });
    } catch {
      detectorRef.current = null;
    }
    return detectorRef.current;
  }, []);

  const evaluateFaceBox = useCallback(
    (box: any, frameWidth: number, frameHeight: number): FrameCheck => {
      const x = Number(box?.x ?? box?.left ?? 0);
      const y = Number(box?.y ?? box?.top ?? 0);
      const width = Number(box?.width ?? 0);
      const height = Number(box?.height ?? 0);

      if (!width || !height || !frameWidth || !frameHeight) {
        return buildFrameCheck('bad', 35, ['no_face']);
      }

      const areaRatio = (width * height) / (frameWidth * frameHeight);
      const centerX = (x + width / 2) / frameWidth;
      const centerY = (y + height / 2) / frameHeight;
      const centerDistance = Math.hypot(centerX - 0.5, centerY - 0.5);

      const margin = 0.02;
      const severeMargin = 0.005;
      const cutoff =
        x / frameWidth < margin ||
        y / frameHeight < margin ||
        (x + width) / frameWidth > 1 - margin ||
        (y + height) / frameHeight > 1 - margin;
      const severeCutoff =
        x / frameWidth < severeMargin ||
        y / frameHeight < severeMargin ||
        (x + width) / frameWidth > 1 - severeMargin ||
        (y + height) / frameHeight > 1 - severeMargin;

      const issues: FrameIssue[] = [];
      if (cutoff) issues.push('cutoff');
      if (areaRatio < 0.13) issues.push('too_small');
      if (areaRatio > 0.6) issues.push('too_large');
      if (centerDistance > 0.22) issues.push('off_center');

      const hardFail = severeCutoff || areaRatio < 0.075 || areaRatio > 0.78 || centerDistance > 0.38;
      const level: FrameLevel = hardFail ? 'bad' : issues.length > 0 ? 'warn' : 'good';

      let score = 100;
      if (areaRatio < 0.14) score -= Math.round(((0.14 - areaRatio) / 0.14) * 20);
      if (areaRatio > 0.58) score -= Math.round(((areaRatio - 0.58) / 0.42) * 20);
      if (centerDistance > 0.2) score -= Math.round(((centerDistance - 0.2) / 0.35) * 24);
      if (cutoff) score -= 18;
      score = Math.max(28, Math.min(99, score));
      if (level === 'good') score = Math.max(88, score);
      if (level === 'warn') score = Math.min(84, score);
      if (level === 'bad') score = Math.min(58, score);

      return buildFrameCheck(level, score, issues);
    },
    [buildFrameCheck]
  );

  const detectFrameFromSource = useCallback(
    async (source: any, width: number, height: number): Promise<FrameCheck> => {
      const detector = ensureDetector();
      if (!detector) return buildFrameCheck('unknown', 70, ['detector_unavailable']);
      try {
        const faces: Array<{ boundingBox?: any }> = await detector.detect(source);
        if (!faces || faces.length === 0) return buildFrameCheck('bad', 34, ['no_face']);

        const best = faces.reduce((prev, cur) => {
          const prevBox = prev?.boundingBox ?? prev;
          const curBox = cur?.boundingBox ?? cur;
          const prevArea = Number(prevBox?.width ?? 0) * Number(prevBox?.height ?? 0);
          const curArea = Number(curBox?.width ?? 0) * Number(curBox?.height ?? 0);
          return curArea > prevArea ? cur : prev;
        });

        const bestBox = best?.boundingBox ?? best;
        return evaluateFaceBox(bestBox, width, height);
      } catch {
        return buildFrameCheck('unknown', 70, ['detector_unavailable']);
      }
    },
    [buildFrameCheck, ensureDetector, evaluateFaceBox]
  );

  const readAsDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  const analyzeUploadedFile = useCallback(
    async (file: File): Promise<FrameCheck> => {
      const objectUrl = URL.createObjectURL(file);
      try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('Image load error'));
          image.src = objectUrl;
        });
        return await detectFrameFromSource(image, image.naturalWidth || image.width, image.naturalHeight || image.height);
      } catch {
        return buildFrameCheck('unknown', 70, ['detector_unavailable']);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [buildFrameCheck, detectFrameFromSource]
  );

  const handleFileChange = useCallback(
    async (slot: SlotId, file: File) => {
      if (uploading) return;
      const [preview, frameCheck] = await Promise.all([readAsDataUrl(file), analyzeUploadedFile(file)]);
      setPhotos((prev) => ({
        ...prev,
        [slot]: { file, preview, frameCheck },
      }));
      setGuardNeedsConfirm(false);
      setGuardSlots([]);
    },
    [analyzeUploadedFile, readAsDataUrl, uploading]
  );

  const removePhoto = useCallback(
    (slot: SlotId) => {
      if (uploading) return;
      setPhotos((prev) => ({
        ...prev,
        [slot]: undefined,
      }));
      setGuardNeedsConfirm(false);
      setGuardSlots([]);
    },
    [uploading]
  );

  const openCamera = useCallback(
    (slot: SlotId) => {
      if (uploading) return;
      setCameraSlot(slot);
      setCameraError(null);
      setLiveFrameCheck(null);
      setGuardNeedsConfirm(false);
    },
    [uploading]
  );

  const closeCamera = useCallback(() => {
    setCameraSlot(null);
    setCameraError(null);
    setLiveFrameCheck(null);
  }, []);

  useEffect(() => {
    if (uploading && cameraSlot) {
      closeCamera();
    }
  }, [uploading, cameraSlot, closeCamera]);

  useEffect(() => {
    if (!cameraSlot || uploading) return;

    let disposed = false;

    const cleanup = () => {
      if (liveCheckTimerRef.current) {
        window.clearInterval(liveCheckTimerRef.current);
        liveCheckTimerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      detectorBusyRef.current = false;
      if (!disposed) {
        setIsCameraReady(false);
        setIsLiveAnalyzing(false);
      }
    };

    const runLiveFrameCheck = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
      if (detectorBusyRef.current) return;

      detectorBusyRef.current = true;
      setIsLiveAnalyzing(true);
      const result = await detectFrameFromSource(video, video.videoWidth, video.videoHeight);
      if (!disposed) setLiveFrameCheck(result);
      detectorBusyRef.current = false;
      if (!disposed) setIsLiveAnalyzing(false);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(copy.cameraNotSupported);
        setLiveFrameCheck(buildFrameCheck('unknown', 70, ['detector_unavailable']));
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1080 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();

        if (disposed) return;

        setIsCameraReady(true);
        await runLiveFrameCheck();

        liveCheckTimerRef.current = window.setInterval(() => {
          void runLiveFrameCheck();
        }, 900);
      } catch {
        setCameraError(copy.cameraPermissionDenied);
      }
    };

    void start();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [
    buildFrameCheck,
    cameraSlot,
    copy.cameraNotSupported,
    copy.cameraPermissionDenied,
    detectFrameFromSource,
    uploading,
  ]);

  useEffect(() => {
    return () => {
      if (liveCheckTimerRef.current) window.clearInterval(liveCheckTimerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const captureFromCamera = useCallback(async () => {
    if (uploading) return;

    const slot = cameraSlot;
    const video = videoRef.current;
    if (!slot || !video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;

    const file = new File([blob], `${slot}_${Date.now()}.jpg`, { type: 'image/jpeg' });
    const preview = canvas.toDataURL('image/jpeg', 0.92);
    const frameCheck =
      liveFrameCheck && liveFrameCheck.level !== 'unknown' ? liveFrameCheck : await analyzeUploadedFile(file);

    setPhotos((prev) => ({
      ...prev,
      [slot]: { file, preview, frameCheck },
    }));
    setGuardNeedsConfirm(false);
    setGuardSlots([]);
    closeCamera();
  }, [analyzeUploadedFile, cameraSlot, closeCamera, liveFrameCheck, uploading]);

  const severeBadSlots = SLOT_IDS.filter((slot) => {
    const frameCheck = photos[slot]?.frameCheck;
    if (!frameCheck) return false;
    return frameCheck.issues.includes('no_face') || (frameCheck.level === 'bad' && frameCheck.score <= 42);
  });

  const gentleAlertSlots = SLOT_IDS.filter((slot) => {
    const frameCheck = photos[slot]?.frameCheck;
    if (!frameCheck) return false;
    if (frameCheck.level === 'warn') return true;
    if (frameCheck.level === 'bad' && !severeBadSlots.includes(slot)) return true;
    return false;
  });

  const handleUpload = () => {
    if (uploading) return;

    if (severeBadSlots.length > 0 && !guardNeedsConfirm) {
      setGuardNeedsConfirm(true);
      setGuardSlots(severeBadSlots);
      return;
    }

    const photoSlots: { daylight?: PhotoSlot; indoor_white?: PhotoSlot } = {};

    SLOT_IDS.forEach((slot) => {
      const photo = photos[slot];
      if (!photo) return;
      photoSlots[slot] = {
        id: slot,
        file: photo.file,
        preview: photo.preview,
        frameCheck: photo.frameCheck,
        retryCount: 0,
      };
    });

    closeCamera();
    setGuardNeedsConfirm(false);
    setGuardSlots([]);
    onAction('photo_upload', { photos: photoSlots, consent });
  };

  const hasPhotos = Boolean(photos.daylight || photos.indoor_white);
  const consentRequired = true;

  useEffect(() => {
    if (step === 'consent' && !hasPhotos) setStep('selection');
  }, [hasPhotos, step]);

  const statusChipClass = (level: FrameLevel | undefined) => {
    if (level === 'good') return 'bg-success/15 text-success border-success/40';
    if (level === 'warn') return 'bg-warning/15 text-warning border-warning/40';
    if (level === 'bad') return 'bg-destructive/15 text-destructive border-destructive/40';
    return 'bg-muted text-muted-foreground border-border';
  };

  const statusLabel = (level: FrameLevel | undefined) => {
    if (level === 'good') return copy.frameGood;
    if (level === 'warn') return copy.frameWarn;
    if (level === 'bad') return copy.frameBad;
    return copy.frameUnknown;
  };

  const renderSlot = (
    slot: SlotId,
    Icon: React.ComponentType<{ className?: string }>,
    inputRef: React.RefObject<HTMLInputElement>
  ) => {
    const photo = photos[slot];

    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Icon className="w-3 h-3" />
          {slotLabel(slot)}
        </label>

        <div
          className={`photo-slot ${photo ? 'photo-slot-filled' : ''}`}
          onClick={() => {
            if (!uploading && !photo) openCamera(slot);
          }}
        >
          {photo ? (
            <>
              <div className="photo-preview">
                <img src={photo.preview} alt={slot} />
              </div>
              <div className="absolute top-2 left-2 z-10">
                <div
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusChipClass(
                    photo.frameCheck?.level
                  )}`}
                >
                  {statusLabel(photo.frameCheck?.level)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removePhoto(slot);
                }}
                className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground z-10"
                aria-label="Remove photo"
                disabled={uploading}
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <Camera className="w-6 h-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground text-center px-2">{t('s3.tap_to_upload', language)}</span>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => openCamera(slot)}
            className="action-button action-button-secondary !py-2 !px-2 text-[11px] flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={uploading}
          >
            <ScanFace className="w-3 h-3" />
            {photo ? copy.retakeCamera : copy.openCamera}
          </button>

          <button
            onClick={() => inputRef.current?.click()}
            className="action-button action-button-ghost !py-2 !px-2 text-[11px] flex items-center justify-center gap-1 border border-border/50 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={uploading}
          >
            <Upload className="w-3 h-3" />
            {copy.uploadAlbum}
          </button>
        </div>

        {photo?.frameCheck && (
          <div className={`rounded-lg border px-2 py-1 text-[11px] ${statusChipClass(photo.frameCheck.level)}`}>
            {photo.frameCheck.hint}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await handleFileChange(slot, file);
          }}
        />
      </div>
    );
  };

  const handleContinueFromSelection = () => {
    if (uploading || !hasPhotos) return;
    closeCamera();
    setGuardNeedsConfirm(false);
    setGuardSlots([]);
    if (consentRequired) {
      setStep('consent');
      return;
    }
    setConsent(true);
    handleUpload();
  };

  const handleContinueWithoutPhotos = () => {
    if (uploading) return;
    closeCamera();
    setStep('selection');
    setGuardNeedsConfirm(false);
    setGuardSlots([]);
    onAction('photo_skip');
  };

  const handleBackFromConsent = () => {
    if (uploading) return;
    setStep('selection');
    setGuardNeedsConfirm(false);
    setGuardSlots([]);
  };

  return (
    <div className="chat-card space-y-3 pb-2">
      <PromptHeader
        title={step === 'selection' ? t('photo.step1.title', language) : t('photo.step2.title', language)}
        helper={step === 'selection' ? t('photo.step1.helper', language) : t('photo.step2.helper', language)}
        language={language}
        step={{ current: step === 'selection' ? 1 : 2, total: 2 }}
        showBack={step === 'consent'}
        onBack={step === 'consent' ? handleBackFromConsent : undefined}
      />

      {step === 'selection' ? (
        <div className="space-y-3 pb-28">
          {cameraSlot && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-primary">{copy.cameraGuideTitle}</div>
                <div className="text-[11px] text-muted-foreground">{copy.cameraGuideTip}</div>
              </div>

              <div className="relative aspect-square rounded-xl overflow-hidden border border-border bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover scale-x-[-1]" />
                <div className="pointer-events-none absolute inset-0 bg-black/15" />
                <div className="pointer-events-none absolute inset-[12%] rounded-[42%] border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.20)]" />
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <div key={idx} className="border border-white/10" />
                  ))}
                </div>
              </div>

              {cameraError ? (
                <div className="rounded-lg border border-warning/40 bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
                  {cameraError}
                </div>
              ) : (
                <div className={`rounded-lg border px-2 py-1.5 text-[11px] ${statusChipClass(liveFrameCheck?.level)}`}>
                  <div className="flex items-center gap-1.5">
                    {liveFrameCheck?.level === 'good' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : liveFrameCheck?.level === 'bad' ? (
                      <TriangleAlert className="w-3.5 h-3.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span className="font-medium">{statusLabel(liveFrameCheck?.level)}</span>
                    {isLiveAnalyzing && <span className="opacity-80">· {copy.analyzing}</span>}
                    {liveFrameCheck && <span className="ml-auto tabular-nums">score {liveFrameCheck.score}</span>}
                  </div>
                  {liveFrameCheck?.hint && <div className="mt-1">{liveFrameCheck.hint}</div>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={captureFromCamera}
                  disabled={!isCameraReady || Boolean(cameraError) || uploading}
                  className="action-button action-button-primary !py-2.5 flex items-center justify-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Camera className="w-4 h-4" />
                  {copy.capture}
                </button>
                <button
                  onClick={closeCamera}
                  className="action-button action-button-secondary !py-2.5"
                  disabled={uploading}
                >
                  {copy.cancel}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {renderSlot('daylight', Sun, daylightInputRef)}
            {renderSlot('indoor_white', Lightbulb, indoorInputRef)}
          </div>

          {hasPhotos && gentleAlertSlots.length > 0 && !guardNeedsConfirm ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              {copy.warningBanner}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={() => {
                closeCamera();
                onAction('photo_use_sample_sample_set_A');
              }}
              disabled={uploading}
            >
              {t('s3.btn.sample', language)}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 pb-28">
          <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            {SLOT_IDS.filter((slot) => photos[slot]).map((slot) => slotLabel(slot)).join(' · ')}
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
              disabled={uploading}
            />
            <span>{t('s3.consent', language)}</span>
          </label>

          {guardNeedsConfirm && guardSlots.length > 0 ? (
            <div className="rounded-lg border border-destructive/45 bg-destructive/10 px-3 py-2 space-y-2">
              <div className="text-xs font-semibold text-destructive">{copy.guardTitle}</div>
              <div className="text-[11px] text-destructive/90">{copy.guardBody}</div>
              <div className="text-[11px] text-destructive/90">{guardSlots.map((slot) => slotLabel(slot)).join(' · ')}</div>
              <button
                type="button"
                onClick={handleBackFromConsent}
                className="action-button action-button-secondary w-full"
                disabled={uploading}
              >
                {copy.retakeFirst}
              </button>
            </div>
          ) : null}
        </div>
      )}

      <PromptFooter
        language={language}
        sticky
        primaryLabel={
          step === 'selection'
            ? t('prompt.common.continue', language)
            : uploading
              ? t('s3.uploading', language)
              : guardNeedsConfirm
                ? copy.continueAnyway
                : t('photo.btn.confirmContinue', language)
        }
        onPrimary={step === 'selection' ? handleContinueFromSelection : handleUpload}
        primaryDisabled={step === 'selection' ? !hasPhotos || uploading : !consent || uploading}
        tertiaryLabel={t('photo.btn.continueWithout', language)}
        onTertiary={step === 'selection' ? handleContinueWithoutPhotos : undefined}
        tertiaryHidden={step !== 'selection'}
      />
    </div>
  );
}
