export type EventType = "APP_VIEW" | "DOWNLOAD" | "SHARE" | "SUBMIT";

export interface AppEvent {
  type: EventType;
  appId?: string;
  repoUrl?: string;
  ip?: string;
  timestamp: string;
}

export type ActionType =
  | "BOOST_APP"
  | "PROMOTE_NEW_APP"
  | "TRIGGER_SHARE_PROMPT"
  | "FEATURE_ON_HOMEPAGE";

export interface GrowthAction {
  action: ActionType;
  appId?: string;
  scoreBoost?: number;
  message?: string;
}
