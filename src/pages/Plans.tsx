import React, { useMemo, useState } from 'react';
import { CalendarDays, MapPin, Menu, Sparkles } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import { bffJson, makeDefaultHeaders, type Language, type V1Envelope } from '@/lib/pivotaAgentBff';
import { getLangPref } from '@/lib/persistence';

export default function Plans() {
  const { openSidebar, startChat } = useOutletContext<MobileShellContext>();
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [itinerary, setItinerary] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const language: Language = useMemo(() => (getLangPref() === 'cn' ? 'CN' : 'EN'), []);

  const onSubmit = async () => {
    const destinationText = destination.trim();
    const itineraryText = itinerary.trim();
    setError('');

    if (!destinationText || !startDate || !endDate) {
      setError(language === 'CN' ? '请先填写地点和日期。' : 'Please fill destination and dates first.');
      return;
    }
    if (startDate > endDate) {
      setError(language === 'CN' ? '开始日期不能晚于结束日期。' : 'Start date cannot be after end date.');
      return;
    }

    try {
      setSaving(true);
      const headers = makeDefaultHeaders(language);
      await bffJson<V1Envelope>('/v1/profile/update', headers, {
        method: 'POST',
        body: JSON.stringify({
          travel_plans: [
            {
              destination: destinationText,
              start_date: startDate,
              end_date: endDate,
              ...(itineraryText ? { itinerary: itineraryText.slice(0, 1200) } : {}),
            },
          ],
        }),
      });

      const query =
        language === 'CN'
          ? `帮我做下周护肤计划。目的地：${destinationText}。日期：${startDate} 到 ${endDate}。${itineraryText ? `补充行程：${itineraryText}` : ''}`
          : `Help me plan my skincare for next week. Destination: ${destinationText}. Dates: ${startDate} to ${endDate}.${itineraryText ? ` Itinerary: ${itineraryText}` : ''}`;
      startChat({ kind: 'query', title: 'Travel skincare plan', query });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ios-page">
      <div className="ios-page-header">
        <button
          type="button"
          onClick={openSidebar}
          className="ios-nav-button"
          aria-label="Open menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <div className="ios-page-title">Plans</div>
        <div className="ios-header-spacer" />
      </div>

      <div className="ios-panel mt-4">
        <div className="flex items-start gap-3">
          <div className="aurora-home-role-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl border">
            <CalendarDays className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="ios-section-title">Plan next week</div>
            <div className="ios-caption mt-1">
              Tell Aurora your schedule (travel, workouts, sun exposure) and get a plan with AM/PM adjustments.
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="mb-1 text-xs text-muted-foreground">{language === 'CN' ? '地点' : 'Destination'}</div>
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={language === 'CN' ? '例如：Tokyo / Paris' : 'e.g. Tokyo / Paris'}
                className="h-6 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <div className="mb-1 text-xs text-muted-foreground">{language === 'CN' ? '开始日期' : 'Start date'}</div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground outline-none"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-xs text-muted-foreground">{language === 'CN' ? '结束日期' : 'End date'}</div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground outline-none"
              />
            </label>
          </div>

          <label className="block">
            <div className="mb-1 text-xs text-muted-foreground">{language === 'CN' ? '可选行程备注' : 'Optional itinerary'}</div>
            <textarea
              value={itinerary}
              onChange={(e) => setItinerary(e.target.value)}
              className="min-h-[86px] w-full resize-none rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              placeholder={
                language === 'CN'
                  ? '如：白天户外较多、飞行、滑雪、跑步、暴晒等'
                  : 'e.g. mostly outdoor daytime, flights, ski, workouts, heavy sun exposure'
              }
            />
          </label>
        </div>

        {error ? <div className="mt-3 text-xs text-red-500">{error}</div> : null}

        <button
          type="button"
          className="aurora-home-role-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card active:scale-[0.99] disabled:opacity-70"
          onClick={onSubmit}
          disabled={saving}
        >
          <Sparkles className="h-4 w-4" />
          {saving ? (language === 'CN' ? '保存中...' : 'Saving...') : language === 'CN' ? '保存并生成计划' : 'Save and build plan'}
        </button>
      </div>
    </div>
  );
}
