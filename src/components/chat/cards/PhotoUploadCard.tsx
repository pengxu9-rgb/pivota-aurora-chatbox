import React, { useState, useRef } from 'react';
import { Language, PhotoSlot } from '@/lib/types';
import { t } from '@/lib/i18n';
import { Camera, X, Sun, Lightbulb } from 'lucide-react';

interface PhotoUploadCardProps {
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

export function PhotoUploadCard({ onAction, language }: PhotoUploadCardProps) {
  const [photos, setPhotos] = useState<{
    daylight?: { file: File; preview: string };
    indoor_white?: { file: File; preview: string };
  }>({});
  
  const daylightInputRef = useRef<HTMLInputElement>(null);
  const indoorInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (slot: 'daylight' | 'indoor_white', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotos(prev => ({
        ...prev,
        [slot]: { file, preview: e.target?.result as string },
      }));
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (slot: 'daylight' | 'indoor_white') => {
    setPhotos(prev => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  };

  const handleUpload = () => {
    const photoSlots: { daylight?: PhotoSlot; indoor_white?: PhotoSlot } = {};
    
    if (photos.daylight) {
      photoSlots.daylight = {
        id: 'daylight',
        file: photos.daylight.file,
        preview: photos.daylight.preview,
        retryCount: 0,
      };
    }
    if (photos.indoor_white) {
      photoSlots.indoor_white = {
        id: 'indoor_white',
        file: photos.indoor_white.file,
        preview: photos.indoor_white.preview,
        retryCount: 0,
      };
    }
    
    onAction('photo_upload', { photos: photoSlots });
  };

  const hasPhotos = photos.daylight || photos.indoor_white;

  return (
    <div className="chat-card space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Daylight slot */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Sun className="w-3 h-3" />
            {t('s3.slot.daylight', language)}
          </label>
          <div
            className={`photo-slot ${photos.daylight ? 'photo-slot-filled' : ''}`}
            onClick={() => !photos.daylight && daylightInputRef.current?.click()}
          >
            {photos.daylight ? (
              <>
                <div className="photo-preview">
                  <img src={photos.daylight.preview} alt="Daylight" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto('daylight');
                  }}
                  className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground z-10"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Camera className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {t('s3.tap_to_upload', language)}
                </span>
              </>
            )}
          </div>
          <input
            ref={daylightInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileChange('daylight', file);
            }}
          />
        </div>

        {/* Indoor white slot */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            {t('s3.slot.indoor', language)}
          </label>
          <div
            className={`photo-slot ${photos.indoor_white ? 'photo-slot-filled' : ''}`}
            onClick={() => !photos.indoor_white && indoorInputRef.current?.click()}
          >
            {photos.indoor_white ? (
              <>
                <div className="photo-preview">
                  <img src={photos.indoor_white.preview} alt="Indoor" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto('indoor_white');
                  }}
                  className="absolute top-2 right-2 p-1 rounded-full bg-destructive text-destructive-foreground z-10"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Camera className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {t('s3.tap_to_upload', language)}
                </span>
              </>
            )}
          </div>
          <input
            ref={indoorInputRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileChange('indoor_white', file);
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {hasPhotos && (
          <button
            onClick={handleUpload}
            className="action-button action-button-primary w-full"
          >
            {t('s3.btn.upload', language)}
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onAction('photo_skip')}
            className="action-button action-button-secondary flex-1"
          >
            {t('s3.btn.skip', language)}
          </button>
          <button
            onClick={() => onAction('photo_use_sample_sample_set_A')}
            className="action-button action-button-ghost flex-1"
          >
            {t('s3.btn.sample', language)}
          </button>
        </div>
      </div>
    </div>
  );
}
