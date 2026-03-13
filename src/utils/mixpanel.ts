const Mixpanel = require("mixpanel");

// Initialize Mixpanel only if the token exists to prevent crashes in dev environments
const mixpanelToken = process.env.MIXPANEL_TOKEN;

export const mixpanel = mixpanelToken
  ? Mixpanel.init(mixpanelToken)
  : {
      // Dummy object that mimics the track function to avoid breaking the app if no token is provided
      track: (event: string, properties?: any) => {
        if (process.env.NODE_ENV !== "test") {
          console.warn(
            `[Mixpanel Stub] Event '${event}' triggered but MIXPANEL_TOKEN is not set.`
          );
        }
      },
    };
