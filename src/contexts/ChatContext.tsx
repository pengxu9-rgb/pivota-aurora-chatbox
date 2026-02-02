import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { 
  Session, 
  Message, 
  Language, 
  BudgetTier, 
  FlowState,
  PhotoSlot,
  CheckoutOutcome,
  SkinConcern,
} from '@/lib/types';
import * as orchestrator from '@/lib/mockOrchestrator';
import * as analytics from '@/lib/analytics';
import { t } from '@/lib/i18n';
import { PivotaApiError } from '@/lib/pivotaApi';
import { clearPersistedChatState, getOrCreateAuroraUid, loadPersistedChatState, savePersistedChatState } from '@/lib/persistence';

interface ChatContextType {
  session: Session;
  messages: Message[];
  language: Language;
  isLoading: boolean;
  setLanguage: (lang: Language) => void;
  setForcedOutcome: (outcome: CheckoutOutcome) => void;
  handleAction: (actionId: string, data?: Record<string, any>) => void;
  addUserMessage: (text: string) => void;
  sendUserText: (text: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider');
  }
  return context;
}

let messageIdCounter = 0;
const generateMessageId = () => `msg_${Date.now()}_${++messageIdCounter}`;

const looksLikeAdverseReaction = (text: string) => {
  const t = text.toLowerCase();
  const en = [
    'burning',
    'burns',
    'stinging',
    'sting',
    'rash',
    'hives',
    'swelling',
    'swollen',
    'peeling',
    'blister',
    'itch',
    'itchy',
    'allergic',
    'allergy',
  ];
  const cn = [
    '刺痛',
    '灼痛',
    '过敏',
    '荨麻疹',
    '红肿',
    '肿',
    '脱皮',
    '起皮',
    '水泡',
    '瘙痒',
    '痒',
    '疼',
    '爆皮',
  ];
  return en.some((k) => t.includes(k)) || cn.some((k) => text.includes(k));
};

const adverseReactionGuidance = (language: Language) =>
  language === 'EN'
    ? [
        "I’m sorry — that sounds uncomfortable. I can’t diagnose, but if you have **facial swelling**, **hives**, **trouble breathing**, or **eye involvement**, please seek urgent medical care.",
        'If symptoms are mild/moderate, a conservative reset usually helps:',
        '1) Stop the new product + strong actives (retinoids, acids, benzoyl peroxide, vitamin C) for a few days',
        '2) Rinse with lukewarm water, keep it gentle',
        '3) Use a bland moisturizer (and petrolatum if very dry)',
        '4) Avoid exfoliating; wear sunscreen',
        'If it’s worsening or not improving in 48–72 hours, consider seeing a clinician.',
      ].join('\n')
    : [
        '听起来很不舒服。我不能做诊断，但如果出现 **明显红肿/荨麻疹**、**呼吸困难**、或 **眼周严重不适**，请尽快就医。',
        '如果是轻中度刺激，建议先做“温和修护重置”：',
        '1) 暂停新产品 + 强功效活性（A 醇/酸类/过氧化苯甲酰/高浓 VC 等）几天',
        '2) 温水轻柔清洁，不要搓洗',
        '3) 用简单保湿（很干可少量凡士林封层）',
        '4) 避免去角质，白天做好防晒',
        '如果 48–72 小时无改善或加重，建议联系医生/皮肤科。',
      ].join('\n');

