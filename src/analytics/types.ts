export const ANALYTICS_EVENT_TYPES = [
  "language_switch",
  "chat_open",
  "chat_message",
  "chat_rate_limited",
  "chat_error",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export type LogEventInput = {
  eventType: AnalyticsEventType;
  locale?: string | null;
  clientId?: string | null;
  pagePath?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type StatsSummary = {
  since: string;
  days: number;
  totals: { event_type: string; locale: string | null; count: number }[];
  daily: { day: string; event_type: string; count: number }[];
};
