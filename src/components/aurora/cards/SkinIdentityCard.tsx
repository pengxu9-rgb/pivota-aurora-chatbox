import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, User, X } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import type { DiagnosisResult, Language, SkinConcern, SkinType } from '@/lib/types';

type SkinHealthStatus = 'good' | 'attention';

interface SkinIdentityCardProps {
  payload: {
    diagnosis: DiagnosisResult;
    avatarUrl?: string | null;
  };
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeSebum(skinType?: SkinType) {
  switch (skinType) {
    case 'oily':
      return 88;
    case 'dry':
      return 22;
    case 'combination':
      return 62;
    case 'normal':
      return 50;
    case 'sensitive':
      return 45;
    default:
      return 50;
  }
}

function computeHydration(skinType?: SkinType, barrierStatus?: DiagnosisResult['barrierStatus']) {
  let base = 52;
  switch (skinType) {
    case 'oily':
      base = 58;
      break;
    case 'dry':
      base = 28;
      break;
    case 'combination':
      base = 46;
      break;
    case 'normal':
      base = 66;
      break;
    case 'sensitive':
      base = 40;
      break;
    default:
      base = 52;
  }

  if (barrierStatus === 'impaired') base -= 8;
  return clampPercent(base);
}

function computeSensitivity(input: {
  skinType?: SkinType;
  barrierStatus?: DiagnosisResult['barrierStatus'];
  concerns: SkinConcern[];
}) {
  let base = 48;
  if (input.barrierStatus === 'healthy') base = 30;
  if (input.barrierStatus === 'impaired') base = 72;

  if (input.skinType === 'sensitive') base += 12;
  if (input.concerns.includes('redness')) base += 10;
  return clampPercent(base);
}

function computeResilience(barrierStatus: DiagnosisResult['barrierStatus'] | undefined, sensitivity: number) {
  const modifier = barrierStatus === 'healthy' ? 6 : barrierStatus === 'impaired' ? -6 : 0;
  return clampPercent(100 - sensitivity + modifier);
}

function computeStatus(barrierStatus: DiagnosisResult['barrierStatus'] | undefined, sensitivity: number): SkinHealthStatus {
  if (barrierStatus === 'healthy' && sensitivity <= 45) return 'good';
  if (barrierStatus === 'impaired') return 'attention';
  return sensitivity >= 55 ? 'attention' : 'good';
}

function borderClass(status: SkinHealthStatus) {
  return status === 'good' ? 'border-l-emerald-500' : 'border-l-amber-500';
}

function statusLabel(status: SkinHealthStatus, language: Language) {
  if (status === 'good') return language === 'EN' ? 'Good' : '良好';
  return language === 'EN' ? 'Attention' : '需关注';
}

function barrierLabel(status: DiagnosisResult['barrierStatus'] | undefined, language: Language) {
  if (status === 'healthy') return language === 'EN' ? 'Healthy barrier' : '屏障稳定';
  if (status === 'impaired') return language === 'EN' ? 'Barrier impaired' : '屏障受损';
  return language === 'EN' ? 'Barrier: not sure' : '屏障：不确定';
}

function RadialProgress({ value, label }: { value: number; label: string }) {
  const clamped = clampPercent(value);
  const size = 56;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="relative h-14 w-14">
        <svg width={size} height={size} className="block">
          <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="fill-none stroke-muted" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="fill-none stroke-foreground"
            style={{ transition: 'stroke-dashoffset 420ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[13px] font-semibold tracking-tight text-foreground">{clamped}</div>
          <div className="text-[9px] font-medium text-muted-foreground">/100</div>
        </div>
      </div>
      <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

export function SkinIdentityCard({ payload, onAction, language }: SkinIdentityCardProps) {
  const { diagnosis } = payload;

  const [localConcerns, setLocalConcerns] = useState<SkinConcern[]>(() => diagnosis.concerns ?? []);

  useEffect(() => {
    setLocalConcerns(diagnosis.concerns ?? []);
  }, [diagnosis.concerns]);

  const sebum = useMemo(() => computeSebum(diagnosis.skinType), [diagnosis.skinType]);
  const hydration = useMemo(() => computeHydration(diagnosis.skinType, diagnosis.barrierStatus), [diagnosis.barrierStatus, diagnosis.skinType]);
  const sensitivity = useMemo(
    () => computeSensitivity({ skinType: diagnosis.skinType, barrierStatus: diagnosis.barrierStatus, concerns: localConcerns }),
    [diagnosis.barrierStatus, diagnosis.skinType, localConcerns],
  );
  const resilience = useMemo(() => computeResilience(diagnosis.barrierStatus, sensitivity), [diagnosis.barrierStatus, sensitivity]);
  const status = useMemo(() => computeStatus(diagnosis.barrierStatus, sensitivity), [diagnosis.barrierStatus, sensitivity]);

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
          'border border-border/70 border-l-4',
          borderClass(status),
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
                <div className="text-sm font-semibold text-foreground">Skin Identity</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">
                    {diagnosis.skinType ? t(`diagnosis.skin_type.${diagnosis.skinType}` as any, language) : language === 'EN' ? 'Profile pending' : '待完善'}
                  </div>
                  <div
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                      status === 'good'
                        ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                        : 'bg-amber-50 text-amber-900 ring-amber-200',
                    )}
                  >
                    {statusLabel(status, language)}
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{barrierLabel(diagnosis.barrierStatus, language)}</div>
              </div>
            </div>

            <RadialProgress value={resilience} label={language === 'EN' ? 'Resilience' : '韧性'} />
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'Hydration', value: hydration },
              { key: 'Sebum', value: sebum },
              { key: 'Sensitivity', value: sensitivity },
            ].map((m) => {
              const isHigh = m.value > 80;
              const indicator = isHigh ? 'bg-yellow-500' : m.key === 'Sensitivity' ? 'bg-rose-500' : m.key === 'Sebum' ? 'bg-emerald-500' : 'bg-sky-500';

              return (
                <div key={m.key} className="rounded-xl border border-border/70 bg-card/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-foreground">{m.key}</div>
                    <div className="text-[11px] font-medium text-muted-foreground">{m.value}%</div>
                  </div>
                  <Progress value={m.value} className="mt-2 h-2 bg-muted/60" indicatorClassName={indicator} />
                </div>
              );
            })}
          </div>

          <div>
            <div className="text-xs font-semibold text-foreground">{language === 'EN' ? 'Concerns' : '关注点'}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {localConcerns.map((c) => {
                  const label = t(`diagnosis.concern.${c}` as any, language);
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
                      aria-label={`Remove ${label}`}
                    >
                      <span className="truncate">{label}</span>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </motion.button>
                  );
                })}
              </AnimatePresence>

              {!localConcerns.length ? (
                <div className="text-[11px] text-muted-foreground">{language === 'EN' ? 'No concerns selected.' : '尚未选择关注点。'}</div>
              ) : null}
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0 flex-col gap-2">
          <Button
            type="button"
            onClick={() => onAction('profile_confirm')}
            className={cn(
              'w-full rounded-xl text-white',
              'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:brightness-110',
              'shadow-sm',
            )}
          >
            {language === 'EN' ? 'Confirm Profile' : '确认画像'}
          </Button>
          <Button type="button" variant="ghost" className="w-full justify-center gap-2" onClick={() => onAction('profile_upload_selfie')}>
            <Camera className="h-4 w-4" />
            {language === 'EN' ? 'Upload Selfie' : '上传自拍'}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

