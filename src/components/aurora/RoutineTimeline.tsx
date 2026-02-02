import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Droplets,
  FlaskConical,
  Leaf,
  Shield,
  Sparkles,
  Sun,
  TestTube2,
  Wand2,
} from 'lucide-react';

export type RoutineStepType =
  | 'cleanser'
  | 'toner'
  | 'serum'
  | 'treatment'
  | 'moisturizer'
  | 'sunscreen'
  | 'mask'
  | 'other';

export type RoutineStep = {
  id: string;
  type: RoutineStepType;
  label?: string;
};

export type RoutineConflict = {
  // connector is rendered between stepIndex and stepIndex+1
  stepIndex: number;
  message: string;
  severity?: 'warn' | 'block';
};

export type CompatibilityResult = {
  safe: boolean;
  conflicts: RoutineConflict[];
  summary?: string;
};

export type RoutineTimelineProps = {
  className?: string;
  am: RoutineStep[];
  pm: RoutineStep[];
  conflicts?: Partial<Record<'am' | 'pm', RoutineConflict[]>>;
  testProduct?: RoutineStep;
  onSimulate?: (args: { routine: 'am' | 'pm'; steps: RoutineStep[]; testProduct: RoutineStep; afterIndex: number }) => CompatibilityResult;
};

const STEP_ICON: Record<RoutineStepType, React.ComponentType<{ className?: string }>> = {
  cleanser: Droplets,
  toner: Leaf,
  serum: TestTube2,
  treatment: FlaskConical,
  moisturizer: Shield,
  sunscreen: Sun,
  mask: Sparkles,
  other: Wand2,
};

