import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  createTestDatabaseClient,
  groupMemberships,
  groups,
  migrateDatabase,
  users,
  type DatabaseClient,
  type DatabaseConnectionOptions,
} from '@schedule/database';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { insertDirectMembership } from '@schedule/test-fixtures';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuthPort } from '../../adapters/auth/auth-port.js';
import { createApp } from '../../app.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../../migrations', import.meta.url));
const databaseOptions = getTestDatabaseOptions();
const describeWithDatabase = databaseOptions === undefined ? describe.skip : describe;

describeWithDatabase('group permissions, contacts, and ownership', () => {
  let app: ReturnType<typeof createApp>;
  let client: DatabaseClient;

  beforeEach(async () => {
    client = createTestDatabaseClient(databaseOptions as DatabaseConnectionOptions);
    await resetDatabase(client);
    await migrateDatabase(client, migrationsDirectory);
    app = createApp({
      authPort: createFakeAuthPort({
        'candidate-token': 'cloudbase-candidate',
        'developer-token': 'cloudbase-developer',
        'other-owner-token': 'cloudbase-other-owner',
        'outsider-token': 'cloudbase-outsider',
        'owner-token': 'cloudbase-owner',
        'suspended-token': 'cloudbase-suspended',
      }),
      databaseClient: client,
      logger: false,
    });
    app.addHook('preValidation', (request, _reply, done) => {
      if (
        (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') &&
        !request.url.endsWith('/mobile-phone-consent') &&
        request.headers['idempotency-key'] === undefined
      ) {
        request.headers['idempotency-key'] = randomUUID();
      }
      done();
    });
    await registerUser('owner-token', 'Owner Doctor');
    await registerUser('candidate-token', 'Candidate Doctor');
    await registerUser('developer-token', 'Developer Doctor');
    await registerUser('other-owner-token', 'Other Owner Doctor');
    await registerUser('outsider-token', 'Outsider Doctor');
    await registerUser('suspended-token', 'Suspended Doctor');
    await client.database
      .update(users)
      .set({ isDeveloperAdmin: 1 })
      .where(eq(users.cloudbaseUid, 'cloudbase-developer'));
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    if (client !== undefined) {
      await client.close();
    }
  });

  it('lets only the owner add and remove administrators, while administrators manage the roster', async () => {
    const groupId = await createClaimedGroup();
    const candidate = await getMember(groupId, 'Candidate Doctor');

    const makeAdministrator = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { expectedVersion: candidate.version, role: 'administrator' },
      url: `/groups/${groupId}/members/${candidate.id}/role`,
    });
    const administratorRoster = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'POST',
      payload: { realNames: ['Administrator Added Doctor'] },
      url: `/groups/${groupId}/roster-entries`,
    });
    const promotedVersion = (makeAdministrator.json() as { version: number }).version;
    const removeAdministrator = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { expectedVersion: promotedVersion, role: 'member' },
      url: `/groups/${groupId}/members/${candidate.id}/role`,
    });

    expect(makeAdministrator.statusCode).toBe(200);
    expect(makeAdministrator.json()).toMatchObject({ id: candidate.id, role: 'administrator' });
    expect(administratorRoster.statusCode).toBe(200);
    expect(removeAdministrator.statusCode).toBe(200);
    expect(removeAdministrator.json()).toMatchObject({ id: candidate.id, role: 'member' });
  });

  it('replays member, contact, and ownership writes before changed authorization is rechecked', async () => {
    const groupId = await createClaimedGroup();
    const candidate = await getMember(groupId, 'Candidate Doctor');
    const groupVersion = await getGroupVersion(groupId);

    const roleOperationId = randomUUID();
    const rolePayload = {
      expectedVersion: candidate.version,
      operationId: roleOperationId,
      role: 'administrator',
    } as const;
    const roleUpdate = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': roleOperationId,
      },
      method: 'PUT',
      payload: rolePayload,
      url: `/groups/${groupId}/members/${candidate.id}/role`,
    });
    const roleReplay = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': roleOperationId,
      },
      method: 'PUT',
      payload: rolePayload,
      url: `/groups/${groupId}/members/${candidate.id}/role`,
    });
    const staleRoleOperationId = randomUUID();
    const staleRole = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': staleRoleOperationId,
      },
      method: 'PUT',
      payload: {
        expectedVersion: candidate.version,
        operationId: staleRoleOperationId,
        role: 'member',
      },
      url: `/groups/${groupId}/members/${candidate.id}/role`,
    });
    expect(roleUpdate.statusCode, roleUpdate.body).toBe(200);
    expect(roleReplay.json()).toEqual(roleUpdate.json());
    expect(staleRole.statusCode).toBe(409);
    expect(staleRole.json()).toMatchObject({
      error: {
        latestData: {
          id: candidate.id,
          objectType: 'group_member',
          version: candidate.version + 1,
        },
      },
    });

    const contactOperationId = randomUUID();
    const contactPayload = {
      expectedVersion: 0,
      mobilePhone: '13800000000',
      operationId: contactOperationId,
    };
    const contactUpdate = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': contactOperationId,
      },
      method: 'PUT',
      payload: contactPayload,
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    const contactReplay = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': contactOperationId,
      },
      method: 'PUT',
      payload: contactPayload,
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    const staleContactOperationId = randomUUID();
    const staleContact = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': staleContactOperationId,
      },
      method: 'PUT',
      payload: {
        expectedVersion: 0,
        operationId: staleContactOperationId,
        shortPhone: '6601',
      },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    expect(contactUpdate.statusCode, contactUpdate.body).toBe(200);
    expect(contactReplay.json()).toEqual(contactUpdate.json());
    expect(staleContact.statusCode).toBe(409);
    expect(staleContact.json()).toMatchObject({
      error: {
        latestData: {
          objectType: 'group_member_contact',
          version: 1,
        },
      },
    });

    const transferOperationId = randomUUID();
    const transferPayload = {
      expectedGroupVersion: groupVersion,
      expectedMemberVersion: candidate.version + 1,
      membershipId: candidate.id,
      operationId: transferOperationId,
    };
    const transfer = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': transferOperationId,
      },
      method: 'POST',
      payload: transferPayload,
      url: `/groups/${groupId}/owner-transfer`,
    });
    const transferReplay = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': transferOperationId,
      },
      method: 'POST',
      payload: transferPayload,
      url: `/groups/${groupId}/owner-transfer`,
    });
    expect(transfer.statusCode, transfer.body).toBe(200);
    expect(transferReplay.statusCode, transferReplay.body).toBe(200);
    expect(transferReplay.json()).toEqual(transfer.json());
  });

  it('prevents members from changing another member contact or any administrator role', async () => {
    const groupId = await createClaimedGroup();
    const owner = await getMember(groupId, 'Owner Doctor');

    const roleUpdate = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { expectedVersion: owner.version, role: 'member' },
      url: `/groups/${groupId}/members/${owner.id}/role`,
    });
    const contactUpdate = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { expectedVersion: 0, mobilePhone: '13800000000' },
      url: `/groups/${groupId}/members/${owner.id}/contact`,
    });

    expect(roleUpdate.statusCode).toBe(403);
    expect(contactUpdate.statusCode).toBe(403);
  });

  it('returns mobile phones for active members by default while preserving group boundaries', async () => {
    const groupId = await createClaimedGroup();
    const candidate = await getMember(groupId, 'Candidate Doctor');
    const owner = await getMember(groupId, 'Owner Doctor');

    const ownerContact = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { expectedVersion: 0, mobilePhone: '13900000000', shortPhone: '9000' },
      url: `/groups/${groupId}/members/${owner.id}/contact`,
    });
    const candidateContact = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { expectedVersion: 0, mobilePhone: '13800000000', shortPhone: '8000' },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    const guestJoin = await app.inject({
      headers: { authorization: 'Bearer outsider-token' },
      method: 'POST',
      url: `/groups/${groupId}/join-guest`,
    });
    const suspendedRoster = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: ['Suspended Doctor'] },
      url: `/groups/${groupId}/roster-entries`,
    });
    await insertDirectMembership(client, { groupCode: '1234', realName: 'Suspended Doctor' });
    await client.database
      .update(users)
      .set({ status: 'suspended' })
      .where(eq(users.cloudbaseUid, 'cloudbase-suspended'));

    const otherGroup = await createGroup('other-owner-token', 'Other group', '4567');
    const crossGroupRead = await app.inject({
      headers: { authorization: 'Bearer other-owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/contacts`,
    });
    const sameGroupRead = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'GET',
      url: `/groups/${groupId}/contacts`,
    });

    expect(ownerContact.statusCode).toBe(200);
    expect(candidateContact.statusCode).toBe(200);
    expect(guestJoin.statusCode).toBe(201);
    expect(suspendedRoster.statusCode).toBe(200);
    expect(otherGroup.statusCode).toBe(201);
    expect(crossGroupRead.statusCode).toBe(403);
    expect(crossGroupRead.json()).not.toHaveProperty('contacts');
    expect(sameGroupRead.statusCode).toBe(200);
    const contacts = sameGroupRead.json() as Array<{
      membershipId: string;
      mobilePhone?: string;
      shortPhone?: string;
    }>;
    expect(contacts.find((contact) => contact.membershipId === candidate.id)).toMatchObject({
      mobilePhone: '13800000000',
      shortPhone: '8000',
    });
    const ownerResult = contacts.find((contact) => contact.membershipId === owner.id);
    expect(ownerResult).toMatchObject({ mobilePhone: '13900000000', shortPhone: '9000' });
  });

  it('lets members edit only themselves while owner, administrator, and developer confirm any active member', async () => {
    const groupId = await createClaimedGroup();
    const candidate = await getMember(groupId, 'Candidate Doctor');
    const owner = await getMember(groupId, 'Owner Doctor');

    const ownUpdate = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { expectedVersion: 0, mobilePhone: '13800000000', shortPhone: '8000' },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    const otherUpdate = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { expectedVersion: 0, mobilePhone: '13700000000' },
      url: `/groups/${groupId}/members/${owner.id}/contact`,
    });
    const memberConfirm = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { expectedVersion: 1, isConfirmed: true },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    const ownerConfirm = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { expectedVersion: 1, isConfirmed: true, shortPhone: '8001' },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    const makeAdministrator = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { expectedVersion: candidate.version, role: 'administrator' },
      url: `/groups/${groupId}/members/${candidate.id}/role`,
    });
    const administratorConfirm = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { expectedVersion: 0, isConfirmed: true, shortPhone: '9001' },
      url: `/groups/${groupId}/members/${owner.id}/contact`,
    });
    const developerConfirm = await app.inject({
      headers: { authorization: 'Bearer developer-token' },
      method: 'PUT',
      payload: { expectedVersion: 2, isConfirmed: true, shortPhone: '8002' },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });

    expect(ownUpdate.statusCode).toBe(200);
    expect(ownUpdate.json()).toMatchObject({ isConfirmed: false, shortPhone: '8000' });
    expect(otherUpdate.statusCode).toBe(403);
    expect(memberConfirm.statusCode).toBe(403);
    expect(ownerConfirm.statusCode).toBe(200);
    expect(ownerConfirm.json()).toMatchObject({
      isConfirmed: true,
      mobilePhone: '13800000000',
      shortPhone: '8001',
    });
    expect(makeAdministrator.statusCode).toBe(200);
    expect(administratorConfirm.statusCode).toBe(200);
    expect(administratorConfirm.json()).toMatchObject({ isConfirmed: true, shortPhone: '9001' });
    expect(administratorConfirm.json()).not.toHaveProperty('mobilePhone');
    expect(developerConfirm.statusCode).toBe(200);
    expect(developerConfirm.json()).toMatchObject({
      isConfirmed: true,
      mobilePhone: '13800000000',
      shortPhone: '8002',
    });
  });

  it('keeps the self-controlled visibility preference version-bound and rejects administrator overrides', async () => {
    const groupId = await createClaimedGroup();
    const candidate = await getMember(groupId, 'Candidate Doctor');
    const saved = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { expectedVersion: 0, mobilePhone: '13800000000', shortPhone: '8000' },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    expect(saved.statusCode, saved.body).toBe(200);
    let contactVersion = (saved.json() as { version: number }).version;
    const administratorVerification = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { expectedVersion: contactVersion, isConfirmed: true, shortPhone: '8001' },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    expect(administratorVerification.statusCode, administratorVerification.body).toBe(200);
    expect(administratorVerification.json()).toMatchObject({ mobilePhone: '13800000000' });
    contactVersion = (administratorVerification.json() as { version: number }).version;

    const initial = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'GET',
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(initial.statusCode, initial.body).toBe(200);
    expect(initial.json()).toMatchObject({
      contactVersion,
      groupId,
      maskedMobilePhone: '138 **** 0000',
      membershipId: candidate.id,
      noticeVersion: 'v1',
      state: 'consented',
    });

    const beforeGrant = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/contacts`,
    });
    expect(beforeGrant.statusCode).toBe(200);
    expect(
      (beforeGrant.json() as Array<{ membershipId: string; mobilePhone?: string }>).find(
        (contact) => contact.membershipId === candidate.id,
      ),
    ).toMatchObject({ mobilePhone: '13800000000' });

    const missingKey = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: {
        consented: true,
        expectedContactVersion: contactVersion,
        noticeVersion: 'v1',
      },
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(missingKey.statusCode).toBe(400);
    const headerOperationId = randomUUID();
    const mismatchedKey = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': headerOperationId,
      },
      method: 'PUT',
      payload: {
        consented: true,
        expectedContactVersion: contactVersion,
        noticeVersion: 'v1',
        operationId: randomUUID(),
      },
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(mismatchedKey.statusCode).toBe(400);
    const unknownNotice = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': randomUUID(),
      },
      method: 'PUT',
      payload: {
        consented: true,
        expectedContactVersion: contactVersion,
        noticeVersion: 'v2',
      },
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(unknownNotice.statusCode).toBe(400);

    const guestJoin = await app.inject({
      headers: { authorization: 'Bearer outsider-token' },
      method: 'POST',
      url: `/groups/${groupId}/join-guest`,
    });
    expect(guestJoin.statusCode).toBe(201);
    const guestConsent = await app.inject({
      headers: { authorization: 'Bearer outsider-token' },
      method: 'GET',
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(guestConsent.statusCode).toBe(403);

    const operationId = randomUUID();
    const request = {
      consented: true,
      expectedContactVersion: contactVersion,
      noticeVersion: 'v1',
      operationId,
    };
    const granted = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': operationId,
      },
      method: 'PUT',
      payload: request,
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(granted.statusCode, granted.body).toBe(200);
    expect(granted.json()).toMatchObject({ state: 'consented' });

    const replay = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': operationId,
      },
      method: 'PUT',
      payload: request,
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(replay.statusCode, replay.body).toBe(200);
    expect(replay.json()).toEqual(granted.json());

    const changedPayload = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': operationId,
      },
      method: 'PUT',
      payload: { ...request, consented: false },
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(changedPayload.statusCode).toBe(409);

    const afterGrant = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/contacts`,
    });
    expect(
      (afterGrant.json() as Array<{ membershipId: string; mobilePhone?: string }>).find(
        (contact) => contact.membershipId === candidate.id,
      ),
    ).toMatchObject({ mobilePhone: '13800000000' });

    const administratorMobileUpdate = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'PUT',
      payload: { expectedVersion: contactVersion, mobilePhone: '13900000000' },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    expect(administratorMobileUpdate.statusCode).toBe(403);
    const forgedTarget = await app.inject({
      headers: {
        authorization: 'Bearer owner-token',
        'idempotency-key': randomUUID(),
      },
      method: 'PUT',
      payload: {
        consented: true,
        expectedContactVersion: contactVersion,
        membershipId: candidate.id,
        noticeVersion: 'v1',
      },
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(forgedTarget.statusCode).toBe(400);

    const [auditRows] = await client.database.execute(
      sql`SELECT action, metadata FROM audit_logs
          WHERE group_id = ${groupId} AND action LIKE 'mobile_phone_consent_%'`,
    );
    expect(auditRows).toHaveLength(1);
    expect(
      (auditRows as unknown as Array<{ metadata: Record<string, unknown> }>)[0]?.metadata,
    ).toMatchObject({
      contactVersion: contactVersion + 1,
      fingerprint: expect.stringMatching(/^[a-f\d]{64}$/u),
      noticeVersion: 'v1',
    });
    expect(JSON.stringify(auditRows)).not.toContain('13800000000');

    await client.database
      .update(groupMemberships)
      .set({ deletedAt: new Date(), status: 'inactive' })
      .where(eq(groupMemberships.id, candidate.id));
    const inactiveConsent = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'GET',
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(inactiveConsent.statusCode).toBe(403);
  });

  it('keeps default visibility on number or notice changes, supports explicit revoke, and never copies a phone across groups', async () => {
    const groupId = await createClaimedGroup();
    const candidate = await getMember(groupId, 'Candidate Doctor');
    const saved = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { expectedVersion: 0, mobilePhone: '13800000000' },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    const firstVersion = (saved.json() as { version: number }).version;
    const grantOperationId = randomUUID();
    const grant = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': grantOperationId,
      },
      method: 'PUT',
      payload: {
        consented: true,
        expectedContactVersion: firstVersion,
        noticeVersion: 'v1',
      },
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(grant.statusCode, grant.body).toBe(200);
    const grantedVersion = (grant.json() as { contactVersion: number }).contactVersion;

    const changed = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'PUT',
      payload: { expectedVersion: grantedVersion, mobilePhone: '13900000000' },
      url: `/groups/${groupId}/members/${candidate.id}/contact`,
    });
    expect(changed.statusCode, changed.body).toBe(200);
    const changedVersion = (changed.json() as { version: number }).version;
    const oldGrantReplay = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': grantOperationId,
      },
      method: 'PUT',
      payload: {
        consented: true,
        expectedContactVersion: firstVersion,
        noticeVersion: 'v1',
      },
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(oldGrantReplay.statusCode, oldGrantReplay.body).toBe(200);
    expect(oldGrantReplay.json()).toEqual(grant.json());
    const staleAfterNumber = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'GET',
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(staleAfterNumber.json()).toMatchObject({
      contactVersion: changedVersion,
      state: 'consented',
    });

    const versionConflict = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': randomUUID(),
      },
      method: 'PUT',
      payload: {
        consented: true,
        expectedContactVersion: firstVersion,
        noticeVersion: 'v1',
      },
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(versionConflict.statusCode).toBe(409);

    const regrant = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': randomUUID(),
      },
      method: 'PUT',
      payload: {
        consented: true,
        expectedContactVersion: changedVersion,
        noticeVersion: 'v1',
      },
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(regrant.statusCode, regrant.body).toBe(200);
    const regrantedVersion = (regrant.json() as { contactVersion: number }).contactVersion;

    await client.database.execute(
      sql`UPDATE group_member_contacts
          SET mobile_phone_consent_notice_version = 'v0'
          WHERE membership_id = ${candidate.id}`,
    );
    const staleNotice = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'GET',
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(staleNotice.json()).toMatchObject({ state: 'consented' });

    const revoke = await app.inject({
      headers: {
        authorization: 'Bearer candidate-token',
        'idempotency-key': randomUUID(),
      },
      method: 'PUT',
      payload: {
        consented: false,
        expectedContactVersion: regrantedVersion,
        noticeVersion: 'v1',
      },
      url: `/groups/${groupId}/mobile-phone-consent`,
    });
    expect(revoke.statusCode, revoke.body).toBe(200);
    expect(revoke.json()).toMatchObject({ state: 'not-consented' });

    const otherGroup = await createGroup('candidate-token', 'Candidate other group', '5678');
    const otherGroupId = (otherGroup.json() as { id: string }).id;
    const otherStatus = await app.inject({
      headers: { authorization: 'Bearer candidate-token' },
      method: 'GET',
      url: `/groups/${otherGroupId}/mobile-phone-consent`,
    });
    expect(otherStatus.statusCode, otherStatus.body).toBe(200);
    expect(otherStatus.json()).toMatchObject({ state: 'missing-phone' });

    const [auditRows] = await client.database.execute(
      sql`SELECT action, metadata FROM audit_logs
          WHERE group_id = ${groupId} AND action LIKE 'mobile_phone_consent_%'
          ORDER BY occurred_at, id`,
    );
    expect((auditRows as unknown as Array<{ action: string }>).map((row) => row.action)).toEqual([
      'mobile_phone_consent_granted',
      'mobile_phone_consent_invalidated',
      'mobile_phone_consent_granted',
      'mobile_phone_consent_revoked',
    ]);
    expect(
      (auditRows as unknown as Array<{ metadata: Record<string, unknown> }>).every(
        (row) => typeof row.metadata.contactVersion === 'number',
      ),
    ).toBe(true);
    expect(
      (auditRows as unknown as Array<{ metadata: Record<string, unknown> }>).every(
        (row) => typeof row.metadata.fingerprint === 'string',
      ),
    ).toBe(true);
    expect(JSON.stringify(auditRows)).not.toContain('13900000000');
  });

  it('keeps exactly one owner when transfer validation fails and when a transfer succeeds', async () => {
    const groupId = await createClaimedGroup();
    const candidate = await getMember(groupId, 'Candidate Doctor');
    const groupVersion = await getGroupVersion(groupId);
    const [ownerUser] = await client.database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cloudbaseUid, 'cloudbase-owner'));

    const invalidTransfer = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        expectedGroupVersion: groupVersion,
        expectedMemberVersion: 1,
        membershipId: '00000000-0000-4000-8000-000000000000',
      },
      url: `/groups/${groupId}/owner-transfer`,
    });
    await expectOwnerState(groupId, ownerUser?.id);

    const successfulTransfer = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: {
        expectedGroupVersion: groupVersion,
        expectedMemberVersion: candidate.version,
        membershipId: candidate.id,
      },
      url: `/groups/${groupId}/owner-transfer`,
    });
    const [candidateUser] = await client.database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.cloudbaseUid, 'cloudbase-candidate'));
    await expectOwnerState(groupId, candidateUser?.id);

    expect(invalidTransfer.statusCode).toBe(404);
    expect(successfulTransfer.statusCode).toBe(200);
    expect(successfulTransfer.json()).toMatchObject({ id: groupId, role: 'administrator' });
  });

  it('soft deletes a group and excludes it from subsequent group switching data', async () => {
    const group = await createGroup('owner-token', 'Recoverable group', '5678');
    const groupSnapshot = group.json() as { id: string; version: number };
    const groupId = groupSnapshot.id;

    const deleted = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'DELETE',
      payload: { expectedVersion: groupSnapshot.version },
      url: `/groups/${groupId}`,
    });
    const listed = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: '/groups',
    });
    const [storedGroup] = await client.database
      .select({ deletedAt: groups.deletedAt })
      .from(groups)
      .where(eq(groups.id, groupId));

    expect(deleted.statusCode).toBe(204);
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: groupId })]),
    );
    expect(storedGroup?.deletedAt).toBeInstanceOf(Date);
  });

  it('hides group codes from guest group summaries', async () => {
    const group = await createGroup('owner-token', 'Guest code group', '6789');
    const groupId = (group.json() as { id: string }).id;

    const joined = await app.inject({
      headers: { authorization: 'Bearer outsider-token' },
      method: 'POST',
      url: `/groups/${groupId}/join-guest`,
    });
    expect(joined.statusCode).toBe(201);

    const listed = await app.inject({
      headers: { authorization: 'Bearer outsider-token' },
      method: 'GET',
      url: '/groups',
    });
    const summary = (listed.json() as Array<{ groupCode?: string; role: string }>)[0];
    expect(summary?.role).toBe('guest');
    expect(summary?.groupCode).toBeUndefined();
  });

  async function createClaimedGroup(): Promise<string> {
    const group = await createGroup('owner-token', 'Primary group', '1234');
    const groupId = (group.json() as { id: string }).id;
    const roster = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'POST',
      payload: { realNames: ['Candidate Doctor'] },
      url: `/groups/${groupId}/roster-entries`,
    });

    expect(group.statusCode).toBe(201);
    expect(roster.statusCode).toBe(200);
    await insertDirectMembership(client, { groupCode: '1234', realName: 'Candidate Doctor' });
    return groupId;
  }

  async function createGroup(token: string, name: string, groupCode: string) {
    return app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { groupCode, name },
      url: '/groups',
    });
  }

  async function getMember(groupId: string, realName: string) {
    const response = await app.inject({
      headers: { authorization: 'Bearer owner-token' },
      method: 'GET',
      url: `/groups/${groupId}/members`,
    });

    expect(response.statusCode).toBe(200);
    const member = (response.json() as { id: string; realName: string; version: number }[]).find(
      (entry) => entry.realName === realName,
    );
    expect(member).toBeDefined();
    return member as { id: string; realName: string; version: number };
  }

  async function getGroupVersion(groupId: string): Promise<number> {
    const [group] = await client.database
      .select({ version: groups.version })
      .from(groups)
      .where(eq(groups.id, groupId));
    expect(group).toBeDefined();
    return group!.version;
  }

  async function expectOwnerState(
    groupId: string,
    expectedOwnerUserId: string | undefined,
  ): Promise<void> {
    const ownerMemberships = await client.database
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          eq(groupMemberships.role, 'owner'),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
        ),
      );
    const [group] = await client.database
      .select({ ownerUserId: groups.ownerUserId })
      .from(groups)
      .where(eq(groups.id, groupId));

    expect(ownerMemberships).toEqual([{ userId: expectedOwnerUserId }]);
    expect(group).toEqual({ ownerUserId: expectedOwnerUserId });
  }

  async function registerUser(token: string, realName: string): Promise<void> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { realName },
      url: '/users',
    });

    expect(response.statusCode).toBe(201);
  }
});

