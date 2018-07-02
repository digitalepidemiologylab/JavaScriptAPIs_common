/* @flow */

import { reachUrlWithPromise, responseToObject } from './ajaxhelpers';

const RestFulMethods = {
  GET: 'GET',
  POST: 'POST',
  PATCH: 'PATCH',
  PUT: 'PUT',
  DELETE: 'DELETE',
};

type Links = {|
  next?: string,
  prev?: string,
  first?: string,
  last?: string,
|};

type LinkName = $Keys<Links>;

type Response = {|
  links: Links,
  next?: ?Function,
  prev?: ?Function,
  first?: ?Function,
  last?: ?Function,
  error?: Error,
|};

export default class GenericAPI {
  host: string;
  version: string;
  apiKey: string;
  sessionToken: string;

  on401: ?(error: Error) => void = null;

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
    query?: ?(string[]),
    body?: ?Object,
    timeout: number = 0,
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

    headers.push(['Accept-Encoding', 'gzip']);

    function handler(response: Response) {
      try {
        const createReachUrlCall = function createReachUrlCall(
          name: LinkName,
        ): ?Function {
          if (!response.links[name]) return null;

          return function reachUrlCall() {
            if (!response.links[name]) return null;
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
        response.error = (error: Error);
      }
    }

    return new Promise((resolve, reject) => {
      reachUrlWithPromise({
        method,
        url,
        headers,
        body,
        timeout,
        responseType: 'arraybuffer',
      })
      .then((xhttp: XMLHttpRequest) => {
        const contentType = xhttp.getResponseHeader('Content-Type');
        if (/^application\/json(;|$)/.test(contentType)) {
          try {
            const obj: ?Object = responseToObject(xhttp);
            if (obj !== null && obj !== undefined) {
              handler(obj);
              resolve(obj);
            } else {
              reject(new Error('Could not parse JSON response'));
            }
          } catch (e) {
            reject(new Error('Could not parse JSON response'));
          }
        } else {
          resolve(xhttp);
        }
      })
      .catch((error) => {
        if (
          this.on401 &&
            error &&
            error.request &&
            error.request.status === 401
        ) {
          this.on401(error);
        }
        reject(error);
      });
    });
  }

  requestGetURL(kind: string, timeout: number = 0): Promise<*> {
    return this.requestURL(
      RestFulMethods.GET,
      kind,
      undefined,
      undefined,
      timeout,
    );
  }

  requestPostURL(kind: string, body: ?Object, timeout: number = 0): Promise<*> {
    return this.requestURL(RestFulMethods.POST, kind, null, body, timeout);
  }

  requestDeleteURL(
    kind: string,
    body: ?Object,
    timeout: number = 0,
  ): Promise<*> {
    return this.requestURL(RestFulMethods.DELETE, kind, null, body, timeout);
  }

  requestPatchURL(
    kind: string,
    body: ?Object,
    timeout: number = 0,
  ): Promise<Object> {
    return this.requestURL(RestFulMethods.PATCH, kind, null, body, timeout);
  }

  requestPutURL(
    kind: string,
    body: ?Object,
    timeout: number = 0,
  ): Promise<Object> {
    return this.requestURL(RestFulMethods.PUT, kind, null, body, timeout);
  }
}
