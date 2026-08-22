import { createHash } from 'node:crypto';

export function hashWechatIdentitySubject(subject: string): string {
  return createHash('sha256').update(subject).digest('hex');
}
