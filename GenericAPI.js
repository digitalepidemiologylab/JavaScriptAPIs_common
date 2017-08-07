/* @flow */

import { reachUrlWithPromise } from './ajaxhelpers';

export default class GenericAPI {

  host: string;
  version: string;
  apiKey: string;
  sessionToken: string;
  contentType: string;

  constructor(apiKey: string, host: string, version: string, contentType  = 'application/json') {
    if (!apiKey) {
      throw new Error('Endpoints need an API key');
    }
    this.apiKey = apiKey;
    this.host = host;
    this.version = version;
    this.contentType = version;
  }

  requestURL(method: string, kind: string, query: ?string[], postData: Object) {
    const queryStr = query ? `?${query.join('&')}` : '';
    const url = `${this.host}/api/v${this.version}/${kind}${queryStr}`;

    const headers = [
      ['Authorization', `Token token="${this.apiKey}"${this.sessionToken ? `, session="${this.sessionToken}"` : ''}`],
      ['Content-Type', this.contentType]
    ];

    function handler(response) {
      try {
        const createReachUrlCall = function createReachUrlCall(name) {
          if (!response.links[name]) return null;

          return function reachUrlCall() {
            return reachUrlWithPromise({
              method,
              url: unescape(response.links[name]),
              headers,
              postData,
            });
          };
        };
        if (response.links) {
          response.next = createReachUrlCall('next');
          response.prev = createReachUrlCall('prev');
          response.first = createReachUrlCall('first');
          response.last = createReachUrlCall('last');
        }
      } catch (error) {
        response.error = error;
      }
    }

    return new Promise((resolve, reject) => {
      reachUrlWithPromise({
        method,
        url,
        headers,
        postData,
      }).then((response) => {
        const obj = JSON.parse(response);
        handler(obj);
        resolve(obj);
      }, (error) => {
        reject(error);
      });
    });
  }

  requestGetURL(kind: string, postData: Object = {}): Promise<*> {
    return this.requestURL('GET', kind, null, postData);
  }

  requestPostURL(kind: string, postData: Object = {}): Promise<*> {
    return this.requestURL('POST', kind, null, postData);
  }

  requestDeleteURL(kind: string, postData: Object = {}): Promise<*> {
    return this.requestURL('DELETE', kind, null, postData);
  }

  requestPatchURL(kind: string, postData: Object = {}): Promise<Object> {
    return this.requestURL('PATCH', kind, null, postData);
  }
}