const extractFirstUrl = (text: string) => {
  const match = text.match(/https?:\/\/\S+/i);
  if (!match) return undefined;
  return match[0].replace(/[)\],.]+$/, '');
};

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const resumeCandidateRef = useRef(loadPersistedChatState());
  const hasResumeCandidate = Boolean(resumeCandidateRef.current?.session && resumeCandidateRef.current?.messages);

  const [bootMode, setBootMode] = useState<'fresh' | 'resume_prompt' | 'running'>(hasResumeCandidate ? 'resume_prompt' : 'fresh');

  const [session, setSession] = useState<Session>(() => orchestrator.startSession());
  const [messages, setMessages] = useState<Message[]>([]);
  const [language, setLanguage] = useState<Language>(() => resumeCandidateRef.current?.language ?? 'EN');
  const [isLoading, setIsLoading] = useState(false);

  type ChipReply =
    | { kind: 'text'; text: string }
    | { kind: 'anchor'; anchorProductId: string };

  const chipReplyMapRef = useRef<Record<string, ChipReply>>({});
  const pendingAnchorQuestionRef = useRef<string | null>(null);

  useEffect(() => {
    // Ensure we have a stable anonymous user id for same-device "returning user".
    getOrCreateAuroraUid();
  }, []);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: generateMessageId(),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const addAssistantText = useCallback((content: string) => {
    addMessage({ type: 'text', role: 'assistant', content });
  }, [addMessage]);

  const addAssistantCard = useCallback((type: Message['type'], payload?: any) => {
    addMessage({ type, role: 'assistant', payload });
  }, [addMessage]);

  const initializeWelcome = useCallback((activeSession: Session) => {
    analytics.emitBriefStarted(activeSession.brief_id, activeSession.trace_id);

    setTimeout(() => {
      addAssistantText(t('s1.greeting', language));
      setTimeout(() => {
        addAssistantText(t('s1.intro', language));
        setTimeout(() => {
          addAssistantText(t('s1.disclaimer', language));
          setTimeout(() => {
            addAssistantText(t('s1.question', language));
            addAssistantCard('chips', {
              chips: [
                { action_id: 'intent_routine', label: t('s1.chip.routine', language) },
                { action_id: 'intent_breakouts', label: t('s1.chip.breakouts', language) },
                { action_id: 'intent_brightening', label: t('s1.chip.brightening', language) },
              ],
              actions: [
                {
                  action_id: 'start_product_analysis',
                  label: language === 'EN' ? '🔎 Analyze a product' : '🔎 分析单品',
                  variant: 'outline',
                },
                {
                  action_id: 'start_diagnosis',
                  label: language === 'EN' ? '🔬 Start Skin Diagnosis' : '🔬 开始皮肤诊断',
                  variant: 'outline',
                },
                { action_id: 'try_sample', label: t('s1.btn.sample', language), variant: 'ghost' },
              ],
            });
            setSession(prev => ({ ...prev, state: 'S1_OPEN_INTENT' }));
          }, 200);
        }, 200);
      }, 200);
    }, 300);
  }, [addAssistantCard, addAssistantText, language]);

  // Initialize with welcome message
  useEffect(() => {
    if (bootMode !== 'fresh') return;
    initializeWelcome(session);
    setBootMode('running');
  }, [bootMode, initializeWelcome, session]);

  // Resume prompt (only if we have a persisted session)
  useEffect(() => {
    if (bootMode !== 'resume_prompt') return;

    const savedAt = resumeCandidateRef.current?.saved_at;
    const lastSeen = savedAt ? new Date(savedAt).toLocaleString() : undefined;

    setTimeout(() => {
      addAssistantText(
        language === 'EN'
          ? `Welcome back${lastSeen ? ` — last active: ${lastSeen}` : ''}.`
          : `欢迎回来${lastSeen ? `（上次活跃：${lastSeen}）` : ''}。`
      );
      addAssistantCard('chips', {
        chips: [],
        actions: [
          { action_id: 'resume_previous', label: language === 'EN' ? 'Resume' : '继续上次', variant: 'primary' },
          { action_id: 'restart', label: language === 'EN' ? 'Start new' : '重新开始', variant: 'outline' },
        ],
      });
    }, 200);
  }, [bootMode, addAssistantText, addAssistantCard, language]);

  // Persist chat state on changes (skip the resume prompt stage)
  useEffect(() => {
    if (bootMode === 'resume_prompt') return;
    const auroraUid = getOrCreateAuroraUid();
    savePersistedChatState({
      saved_at: Date.now(),
      aurora_uid: auroraUid,
      language,
      session,
      messages,
    });
  }, [bootMode, language, messages, session]);

  const handleAction = useCallback(async (actionId: string, data?: Record<string, any>) => {
    console.log('[Action]', actionId, data);

    if (actionId === 'resume_previous') {
      const candidate = resumeCandidateRef.current;
      if (!candidate) return;

      setSession(candidate.session);
      setMessages(candidate.messages);
      setLanguage(candidate.language);
      setBootMode('running');

      analytics.emitBriefResumed(candidate.session.brief_id, candidate.session.trace_id, candidate.saved_at);
      return;
    }

    if (actionId === 'chat_generate_recos') {
      addMessage({
        type: 'text',
        role: 'user',
        content: language === 'EN' ? 'Show recommendations' : '生成推荐',
      });
      setIsLoading(true);
      addAssistantCard('loading_card', {
        message: language === 'EN' ? 'Generating recommendations…' : '正在生成推荐…',
      });
      try {
        await showProductRecommendations(session);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (actionId === 'chat_anchor_send_name') {
      addMessage({
        type: 'text',
        role: 'user',
        content: language === 'EN' ? 'I’ll send the product name' : '我发产品名',
      });
      addAssistantText(
        language === 'EN'
          ? 'Great — reply with the exact product name (brand + product).'
          : '好的——请直接回复具体产品名（品牌 + 产品名）。'
      );
      return;
    }

    if (actionId === 'chat_anchor_send_link') {
      addMessage({
        type: 'text',
        role: 'user',
        content: language === 'EN' ? 'I’ll paste a product link' : '我粘贴购买链接',
      });
      addAssistantText(
        language === 'EN'
          ? 'Paste the product link here (Amazon/Sephora/etc.).'
          : '请把购买链接粘贴到这里（Amazon/Sephora 等）。'
      );
      return;
    }

    if (actionId === 'chat_anchor_upload_photo') {
      addMessage({
        type: 'text',
        role: 'user',
        content: language === 'EN' ? 'I’ll upload a photo' : '我上传照片',
      });
      addAssistantText(
        language === 'EN'
          ? 'Tap the “+” button and upload a clear photo of the product front + ingredients list.'
          : '点击下方“+”上传产品正面 + 成分表的清晰照片。'
      );
      return;
    }

    if (actionId === 'start_product_analysis') {
      addMessage({
        type: 'text',
        role: 'user',
        content: language === 'EN' ? 'Analyze a product' : '分析一个单品',
      });

      addAssistantText(
        language === 'EN'
          ? 'Sure. For the best result, upload a clear photo of the product front + ingredients list (tap the camera button). You can also paste a link or type the product name.'
          : '可以。效果最好的是上传「产品正面 + 成分表」清晰照片（点击下方相机按钮）；你也可以粘贴购买链接或直接输入产品名。'
      );

      addAssistantCard('chips', {
        chips: [],
        actions: [
          { action_id: 'chat_anchor_upload_photo', label: language === 'EN' ? 'Upload a photo' : '上传照片', variant: 'primary' },
          { action_id: 'chat_anchor_send_link', label: language === 'EN' ? 'Paste product link' : '粘贴链接', variant: 'outline' },
          { action_id: 'chat_anchor_send_name', label: language === 'EN' ? 'Type product name' : '输入产品名', variant: 'outline' },
        ],
      });
      return;
    }

    if (actionId === 'chat_safety_mild') {
      addMessage({
        type: 'text',
        role: 'user',
        content: language === 'EN' ? 'Mostly mild irritation' : '偏轻微',
      });
      addAssistantText(adverseReactionGuidance(language));
      return;
    }

    if (actionId === 'chat_safety_severe') {
      addMessage({
        type: 'text',
        role: 'user',
        content: language === 'EN' ? 'Severe symptoms' : '比较严重',
      });
      addAssistantText(
        language === 'EN'
          ? 'If you have swelling/hives/trouble breathing/eye involvement, please seek urgent medical care now. If safe to do so, stop the product and rinse with water.'
          : '如果有明显红肿/荨麻疹/呼吸困难/眼周严重不适，请尽快就医；同时停用产品并用清水轻柔冲洗。'
      );
      return;
    }

    if (actionId.startsWith('chat_clarify_') || actionId.startsWith('chat_anchor_candidate_')) {
      const reply = chipReplyMapRef.current[actionId];
      if (!reply) return;
      delete chipReplyMapRef.current[actionId];

      if (reply.kind === 'text') {
        await sendUserText(reply.text);
        return;
      }

      const question =
        pendingAnchorQuestionRef.current ??
        (language === 'EN'
          ? 'Please evaluate this product for my skin and call out any cautions.'
          : '请评估这款产品是否适合我，并提示注意事项。');

      addMessage({
        type: 'text',
        role: 'user',
        content: language === 'EN' ? 'Use this product' : '选择该产品',
      });

      await sendToAgent(question, { anchor_product_id: reply.anchorProductId });
      return;
    }

    // Handle start diagnosis - explicit entry point
    if (actionId === 'start_diagnosis') {
      addMessage({ type: 'text', role: 'user', content: language === 'EN' ? 'Start skin diagnosis' : '开始皮肤诊断' });
      
      // Activate diagnosis flow - floating progress will appear automatically
      setSession(prev => ({ ...prev, state: 'S2_DIAGNOSIS', isDiagnosisActive: true }));
      
      setTimeout(() => {
        addAssistantText(t('diagnosis.intro', language));
        addAssistantCard('diagnosis_card');
      }, 300);
      return;
    }

    // Handle intents - AI detects intent and offers to start diagnosis
    if (actionId.startsWith('intent_')) {
      const intentId = actionId.replace('intent_', '');
      addMessage({ type: 'text', role: 'user', content: t(`s1.chip.${intentId}` as any, language) });
      analytics.emitIntentSelected(session.brief_id, session.trace_id, intentId);
      
      const newSession = orchestrator.submitIntent(session, intentId);
      setSession({ ...newSession, isDiagnosisActive: true });
      
      // AI recognizes intent and suggests diagnosis - floating progress appears automatically
      setTimeout(() => {
        const responseText = language === 'EN' 
          ? `Great! To help you ${intentId === 'routine' ? 'build a personalized routine' : intentId === 'breakouts' ? 'tackle breakouts effectively' : 'achieve brighter skin'}, I'd like to understand your skin better.`
          : `好的！为了帮你${intentId === 'routine' ? '建立个性化护肤流程' : intentId === 'breakouts' ? '有效解决痘痘问题' : '提亮肤色'}，我需要先了解你的肤质。`;
        addAssistantText(responseText);
        
        setTimeout(() => {
          addAssistantText(t('diagnosis.intro', language));
          addAssistantCard('diagnosis_card');
        }, 300);
      }, 300);
      return;
    }

    // Handle try sample photos - fast track
    if (actionId === 'try_sample') {
      addMessage({ type: 'text', role: 'user', content: t('s1.btn.sample', language) });
      
      // Fast-track with sample photos - activate diagnosis flow
      let newSession = orchestrator.submitIntent(session, 'routine');
      newSession = { ...newSession, isDiagnosisActive: true };
      newSession = await orchestrator.submitDiagnosis(
        newSession,
        {
          skinType: 'combination',
          concerns: ['acne', 'dullness'],
          currentRoutine: 'basic',
        },
        true
      );

      const { session: photoSession } = await orchestrator.attachPhotos(newSession, {}, 'sample_set_A');
      setSession({ ...photoSession, isDiagnosisActive: true });

      await runAnalysisFlow(photoSession);
      return;
    }

    // Handle diagnosis submission
    if (actionId === 'diagnosis_submit') {
      const { skinType, concerns, currentRoutine, barrierStatus } = data || {};
      addMessage({ type: 'text', role: 'user', content: `${skinType} skin, concerns: ${concerns?.join(', ')}` });
      try {
        const newSession = await orchestrator.submitDiagnosis(session, { skinType, concerns, currentRoutine });
        const diagnosisSnapshot = {
          ...(newSession.diagnosis ?? { skinType, concerns: concerns ?? [], currentRoutine: currentRoutine ?? 'basic' }),
          ...(barrierStatus ? { barrierStatus } : {}),
        };
        setSession({ ...newSession, diagnosis: diagnosisSnapshot as any });

        addAssistantText(
          language === 'EN'
            ? "Here’s your Skin Identity snapshot. Confirm when you’re ready to go deeper (optional photos help)."
            : '这是你的「皮肤画像」快照。确认后我们再继续（可选：上传照片会更准确）。'
        );
        addAssistantCard('skin_identity_card', { diagnosis: diagnosisSnapshot });
      } catch (err) {
        console.error('[Diagnosis] submit failed', err);
        const statusHint = err instanceof PivotaApiError && err.status ? ` (HTTP ${err.status})` : '';
        const configHint =
          err instanceof PivotaApiError && (err.status === 0 || err.status === 404)
            ? language === 'EN'
              ? ' (Check API URL: `VITE_API_BASE_URL` should point to the Glow Agent `/v1`.)'
              : '（请检查 API 配置：`VITE_API_BASE_URL` 应指向 Glow Agent 的 `/v1`。）'
            : '';
        addAssistantText(
          language === 'EN'
            ? `Sorry — I couldn't submit your diagnosis right now${statusHint}${configHint}. Please try again, or continue chatting below.`
            : `抱歉：诊断信息提交失败${statusHint}${configHint}。你可以稍后重试，或直接在下方继续对话。`
        );
      }
      return;
    }

    if (actionId === 'profile_update_concerns') {
      const nextConcerns = (data?.concerns as SkinConcern[] | undefined) ?? [];
      setSession(prev =>
        prev.diagnosis
          ? {
              ...prev,
              diagnosis: {
                ...prev.diagnosis,
                concerns: nextConcerns,
              },
            }
          : prev
      );
      return;
    }

    if (actionId === 'profile_confirm' || actionId === 'profile_upload_selfie') {
      addMessage({
        type: 'text',
        role: 'user',
        content: language === 'EN' ? (actionId === 'profile_confirm' ? 'Confirm profile' : 'Upload selfie') : actionId === 'profile_confirm' ? '确认画像' : '上传自拍',
      });

      analytics.emitPhotoPromptShown(session.brief_id, session.trace_id);
      setSession(prev => ({ ...prev, state: 'S3_PHOTO_OPTION' as FlowState, isDiagnosisActive: true }));
      addAssistantText(t('s3.intro', language));
      addAssistantText(t('s3.tip', language));
      addAssistantCard('photo_upload_card');
      return;
    }

    if (actionId === 'context_skip' || actionId === 'diagnosis_skip') {
      addMessage({ type: 'text', role: 'user', content: t('diagnosis.btn.skip', language) });
      try {
        const newSession = await orchestrator.submitDiagnosis(session, { concerns: [], currentRoutine: 'basic' }, true);
        setSession(newSession);

        setTimeout(() => {
          analytics.emitPhotoPromptShown(session.brief_id, session.trace_id);
          addAssistantText(t('s3.intro', language));
          addAssistantCard('photo_upload_card');
        }, 300);
      } catch (err) {
        console.error('[Diagnosis] skip failed', err);
        const statusHint = err instanceof PivotaApiError && err.status ? ` (HTTP ${err.status})` : '';
        const configHint =
          err instanceof PivotaApiError && (err.status === 0 || err.status === 404)
            ? language === 'EN'
              ? ' (Check API URL: `VITE_API_BASE_URL` should point to the Glow Agent `/v1`.)'
              : '（请检查 API 配置：`VITE_API_BASE_URL` 应指向 Glow Agent 的 `/v1`。）'
            : '';
        addAssistantText(
          language === 'EN'
            ? `Sorry — I couldn't skip diagnosis right now${statusHint}${configHint}. Please try again, or continue chatting below.`
            : `抱歉：跳过诊断失败${statusHint}${configHint}。你可以稍后重试，或直接在下方继续对话。`
        );
      }
      return;
    }

    // Handle photo actions
    if (actionId === 'photo_upload') {
      const photos = data?.photos as { daylight?: PhotoSlot; indoor_white?: PhotoSlot };
      (Object.keys(photos || {}) as Array<keyof typeof photos>).forEach((slot) => {
        if (photos?.[slot]) analytics.emitPhotoUploadStarted(session.brief_id, session.trace_id, String(slot));
      });

      try {
        const { session: photoSession, qcIssues } = await orchestrator.attachPhotos(session, photos);
        setSession(photoSession);

        (Object.keys(photos || {}) as Array<keyof typeof photos>).forEach((slot) => {
          if (photos?.[slot]) analytics.emitPhotoUploadSucceeded(session.brief_id, session.trace_id, String(slot));
        });
      
        if (qcIssues.length > 0 && photoSession.state === 'S3a_PHOTO_QC') {
        // Show QC message
        const issue = qcIssues[0];
        const qcKey = issue.status === 'too_dark' ? 'qc.too_dark' : 
                      issue.status === 'has_filter' ? 'qc.has_filter' : 'qc.blurry';
        addAssistantText(t(qcKey as any, language));
        addAssistantCard('chips', {
          chips: [],
          actions: [
            { action_id: 'qc_reupload', label: t('qc.btn.reupload', language), variant: 'secondary' },
            { action_id: 'qc_continue', label: t('qc.btn.continue', language), variant: 'ghost' },
          ],
        });
        } else {
        // Proceed to analysis
        await runAnalysisFlow(photoSession);
        }
      } catch (err: any) {
        const reason = typeof err?.message === 'string' ? err.message : 'unknown';
        (Object.keys(photos || {}) as Array<keyof typeof photos>).forEach((slot) => {
          if (photos?.[slot]) analytics.emitPhotoUploadFailed(session.brief_id, session.trace_id, String(slot), reason);
        });
        console.error('[Photo upload] failed', err);
        const statusHint = err instanceof PivotaApiError && err.status ? ` (HTTP ${err.status})` : '';
        const configHint =
          err instanceof PivotaApiError && (err.status === 0 || err.status === 404 || err.status === 405)
            ? language === 'EN'
              ? ' (Check upload config: remove `VITE_UPLOAD_ENDPOINT` or set it to the same host as `VITE_API_BASE_URL`.)'
              : '（请检查上传配置：删除 `VITE_UPLOAD_ENDPOINT` 或将其设置为与 `VITE_API_BASE_URL` 相同的 host。）'
            : '';
        addAssistantText(
          language === 'EN'
            ? `Photo upload failed${statusHint}${configHint} You can also skip photos for now.`
            : `照片上传失败${statusHint}${configHint}。你也可以先选择跳过。`
        );
      }
      return;
    }

    if (actionId === 'photo_skip') {
      addMessage({ type: 'text', role: 'user', content: t('s3.btn.skip', language) });
      const newSession = orchestrator.skipPhotos(session);
      setSession(newSession);
      await runAnalysisFlow(newSession);
      return;
    }

    if (actionId.startsWith('photo_use_sample_')) {
      const sampleSetId = actionId.replace('photo_use_sample_', '');
      addMessage({ type: 'text', role: 'user', content: t('s3.btn.sample', language) });
      const { session: photoSession } = await orchestrator.attachPhotos(session, {}, sampleSetId);
      setSession(photoSession);
      await runAnalysisFlow(photoSession);
      return;
    }

    if (actionId === 'qc_continue' || actionId === 'qc_reupload') {
      addMessage({ type: 'text', role: 'user', content: t(actionId === 'qc_continue' ? 'qc.btn.continue' : 'qc.btn.reupload', language) });
      const newSession = { ...session, state: 'S4_ANALYSIS_LOADING' as FlowState };
      setSession(newSession);
      await runAnalysisFlow(newSession);
      return;
    }

    if (actionId === 'analysis_skip') {
      addMessage({ type: 'text', role: 'user', content: t('s4.btn.skip', language) });
      try {
        const { session: analysisSession, analysis } = await orchestrator.runAnalysis(session);
        setSession(analysisSession);
        addAssistantCard('analysis_summary', { analysis, session: analysisSession });
      } catch (err) {
        console.error('[Analysis] failed', err);
        addAssistantText(language === 'EN' ? 'Analysis failed. Please try again.' : '分析失败，请重试。');
      }
      return;
    }

    if (actionId === 'analysis_review_products') {
      addMessage({
        type: 'text',
        role: 'user',
        content: language === 'EN' ? 'Review my current products first' : '先评估我现在用的产品',
      });

      await sendToAgent(
        language === 'EN'
          ? 'Before recommending anything, please review my current skincare products and tell me what to keep/change.'
          : '在推荐之前，请先评估我现在用的护肤品：哪些适合保留，哪些需要替换/注意。'
      );
      return;
    }

    // Handle analysis summary actions
    if (actionId === 'analysis_continue') {
      // The CTA label is "See product recommendations" — treat it as an explicit recommendation request.
      addMessage({ type: 'text', role: 'user', content: t('s5.btn.continue', language) });
      setSession(prev => ({ ...prev, isDiagnosisActive: true }));

      // Only ask risk/budget when the user explicitly wants recommendations.
      if (session.analysis?.needs_risk_check && !session.analysis?.risk_answered) {
        analytics.emitRiskQuestionShown(session.brief_id, session.trace_id);
        setSession(prev => ({ ...prev, state: 'S5a_RISK_CHECK' as FlowState }));
        addAssistantCard('risk_check_card');
      } else {
        setSession(prev => ({ ...prev, state: 'S6_BUDGET' as FlowState }));
        showBudgetCard();
      }
      return;
    }

    if (actionId === 'analysis_gentler' || actionId === 'analysis_simple') {
      const labelKey = actionId === 'analysis_gentler' ? 's5.btn.gentler' : 's5.btn.simple';
      addMessage({ type: 'text', role: 'user', content: t(labelKey as any, language) });

      addAssistantText(language === 'EN' ? 'What would you like to do next?' : '你接下来想做什么？');
      addAssistantCard('chips', {
        chips: [],
        actions: [
          {
            action_id: 'post_analysis_chat',
            label: language === 'EN' ? '💬 Keep chatting' : '💬 继续聊天',
            variant: 'primary',
          },
          {
            action_id: 'analysis_review_products',
            label: language === 'EN' ? '🔎 Review my current products' : '🔎 先评估我现在用的产品',
            variant: 'outline',
          },
          {
            action_id: 'post_analysis_recos',
            label: language === 'EN' ? '✨ Get product recommendations' : '✨ 获取产品推荐',
            variant: 'outline',
          },
        ],
      });
      return;
    }

    if (actionId === 'post_analysis_chat') {
      addMessage({ type: 'text', role: 'user', content: language === 'EN' ? 'Keep chatting' : '继续聊天' });
      setSession(prev => ({ ...prev, state: 'S1_OPEN_INTENT' as FlowState, isDiagnosisActive: false }));
      addAssistantText(
        language === 'EN'
          ? "Sure — ask me anything. If you want, you can also paste a product link to evaluate it."
          : "当然——你随时可以继续问问题。你也可以直接粘贴产品链接让我评估。"
      );
      return;
    }

    if (actionId === 'post_analysis_recos') {
      addMessage({ type: 'text', role: 'user', content: language === 'EN' ? 'Get recommendations' : '获取推荐' });
      setSession(prev => ({ ...prev, isDiagnosisActive: true }));

      // Only ask risk/budget when the user explicitly wants recommendations.
      if (session.analysis?.needs_risk_check && !session.analysis?.risk_answered) {
        analytics.emitRiskQuestionShown(session.brief_id, session.trace_id);
        setSession(prev => ({ ...prev, state: 'S5a_RISK_CHECK' as FlowState }));
        addAssistantCard('risk_check_card');
      } else {
        setSession(prev => ({ ...prev, state: 'S6_BUDGET' as FlowState }));
        showBudgetCard();
      }
      return;
    }

    // Handle risk check
    if (actionId.startsWith('risk_check_')) {
      const answer = actionId.replace('risk_check_', '') as 'yes' | 'no' | 'not_sure' | 'skip';
      const labelKey = `s5a.btn.${answer}` as any;
      addMessage({ type: 'text', role: 'user', content: t(labelKey, language) });
      
      analytics.emitRiskQuestionAnswered(session.brief_id, session.trace_id, answer);
      const newSession = await orchestrator.answerRiskCheck(session, answer);
      setSession(newSession);
      showBudgetCard(newSession);
      return;
    }

    // Handle budget submission
    if (actionId === 'budget_submit') {
      const budget = data?.budget as BudgetTier;
      addMessage({ type: 'text', role: 'user', content: t(`budget.${budget}` as any, language) });
      
      const newSession = orchestrator.submitBudget(session, budget);
      setSession(newSession);
      await showProductRecommendations(newSession);
      return;
    }

    if (actionId === 'budget_skip') {
      addMessage({ type: 'text', role: 'user', content: t('budget.btn.skip', language) });
      const newSession = orchestrator.submitBudget(session, undefined, true);
      setSession(newSession);
      await showProductRecommendations(newSession);
      return;
    }

    // Handle product selection (premium vs dupe)
    if (actionId.startsWith('select_premium_') || actionId.startsWith('select_dupe_')) {
      const type = actionId.startsWith('select_premium_') ? 'premium' : 'dupe';
      const skuId = actionId.replace(type === 'premium' ? 'select_premium_' : 'select_dupe_', '');
      const categoryFromData = data?.category as string | undefined;

      const allPairs = [...(session.productPairs?.am ?? []), ...(session.productPairs?.pm ?? [])];
      const inferredCategory =
        categoryFromData ||
        allPairs.find((p) => p.premium.product.sku_id === skuId || p.dupe.product.sku_id === skuId)?.category;

      if (!inferredCategory) return;

      const offerId = (data?.offer_id as string | undefined) ?? (data?.offerId as string | undefined);
      const nextSession = await orchestrator.patchRoutineSelection(session, {
        key: inferredCategory,
        type,
        sku_id: skuId,
        offer_id: offerId,
      });
      setSession(nextSession);
      return;
    }

    // Handle checkout
    if (actionId === 'checkout_confirm' || actionId === 'checkout') {
      addMessage({ type: 'text', role: 'user', content: t('s6.btn.checkout', language) });
      analytics.emitCheckoutStarted(session.brief_id, session.trace_id);

      const checkoutSession = orchestrator.goToCheckout(session);
      setSession(checkoutSession);

      setIsLoading(true);
      addAssistantCard('loading_card', { message: t('loading', language) });

      const internalItems = data?.internalItems as { offer: { offer_id: string } }[] | undefined;
      const offerIds =
        (data?.offer_ids as string[] | undefined) ??
        (internalItems ? internalItems.map((i) => i.offer.offer_id) : undefined) ??
        Object.values(session.selected_offers ?? {});

      try {
        const { session: resultSession, result } = await orchestrator.checkout(checkoutSession, { offer_ids: offerIds });
        setSession(resultSession);

        if (result.success) {
          analytics.emitCheckoutSucceeded(session.brief_id, session.trace_id, result.order_id!, result.total!);
          addAssistantCard('success_card', { result, session: resultSession });
        } else {
          analytics.emitCheckoutFailed(session.brief_id, session.trace_id, result.reason_code!);
          addAssistantCard('failure_card', { result, session: resultSession });
        }
      } catch (err) {
        console.error('[Checkout] failed', err);
        addAssistantText(language === 'EN' ? 'Checkout failed. Please try again.' : '结账失败，请重试。');
      } finally {
        setIsLoading(false);
      }

      return;
    }

    // Handle recovery actions
    if (actionId.startsWith('recovery_')) {
      const action = actionId.replace('recovery_', '') as 'switch_offer' | 'switch_payment' | 'try_again' | 'adjust_routine';
      const labelKey = `s10.btn.${action.replace('_', '_')}` as any;
      addMessage({ type: 'text', role: 'user', content: t(labelKey, language) });
      
      analytics.emitRecoveryActionSelected(session.brief_id, session.trace_id, action);
      const newSession = orchestrator.recoveryAction(session, action);
      setSession(newSession);
      
      if (action === 'adjust_routine' || action === 'switch_offer') {
        await showProductRecommendations(newSession);
      } else {
        // Try again or switch payment
        await handleAction('checkout_confirm');
      }
      return;
    }

    // Handle restart
    if (actionId === 'restart') {
      analytics.emitBriefEnded(session.brief_id, session.trace_id, 'restart');
      clearPersistedChatState();
      resumeCandidateRef.current = undefined;
      const newSession = orchestrator.restartSession(session);
      setSession({ ...newSession, isDiagnosisActive: false });
      setMessages([]);
      setBootMode('running');
      initializeWelcome(newSession);
      return;
    }

    // Handle preference re-ranking (cheaper, gentler, fastest)
    if (actionId.startsWith('pref_')) {
      const rawPreference = actionId.replace('pref_', '') as
        | 'cheaper'
        | 'gentler'
        | 'fastest'
        | 'fastest_delivery'
        | 'keep';
      const preference = (rawPreference === 'fastest_delivery' ? 'fastest' : rawPreference) as
        | 'cheaper'
        | 'gentler'
        | 'fastest'
        | 'keep';
      const prefLabels = {
        cheaper: language === 'EN' ? 'Cheaper options' : '更便宜',
        gentler: language === 'EN' ? 'Gentler options' : '更温和',
        fastest: language === 'EN' ? 'Fastest delivery' : '最快到货',
        keep: language === 'EN' ? 'Keep current' : '保持不变',
      };
      addMessage({ type: 'text', role: 'user', content: prefLabels[preference] });
      analytics.emitPreferenceSelected(session.brief_id, session.trace_id, preference);
      
      // Re-build product pairs with preference
      const { session: pairSession, amPairs, pmPairs } = await orchestrator.buildProductPairs(session, preference);
      setSession(pairSession);
      analytics.emitRoutineShown(pairSession.brief_id, pairSession.trace_id, amPairs.length + pmPairs.length);
      
      addAssistantText(
        language === 'EN'
          ? `I've re-sorted your options for ${preference === 'cheaper' ? 'best prices' : preference === 'gentler' ? 'gentler formulas' : preference === 'fastest' ? 'fastest delivery' : 'your preferences'}.`
          : `已按${preference === 'cheaper' ? '最低价格' : preference === 'gentler' ? '温和配方' : preference === 'fastest' ? '最快到货' : '您的偏好'}重新排序。`
      );
      
      // Show updated AM routine
      setTimeout(() => {
        addAssistantCard('product_comparison_card', { 
          pairs: amPairs, 
          routine: 'am',
          session: pairSession 
        });
        
        // Show PM routine after delay
        setTimeout(() => {
          addAssistantCard('product_comparison_card', { 
            pairs: pmPairs, 
            routine: 'pm',
            session: pairSession 
          });
        }, 300);
      }, 300);
      return;
    }

    // Handle affiliate list open
    if (actionId === 'set_open_affiliate_list' || actionId === 'open_affiliate_list') {
      const { affiliateItems } = data || {};
      const affiliateItemsSafe = Array.isArray(affiliateItems) ? affiliateItems : [];
      addMessage({ 
        type: 'text', 
        role: 'user', 
        content: language === 'EN' ? 'Open retailer links' : '打开零售商链接' 
      });

      setIsLoading(true);
      addAssistantCard('loading_card', {
        message: language === 'EN' ? 'Fetching retailer links…' : '正在获取购买链接…',
      });

      try {
        const resolved = await orchestrator.resolveAffiliateItems(session, affiliateItemsSafe);
        addAssistantText(
          language === 'EN'
            ? 'Here are the retailer links for your remaining items. Tap to open each store.'
            : '以下是您剩余商品的零售商链接。点击打开各商店。'
        );
        addAssistantCard('affiliate_outcome_card', { affiliateItems: resolved });
      } catch (err) {
        console.error('[Affiliate] resolve failed', err);
        addAssistantText(
          language === 'EN'
            ? 'I could not load retailer links right now. Showing basic links instead.'
            : '暂时无法获取零售商链接，先展示基础链接。'
        );
        addAssistantCard('affiliate_outcome_card', { affiliateItems: affiliateItemsSafe });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Handle mixed checkout (internal only)
    if (actionId === 'set_checkout_internal_only' || actionId === 'checkout_internal_only') {
      const { internalItems, affiliateItems } = data || {};
      addMessage({
        type: 'text',
        role: 'user',
        content: language === 'EN' ? 'Checkout available items' : '结账可购商品',
      });
      analytics.emitCheckoutStarted(session.brief_id, session.trace_id);

      const checkoutSession = orchestrator.goToCheckout(session);
      setSession(checkoutSession);

      setIsLoading(true);
      addAssistantCard('loading_card', { message: t('loading', language) });

      const offerIds = Array.isArray(internalItems)
        ? internalItems.map((i: any) => i.offer?.offer_id).filter(Boolean)
        : [];

      try {
        const { session: resultSession, result } = await orchestrator.checkout(checkoutSession, { offer_ids: offerIds });
        setSession(resultSession);

        if (result.success) {
          analytics.emitCheckoutSucceeded(session.brief_id, session.trace_id, result.order_id!, result.total!);
          addAssistantCard('success_card', { result, session: resultSession });

          // Show affiliate items if any remain
          if (affiliateItems && affiliateItems.length > 0) {
            setTimeout(() => {
              void (async () => {
                addAssistantText(
                  language === 'EN'
                    ? 'Great! Now complete your purchase for the remaining items on retailer sites:'
                    : '太好了！现在请在零售商网站完成剩余商品的购买：'
                );

                try {
                  const resolved = await orchestrator.resolveAffiliateItems(resultSession, affiliateItems);
                  addAssistantCard('affiliate_outcome_card', { affiliateItems: resolved });
                } catch (err) {
                  console.error('[Affiliate] resolve failed', err);
                  addAssistantCard('affiliate_outcome_card', { affiliateItems });
                }
              })();
            }, 500);
          }
        } else {
          analytics.emitCheckoutFailed(session.brief_id, session.trace_id, result.reason_code!);
          addAssistantCard('failure_card', { result, session: resultSession });
        }
      } catch (err) {
        console.error('[Checkout] failed', err);
        addAssistantText(language === 'EN' ? 'Checkout failed. Please try again.' : '结账失败，请重试。');
      } finally {
        setIsLoading(false);
      }

      return;
    }

    // Handle affiliate outcome actions
    if (actionId === 'affiliate_outcome_success') {
      addMessage({ 
        type: 'text', 
        role: 'user', 
        content: language === 'EN' ? 'I completed my purchase' : '我已完成购买' 
      });
      analytics.emitAffiliateOutcomeReported(session.brief_id, session.trace_id, 'success');
      await orchestrator.reportAffiliateOutcome(session, 'success');
      analytics.emitBriefEnded(session.brief_id, session.trace_id, 'affiliate_success');
      
      addAssistantText(
        language === 'EN'
          ? '🎉 Awesome! Your routine is complete. Enjoy your new skincare products!'
          : '🎉 太棒了！您的护肤流程已完成。祝您享受新的护肤品！'
      );
      addAssistantCard('chips', {
        chips: [],
        actions: [
          { action_id: 'restart', label: language === 'EN' ? 'Start new analysis' : '开始新分析', variant: 'secondary' },
        ],
      });
      return;
    }

    if (actionId === 'affiliate_outcome_failed') {
      addMessage({ 
        type: 'text', 
        role: 'user', 
        content: language === 'EN' ? "Couldn't complete" : '无法完成' 
      });
      analytics.emitAffiliateOutcomeReported(session.brief_id, session.trace_id, 'failed');
      await orchestrator.reportAffiliateOutcome(session, 'failed');
      
      addAssistantText(
        language === 'EN'
          ? "No worries! Would you like to try a different retailer or see alternative products?"
          : "没关系！您想尝试其他零售商还是查看替代产品？"
      );
      addAssistantCard('chips', {
        chips: [],
        actions: [
          { action_id: 'recovery_switch_offer', label: language === 'EN' ? 'Try different retailer' : '尝试其他零售商', variant: 'primary' },
          { action_id: 'recovery_adjust_routine', label: language === 'EN' ? 'Show alternatives' : '显示替代品', variant: 'secondary' },
          { action_id: 'save', label: language === 'EN' ? 'Save for later' : '稍后再说', variant: 'ghost' },
        ],
      });
      return;
    }

    if (actionId === 'affiliate_outcome_save') {
      addMessage({ 
        type: 'text', 
        role: 'user', 
        content: language === 'EN' ? 'Save routine' : '保存方案' 
      });
      analytics.emitAffiliateOutcomeReported(session.brief_id, session.trace_id, 'save');
      await orchestrator.reportAffiliateOutcome(session, 'save');
      
      addAssistantText(
        language === 'EN'
          ? '📌 Your routine has been saved! You can come back anytime to complete your purchase.'
          : '📌 您的护肤方案已保存！您可以随时回来完成购买。'
      );
      addAssistantCard('chips', {
        chips: [],
        actions: [
          { action_id: 'restart', label: language === 'EN' ? 'Start new analysis' : '开始新分析', variant: 'secondary' },
        ],
      });
      return;
    }

    // Handle offer selection
    if (actionId === 'select_offer') {
      const { sku_id, offer_id } = data || {};
      if (sku_id && offer_id) {
        analytics.emitOfferSelected(session.brief_id, session.trace_id, sku_id, offer_id);
        const newSession = orchestrator.chooseOffer(session, sku_id, offer_id);
        setSession(newSession);
      }
      return;
    }

    // Handle product photo upload for cosmetic analysis
    if (actionId === 'product_photo_upload') {
      const { preview } = data || {};
      if (!preview) return;
      
      addMessage({ 
        type: 'text', 
        role: 'user', 
        content: language === 'EN' ? '📷 Uploaded product photo for analysis' : '📷 上传了产品照片待分析'
      });
      
      // Show loading state
      setIsLoading(true);
      setSession(prev => ({ ...prev, state: 'P1_PRODUCT_ANALYZING' as FlowState }));
      
      setTimeout(() => {
        addAssistantText(language === 'EN' 
          ? "Analyzing your product... I'll check ingredients, match it to your skin profile, and find any better alternatives."
          : "正在分析产品... 我会检查成分、匹配肤质，并查找更好的替代选择。"
        );
        addAssistantCard('loading_card', { 
          message: language === 'EN' ? 'Analyzing product...' : '分析产品中...' 
        });
        
        // Run product analysis
        setTimeout(() => {
          const { session: analysisSession, result } = orchestrator.analyzeProduct(session, preview);
          setSession(analysisSession);
          setIsLoading(false);
          
          addAssistantText(language === 'EN' 
            ? `I've analyzed **${result.productName}** by ${result.brand}. Here's what I found:`
            : `已分析完成 **${result.productName}** (${result.brand})。以下是分析结果：`
          );
          addAssistantCard('product_analysis_card', { result, photoPreview: preview });
        }, 2000);
      }, 300);
      return;
    }
    
    // Handle product analysis completion
    if (actionId === 'product_analysis_done') {
      addMessage({ type: 'text', role: 'user', content: language === 'EN' ? 'Done' : '完成' });
      
      // Return to normal state, offer next steps
      setSession(prev => ({ ...prev, state: 'S1_OPEN_INTENT' as FlowState, productAnalysis: undefined }));
      
      setTimeout(() => {
        addAssistantText(language === 'EN' 
          ? "Would you like to do anything else?"
          : "还需要其他帮助吗？"
        );
        addAssistantCard('chips', {
          chips: [
            { action_id: 'intent_routine', label: t('s1.chip.routine', language) },
            { action_id: 'intent_brightening', label: t('s1.chip.brightening', language) },
          ],
          actions: [
            { action_id: 'start_diagnosis', label: language === 'EN' ? '🔬 Start Skin Diagnosis' : '🔬 开始皮肤诊断', variant: 'outline' },
          ],
        });
      }, 300);
      return;
    }
    
    // Handle analyze another product
    if (actionId === 'product_analysis_another') {
      addMessage({ type: 'text', role: 'user', content: language === 'EN' ? 'Analyze another' : '分析另一个' });
      
      setSession(prev => ({ ...prev, state: 'S1_OPEN_INTENT' as FlowState, productAnalysis: undefined }));
      
      setTimeout(() => {
        addAssistantText(language === 'EN' 
          ? "Sure! Take or upload a photo of another product using the camera button below."
          : "好的！使用下方的相机按钮拍摄或上传另一个产品的照片。"
        );
      }, 300);
      return;
    }

  }, [session, language, isLoading, addMessage, addAssistantText, addAssistantCard]);

  const runAnalysisFlow = useCallback(async (currentSession: Session) => {
    setIsLoading(true);
    addAssistantCard('loading_card', { message: t('s4.analyzing', language) });

    analytics.emitAnalysisStarted(currentSession.brief_id, currentSession.trace_id);
    const photoCount = Object.values(currentSession.photos).filter((p) => p?.preview).length;

    try {
      const { session: analysisSession, analysis } = await orchestrator.runAnalysis(currentSession);
      setSession(analysisSession);
      analytics.emitAnalysisCompleted(analysisSession.brief_id, analysisSession.trace_id, photoCount);
      addAssistantCard('analysis_summary', { analysis, session: analysisSession });
    } catch (err) {
      console.error('[Analysis] failed', err);
      addAssistantText(language === 'EN' ? 'Analysis failed. Please try again.' : '分析失败，请重试。');
    } finally {
      setIsLoading(false);
    }
  }, [language, addAssistantCard, addAssistantText]);

  const showBudgetCard = useCallback((currentSession?: Session) => {
    setTimeout(() => {
      addAssistantText(t('budget.intro', language));
      addAssistantCard('budget_card');
    }, 300);
  }, [language, addAssistantText, addAssistantCard]);

  const showProductRecommendations = useCallback(async (currentSession: Session) => {
    try {
      const { session: pairSession, amPairs, pmPairs } = await orchestrator.buildProductPairs(currentSession);
      setSession(pairSession);
      analytics.emitRoutineShown(pairSession.brief_id, pairSession.trace_id, amPairs.length + pmPairs.length);

      // Show AM routine
      addAssistantCard('product_comparison_card', {
        pairs: amPairs,
        routine: 'am',
        session: pairSession,
      });

      // Show PM routine after a short delay
      setTimeout(() => {
        addAssistantCard('product_comparison_card', {
          pairs: pmPairs,
          routine: 'pm',
          session: pairSession,
        });
      }, 300);
    } catch (err) {
      console.error('[Routine] failed', err);
      addAssistantText(language === 'EN' ? 'Could not load recommendations. Please try again.' : '无法加载推荐，请重试。');
    }
  }, [addAssistantCard, addAssistantText, language]);

  const addUserMessage = useCallback((text: string) => {
    addMessage({ type: 'text', role: 'user', content: text });
  }, [addMessage]);

  const sendToAgent = useCallback(
    async (message: string, options: { anchor_product_id?: string; anchor_product_url?: string } = {}) => {
      setIsLoading(true);
      try {
        const res = await orchestrator.sendChatMessage(session, message, language, options);
        const answer = typeof res?.answer === 'string' ? res.answer : '';
        addAssistantText(answer || (language === 'EN' ? '…' : '…'));

        const hasRoutine = Boolean(
          res &&
            typeof res === 'object' &&
            (res as any).context &&
            typeof (res as any).context === 'object' &&
            (res as any).context.routine
        );

        if (res?.intent === 'routine' || hasRoutine) {
          pendingAnchorQuestionRef.current = null;
          addAssistantCard('chips', {
            chips: [],
            actions: [
              {
                action_id: 'chat_generate_recos',
                label: language === 'EN' ? '✨ Generate recommendations' : '✨ 生成推荐卡片',
                variant: 'primary',
              },
              {
                action_id: 'start_diagnosis',
                label: language === 'EN' ? '🔬 Start diagnosis (more accurate)' : '🔬 开始诊断（更准确）',
                variant: 'outline',
              },
            ],
          });
          return;
        }

        if (res?.intent === 'clarify' && (res as any)?.clarification?.questions) {
          const questions = (res as any).clarification.questions;
          const q0 = Array.isArray(questions) ? questions[0] : undefined;
          const qid = q0 && typeof q0.id === 'string' ? q0.id : undefined;
          const questionText = q0 && typeof q0.question === 'string' ? q0.question : undefined;
          const opts = q0 && Array.isArray(q0.options) ? q0.options : [];

          if (questionText) addAssistantText(questionText);

          if (qid === 'anchor') {
            pendingAnchorQuestionRef.current = message;

            const candidates = (res as any)?.clarification?.candidates;
            const now = Date.now();
            const candidateChips =
              Array.isArray(candidates)
                ? candidates
                    .slice(0, 6)
                    .map((cand: any, idx: number) => {
                      const productId = cand?.product_id ?? cand?.productId;
                      if (!productId) return null;
                      const alias = cand?.matched_alias ?? cand?.matchedAlias;
                      const base = alias ? String(alias) : language === 'EN' ? 'Option' : '候选';
                      const label = language === 'EN' ? `${base} #${idx + 1}` : `${base} ${idx + 1}`;
                      const action_id = `chat_anchor_candidate_${now}_${idx}`;
                      chipReplyMapRef.current[action_id] = { kind: 'anchor', anchorProductId: String(productId) };
                      return { action_id, label };
                    })
                    .filter(Boolean)
                : [];

            addAssistantCard('chips', {
              chips: candidateChips,
              actions: [
                {
                  action_id: 'chat_anchor_send_name',
                  label: language === 'EN' ? 'Type product name' : '输入产品名',
                  variant: 'outline',
                },
                {
                  action_id: 'chat_anchor_send_link',
                  label: language === 'EN' ? 'Paste product link' : '粘贴链接',
                  variant: 'outline',
                },
                {
                  action_id: 'chat_anchor_upload_photo',
                  label: language === 'EN' ? 'Upload a photo' : '上传照片',
                  variant: 'outline',
                },
              ],
            });
            return;
          }

          pendingAnchorQuestionRef.current = null;
          if (opts.length > 0) {
            const now = Date.now();
            const chips = opts.slice(0, 12).map((opt: any, idx: number) => {
              const label = String(opt);
              const action_id = `chat_clarify_${now}_${idx}`;
              chipReplyMapRef.current[action_id] = { kind: 'text', text: label };
              return { action_id, label };
            });
            addAssistantCard('chips', { chips });
          }
          return;
        }

        pendingAnchorQuestionRef.current = null;
      } catch (err) {
        console.error('[Chat] sendToAgent failed', err);
        addAssistantText(
          language === 'EN'
            ? 'Sorry — I could not reach the agent backend. Please try again.'
            : '抱歉：暂时无法连接到 Agent 后端，请稍后再试。'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [addAssistantCard, addAssistantText, language, session]
  );

  const sendUserText = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || isLoading) return;

      addUserMessage(message);

      if (looksLikeAdverseReaction(message)) {
        addAssistantText(adverseReactionGuidance(language));
        addAssistantCard('chips', {
          chips: [
            { action_id: 'chat_safety_mild', label: language === 'EN' ? 'Mild / moderate' : '轻微/中度' },
            { action_id: 'chat_safety_severe', label: language === 'EN' ? 'Severe / swelling / breathing' : '严重/红肿/呼吸' },
          ],
        });
        return;
      }

      const url = extractFirstUrl(message);
      await sendToAgent(message, url ? { anchor_product_url: url } : {});
    },
    [addAssistantCard, addAssistantText, addUserMessage, isLoading, language, sendToAgent]
  );

  const setForcedOutcome = useCallback((outcome: CheckoutOutcome) => {
    setSession(prev => ({ ...prev, forced_outcome: outcome }));
  }, []);

  return (
    <ChatContext.Provider value={{
      session,
      messages,
      language,
      isLoading,
      setLanguage,
      setForcedOutcome,
      handleAction,
      addUserMessage,
      sendUserText,
    }}>
      {children}
    </ChatContext.Provider>
  );
}
