// Wire contract: pivota-agent src/auroraBff/diagnosisV2Schema.js.
// Keep separate from the legacy UI CardAction (action_id/data).
export type DiagnosisV2Action = {
  type: string;
  label: string;
  payload?: Record<string, unknown>;
};

export type DiagnosisV2GoalPreset =
  | 'anti_aging_face' | 'eye_anti_aging' | 'post_procedure_repair'
  | 'barrier_repair' | 'sun_protection' | 'brightening' | 'neck_care'
  | 'daily_maintenance' | 'mask_special' | 'custom';

export type DiagnosisV2GoalProfile = {
  selected_goals: string[];
  custom_input?: string;
  constraints: string[];
  post_procedure_meta?: { days_since: number; skin_broken: boolean; procedure_type?: string };
};

export type DiagnosisV2FollowupQuestion = {
  id: string;
  question: string;
  options: Array<{ id: string; label: string; value?: string; metadata?: Record<string, unknown> }>;
  required?: boolean;
};

export type DiagnosisV2IntroPayload = {
  goal_profile: DiagnosisV2GoalProfile;
  is_cold_start: boolean;
  question_strategy: 'default' | 'state_probe';
  followup_questions: DiagnosisV2FollowupQuestion[];
  actions: DiagnosisV2Action[];
};

export type DiagnosisV2Level = 'low' | 'moderate' | 'high' | 'severe';
export type DiagnosisV2InferredAxis = {
  axis: string;
  level: DiagnosisV2Level;
  confidence: number;
  evidence: string[];
  trend: 'improved' | 'stable' | 'worsened' | 'new';
  previous_level?: DiagnosisV2Level;
};
export type DiagnosisV2Strategy = {
  title: string;
  why: string;
  timeline: string;
  do_list: string[];
  avoid_list: string[];
};
export type DiagnosisV2ImprovementTip = {
  tip: string;
  action_type: 'take_photo' | 'setup_routine' | 'start_checkin' | 'add_travel' | 'intake_optimize';
  action_label: string;
};
export type DiagnosisV2ResultPayload = {
  diagnosis_id: string;
  diagnosis_seq: number;
  goal_profile: DiagnosisV2GoalProfile;
  is_cold_start: boolean;
  data_quality: { overall: 'high' | 'medium' | 'low'; limits_banner?: string };
  inferred_state: { axes: DiagnosisV2InferredAxis[] };
  strategies: DiagnosisV2Strategy[];
  routine_blueprint: { am_steps: string[]; pm_steps: string[]; conflict_rules: string[] };
  improvement_path: DiagnosisV2ImprovementTip[];
  next_actions: DiagnosisV2Action[];
};
export type DiagnosisV2ThinkingStep = {
  stage: 'goal_understanding' | 'inference' | 'strategy';
  step: string;
  text: string;
  status: 'pending' | 'in_progress' | 'done';
};
export type DiagnosisV2LoginPromptPayload = {
  prompt_text: string;
  login_action: DiagnosisV2Action;
  skip_action: DiagnosisV2Action;
  pending_goals: string[];
};
export type DiagnosisV2PhotoPromptPayload = {
  prompt_text: string;
  photo_action: DiagnosisV2Action;
  skip_action: DiagnosisV2Action;
  has_existing_artifact: boolean;
};
