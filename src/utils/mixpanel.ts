const Mixpanel = require("mixpanel");

// Conditionally instantiate the Mixpanel client to prevent runtime exceptions in environments lacking a configured token
const mixpanelToken = process.env.MIXPANEL_TOKEN;

export const mixpanel = mixpanelToken
  ? Mixpanel.init(mixpanelToken)
  : {
      // Fallback implementation to safely bypass tracking when MIXPANEL_TOKEN is undefined in lower environments
      track: (event: string, properties?: any) => {
        if (process.env.NODE_ENV !== "test") {
          console.warn(
            `[Mixpanel Stub] Event '${event}' triggered but MIXPANEL_TOKEN is not set.`
          );
        }
      },
    };
