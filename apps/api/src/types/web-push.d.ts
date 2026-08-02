declare module 'web-push' {
  export default interface WebPushLibrary {
    sendNotification(subscription: unknown, payload: string): Promise<unknown>;
    setGCMAPIKey(apiKey: string): void;
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  }
}
