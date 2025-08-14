export type NotificationPreference = "true" | "false" | "prompt";

export interface NotificationPreferences {
  wants_proposal_created_email: NotificationPreference;
  wants_proposal_ending_soon_email: NotificationPreference;
  last_updated: string;
}

export interface NotificationPreferencesInput {
  wants_proposal_created_email?: NotificationPreference;
  wants_proposal_ending_soon_email?: NotificationPreference;
}

export const defaultNotificationPreferences = (): NotificationPreferences => ({
  wants_proposal_created_email: "prompt",
  wants_proposal_ending_soon_email: "prompt",
  last_updated: new Date().toISOString(),
});

export const isValidNotificationPreference = (
  value: any
): value is NotificationPreference => {
  return value === "true" || value === "false" || value === "prompt";
};
