/* @flow */

import { HttpError, reachUrlWithPromise } from './ajaxhelpers';

const RestFulMethods = {
  GET: 'GET',
  POST: 'POST',
  PATCH: 'PATCH',
  PUT: 'PUT',
  DELETE: 'DELETE',
};

export default class GenericAPI {
  host: string;
  version: string;
  apiKey: string;
  sessionToken: string;

  constructor(apiKey: string, host: string, version: string) {
    if (!apiKey) {
      throw new Error('Endpoints need an API key');
    }
    this.apiKey = apiKey;
    this.host = host;
    this.version = version;
  }

  requestURL(
    method: string,
    kind: string,
    query: ?(string[]),
    body?: ?Object,
  ): Promise<*> {
    const queryStr = query ? `?${query.join('&')}` : '';
    const url = `${this.host}/api/v${this.version}/${kind}${queryStr}`;

    let authorization = `Token token="${this.apiKey}"`;
    if (this.sessionToken) {
      authorization += `, session="${this.sessionToken}"`;
    }

    const headers = [['Authorization', authorization]];
    if (typeof body !== 'undefined') {
      headers.push(['Content-Type', 'application/json']);
    }

    function handler(response) {
      try {
        const createReachUrlCall = function createReachUrlCall(name) {
          if (!response.links[name]) return null;

          return function reachUrlCall() {
            return reachUrlWithPromise({
              method,
              url: unescape(response.links[name]),
              headers,
              body,
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
        body,
      })
      .then((xhttp) => {
        const contentType = xhttp.getResponseHeader('Content-Type');
        if (/^application\/json(;|$)/.test(contentType)) {
          let obj = null;
          try {
            obj = JSON.parse(xhttp.response);
          } catch (e) {
            reject(
              new HttpError(
                `Could not parse JSON response: ${xhttp.response}`,
              ),
            );
            return;
          }
          if (obj !== null) {
            handler(obj);
          }
          resolve(obj);
        } else {
          resolve(xhttp);
        }
      })
      .catch(reject);
    });
  }

  requestGetURL(kind: string): Promise<*> {
    return this.requestURL(RestFulMethods.GET, kind);
  }

  requestPostURL(kind: string, body: ?Object): Promise<*> {
    return this.requestURL(RestFulMethods.POST, kind, null, body);
  }

  requestDeleteURL(kind: string, body: ?Object): Promise<*> {
    return this.requestURL(RestFulMethods.DELETE, kind, null, body);
  }

  requestPatchURL(kind: string, body: ?Object): Promise<Object> {
    return this.requestURL(RestFulMethods.PATCH, kind, null, body);
  }

  requestPutURL(kind: string, body: ?Object): Promise<Object> {
    return this.requestURL(RestFulMethods.PUT, kind, null, body);
  }
}
