import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, User, X } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { pickLocalizedText, t } from '@/lib/i18n';
import type { DiagnosisResult, Language, SkinConcern } from '@/lib/types';

interface SkinIdentityCardProps {
  payload: {
    diagnosis: DiagnosisResult;
    avatarUrl?: string | null;
    photoHint?: boolean;
  };
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

function barrierLabel(status: DiagnosisResult['barrierStatus'] | undefined, language: Language) {
  if (status === 'healthy') return pickLocalizedText(language, { en: 'Healthy', cn: '稳定' });
  if (status === 'impaired') return pickLocalizedText(language, { en: 'Stressed', cn: '受损/脆弱' });
  if (status === 'unknown') return pickLocalizedText(language, { en: 'Not sure', cn: '不确定' });
  return pickLocalizedText(language, { en: 'Not provided', cn: '未填写' });
}

export function SkinIdentityCard({ payload, onAction, language }: SkinIdentityCardProps) {
  const { diagnosis } = payload;

  const [localConcerns, setLocalConcerns] = useState<SkinConcern[]>(() => diagnosis.concerns ?? []);

  useEffect(() => {
    setLocalConcerns(diagnosis.concerns ?? []);
  }, [diagnosis.concerns]);

  const removeConcern = useCallback(
    (c: SkinConcern) => {
      setLocalConcerns((prev) => {
        const next = prev.filter((x) => x !== c);
        onAction('profile_update_concerns', { concerns: next });
        return next;
      });
    },
    [onAction],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <Card
        className={cn(
          'w-full max-w-sm bg-white/90 backdrop-blur-sm shadow-elevated',
          'border border-border/70',
        )}
      >
        <CardHeader className="p-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border/60 bg-muted/40">
                {payload.avatarUrl ? <AvatarImage src={payload.avatarUrl} alt="User" /> : null}
                <AvatarFallback className="bg-muted/40">
                  <User className="h-5 w-5 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-semibold text-foreground">{pickLocalizedText(language, { en: 'Skin Identity', cn: '皮肤画像' })}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {pickLocalizedText(language, {
                    en: 'Based on your self-reported profile. Photos can improve accuracy.',
                    cn: '基于你的自述信息。上传照片可显著提升准确性。',
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-4">
          <div className="rounded-xl border border-border/70 bg-card/60 p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{pickLocalizedText(language, { en: 'Skin type:', cn: '肤质：' })}</span>
              <span className="font-medium text-foreground">
                {diagnosis.skinType ? t(`diagnosis.skin_type.${diagnosis.skinType}`, language) : pickLocalizedText(language, { en: 'Not provided', cn: '未填写' })}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{pickLocalizedText(language, { en: 'Barrier:', cn: '屏障：' })}</span>
              <span className="font-medium text-foreground">{barrierLabel(diagnosis.barrierStatus, language)}</span>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-foreground">{pickLocalizedText(language, { en: 'Concerns', cn: '关注点' })}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {localConcerns.map((c) => {
                  const label = t(`diagnosis.concern.${c}`, language);
                  return (
                    <motion.button
                      key={c}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      type="button"
                      onClick={() => removeConcern(c)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/30 px-3 py-1 text-[11px] font-semibold text-foreground',
                        'hover:bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-ring/30',
                      )}
                      aria-label={pickLocalizedText(language, { en: `Remove ${label}`, cn: `移除${label}` })}
                    >
                      <span className="truncate">{label}</span>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </motion.button>
                  );
                })}
              </AnimatePresence>

              {!localConcerns.length ? (
                <div className="text-[11px] text-muted-foreground">{pickLocalizedText(language, { en: 'No concerns selected.', cn: '尚未选择关注点。' })}</div>
              ) : null}
            </div>
          </div>

          {payload.photoHint !== false ? (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground/90">{t('s3.intro', language)}</div>
              <div className="mt-1">{t('s3.one_photo_hint', language)}</div>
              <div className="mt-1">{t('s3.tip', language)}</div>
              <div className="mt-1">{t('s3.warning', language)}</div>
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="p-4 pt-0 flex-col gap-2">
          <Button
            type="button"
            onClick={() => onAction('profile_upload_selfie')}
            className={cn('w-full rounded-xl text-white', 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:brightness-110', 'shadow-sm')}
          >
            <Camera className="h-4 w-4 mr-2" />
            {pickLocalizedText(language, { en: 'Upload photo (recommended)', cn: '上传照片（推荐）' })}
          </Button>
          <Button type="button" variant="ghost" className="w-full justify-center" onClick={() => onAction('profile_confirm')}>
            {pickLocalizedText(language, { en: 'Continue without photos', cn: '先不传照片，继续' })}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
