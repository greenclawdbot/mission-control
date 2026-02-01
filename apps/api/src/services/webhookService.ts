import { Task } from '@shared/src/types';

const WEBHOOK_URL = process.env.WEBHOOK_URL;

export async function triggerWebhook(event: string, task: Task): Promise<boolean> {
  if (!WEBHOOK_URL) {
    console.log(`[Webhook] Would fire for ${event}, but WEBHOOK_URL not configured`);
    return false;
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event,
        task,
        timestamp: new Date().toISOString()
      })
    });

    if (response.ok) {
      console.log(`[Webhook] Successfully fired ${event} for task ${task.id}`);
      return true;
    } else {
      console.error(`[Webhook] Failed to fire ${event}: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`[Webhook] Error firing ${event}:`, error);
    return false;
  }
}
