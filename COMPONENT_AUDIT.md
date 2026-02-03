# pivota-aurora-chatbox UI 组件盘点（面向 BFF Chat）

> 目标：尽量复用现有设计好的 UI/card 组件，把 `src/pages/BffChat.tsx` 的“手写渲染”逐步迁移到可复用组件（或做一层 adapter），同时保持 pivota-agent `/v1/...` 的结构化协议不被前端细节绑死。

## 1) 可直接复用（低改动 / Drop-in）

这些组件本身不依赖 `ChatContext`，只吃 props，适合在 `BffChat.tsx` 中直接用：

- `src/components/chat/cards/PhotoUploadCard.tsx`
  - 作用：选择自然光 / 室内白光两张自拍 + 显式 consent
  - 建议：作为“照片入口”的主 UI（已在 BFF Chat 中接入）
- `src/components/aurora/cards/AuroraDiagnosisProgress.tsx`
  - 作用：顶部/卡片式进度（S0~S11）
  - 建议：把 BFF `sessionState` 映射到 `FlowState` 后即可展示
- `src/components/aurora/cards/AuroraRoutineCard.tsx`
  - 作用：AM/PM 流程展示 + conflicts
  - 建议：把 BFF `recommendations` card 的 items 映射成 `amSteps/pmSteps` 即可
- `src/components/aurora/cards/AuroraDupeCard.tsx` / `DupeComparisonCard.tsx`
  - 作用：平替对比 UI
  - 建议：把 BFF `dupe_compare`/`aurora_structured.alternatives` 归一化后渲染
- `src/components/aurora/cards/AuroraScoringCard.tsx` + `src/components/aurora/charts/ProductVectorRadar.tsx`
  - 作用：产品向量/评分可视化
  - 建议：用于 `product_analyze`/`deep_scan` 的展示层（需 adapter）

## 2) 需要适配层（推荐做 adapter，而不是改 BFF 协议）

这些组件的“数据结构”与 BFF card payload 不一致，但 UI 设计可复用：

- `src/components/chat/cards/AnalysisSummaryCard.tsx`
  - 目前需要 `payload.analysis + payload.session.photos`
  - BFF 现有 `analysis_summary` payload 为 `{analysis, used_photos, photos_provided...}`
  - 建议：做 `toAnalysisSummaryCardPayload(bffCard, sessionState)` 适配；或者让 pivota-agent 在 `analysis_summary` 里附带最小 `session.photos`（但会让 BFF 协议更像前端 view-model）
- `src/components/chat/cards/RoutineCard.tsx`
  - 需要完整 offers + selected_offers + routine.total_estimate 等
  - BFF 目前 routine 推荐是“卡片协议+可解释 evidence”，offers 走 `/v1/offers/resolve`
  - 建议：先用 `AuroraRoutineCard`（轻量），再逐步把 offers 绑定到一个单独的 `offers_resolved` 卡片组件
- `src/components/aurora/cards/SkinIdentityCard.tsx`
  - 需要 `DiagnosisResult`（skinType/concerns/barrierStatus）+ avatarUrl
  - BFF `UserProfile` 字段更细（含 sensitivity/goals/budgetTier）
  - 建议：做 `profile -> DiagnosisResult` 映射（goals→concerns 的字典），先用作“资料摘要卡”

## 3) 强依赖 ChatContext（要复用需“接入同一套前端状态机”）

这些组件依赖 `src/contexts/ChatContext` 的 session 管理与 action 分发；要复用有两条路：

1. **把 BFF Chat 接入 ChatContext（推荐）**
   - 新增 `BffChatProvider`：内部仍调 `/v1/...`，但把返回的 `session_patch/cards/chips` 映射到 `session/messages`。
   - 好处：可以直接复用 `ChatShell.tsx`、`ChatInput.tsx`、`MessageList.tsx`、`AuroraHeader.tsx`。

2. **把这些组件改为“纯 props 组件”**
   - 改动更大，且容易让旧流程断裂。

强依赖组件列表：

- `src/components/ChatShell.tsx`
- `src/components/chat/ChatHeader.tsx`
- `src/components/chat/MessageList.tsx`
- `src/components/chat/ChatInput.tsx`
- `src/components/aurora/AuroraHeader.tsx`

## 4) 建议落地顺序（最小风险 → 最大收益）

1. **照片上传**：`PhotoUploadCard` + 后端代理上传（避免浏览器 CORS）→ 通过后自动触发 `analysis_summary`
2. **推荐展示**：把 BFF `recommendations` 改用 `AuroraRoutineCard` 渲染（只需轻量 adapter）
3. **产品评估/平替**：把 BFF `product_analyze`/`dupe_compare` 输出映射到 `Aurora*` cards
4. **统一壳子**：引入 `BffChatProvider` 复用 `ChatShell/MessageList/ChatInput`

