import { Language, Market, BudgetTier } from './types';

const translations = {
  EN: {
    // Header
    'header.title': 'Aurora',
    'header.demo_mode': 'Demo Mode',
    'header.live_mode': 'Live Mode',

    // S1 Open Intent
    's1.greeting': "Hi! I'm Aurora, your professional beauty consultant.",
    's1.intro': "I'll analyze your skin, recommend the best products, and find you budget-friendly alternatives with similar results.",
    's1.disclaimer': "Not medical advice—just product suitability guidance based on science.",
    's1.question': "What brings you here today?",
    's1.chip.routine': "Build a routine",
    's1.chip.breakouts': "Tackle breakouts",
    's1.chip.brightening': "Brighten skin",
    's1.chip.dupe': "Find a dupe",
    's1.chip.veto': "Check product safety",
    's1.btn.sample': "Try with sample photos",
    's1.btn.surprise': "Surprise me",

    // Diagnosis
    'diagnosis.intro': "Let me learn about your skin so I can give you personalized recommendations.",
    'diagnosis.skin_type.label': "How would you describe your skin?",
    'diagnosis.skin_type.hint': "Think about how your skin feels a few hours after washing",
    'diagnosis.skin_type.oily': "Oily",
    'diagnosis.skin_type.dry': "Dry",
    'diagnosis.skin_type.combination': "Combination",
    'diagnosis.skin_type.normal': "Normal",
    'diagnosis.skin_type.sensitive': "Sensitive",
    'diagnosis.barrier.label': "How’s your skin barrier lately?",
    'diagnosis.barrier.hint': "Any stinging, redness, or flaking?",
    'diagnosis.barrier.healthy': "Barrier: healthy",
    'diagnosis.barrier.impaired': "Barrier: irritated",
    'diagnosis.barrier.unknown': "Barrier: not sure",
    'diagnosis.sensitivity.label': "How sensitive is your skin?",
    'diagnosis.sensitivity.hint': "How easily do products irritate you?",
    'diagnosis.sensitivity.low': "Sensitivity: low",
    'diagnosis.sensitivity.medium': "Sensitivity: medium",
    'diagnosis.sensitivity.high': "Sensitivity: high",
    'diagnosis.concerns.label': "What concerns you most?",
    'diagnosis.concerns.hint': "Select up to 3 concerns",
    'diagnosis.concern.acne': "Acne/Breakouts",
    'diagnosis.concern.dark_spots': "Dark spots",
    'diagnosis.concern.wrinkles': "Fine lines",
    'diagnosis.concern.dullness': "Dullness",
    'diagnosis.concern.redness': "Redness",
    'diagnosis.concern.pores': "Large pores",
    'diagnosis.concern.dehydration': "Dehydration",
    'diagnosis.routine.label': "What's your current routine like?",
    'diagnosis.routine.none': "No routine",
    'diagnosis.routine.none_desc': "I don't use skincare products regularly",
    'diagnosis.routine.basic': "Basic routine",
    'diagnosis.routine.basic_desc': "Cleanser + moisturizer, maybe sunscreen",
    'diagnosis.routine.full': "Full routine",
    'diagnosis.routine.full_desc': "Multiple steps including treatments/serums",
    'diagnosis.btn.next': "Next",
    'diagnosis.btn.back': "Back",
    'diagnosis.btn.analyze': "Analyze my skin",
    'diagnosis.btn.skip': "Skip",

    // S3 Photo Option
    's3.intro': "Optional: add 1–2 photos for more precise recommendations.",
    's3.tip': "Best with: (1) Natural daylight near a window + (2) Indoor white light.",
    's3.warning': "Please avoid filters/beauty mode.",
    's3.slot.daylight': "Natural daylight (near a window)",
    's3.slot.indoor': "Indoor white light",
    's3.btn.upload': "Upload photos",
    's3.btn.skip': "Skip photos",
    's3.btn.sample': "Try sample photos",
    's3.uploading': "Uploading...",
    's3.tap_to_upload': "Tap to upload",
    's3.consent': "I agree to upload and temporarily store my photos for analysis.",

    // QC
    'qc.pending': "Processing your photo—please wait a moment or try uploading again.",
    'qc.too_dark': "This photo is a bit dark—I may miss some details. Re-upload in brighter light?",
    'qc.has_filter': "This might have a filter. For best results, use an unedited photo.",
    'qc.blurry': "This photo appears blurry. A clearer photo helps me spot details better.",
    'qc.btn.retry_check': "Check again",
    'qc.btn.reupload': "Re-upload",
    'qc.btn.continue': "Continue anyway",

    // S4 Loading
    's4.analyzing': "Analyzing your skin profile...",
    's4.btn.skip': "Continue without photo analysis",

    // S5 Analysis Summary
    's5.evidence': "Based on your answers{photos_text}",
    's5.photos_suffix': " and {photos_count} photo(s)",
    's5.confidence.pretty_sure': "confident",
    's5.confidence.somewhat_sure': "likely",
    's5.confidence.not_sure': "possible",
    's5.strategy_prefix': "My recommendation: ",
    's5.btn.review_products': "Review my current products first",
    's5.btn.continue': "See product recommendations",
    's5.btn.gentler': "Make it gentler",
    's5.btn.simple': "Keep it simple",

    // S5a Risk Check
    's5a.intro': "Quick safety check (to avoid over-stacking actives):",
    's5a.question': "Do you currently use strong actives 2+ nights/week? (retinoids or exfoliating acids)",
    's5a.btn.yes': "Yes",
    's5a.btn.no': "No",
    's5a.btn.not_sure': "Not sure",
    's5a.btn.skip': "Skip",

    // Budget
    'budget.intro': "One more thing—what's your budget comfort zone?",
    'budget.label': "Budget range",
    'budget.hint': "I'll show you both premium and budget-friendly options regardless",
    'budget.btn.show_products': "Show recommendations",
    'budget.btn.skip': "Skip",

    // Budget tiers
    'budget.$': '$ Budget-friendly',
    'budget.$$': '$$ Mid-range',
    'budget.$$$': '$$$ Premium',

    // S6/S7 Product Recommendations
    's6.am_label': "☀️ Morning Routine",
    's6.pm_label': "🌙 Evening Routine",
    's6.total_estimate': "Total: {min}–{max} {currency}",
    's6.pref.cheaper': "Cheaper",
    's6.pref.gentler': "Gentler",
    's6.pref.fastest': "Fastest",
    's6.pref.keep': "Keep as-is",
    's6.btn.checkout': "Checkout",
    's6.btn.customize': "Customize",
    's6.btn.save': "Save routine",
    's6.btn.choose_offer': "Compare sellers",

    // Product comparison
    'product.premium': "Premium",
    'product.dupe': "Budget pick",
    'product.total': "Subtotal",
    'product.compare_sellers': "Compare sellers",
    'product.category.cleanser': "Cleanser",
    'product.category.moisturizer': "Moisturizer",
    'product.category.sunscreen': "Sunscreen",
    'product.category.treatment': "Treatment",
    'product.view_details': "View details",
    'product.choose_offer': "Choose offer",
    'product.add_to_set': "Add to set",

    // Offer Badges
    'badge.best_price': "Best price",
    'badge.best_returns': "Best returns",
    'badge.fastest_shipping': "Fastest",
    'badge.high_reliability': "Reliable",

    // Offer Picker
    'offer.select': "Select",
    'offer.selected': "Selected ✓",
    'offer.shipping': "{days} day shipping",
    'offer.returns': "{policy}",
    'offer.reliability': "{score}% reliable",
    'offer.back': "Back",
    'offer.auto_best': "Auto-pick best",

    // S8 Checkout
    's8.ready': "Ready to check out with the best available offers.",
    's8.btn.checkout': "Complete checkout",
    's8.btn.review': "Review offers",
    's8.btn.customize': "Customize",

    // S9 Success
    's9.title': "✅ Order confirmed!",
    's9.order': "Order: {order_id}",
    's9.total': "Total: {total} {currency}",
    's9.eta': "Delivery: {eta}",
    's9.btn.track': "Track order",
    's9.btn.save': "Save routine",
    's9.btn.restart': "Start over",

    // S10 Failure
    's10.title': "⚠️ Checkout didn't complete",
    's10.reason': "Reason: {reason}",
    's10.next': "What you can do:",
    's10.btn.switch_offer': "Switch offer",
    's10.btn.switch_payment': "Switch payment",
    's10.btn.try_again': "Try again",
    's10.btn.adjust': "Adjust routine",

    // General
    'loading': "Loading...",
    'error': "Something went wrong",
    'retry': "Try again",

    // Dev Drawer
    'dev.title': "Developer Info",
    'dev.brief_id': "Brief ID",
    'dev.trace_id': "Trace ID",
    'dev.mode': "Mode",
    'dev.state': "State",
    'dev.clarifications': "Clarifications",
    'dev.selected_offers': "Selected Offers",
    'dev.events': "Events",
    'dev.force_outcome': "Force checkout outcome",
    'dev.outcome.success': "Success",
    'dev.outcome.payment': "Payment declined",
    'dev.outcome.expired': "Offer expired",

    // Markets (kept for IP-based detection display)
    'market.US': 'US',
    'market.EU': 'EU',
    'market.UK': 'UK',
    'market.Canada': 'Canada',
    'market.Singapore': 'Singapore',
    'market.Global': 'Global',
  },
  CN: {
    // Header
    'header.title': 'Aurora',
    'header.demo_mode': '演示模式',
    'header.live_mode': '正式模式',

    // S1 Open Intent
    's1.greeting': "你好！我是 Aurora，你的专业美容顾问。",
    's1.intro': "我会分析你的肤质，推荐最适合的产品，并帮你找到效果相近的平价替代。",
    's1.disclaimer': "非医疗建议——基于科学的产品适配建议。",
    's1.question': "今天想解决什么问题？",
    's1.chip.routine': "搭建护肤流程",
    's1.chip.breakouts': "解决痘痘问题",
    's1.chip.brightening': "提亮肤色",
    's1.chip.dupe': "找平替",
    's1.chip.veto': "产品安全检测",
    's1.btn.sample': "用示例照片体验",
    's1.btn.surprise': "随机推荐",

    // Diagnosis
    'diagnosis.intro': "让我了解你的肤质，以便给出个性化推荐。",
    'diagnosis.skin_type.label': "你如何描述自己的肤质？",
    'diagnosis.skin_type.hint': "想想洗脸后几小时皮肤的感觉",
    'diagnosis.skin_type.oily': "油性",
    'diagnosis.skin_type.dry': "干性",
    'diagnosis.skin_type.combination': "混合",
    'diagnosis.skin_type.normal': "中性",
    'diagnosis.skin_type.sensitive': "敏感",
    'diagnosis.barrier.label': "最近屏障状态如何？",
    'diagnosis.barrier.hint': "是否有刺痛、泛红或脱皮？",
    'diagnosis.barrier.healthy': "屏障：稳定",
    'diagnosis.barrier.impaired': "屏障：不稳定/刺痛",
    'diagnosis.barrier.unknown': "屏障：不确定",
    'diagnosis.sensitivity.label': "你的敏感程度？",
    'diagnosis.sensitivity.hint': "护肤品是否容易刺激你？",
    'diagnosis.sensitivity.low': "敏感：低",
    'diagnosis.sensitivity.medium': "敏感：中",
    'diagnosis.sensitivity.high': "敏感：高",
    'diagnosis.concerns.label': "你最关心什么问题？",
    'diagnosis.concerns.hint': "最多选3个",
    'diagnosis.concern.acne': "痘痘/粉刺",
    'diagnosis.concern.dark_spots': "色斑",
    'diagnosis.concern.wrinkles': "细纹",
    'diagnosis.concern.dullness': "暗沉",
    'diagnosis.concern.redness': "泛红",
    'diagnosis.concern.pores': "毛孔粗大",
    'diagnosis.concern.dehydration': "缺水",
    'diagnosis.routine.label': "你现在的护肤流程是？",
    'diagnosis.routine.none': "没有固定流程",
    'diagnosis.routine.none_desc': "我不经常使用护肤品",
    'diagnosis.routine.basic': "基础护肤",
    'diagnosis.routine.basic_desc': "洁面+保湿，可能有防晒",
    'diagnosis.routine.full': "完整流程",
    'diagnosis.routine.full_desc': "多步骤，包含精华/治疗类产品",
    'diagnosis.btn.next': "下一步",
    'diagnosis.btn.back': "返回",
    'diagnosis.btn.analyze': "分析我的皮肤",
    'diagnosis.btn.skip': "跳过",

    // S3 Photo Option
    's3.intro': "可选：上传1-2张照片获得更精准推荐。",
    's3.tip': "最佳：①靠窗自然光 ②室内白光。",
    's3.warning': "请避免滤镜/美颜。",
    's3.slot.daylight': "自然光（靠窗）",
    's3.slot.indoor': "室内白光",
    's3.btn.upload': "上传照片",
    's3.btn.skip': "跳过照片",
    's3.btn.sample': "用示例照片",
    's3.uploading': "上传中...",
    's3.tap_to_upload': "点击上传",
    's3.consent': "我同意上传并临时存储照片用于分析。",

    // QC
    'qc.pending': "正在处理照片——请稍等片刻，或尝试重新上传。",
    'qc.too_dark': "这张有点暗——可能看不清细节。要重新上传吗？",
    'qc.has_filter': "这张可能有滤镜。建议用未编辑的照片。",
    'qc.blurry': "这张有点模糊。清晰的照片能帮我看得更清楚。",
    'qc.btn.retry_check': "重新检查",
    'qc.btn.reupload': "重新上传",
    'qc.btn.continue': "先这样继续",

    // S4 Loading
    's4.analyzing': "正在分析你的肤质...",
    's4.btn.skip': "不做照片分析也继续",

    // S5 Analysis Summary
    's5.evidence': "根据你的回答{photos_text}",
    's5.photos_suffix': "和 {photos_count} 张照片",
    's5.confidence.pretty_sure': "比较确定",
    's5.confidence.somewhat_sure': "可能",
    's5.confidence.not_sure': "不太确定",
    's5.strategy_prefix': "我的建议：",
    's5.btn.review_products': "先评估我正在用的产品",
    's5.btn.continue': "查看产品推荐",
    's5.btn.gentler': "选温和一点的",
    's5.btn.simple': "保持简单",

    // S5a Risk Check
    's5a.intro': "快速安全确认（避免活性叠加刺激）：",
    's5a.question': "你现在每周≥2晚会用 A 醇/维A 类或刷酸（AHA/BHA）吗？",
    's5a.btn.yes': "是",
    's5a.btn.no': "否",
    's5a.btn.not_sure': "不确定",
    's5a.btn.skip': "跳过",

    // Budget
    'budget.intro': "最后一个问题——你的预算范围是？",
    'budget.label': "预算范围",
    'budget.hint': "无论如何我都会展示高端和平价选项",
    'budget.btn.show_products': "查看推荐",
    'budget.btn.skip': "跳过",

    // Budget tiers
    'budget.$': '$ 平价',
    'budget.$$': '$$ 中档',
    'budget.$$$': '$$$ 高端',

    // S6/S7 Product Recommendations
    's6.am_label': "☀️ 早间护肤",
    's6.pm_label': "🌙 晚间护肤",
    's6.total_estimate': "总计：{min}–{max} {currency}",
    's6.pref.cheaper': "更便宜",
    's6.pref.gentler': "更温和",
    's6.pref.fastest': "最快到货",
    's6.pref.keep': "保持原样",
    's6.btn.checkout': "结账",
    's6.btn.customize': "自定义",
    's6.btn.save': "保存方案",
    's6.btn.choose_offer': "比较商家",

    // Product comparison
    'product.premium': "高端款",
    'product.dupe': "平价替代",
    'product.total': "小计",
    'product.compare_sellers': "比较商家",
    'product.category.cleanser': "洁面",
    'product.category.moisturizer': "保湿",
    'product.category.sunscreen': "防晒",
    'product.category.treatment': "精华/治疗",
    'product.view_details': "查看详情",
    'product.choose_offer': "选择优惠",
    'product.add_to_set': "加入方案",

    // Offer Badges
    'badge.best_price': "最低价",
    'badge.best_returns': "退换保障",
    'badge.fastest_shipping': "最快发货",
    'badge.high_reliability': "高可靠度",

    // Offer Picker
    'offer.select': "选择",
    'offer.selected': "已选 ✓",
    'offer.shipping': "{days} 天到货",
    'offer.returns': "{policy}",
    'offer.reliability': "{score}% 可靠",
    'offer.back': "返回",
    'offer.auto_best': "自动选最佳",

    // S8 Checkout
    's8.ready': "准备结账，将应用最佳优惠。",
    's8.btn.checkout': "完成结账",
    's8.btn.review': "查看优惠",
    's8.btn.customize': "自定义",

    // S9 Success
    's9.title': "✅ 订单已确认！",
    's9.order': "订单号：{order_id}",
    's9.total': "总计：{total} {currency}",
    's9.eta': "预计送达：{eta}",
    's9.btn.track': "追踪订单",
    's9.btn.save': "保存方案",
    's9.btn.restart': "重新开始",

    // S10 Failure
    's10.title': "⚠️ 下单未完成",
    's10.reason': "原因：{reason}",
    's10.next': "你可以：",
    's10.btn.switch_offer': "更换优惠",
    's10.btn.switch_payment': "更换支付方式",
    's10.btn.try_again': "重试",
    's10.btn.adjust': "调整方案",

    // General
    'loading': "加载中...",
    'error': "出了点问题",
    'retry': "重试",

    // Dev Drawer
    'dev.title': "开发者信息",
    'dev.brief_id': "Brief ID",
    'dev.trace_id': "Trace ID",
    'dev.mode': "模式",
    'dev.state': "状态",
    'dev.clarifications': "澄清次数",
    'dev.selected_offers': "已选优惠",
    'dev.events': "事件",
    'dev.force_outcome': "强制结账结果",
    'dev.outcome.success': "成功",
    'dev.outcome.payment': "支付失败",
    'dev.outcome.expired': "优惠过期",

    // Markets
    'market.US': '美国',
    'market.EU': '欧盟',
    'market.UK': '英国',
    'market.Canada': '加拿大',
    'market.Singapore': '新加坡',
    'market.Global': '全球',
  },
} as const;

export function t(key: string, lang: Language, params?: Record<string, string | number>): string {
  const langTranslations = translations[lang] as Record<string, string>;
  const enTranslations = translations.EN as Record<string, string>;
  let text = langTranslations[key] || enTranslations[key] || key;
  
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  
  return text;
}

export function getMarketLabel(market: Market, lang: Language): string {
  return t(`market.${market}`, lang);
}

export function getBudgetLabel(budget: BudgetTier, lang: Language): string {
  return t(`budget.${budget}`, lang);
}

export function getConfidenceLabel(confidence: 'pretty_sure' | 'somewhat_sure' | 'not_sure', lang: Language): string {
  return t(`s5.confidence.${confidence}`, lang);
}

export function getBadgeLabel(badge: string, lang: Language): string {
  return t(`badge.${badge}`, lang);
}
