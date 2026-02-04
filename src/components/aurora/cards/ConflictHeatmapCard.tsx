import React from 'react';
import { motion } from 'framer-motion';
import { Grid3X3 } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { normalizeConflictHeatmapUiModelV1 } from '@/lib/auroraUiContracts';
import { cn } from '@/lib/utils';
import type { Language } from '@/lib/types';

export function ConflictHeatmapCard({ payload, language }: { payload: unknown; language: Language }) {
  const model = normalizeConflictHeatmapUiModelV1(payload);
  if (!model) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <Card className={cn('w-full max-w-sm bg-white/90 backdrop-blur-sm shadow-elevated', 'border border-border/70')}>
        <CardHeader className="p-4 pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-muted/40">
              <Grid3X3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                {language === 'CN' ? '冲突热力图' : 'Conflict heatmap'}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {language === 'CN'
                  ? '契约已就位；热力图可视化仍在开发中。'
                  : 'Contract is ready; visualization coming soon.'}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-2">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-[11px] text-muted-foreground">
            {language === 'CN'
              ? '当前版本只展示占位，不依赖未定义字段（避免 UI 发散）。'
              : 'This version is a placeholder and does not depend on undefined fields.'}
          </div>
          <div className="text-[11px] text-muted-foreground">{model.schema_version}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

