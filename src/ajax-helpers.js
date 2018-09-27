// @flow

import { byteArrayToStr } from './bytearray-helpers';
import Url from './url-helpers';

function responseToString(xhttp: XMLHttpRequest) {
  try {
    switch (xhttp.responseType) {
      case '':
      case 'text':
        return xhttp.responseText;
      case 'arraybuffer': {
        const byteArray = new Uint8Array(xhttp.response);
        return byteArrayToStr(byteArray);
      }
      default:
        throw new Error('Could not convert response to string');
    }
  } catch (e) {
    throw new Error('Could not convert response to string');
  }
}

function responseToObject(xhttp: XMLHttpRequest) {
  try {
    const text = responseToString(xhttp);
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Could not convert response to object');
  }
}

class HttpError extends Error {
  request: XMLHttpRequest;

  response: ?string;

  constructor(request: XMLHttpRequest) {
    const details = [];
    const response = responseToString(request);
    details.push(`Status code: ${request.status}`);
    if (typeof request.statusText === 'string') {
      details.push(`Status: ${request.statusText}`);
    }
    details.push(`Response: ${response}`);
    const message = `(${details.join(', ')})`;
    super(message);
    this.message = message;
    this.response = response;
    this.request = request;
  }
}

export type ResponseType =
  | ''
  | 'arraybuffer'
  | 'blob'
  | 'document'
  | 'json'
  | 'text';

type ParamsType = {
  method?: string,
  url: string,
  headers?: string[][],
  postData?: Object,
  body?: ?Object,
  timeout?: number,
  responseType?: ResponseType,
};

const debugConfig = {
  curlEquivalentToConsole: false,
  curlEquivalentToTronConsole: false,
};

function reachUrl(
  method: string = 'GET',
  url: string,
  headers: string[][],
  body: ?(string | Object),
  callback: (xhttp: XMLHttpRequest, event?: any) => void,
  errorCallback: (xhttp: XMLHttpRequest) => void,
  timeout: ?number,
  responseType: ?ResponseType,
) {
  const xhttp = new XMLHttpRequest();
  let timeoutTimer = null;

  // Open connection
  xhttp.open(method, url, true);
  xhttp.responseType = responseType || '';

  /*
  xhttp.onreadystatechange = function onreadystatechange() {
    if (this.readyState === 4) {
      if (typeof callback === 'function') {
        callback(this);
      }
    }
  };
  */

  xhttp.onload = () => {
    callback(xhttp);
  };

  xhttp.onerror = () => {
    errorCallback(xhttp);
  };

  xhttp.ontimeout = () => {
    errorCallback(xhttp);
  };

  xhttp.onabort = () => {
    errorCallback(xhttp);
  };

  xhttp.onreadystatechange = () => {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  };

  xhttp.timeout = timeout || 0;

  const { curlEquivalentToConsole, curlEquivalentToTronConsole } = debugConfig;
  const curlNeeded = curlEquivalentToConsole || curlEquivalentToTronConsole;

  let curlStr = curlNeeded ? `curl -X ${method}` : null;

  function singleQuoteEscape(s) {
    return s.replace(/'/g, '\\\'');
  }

  // Put headers
  if (Array.isArray(headers)) {
    headers.forEach((header) => {
      if (Array.isArray(header) && header.length === 2) {
        xhttp.setRequestHeader(header[0], header[1]);
        if (curlStr) {
          curlStr += ` -H '${singleQuoteEscape(header[0])}: ${singleQuoteEscape(
            header[1],
          )}'`;
        }
      }
    });
  }

  // Prepare body
  let bodyStr: ?string = null;
  if (body) {
    bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    if (curlStr) {
      curlStr += ` -d '${singleQuoteEscape(bodyStr)}'`;
    }
  }

  if (curlStr) {
    curlStr += ` "${new Url(url).toString()}"`;
  }

  // Log curl equivalent
  if (curlEquivalentToConsole) console.log(curlStr);
  // $FlowExpectedError
  if (curlEquivalentToTronConsole) console.tron.log(curlStr);

  // Send request
  xhttp.send(bodyStr);

  // Handle timeouts ourselves too because on Android, it seems
  // buggy connections in emulator fail to trigger timeouts
  // (i.e. could not resolve host)
  if (xhttp.timeout) {
    timeoutTimer = setTimeout(() => {
      xhttp.abort();
    }, xhttp.timeout * 1.1);
  }
}

function reachUrlWithPromise(params: ParamsType): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    reachUrl(
      params.method,
      params.url,
      params.headers || [],
      params.body,
      (xhttp: XMLHttpRequest) => {
        if (xhttp.status === 200) {
          resolve(xhttp);
        } else {
          reject(new HttpError(xhttp));
        }
      },
      (xhttp: XMLHttpRequest) => reject(new HttpError(xhttp)),
      params.timeout || 0,
      params.responseType,
    );
  });
}

export {
  HttpError, reachUrlWithPromise, responseToString, responseToObject,
};
export type UrlPromiseParamsType = ParamsType;
