import {
  disconnectWatchdogPrisma,
  runWatchdogAudit,
} from "./monitorVotingPower";

runWatchdogAudit()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Critical Watchdog Error:", e);
    process.exit(1);
  })
  .finally(() => {
    void disconnectWatchdogPrisma();
  });
