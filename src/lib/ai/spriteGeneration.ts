// src/lib/ai/spriteGeneration.ts
import { spriteRegistry } from "../SpriteRegistry";
import type { SpriteModel } from "./models";

const API_BASE_URL = "https://ionutbogdan.ro/api/sprites";

export async function createSpriteJob(
  interests: string[],
  model: SpriteModel | null
): Promise<string | null> {
  if (!model) {
    console.warn("Sprite model is not set.");
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/create_job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interests, model }),
    });

    if (!response.ok) {
      console.error("Failed to create sprite job:", response.statusText);
      return null;
    }

    const data = await response.json();
    return data.job?.id ?? null;
  } catch (error) {
    console.error("Error creating sprite job:", error);
    return null;
  }
}

export type JobStatus = {
  id: string;
  done: number;
  pending: number;
  model: string;
};

export type LastItem = {
  index: number;
  object: string;
  status: "pending" | "done";
  url: string | null;
  file: string | null;
};

export type JobStatusResponse = {
  ai_disabled?: boolean;
  job: JobStatus;
  last_item: null | LastItem;
  _meta: {
    used_model: string;
    retry_in_seconds?: number;
    error?: string | null;
  };
};

export class SpriteJobPoller {
  private jobId: string;
  private interests: string[];
  private onProgress: (status: JobStatusResponse) => void;
  private onComplete: () => void;
  private onError: (error: string) => void;
  private stopPolling = false;
  private backoff = 4000; // Start with 4 seconds

  constructor(
    jobId: string,
    interests: string[],
    onProgress: (status: JobStatusResponse) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ) {
    this.jobId = jobId;
    this.interests = interests;
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;
  }

  async start() {
    this.poll();
  }

  stop() {
    this.stopPolling = true;
  }

  private async poll() {
    if (this.stopPolling) return;

    try {
      const response = await fetch(`${API_BASE_URL}/job_status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: this.jobId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: JobStatusResponse = await response.json();

      this.onProgress(data);

      if (data.ai_disabled) {
        this.onError("AI has been disabled.");
        return;
      }

      if (data.job.pending === 0) {
        this.onComplete();
        return;
      }

      if (data.last_item?.status === "done" && data.last_item.url && data.last_item.file) {
        if (!spriteRegistry.isDelivered(data.last_item.file)) {
          // Preload image
          const img = new Image();
          img.src = data.last_item.url;
          await img.decode();

          const interestIndex = Math.floor(data.last_item.index / (10 / this.interests.length));
          const interest = this.interests[interestIndex];

          spriteRegistry.add({
            url: data.last_item.url,
            file: data.last_item.file,
            object: data.last_item.object,
            interest: interest,
          });
        }
      }

      if (data._meta.retry_in_seconds) {
        setTimeout(() => this.poll(), data._meta.retry_in_seconds * 1000);
        return;
      }

      if (data._meta.error) {
        setTimeout(() => this.poll(), this.backoff);
        this.backoff = Math.min(60000, this.backoff * 2); // Exponential backoff up to 60s
        return;
      }

      this.backoff = 4000; // Reset backoff on success
      setTimeout(() => this.poll(), 5000); // Normal cadence

    } catch (error) {
      console.error("Polling error:", error);
      this.onError("Network error during polling.");
      setTimeout(() => this.poll(), this.backoff);
      this.backoff = Math.min(60000, this.backoff * 2);
    }
  }
}
