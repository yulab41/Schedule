export async function enableTestClientCapabilities(version = 'test') {
  const store = await import('../src/app/client-capability-store.ts');
  store.configureRuntimeClientCapabilityReader(
    () =>
      Promise.resolve({
        core: true,
        externalMessages: true,
        global: true,
        guest: true,
        insights: true,
        organization: true,
        platform: 'miniprogram',
        version,
        workflows: true,
      }),
    version,
  );
  await store.refreshClientCapabilities({ force: true });
}
