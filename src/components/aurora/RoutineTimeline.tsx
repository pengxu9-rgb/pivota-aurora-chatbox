import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Check,
  Droplets,
  FlaskConical,
  Leaf,
  Plus,
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
  // connector is rendered between stepIndex and stepIndex+1 in the simulated list
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
  language?: 'EN' | 'CN';
  am: RoutineStep[];
  pm: RoutineStep[];
  conflicts?: Partial<Record<'am' | 'pm', RoutineConflict[]>>;
  // Optional default (used as preselection in the test drawer)
  testProduct?: RoutineStep;
  onSimulate?: (args: {
    routine: 'am' | 'pm';
    steps: RoutineStep[];
    testProduct: RoutineStep;
    afterIndex: number;
  }) => CompatibilityResult;
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

const COPY = {
  EN: {
    title: 'Routine timeline',
    subtitle: 'Test where a product fits, and catch conflicts early.',
    testBtn: 'Test a product',
    changeBtn: 'Change',
    exitBtn: 'Exit',
    placingHint: 'Tap a + to place your test product.',
    drawerTitle: 'Test a product',
    drawerDesc: 'Paste a link/name, pick a category, then place it into your routine.',
    nameLabel: 'Product link or name',
    namePlaceholder: 'e.g., “The Ordinary Retinol” or a URL',
    typeLabel: 'Category',
    startTest: 'Start test',
    cancel: 'Cancel',
    placeHere: 'Place here',
    placed: 'Placed',
    resultTitle: 'Compatibility check',
    safe: 'Looks compatible',
    caution: 'Potential conflict',
    altNights: 'Alternate nights',
    moveAfterMoisturizer: 'Move after moisturizer',
    tryPM: 'Try in PM',
    save: 'Save',
    saved: 'Saved (coming soon)',
    noMoisturizer: 'No moisturizer step detected.',
  },
  CN: {
    title: '护肤时间线',
    subtitle: '测试单品如何插入，并提前发现冲突。',
    testBtn: '测试单品',
    changeBtn: '更换',
    exitBtn: '退出',
    placingHint: '点击 “+” 选择插入位置。',
    drawerTitle: '测试单品',
    drawerDesc: '粘贴链接/名称，选择品类，然后把它放进你的流程里。',
    nameLabel: '产品链接或名称',
    namePlaceholder: '例如 “The Ordinary 视黄醇” 或 URL',
    typeLabel: '品类',
    startTest: '开始测试',
    cancel: '取消',
    placeHere: '放这里',
    placed: '已放置',
    resultTitle: '兼容性检查',
    safe: '看起来兼容',
    caution: '可能冲突',
    altNights: '隔天使用',
    moveAfterMoisturizer: '放在保湿后',
    tryPM: '改到晚间',
    save: '保存',
    saved: '已保存（即将支持）',
    noMoisturizer: '未检测到保湿步骤。',
  },
} as const;

function clampAfterIndex(afterIndex: number, stepsLen: number) {
  const min = -1;
  const max = Math.max(-1, stepsLen - 1);
  return Math.max(min, Math.min(max, afterIndex));
}

function defaultSimulate(args: { steps: RoutineStep[]; testProduct: RoutineStep; afterIndex: number }): CompatibilityResult {
  const { steps, testProduct } = args;
  const afterIndex = clampAfterIndex(args.afterIndex, steps.length);
  const simulated = steps.slice();
  simulated.splice(afterIndex + 1, 0, testProduct);

  const activeTypes = new Set<RoutineStepType>(['serum', 'treatment']);
  const conflicts: RoutineConflict[] = [];

  for (let i = 0; i < simulated.length - 1; i += 1) {
    const a = simulated[i];
    const b = simulated[i + 1];
    if (activeTypes.has(a.type) && activeTypes.has(b.type)) {
      conflicts.push({
        stepIndex: i,
        severity: 'warn',
        message: 'Incompatible pH levels. Use on alternate nights.',
      });
    }
  }

  return {
    safe: conflicts.length === 0,
    conflicts,
    summary: conflicts.length ? 'Try spacing actives apart or alternating nights.' : 'Looks compatible with your routine order.',
  };
}

