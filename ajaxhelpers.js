// @flow

const pako = require('pako');

type ByteArrayToStrMethod = 'auto' | 'gzip' | 'string';

function byteArrayToStr(
  byteArray: Uint8Array,
  method: ByteArrayToStrMethod = 'auto',
) {
  let actualMethod;
  if (method === 'auto') {
    if (byteArray.length > 1) {
      // cf. http://www.zlib.org/rfc-gzip.html
      const [ID1, ID2] = byteArray;
      if (ID1 === 31 && ID2 === 139) {
        actualMethod = 'gzip';
      } else {
        actualMethod = 'string';
      }
    } else {
      actualMethod = method;
    }
  }
  switch (actualMethod) {
    case 'string':
      return String.fromCharCode.apply(null, byteArray);
    case 'gzip':
      return pako.inflate(byteArray, { to: 'string' });
    default:
      throw new Error(`Invalid byte array to string method: ${method}`);
  }
}

function responseToString(xhttp: XMLHttpRequest) {
  try {
    switch (xhttp.responseType) {
      case '':
      case 'text':
        return xhttp.responseText;
      case 'arraybuffer': {
        const { response } = xhttp;
        const contentEncoding = xhttp.getResponseHeader('Content-Encoding');
        if (contentEncoding === 'gzip') {
          const byteArray = new Uint8Array(response);
          return byteArrayToStr(byteArray);
        }
        return response;
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

  constructor(request: XMLHttpRequest) {
    const details = [];
    details.push(`Status code: ${request.status}`);
    if (typeof request.statusText === 'string') {
      details.push(`Status: ${request.statusText}`);
    }
    details.push(`Response: ${responseToString(request)}`);
    const message = `(${details.join(', ')})`;
    super(message);

    this.request = request;
  }
}

type ResponseType = '' | 'arraybuffer' | 'blob' | 'document' | 'json' | 'text';

type ParamsType = {
  method: string,
  url: string,
  headers?: string[][],
  postData?: Object,
  body?: ?Object,
  timeout?: number,
  responseType?: ResponseType,
};

const curlEquivalentToConsole = false;

function reachUrl(
  method: string,
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
  // alert(`xhttp.timeout: ${xhttp.timeout}`);

  let curlStr = `curl -X ${method}`;

  function singleQuoteEscape(s) {
    return s.replace(/'/g, '\\\'');
  }

  // Put headers
  if (Array.isArray(headers)) {
    headers.forEach((header) => {
      if (Array.isArray(header) && header.length === 2) {
        xhttp.setRequestHeader(header[0], header[1]);
        curlStr += ` -H '${singleQuoteEscape(header[0])}: ${singleQuoteEscape(
          header[1],
        )}'`;
      }
    });
  }

  // Prepare body
  let bodyStr: ?string = null;
  if (body) {
    bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

    curlStr += ` -d '${singleQuoteEscape(bodyStr)}'`;
  }

  curlStr += ` ${url}`;

  // Log curl equivalent
  if (curlEquivalentToConsole) console.log(curlStr);

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

export { HttpError, reachUrlWithPromise };
export type UrlPromiseParamsType = ParamsType;
