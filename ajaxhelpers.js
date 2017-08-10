function HttpError(request) {
  const error = new Error(request.statusText || request.responseText);
  error.request = request;
  return error;
}

type paramsType = {
  method: string;
  url: string;
  headers?: string[][];
  postData?: Object;
}

const curlEquivalentToConsole = false;

function reachUrl(method: string, url: string, headers: string[][], body?: Object,
  callback: Function, errorCallback: Function) {
  const xhttp = new XMLHttpRequest();

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

  xhttp.onerror = (error) => {
    errorCallback(error, xhttp);
  };

  // Open connection
  xhttp.open(method, url, true);

  let curlStr = `curl -X ${method}`;

  function singleQuoteEscape(s) {
    return s.replace(/'/g, "\\'");
  }

  // Put headers
  if (Array.isArray(headers)) {
    headers.forEach((header) => {
      if (Array.isArray(header) && header.length === 2) {
        xhttp.setRequestHeader(header[0], header[1]);
        curlStr += ` -H '${singleQuoteEscape(header[0])}: ${singleQuoteEscape(header[1])}'`;
      }
    });
  }

  // Prepare body
  let bodyStr = null;
  if (body) {
    bodyStr = typeof body === 'string'
      ? body
      : JSON.stringify(body);

    curlStr += ` -d '${singleQuoteEscape(bodyStr)}'`;
  }

  curlStr += ` ${url}`;

  // Log curl equivalent
  if (curlEquivalentToConsole) console.log(curlStr);

  // Send request
  xhttp.send(bodyStr);
}

function reachUrlWithPromise(params: paramsType) {
  return new Promise((resolve, reject) => {
    reachUrl(params.method, params.url, params.headers || [], params.body,
      (xhttp) => {
        if (xhttp.status === 200) {
          resolve(xhttp.response, xhttp);
        } else {
          reject(new HttpError(xhttp));
        }
      },
      xhttp => reject(Error('Network Error'), xhttp),
    );
  });
}

export { HttpError, reachUrlWithPromise };
export type UrlPromiseParamsType = paramsType;
