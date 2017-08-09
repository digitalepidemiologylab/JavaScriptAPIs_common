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

function reachUrl(method: string, url: string, headers: string[][], postData?: Object,
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

  xhttp.onerror = () => {
    errorCallback(xhttp);
  };

  // Open connection
  xhttp.open(method, url, true);

  // Prepare POST data, if any
  let dataStr = 0;
  if (method !== 'GET' && postData) {
    dataStr = typeof postData === 'string' ? postData : JSON.stringify(postData);
  }

  // Put headers
  if (Array.isArray(headers)) {
    headers.forEach((header) => {
      if (Array.isArray(header) && header.length === 2) {
        xhttp.setRequestHeader(header[0], header[1]);
      }
    });
  }

  // Send request
  xhttp.send(dataStr !== 0 ? dataStr : null);
}

function reachUrlWithPromise(params: paramsType) {
  return new Promise((resolve, reject) => {
    reachUrl(params.method, params.url, params.headers || [], params.postData,
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