function clampIndex(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function uniqConflicts(conflicts: RoutineConflict[]) {
  const seen = new Set<string>();
  return conflicts.filter((c) => {
    const key = `${c.stepIndex}:${c.message.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function TimelineRow({
  routine,
  steps,
  baseConflicts,
  testProduct,
  onSimulate,
}: {
  routine: 'am' | 'pm';
  steps: RoutineStep[];
  baseConflicts: RoutineConflict[];
  testProduct?: RoutineStep;
  onSimulate?: RoutineTimelineProps['onSimulate'];
}) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [simulation, setSimulation] = useState<CompatibilityResult | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);

  const effective = simulation?.conflicts?.length ? simulation.conflicts : baseConflicts;
  const effectiveConflicts = useMemo(() => uniqConflicts(effective), [effective]);

  const safeGlow = (simulation?.safe ?? (effectiveConflicts.length === 0)) ? 'shadow-[0_0_0_3px_rgba(16,185,129,0.15)]' : '';

  const conflictsByConnector = useMemo(() => {
    const map = new Map<number, RoutineConflict>();
    for (const c of effectiveConflicts) {
      const idx = clampIndex(c.stepIndex, 0, Math.max(0, steps.length - 2));
      if (!map.has(idx)) map.set(idx, c);
    }
    return map;
  }, [effectiveConflicts, steps.length]);

  const defaultTestProduct: RoutineStep = useMemo(
    () => testProduct ?? { id: 'test_product', type: 'serum', label: 'Test Product' },
    [testProduct],
  );

  function simulate(afterIndex: number) {
    if (!onSimulate) return;
    const idx = clampIndex(afterIndex, -1, steps.length - 1);
    const result = onSimulate({ routine, steps, testProduct: defaultTestProduct, afterIndex: idx });
    setSimulation(result);
  }

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('application/x-aurora-test-product', JSON.stringify(defaultTestProduct));
    e.dataTransfer.effectAllowed = 'copy';
    setSimulation(null);
    setIsPlacing(false);
  }

  function onDragOverDropTarget(e: React.DragEvent, afterIndex: number) {
    e.preventDefault();
    setDragOverIndex(afterIndex);
    e.dataTransfer.dropEffect = 'copy';
    simulate(afterIndex);
  }

  function onDropOnTarget(e: React.DragEvent, afterIndex: number) {
    e.preventDefault();
    setDragOverIndex(null);
    const raw = e.dataTransfer.getData('application/x-aurora-test-product');
    if (!raw) return;
    simulate(afterIndex);
  }

  function onDragLeave() {
    setDragOverIndex(null);
  }

  function onToggleTestMode() {
    if (!isPlacing) {
      setIsPlacing(true);
      // Default to "after last step" so mobile users see an immediate result.
      const defaultAfterIndex = steps.length - 1;
      setDragOverIndex(defaultAfterIndex);
      simulate(defaultAfterIndex);
      return;
    }

    setIsPlacing(false);
    setDragOverIndex(null);
  }

  function onTapPlace(afterIndex: number) {
    if (!isPlacing) return;
    setDragOverIndex(afterIndex);
    simulate(afterIndex);
  }

  const previewSteps = useMemo(() => {
    if (dragOverIndex === null || !onSimulate) return steps;
    const idx = clampIndex(dragOverIndex, -1, steps.length - 1);
    const out = steps.slice();
    out.splice(idx + 1, 0, { ...defaultTestProduct, id: 'test_product_preview' });
    return out;
  }, [dragOverIndex, onSimulate, steps, defaultTestProduct]);

  const hasBlocking = effectiveConflicts.some((c) => (c.severity ?? 'warn') === 'block');

  return (
    <TooltipProvider>
      <div className={cn('rounded-xl border border-border/70 bg-white/70 backdrop-blur-sm', safeGlow)}>
        <div className="px-3 py-2 flex items-center justify-between border-b border-border/60">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {routine === 'am' ? 'AM timeline' : 'PM timeline'}
          </div>
          {simulation ? (
            <Badge
              variant="secondary"
              className={cn(
                'rounded-full text-[10px]',
                simulation.safe ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700',
              )}
            >
              {simulation.safe ? 'Safe' : hasBlocking ? 'Not compatible' : 'Needs caution'}
            </Badge>
          ) : effectiveConflicts.length ? (
            <Badge variant="secondary" className="rounded-full text-[10px] bg-amber-500/15 text-amber-700">
              {effectiveConflicts.length} signal{effectiveConflicts.length === 1 ? '' : 's'}
            </Badge>
          ) : (
            <Badge variant="secondary" className="rounded-full text-[10px] bg-emerald-500/15 text-emerald-700">
              Safe
            </Badge>
          )}
        </div>

        <div className="px-3 py-3">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
            {previewSteps.map((step, idx) => {
              const Icon = STEP_ICON[step.type] ?? Wand2;
              const isPreview = step.id === 'test_product_preview';
              const isDropTarget = dragOverIndex === idx - 1;
              const isLast = idx === previewSteps.length - 1;
              const connectorConflict = conflictsByConnector.get(idx);

              return (
                <React.Fragment key={`${step.id}-${idx}`}>
                  <div
                    className={cn(
                      'flex flex-col items-center gap-1 shrink-0',
                      isPreview ? 'opacity-80' : '',
                      isDropTarget ? 'scale-[1.01]' : '',
                    )}
                    onDragOver={(e) => onDragOverDropTarget(e, idx - 1)}
                    onDrop={(e) => onDropOnTarget(e, idx - 1)}
                    onDragLeave={onDragLeave}
                    onClick={() => onTapPlace(idx - 1)}
                  >
                    <div
                      className={cn(
                        'relative h-11 w-11 rounded-full border border-border/60 bg-muted/20 flex items-center justify-center',
                        isPreview ? 'ring-2 ring-primary/15' : '',
                        isDropTarget ? 'ring-2 ring-primary/30 bg-primary/5' : '',
                        isPlacing ? 'cursor-pointer hover:bg-primary/5' : '',
                      )}
                      title={step.label ?? step.type}
                    >
                      <Icon className={cn('h-5 w-5 text-foreground/80', isPreview ? 'text-primary' : '')} />
                    </div>
                    <div className="text-[10px] text-muted-foreground text-center max-w-[72px] truncate">
                      {step.label ?? step.type}
                    </div>
                  </div>

                  {!isLast ? (
                    <div
                      className={cn(
                        'relative shrink-0 w-12 h-10 flex items-center justify-center rounded-lg',
                        isPlacing ? 'cursor-pointer ring-1 ring-primary/20 hover:bg-primary/5' : '',
                      )}
                      onDragOver={(e) => onDragOverDropTarget(e, idx)}
                      onDrop={(e) => onDropOnTarget(e, idx)}
                      onDragLeave={onDragLeave}
                      onClick={() => onTapPlace(idx)}
                    >
                      <svg width="48" height="20" viewBox="0 0 48 20" className="block">
                        <line
                          x1="4"
                          y1="10"
                          x2="44"
                          y2="10"
                          strokeWidth="2"
                          className={cn(
                            connectorConflict ? 'stroke-rose-500' : 'stroke-muted-foreground/40',
                          )}
                          strokeLinecap="round"
                        />
                      </svg>

                      {connectorConflict ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background border border-border shadow-sm p-1"
                            >
                              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-xs leading-snug">
                            {connectorConflict.message}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  ) : null}
                </React.Fragment>
              );
            })}

            {/* Drop target: append */}
            <div
              className={cn(
                'shrink-0 rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-2',
                dragOverIndex === previewSteps.length - 1 ? 'border-primary/50 bg-primary/5' : '',
                isPlacing ? 'cursor-pointer ring-1 ring-primary/20 hover:bg-primary/5' : '',
              )}
              onDragOver={(e) => onDragOverDropTarget(e, previewSteps.length - 1)}
              onDrop={(e) => onDropOnTarget(e, previewSteps.length - 1)}
              onDragLeave={onDragLeave}
              onClick={() => onTapPlace(previewSteps.length - 1)}
            >
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {isPlacing ? 'Tap to test' : 'Drag or tap to test'}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">after last step</div>
            </div>
          </div>

          {/* Test Product drag source */}
          <div className="mt-2 rounded-xl border border-border/60 bg-muted/10 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground">Test Product</div>
              <div className="text-xs text-muted-foreground truncate">
                {isPlacing ? 'Tap a connector to place it' : 'Tap to test (or drag on desktop)'}
              </div>
            </div>
            <button
              type="button"
              draggable
              onDragStart={onDragStart}
              onClick={onToggleTestMode}
              className={cn(
                'shrink-0 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5',
                'cursor-pointer md:cursor-grab md:active:cursor-grabbing',
                isPlacing ? 'ring-2 ring-primary/20 bg-primary/5' : '',
              )}
              title={isPlacing ? 'Exit test mode' : 'Tap to test'}
            >
              <Wand2 className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">{defaultTestProduct.label ?? 'Test'}</span>
            </button>
          </div>

          {simulation?.summary ? (
            <div className="mt-2 text-xs text-muted-foreground">{simulation.summary}</div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function RoutineTimeline({ className, am, pm, conflicts, testProduct, onSimulate }: RoutineTimelineProps) {
  const amConflicts = conflicts?.am ?? [];
  const pmConflicts = conflicts?.pm ?? [];

  return (
    <Card className={cn('w-full bg-white/90 backdrop-blur-sm border-border/70 shadow-card', className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Routine timeline</div>
            <div className="text-xs text-muted-foreground">Tap warnings to see why steps may conflict</div>
          </div>
        </div>

        <Tabs defaultValue="am" className="mt-3">
          <TabsList className="w-full">
            <TabsTrigger value="am" className="flex-1">
              Morning (AM)
            </TabsTrigger>
            <TabsTrigger value="pm" className="flex-1">
              Evening (PM)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="am">
            <TimelineRow routine="am" steps={am} baseConflicts={amConflicts} testProduct={testProduct} onSimulate={onSimulate} />
          </TabsContent>

          <TabsContent value="pm">
            <TimelineRow routine="pm" steps={pm} baseConflicts={pmConflicts} testProduct={testProduct} onSimulate={onSimulate} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
