import { findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";

let questTimer = null;

const HTTP = findByProps("get", "post", "put");

function log(msg) {
  console.log(`[OrbQuestAutomator] ${msg}`);
}

async function runQuestAutomator() {
  try {
    const res = await HTTP.get({ url: "/quests/user" });
    const quests = res?.body?.quests || [];

    if (!quests.length) {
      log("No active quests found.");
      return;
    }

    log(`Found ${quests.length} quest(s). Processing...`);

    for (const quest of quests) {
      const id = quest.id;
      const status = quest.user_status;

      // Skip if already completed
      if (status?.completed_at) continue;

      // Auto Enroll
      if (!status?.enrolled_at) {
        log(`Enrolling in quest ${id}`);
        await HTTP.post({ url: `/quests/${id}/enroll` });
      }

      // Handle Video Quests
      if (quest.config?.task_type === "WATCH_VIDEO" || quest.config?.task_type === 1) {
        let current = status?.progress?.WATCH_VIDEO?.progress || 0;
        const target = (quest.config?.stream_duration_requirement_minutes || 3) * 60;

        while (current < target) {
          current += 30;
          await HTTP.post({
            url: `/quests/${id}/video-progress`,
            body: { timestamp: current }
          });
          log(`Video progress: ${current}/${target}s`);
          await new Promise((r) => setTimeout(r, 2000));
        }
      } 
      // Handle Game/Stream Heartbeats
      else {
        await HTTP.post({
          url: `/quests/${id}/heartbeat`,
          body: { stream_key: "spoofed_session" }
        });
        log(`Heartbeat sent for quest ${id}`);
      }

      // Auto Claim
      if (status?.progress >= 100 || status?.completed_at) {
        await HTTP.post({ url: `/quests/${id}/claim` });
        showToast("Claimed Orb Quest Reward! 🎉", "success");
      }
    }
  } catch (err) {
    log(`Error processing quests: ${err.message || err}`);
  }
}

export default {
  onLoad: () => {
    showToast("Orb Quest Automator Enabled 🚀", "info");
    runQuestAutomator();
    questTimer = setInterval(runQuestAutomator, 120000);
  },
  onUnload: () => {
    if (questTimer) clearInterval(questTimer);
    showToast("Orb Quest Automator Disabled", "info");
  }
};