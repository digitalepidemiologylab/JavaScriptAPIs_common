/* @flow */

import {
  reachUrlWithPromise,
  responseToObject,
  type ResponseType,
} from './ajax-helpers';

const RestFulMethods = {
  GET: 'GET',
  POST: 'POST',
  PATCH: 'PATCH',
  PUT: 'PUT',
  DELETE: 'DELETE',
};

type Links = {|
  next?: string,
    prev ?: string,
    first ?: string,
    last ?: string,
|};

type LinkName = $Keys<Links>;

type Response = {|
  links: Links,
    next ?: ? Function,
    prev ?: ? Function,
    first ?: ? Function,
    last ?: ? Function,
    error ?: Error,
|};

export type TError = {
  message?: string,
  request: XMLHttpRequest,
};

const reURLInformation = new RegExp(
  [
    '^(https?:)//', // protocol
    '(([^:/?#]*)(?::([0-9]+))?)', // host (hostname and port)
    '(/api/v\\d+)', // Path header
    '(/[^?#]*)', // pathname
    '(\\?[^#]*|)', // search
    '(#.*|)$', // hash
  ].join(''),
);

function getLocation(href) {
  // https://stackoverflow.com/questions/736513
  const match = href.match(reURLInformation);
  return (
    match && {
      href,
      protocol: match[1],
      host: match[2],
      hostName: match[3],
      port: match[4],
      pathHeader: match[5],
      pathName: match[6],
      search: match[7],
      hash: match[8],
    }
  );
}

const parseRequestURL = (request: XMLHttpRequest) => (
  getLocation(request.responseURL)
);

export { parseRequestURL };

export type TCompressionType = 'auto' | 'gzip' | 'none';

export default class GenericAPI {
  host: string;

  version: string;

  apiKey: string;

  sessionToken: string;

  compress: TCompressionType;

  onError: ?(error: TError) => void = null;

  constructor(
    apiKey: string,
    host: string,
    version: string,
    compress: TCompressionType = 'auto',
  ) {
    // compress = false;
    if (!apiKey) {
      throw new Error('Endpoints need an API key');
    }
    this.apiKey = apiKey;
    this.host = host;
    this.version = version;
    this.compress = compress;
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

    let responseType: ResponseType;
    switch (this.compress) {
      case 'auto':
        // Leave default params
        // In some frameworks (i.e. React Native)
        // that means gzip and auto decompression
        break;
      case 'gzip':
        headers.push(['Accept-Encoding', 'gzip']);
        responseType = 'arraybuffer';
        break;
      case 'none':
        headers.push(['Accept-Encoding', 'identity']);
        responseType = '';
        break;
      default:
        throw new Error(`Unknown compression parameter: ${this.compress}`);
    }

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
        responseType,
      })
        .then((xhttp: XMLHttpRequest) => {
          const contentType = xhttp.getResponseHeader('Content-Type');
          if (/^application\/json(;|$)/.test(contentType)) {
            try {
              const obj: ?Object = responseToObject(xhttp);
              if (obj !== null && obj !== undefined) {
                handler(obj);
                resolve(obj);
                return;
              }
            } catch (e) {
              /**/
            }
            reject(new Error('Could not parse JSON response'));
          } else {
            resolve(xhttp);
          }
        })
        .catch((error) => {
          if (this.onError) {
            this.onError(error);
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
