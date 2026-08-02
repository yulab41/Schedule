import type { JsonObject } from '@schedule/contracts';

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
  private readonly privateKey: string | undefined;
  private readonly publicKey: string | undefined;
  private readonly subject: string | undefined;
  private libraryPromise: Promise<WebPushLibrary> | undefined;

  public constructor(values: NodeJS.ProcessEnv) {
    const subject = values.VAPID_SUBJECT;
    const publicKey = values.VAPID_PUBLIC_KEY;
    const privateKey = values.VAPID_PRIVATE_KEY;
    this.subject = subject;
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.isConfigured =
      subject !== undefined &&
      subject.length > 0 &&
      publicKey !== undefined &&
      publicKey.length > 0 &&
      privateKey !== undefined &&
      privateKey.length > 0;
    this.vapidPublicKey = this.isConfigured && publicKey !== undefined ? publicKey : null;
  }

  public async send(subscription: PushSubscriptionDetails, payload: PushPayload): Promise<void> {
    const library = await this.getLibrary();
    await library.sendNotification(subscription, JSON.stringify(payload));
  }

  private getLibrary(): Promise<WebPushLibrary> {
    this.libraryPromise ??= import('web-push').then((module) => {
      const library = (module as { readonly default?: WebPushLibrary }).default;
      if (library === undefined) {
        throw new Error('web-push did not expose a default export.');
      }
      if (this.isConfigured) {
        library.setVapidDetails(
          this.subject as string,
          this.publicKey as string,
          this.privateKey as string,
        );
      }
      return library;
    });
    return this.libraryPromise;
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
