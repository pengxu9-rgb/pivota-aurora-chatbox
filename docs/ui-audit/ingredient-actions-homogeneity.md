# Ingredient Actions 同质化诊断（仅诊断，不改算法）

更新时间：2026-02-23

## 结论摘要
- 当前 `ingredientActionsV1` 的候选集合主要由静态映射驱动（同 `issueType` 会落到高度相似的候选池）。
- 个性化主要体现在排序与置信度收敛，而不是候选集合的显著变化。
- 因此在同类问题分布下，不同用户看到相似 `Ingredient actions` 是当前实现下的预期结果。

## 主要根因
- 静态映射主导：`ISSUE_INGREDIENT_MAP`（或同类结构）按问题类型映射候选成分，差异度上限受限。
- 风险与脆弱性逻辑主要做过滤/降级：例如 `isFragile`、`riskTier`、evidence merge 会影响是否保守，但对“候选池宽度”影响有限。
- 证据聚合偏稳定：photo modules 在质量降级或证据稀疏时，输出趋向保守模板，进一步增强同质观感。

## 当前实现下可见现象
- 相同 `issueType` 组合时，行动建议文本和成分优先级高度接近。
- 用户差异更多体现在：
  - 置信度与语气（保守/明确）
  - safety 约束标签
  - 轻微排序变化

## 后续可调杠杆（本轮不实施）
- 扩展候选生成层：从“单映射池”变为“映射池 + 用户上下文补充池”。
- 提升个性化特征权重：将 routine 历史、近 7 天 tracker、环境压力信号直接作用于候选集合而非仅排序。
- 引入多样性约束：同 issueType 下增加去同质化策略（MMR/类别配额/去重惩罚）。
- 强化证据驱动分支：将 `evidence_region_ids` 强绑定到 action 生成模板，提升解释差异。
- 建立离线评估：增加“跨用户建议相似度”指标（如 top-k Jaccard）作为回归门禁。

## Photo Modules 圈选诊断实现（前端）
- 数据来源：`photo_modules_v1.payload.regions`，支持 `bbox/polygon/heatmap`，坐标系 `face_crop_norm_v1`。
- 渲染结构：`PhotoModulesCard` 双 canvas 分层。
  - base 层：渲染全部 regions（按 priority/强度）。
  - highlight 层：仅渲染当前 module/issue 的 `evidence_region_ids`。
- 交互联动：点击 module 或 issue 时，用 `evidence_region_ids` 过滤高亮区域，并联动下方解释与 actions。

## 本轮边界
- 本文档仅输出诊断结论与后续建议。
- 不修改后端 `ingredientActionsV1` 算法与线上行为。
