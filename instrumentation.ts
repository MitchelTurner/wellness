export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startReminderScheduler } = await import("./lib/reminder-scheduler");
  startReminderScheduler();
}
