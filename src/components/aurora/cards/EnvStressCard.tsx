import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';

import { EnvStressRadar } from '@/components/aurora/charts/EnvStressRadar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { EnvStressUiModelV1 } from '@/lib/auroraEnvStress';
import { normalizeEnvStressUiModelV1 } from '@/lib/auroraUiContracts';
import { cn } from '@/lib/utils';
import type { Language } from '@/lib/types';

export function EnvStressCard({ payload, language }: { payload: EnvStressUiModelV1 | null; language: Language }) {
  const { model, didWarn } = normalizeEnvStressUiModelV1(payload);

  useEffect(() => {
    if (didWarn) console.warn('[aurora.ui] env_stress model normalized (clamp/NaN policy applied)');
  }, [didWarn]);

  if (!payload) return null;

  const ess = model?.ess;
  const tier = model?.tier;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <Card className={cn('w-full max-w-sm bg-white/90 backdrop-blur-sm shadow-elevated', 'border border-border/70')}>
        <CardHeader className="p-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-muted/40">
                <Globe className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {language === 'EN' ? 'Environment Stress' : '环境压力'}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {language === 'EN'
                    ? 'A bounded, explainable stress signal (ESS).'
                    : '可解释、可降级的压力信号（ESS）。'}
                </div>
              </div>
            </div>

            {typeof ess === 'number' ? (
              <div className="text-right">
                <div className="text-[11px] text-muted-foreground">{language === 'EN' ? 'ESS' : 'ESS'}</div>
                <div className="text-sm font-semibold text-foreground">{Math.round(ess)}/100</div>
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-3">
          {typeof ess === 'number' ? (
            <>
              <Progress
                value={Math.max(0, Math.min(100, Math.round(ess)))}
                className="h-2 bg-muted/50"
                indicatorClassName="bg-orange-500"
                aria-label="Environment stress score"
              />
              {tier ? (
                <div className="text-[11px] text-muted-foreground">
                  {language === 'EN' ? 'Tier:' : '等级：'} {tier}
                </div>
              ) : null}

              {model?.radar?.length ? <EnvStressRadar model={model} /> : null}
            </>
          ) : (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-[11px] text-muted-foreground">
              {model?.notes?.[0] ??
                (language === 'EN'
                  ? 'Not enough data to compute ESS yet.'
                  : '当前数据不足，暂无法计算 ESS。')}
            </div>
          )}

          {model?.notes?.length ? (
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {model.notes.slice(0, 4).map((note, idx) => (
                <li key={`${idx}_${note.slice(0, 24)}`} className="truncate">
                  • {note}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}

