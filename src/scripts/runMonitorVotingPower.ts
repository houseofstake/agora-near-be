import {
  disconnectWatchdogPrisma,
  runWatchdogAudit,
} from "./monitorVotingPower";

runWatchdogAudit()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnectWatchdogPrisma().finally(() => process.exit());
  });
