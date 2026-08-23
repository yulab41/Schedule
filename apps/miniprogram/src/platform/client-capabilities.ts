import {
  createClientCapabilityClient,
  createHttpClientError,
  createInvalidResponseError,
  createNetworkError,
  type ClientTransport,
} from '@schedule/client-core';

import {
  createClientCapabilityStore,
  type ClientCapabilityStore,
} from '../app/client-capability-store.js';
import { buildInfo } from './build-info.js';
import { runtimeConfig } from './runtime-config.js';
import {
  executeWxJsonRequest,
  WxRequestNetworkError,
  type WxJsonRequestOptions,
} from './wx-request-executor.js';

const baseUrl = runtimeConfig.apiBaseUrl.replace(/\/$/u, '');

const capabilityTransport: ClientTransport = {
  async request(endpoint, input) {
    try {
      const response = await executeWxJsonRequest({
        capability: 'bypass',
        method: endpoint.method,
        request: (requestOptions: WxJsonRequestOptions) => wx.request(requestOptions),
        url: `${baseUrl}${endpoint.path(input)}`,
      });
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw createHttpClientError(response.statusCode, response.data);
      }
      const decoded = endpoint.decoder.safeDecode(response.data);
      if (!decoded.success) throw createInvalidResponseError(response.statusCode);
      return decoded.data;
    } catch (error) {
      if (error instanceof WxRequestNetworkError) throw createNetworkError();
      throw error;
    }
  },
};

export function createRuntimeClientCapabilityStore(): ClientCapabilityStore {
  const client = createClientCapabilityClient(capabilityTransport);
  return createClientCapabilityStore({
    platform: 'miniprogram',
    read: () => client.get('miniprogram', buildInfo.buildVersion),
    version: buildInfo.buildVersion,
  });
}
