import { createRequire } from 'node:module';

import type { JsonObject } from '@schedule/contracts';

const require = createRequire(import.meta.url);

export interface PushSubscriptionDetails {
  readonly auth: string;
  readonly endpoint: string;
  readonly p256dh: string;
}

export interface PushPayload {
  readonly body: string;
  readonly data?: JsonObject;
  readonly title: string;
  readonly url: string;
}

export interface PushDispatcher {
  readonly isConfigured: boolean;
  readonly vapidPublicKey: string | null;
  send(subscription: PushSubscriptionDetails, payload: PushPayload): Promise<void>;
}

interface WebPushLibrary {
  sendNotification(subscription: PushSubscriptionDetails, payload: string): Promise<unknown>;
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
}

export class WebPushDispatcher implements PushDispatcher {
  public readonly isConfigured: boolean;
  public readonly vapidPublicKey: string | null;
  private readonly library: WebPushLibrary;

  public constructor(values: NodeJS.ProcessEnv) {
    this.library = require('web-push') as WebPushLibrary;
    const subject = values.VAPID_SUBJECT;
    const publicKey = values.VAPID_PUBLIC_KEY;
    const privateKey = values.VAPID_PRIVATE_KEY;
    this.isConfigured =
      subject !== undefined &&
      subject.length > 0 &&
      publicKey !== undefined &&
      publicKey.length > 0 &&
      privateKey !== undefined &&
      privateKey.length > 0;
    this.vapidPublicKey = this.isConfigured ? (publicKey as string) : null;

    if (this.isConfigured) {
      this.library.setVapidDetails(subject as string, publicKey as string, privateKey as string);
    }
  }

  public async send(subscription: PushSubscriptionDetails, payload: PushPayload): Promise<void> {
    await this.library.sendNotification(subscription, JSON.stringify(payload));
  }
}

export class NoopPushDispatcher implements PushDispatcher {
  public readonly isConfigured = false;
  public readonly vapidPublicKey: string | null = null;

  public async send(): Promise<void> {
    // Nothing to send when no push service is configured.
  }
}

export function createPushDispatcher(values: NodeJS.ProcessEnv): PushDispatcher {
  return new WebPushDispatcher(values);
}
