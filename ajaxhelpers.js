// @flow

class HttpError extends Error {
  request: XMLHttpRequest;

  constructor(request: XMLHttpRequest) {
    const details = [];
    details.push(`Status code: ${request.status}`);
    if (typeof request.statusText === 'string') {
      details.push(`Status: ${request.statusText}`);
    }
    details.push(`Response: ${request.responseText}`);
    const message = `(${details.join(', ')})`;
    super(message);

    this.request = request;
  }
}

type ParamsType = {
  method: string,
  url: string,
  headers?: string[][],
  postData?: Object,
  body?: ?Object,
  timeout?: number,
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
) {
  const xhttp = new XMLHttpRequest();
  let timeoutTimer = null;

  // Open connection
  xhttp.open(method, url, true);

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
  timeoutTimer = setTimeout(() => {
    xhttp.abort();
  }, timeout * 1.1);
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
    );
  });
}

export { HttpError, reachUrlWithPromise };
export type UrlPromiseParamsType = ParamsType;