function createFakeAuthPort(tokens: Readonly<Record<string, string>>): AuthPort {
  return {
    authenticate: async ({ authorization }) => {
      const token = authorization?.replace(/^Bearer\s+/iu, '');
      const cloudbaseUid = token === undefined ? undefined : tokens[token];

      return cloudbaseUid === undefined ? undefined : { cloudbaseUid };
    },
  };
}

function getTestDatabaseOptions(): DatabaseConnectionOptions | undefined {
  if (process.env.NODE_ENV !== 'test') {
    return undefined;
  }

  const {
    TEST_MYSQL_DATABASE,
    TEST_MYSQL_HOST,
    TEST_MYSQL_PASSWORD,
    TEST_MYSQL_PORT,
    TEST_MYSQL_USER,
  } = process.env;
  const port = Number(TEST_MYSQL_PORT ?? '3307');

  if (
    TEST_MYSQL_DATABASE === undefined ||
    TEST_MYSQL_PASSWORD === undefined ||
    TEST_MYSQL_USER === undefined ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    return undefined;
  }

  return {
    database: TEST_MYSQL_DATABASE,
    host: TEST_MYSQL_HOST ?? '127.0.0.1',
    password: TEST_MYSQL_PASSWORD,
    port,
    user: TEST_MYSQL_USER,
  };
}