function normalizeLabel(raw: string, fallback: string) {
  const v = raw.trim();
  if (!v) return fallback;
  if (v.length <= 44) return v;
  return `${v.slice(0, 41)}…`;
}

function TimelineRow({
  copy,
  routine,
  steps,
  testProduct,
  isPlacing,
  afterIndex,
  simulation,
  baseConflicts,
  onPlace,
}: {
  copy: typeof COPY.EN | typeof COPY.CN;
  routine: 'am' | 'pm';
  steps: RoutineStep[];
  testProduct: RoutineStep | null;
  isPlacing: boolean;
  afterIndex: number | null;
  simulation: CompatibilityResult | null;
  baseConflicts: RoutineConflict[];
  onPlace: (afterIndex: number) => void;
}) {
  const selectedAfterIndex = typeof afterIndex === 'number' ? clampAfterIndex(afterIndex, steps.length) : null;

  const baseByAfterIndex = useMemo(() => {
    const map = new Map<number, RoutineConflict>();
    for (const c of baseConflicts) map.set(c.stepIndex, c);
    return map;
  }, [baseConflicts]);

  const placementConflict = useMemo(() => {
    if (!isPlacing || !testProduct) return null;
    const conflicts = simulation?.conflicts ?? [];
    return conflicts.length ? conflicts[0] : null;
  }, [isPlacing, simulation?.conflicts, testProduct]);

  function renderSlot(slotAfterIndex: number, kind: 'start' | 'mid' | 'end') {
    const isSelected = isPlacing && typeof selectedAfterIndex === 'number' && selectedAfterIndex === slotAfterIndex && !!testProduct;
    const baseConflict = baseByAfterIndex.get(slotAfterIndex) ?? null;
    const conflict = isSelected && placementConflict ? placementConflict : baseConflict;
    const danger = !!conflict;

    const lineClass = danger ? 'stroke-rose-500' : 'stroke-muted-foreground/40';
    const buttonTone = danger ? 'bg-rose-500 text-white' : isSelected ? 'bg-primary text-primary-foreground' : 'bg-background';

    return (
      <div
        key={`slot_${routine}_${slotAfterIndex}_${kind}`}
        className={cn(
          'relative shrink-0 h-14 w-14 flex items-center justify-center',
          isPlacing ? 'cursor-pointer' : '',
        )}
        onClick={() => {
          if (!isPlacing || !testProduct) return;
          onPlace(slotAfterIndex);
        }}
        onDragOver={(e) => {
          if (!isPlacing || !testProduct) return;
          e.preventDefault();
          onPlace(slotAfterIndex);
        }}
        onDrop={(e) => {
          if (!isPlacing || !testProduct) return;
          e.preventDefault();
          onPlace(slotAfterIndex);
        }}
      >
        <svg width="56" height="24" viewBox="0 0 56 24" className="block">
          <line x1="8" y1="12" x2="48" y2="12" strokeWidth="2" className={lineClass} strokeLinecap="round" />
        </svg>

        {isPlacing ? (
          <button
            type="button"
            className={cn(
              'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-border/70 shadow-sm',
              buttonTone,
              isSelected ? 'ring-2 ring-primary/20' : '',
            )}
            aria-label={isSelected ? copy.placed : copy.placeHere}
          >
            {isSelected ? <Check className="h-4 w-4 mx-auto" /> : <Plus className="h-4 w-4 mx-auto" />}
          </button>
        ) : null}

        {isSelected && testProduct ? (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2">
            <div className="relative h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Wand2 className="h-4 w-4 text-primary" />
              {danger ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm"
                      aria-label="Conflict details"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <AlertTriangle className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-72 text-xs leading-snug">
                    {conflict?.message ?? copy.caution}
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const content = (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
      {renderSlot(-1, 'start')}

      {steps.map((step, idx) => {
        const Icon = STEP_ICON[step.type] ?? Wand2;
        return (
          <React.Fragment key={`${routine}_${step.id}_${idx}`}>
            <div className="shrink-0 flex flex-col items-center gap-1 min-w-0">
              <div className="h-11 w-11 rounded-full border border-border/60 bg-muted/20 flex items-center justify-center">
                <Icon className="h-5 w-5 text-foreground/80" />
              </div>
              <div className="text-[10px] text-muted-foreground text-center max-w-[76px] truncate">
                {step.label ?? step.type}
              </div>
            </div>

            {idx === steps.length - 1 ? renderSlot(idx, 'end') : renderSlot(idx, 'mid')}
          </React.Fragment>
        );
      })}

      {steps.length === 0 ? (
        <div className="shrink-0">
          {renderSlot(-1, 'end')}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="rounded-xl border border-border/70 bg-white/70 backdrop-blur-sm">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border/60">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {routine === 'am' ? 'AM' : 'PM'}
        </div>
        {isPlacing && testProduct ? (
          <Badge variant="secondary" className="rounded-full text-[10px]">
            {copy.placingHint}
          </Badge>
        ) : (
          <Badge variant="secondary" className="rounded-full text-[10px]">
            {copy.subtitle}
          </Badge>
        )}
      </div>

      <div className="px-3 py-3">{content}</div>
    </div>
  );
}

function ResultCard({
  copy,
  steps,
  routine,
  testProduct,
  afterIndex,
  simulation,
  onPlaceAfterMoisturizer,
  onTryPM,
  onAltNights,
  onSave,
}: {
  copy: typeof COPY.EN | typeof COPY.CN;
  steps: RoutineStep[];
  routine: 'am' | 'pm';
  testProduct: RoutineStep | null;
  afterIndex: number | null;
  simulation: CompatibilityResult | null;
  onPlaceAfterMoisturizer: () => void;
  onTryPM: () => void;
  onAltNights: () => void;
  onSave: () => void;
}) {
  if (!testProduct || typeof afterIndex !== 'number' || !simulation) return null;

  const conflicts = simulation.conflicts ?? [];
  const hasBlocking = conflicts.some((c) => (c.severity ?? 'warn') === 'block');
  const danger = conflicts.length > 0;

  const title = danger ? copy.caution : copy.safe;
  const color = danger ? (hasBlocking ? 'border-rose-500/40 bg-rose-500/5' : 'border-amber-500/40 bg-amber-500/5') : 'border-emerald-500/40 bg-emerald-500/5';

  const headline = conflicts[0]?.message ?? simulation.summary ?? '';

  return (
    <div className={cn('rounded-xl border p-3', color)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{copy.resultTitle}</div>
          <div className="mt-0.5 text-xs text-muted-foreground truncate">
            {testProduct.label ?? testProduct.type} · {routine.toUpperCase()}
          </div>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            'rounded-full text-[10px]',
            danger ? (hasBlocking ? 'bg-rose-500/15 text-rose-700' : 'bg-amber-500/15 text-amber-700') : 'bg-emerald-500/15 text-emerald-700',
          )}
        >
          {title}
        </Badge>
      </div>

      {headline ? <div className="mt-2 text-xs text-muted-foreground leading-snug">{headline}</div> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onAltNights}>
          {copy.altNights}
        </Button>
        <Button size="sm" variant="secondary" onClick={onPlaceAfterMoisturizer}>
          {copy.moveAfterMoisturizer}
        </Button>
        <Button size="sm" variant="secondary" onClick={onTryPM}>
          {copy.tryPM}
        </Button>
        <Button size="sm" onClick={onSave}>
          {copy.save}
        </Button>
      </div>
    </div>
  );
}

export function RoutineTimeline({
  className,
  language = 'EN',
  am,
  pm,
  conflicts,
  testProduct: defaultTestProduct,
  onSimulate,
}: RoutineTimelineProps) {
  const copy = COPY[language];

  const [activeRoutine, setActiveRoutine] = useState<'am' | 'pm'>('am');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState<RoutineStepType>(defaultTestProduct?.type ?? 'treatment');

  const [testProduct, setTestProduct] = useState<RoutineStep | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [afterIndexByRoutine, setAfterIndexByRoutine] = useState<{ am: number | null; pm: number | null }>({
    am: null,
    pm: null,
  });
  const [simulationByRoutine, setSimulationByRoutine] = useState<{ am: CompatibilityResult | null; pm: CompatibilityResult | null }>({
    am: null,
    pm: null,
  });

  const baseConflictsAM = conflicts?.am ?? [];
  const baseConflictsPM = conflicts?.pm ?? [];

  const stepsFor = useMemo(() => ({ am, pm }), [am, pm]);

  function runSim(routine: 'am' | 'pm', afterIndex: number, product: RoutineStep) {
    const steps = stepsFor[routine];
    const idx = clampAfterIndex(afterIndex, steps.length);
    const result =
      onSimulate?.({ routine, steps, testProduct: product, afterIndex: idx }) ??
      defaultSimulate({ steps, testProduct: product, afterIndex: idx });

    setAfterIndexByRoutine((prev) => ({ ...prev, [routine]: idx }));
    setSimulationByRoutine((prev) => ({ ...prev, [routine]: result }));
  }

  function startTest() {
    const fallbackLabel = language === 'CN' ? '测试单品' : 'Test product';
    const label = normalizeLabel(draftName, fallbackLabel);

    const product: RoutineStep = {
      id: 'test_product',
      type: draftType,
      label,
    };

    setTestProduct(product);
    setIsPlacing(true);
    setDrawerOpen(false);

    const steps = stepsFor[activeRoutine];
    const defaultAfterIndex = Math.max(-1, steps.length - 1);
    runSim(activeRoutine, defaultAfterIndex, product);
  }

  function exitTest() {
    setIsPlacing(false);
    setTestProduct(null);
    setAfterIndexByRoutine({ am: null, pm: null });
    setSimulationByRoutine({ am: null, pm: null });
  }

  function place(routine: 'am' | 'pm', afterIndex: number) {
    if (!testProduct) return;
    runSim(routine, afterIndex, testProduct);
  }

  function placeAfterMoisturizer(routine: 'am' | 'pm') {
    if (!testProduct) return;
    const steps = stepsFor[routine];
    const idx = steps.findIndex((s) => s.type === 'moisturizer');
    if (idx < 0) {
      toast(copy.noMoisturizer);
      return;
    }
    place(routine, idx);
  }

  function tryInPM() {
    setActiveRoutine('pm');
    if (!testProduct) return;

    const pmSteps = stepsFor.pm;
    const defaultAfterIndex = Math.max(-1, pmSteps.length - 1);
    // ensure PM has a placement+simulation immediately
    runSim('pm', afterIndexByRoutine.pm ?? defaultAfterIndex, testProduct);
  }

  function altNights() {
    toast(language === 'CN' ? '建议：隔天使用（即将支持自动应用）' : 'Suggestion: alternate nights (auto-apply coming soon)');
  }

  function save() {
    toast(copy.saved);
  }

  const typeOptions: Array<{ type: RoutineStepType; label: string }> = useMemo(() => {
    const L = language === 'CN';
    return [
      { type: 'cleanser', label: L ? '洁面' : 'Cleanser' },
      { type: 'serum', label: L ? '精华' : 'Serum' },
      { type: 'treatment', label: L ? '功效' : 'Active' },
      { type: 'moisturizer', label: L ? '保湿' : 'Moisturizer' },
      { type: 'sunscreen', label: L ? '防晒' : 'Sunscreen' },
      { type: 'other', label: L ? '其他' : 'Other' },
    ];
  }, [language]);

  return (
    <Card className={cn('w-full bg-white/90 backdrop-blur-sm border-border/70 shadow-card', className)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">{copy.title}</div>
            <div className="text-xs text-muted-foreground">{copy.subtitle}</div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isPlacing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setDrawerOpen(true)}>
                  {copy.changeBtn}
                </Button>
                <Button size="sm" onClick={exitTest}>
                  {copy.exitBtn}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setDrawerOpen(true)}>
                {copy.testBtn}
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeRoutine} onValueChange={(v) => setActiveRoutine(v as 'am' | 'pm')}>
          <TabsList className="w-full">
            <TabsTrigger value="am" className="flex-1">
              {language === 'CN' ? '早上 (AM)' : 'Morning (AM)'}
            </TabsTrigger>
            <TabsTrigger value="pm" className="flex-1">
              {language === 'CN' ? '晚上 (PM)' : 'Evening (PM)'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="am" className="space-y-3">
            <TimelineRow
              copy={copy}
              routine="am"
              steps={am}
              testProduct={testProduct}
              isPlacing={isPlacing}
              afterIndex={afterIndexByRoutine.am}
              simulation={simulationByRoutine.am}
              baseConflicts={baseConflictsAM}
              onPlace={(idx) => place('am', idx)}
            />

            <ResultCard
              copy={copy}
              steps={am}
              routine="am"
              testProduct={testProduct}
              afterIndex={afterIndexByRoutine.am}
              simulation={simulationByRoutine.am}
              onAltNights={altNights}
              onTryPM={tryInPM}
              onPlaceAfterMoisturizer={() => placeAfterMoisturizer('am')}
              onSave={save}
            />
          </TabsContent>

          <TabsContent value="pm" className="space-y-3">
            <TimelineRow
              copy={copy}
              routine="pm"
              steps={pm}
              testProduct={testProduct}
              isPlacing={isPlacing}
              afterIndex={afterIndexByRoutine.pm}
              simulation={simulationByRoutine.pm}
              baseConflicts={baseConflictsPM}
              onPlace={(idx) => place('pm', idx)}
            />

            <ResultCard
              copy={copy}
              steps={pm}
              routine="pm"
              testProduct={testProduct}
              afterIndex={afterIndexByRoutine.pm}
              simulation={simulationByRoutine.pm}
              onAltNights={altNights}
              onTryPM={tryInPM}
              onPlaceAfterMoisturizer={() => placeAfterMoisturizer('pm')}
              onSave={save}
            />
          </TabsContent>
        </Tabs>

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{copy.drawerTitle}</DrawerTitle>
              <DrawerDescription>{copy.drawerDesc}</DrawerDescription>
            </DrawerHeader>

            <div className="px-4 space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{copy.nameLabel}</div>
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder={copy.namePlaceholder}
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{copy.typeLabel}</div>
                <div className="grid grid-cols-3 gap-2">
                  {typeOptions.map((opt) => {
                    const Icon = STEP_ICON[opt.type] ?? Wand2;
                    const selected = draftType === opt.type;
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => setDraftType(opt.type)}
                        className={cn(
                          'rounded-xl border border-border/60 bg-muted/10 px-2 py-2 text-left',
                          selected ? 'ring-2 ring-primary/20 bg-primary/5' : 'hover:bg-muted/20',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', selected ? 'bg-primary/10' : 'bg-muted/20')}>
                            <Icon className={cn('h-4 w-4', selected ? 'text-primary' : 'text-foreground/70')} />
                          </div>
                          <div className="text-xs font-semibold text-foreground">{opt.label}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <DrawerFooter>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDrawerOpen(false)}>
                  {copy.cancel}
                </Button>
                <Button className="flex-1" onClick={startTest}>
                  {copy.startTest}
                </Button>
              </div>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </CardContent>
    </Card>
  );
}