async function resetDatabase(client: DatabaseClient): Promise<void> {
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_search_aliases`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_contact_methods`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_source_documents`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_import_batches`);
  await client.database.execute(sql`DROP TABLE IF EXISTS directory_campuses`);
  await client.database.execute(sql`DROP TABLE IF EXISTS invite_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS miniprogram_telemetry_events`);
  await client.database.execute(sql`DROP TABLE IF EXISTS visitor_access_monthly_aggregates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS visitor_access_logs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS backup_archives`);
  await client.database.execute(sql`DROP TABLE IF EXISTS platform_job_runs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_cells`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_template_members`);
  await client.database.execute(sql`DROP TABLE IF EXISTS manual_schedule_templates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS duty_adjustments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS workflow_sequence_allocations`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_deliveries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notifications`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_preferences`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_settings`);
  await client.database.execute(sql`DROP TABLE IF EXISTS web_push_subscriptions`);
  await client.database.execute(sql`DROP TABLE IF EXISTS notification_batches`);
  await client.database.execute(sql`DROP TABLE IF EXISTS holiday_dates`);
  await client.database.execute(sql`DROP TABLE IF EXISTS holiday_calendar_versions`);
  await client.database.execute(sql`DROP TABLE IF EXISTS statistics_recalc_checks`);
  await client.database.execute(sql`DROP TABLE IF EXISTS statistics_snapshots`);
  await client.database.execute(sql`DROP TABLE IF EXISTS export_jobs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS shift_assignments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_periods`);
  await client.database.execute(sql`DROP TABLE IF EXISTS audit_logs`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_events`);
  await client.database.execute(sql`DROP TABLE IF EXISTS rotation_members`);
  await client.database.execute(sql`DROP TABLE IF EXISTS rotation_rules`);
  await client.database.execute(sql`DROP TABLE IF EXISTS shift_types`);
  await client.database.execute(sql`DROP TABLE IF EXISTS member_schedule_roles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS schedule_roles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_join_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS guest_schedule_access_attempts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS membership_claim_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_code_attempts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_member_contacts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS leave_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS swap_requests`);
  await client.database.execute(sql`DROP TABLE IF EXISTS group_memberships`);
  await client.database.execute(sql`DROP TABLE IF EXISTS roster_entries`);
  await client.database.execute(sql`DROP TABLE IF EXISTS idempotency_keys`);
  await client.database.execute(sql`DROP TABLE IF EXISTS \`groups\``);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_auth_identities`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_password_credentials`);
  await client.database.execute(sql`DROP TABLE IF EXISTS user_profiles`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_admin_binding_tickets`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_identity_detachments`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_link_tokens`);
  await client.database.execute(sql`DROP TABLE IF EXISTS wechat_union_accounts`);
  await client.database.execute(sql`DROP TABLE IF EXISTS users`);
  await client.database.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations`);
  await client.database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}
