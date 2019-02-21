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

function convertModelToFormData(
  model: any,
  form: ?FormData = null,
  namespace: string = ''
): FormData {
  const formData = form || new FormData();

  const keys = Object.keys(model);
  keys.forEach((propertyName) => {
    const formKey = namespace ? `${namespace}[${propertyName}]` : propertyName;
    if (model[propertyName] instanceof Date) {
      formData.append(formKey, model[propertyName].toISOString());
    } else if (model[propertyName] instanceof Array) {
      model[propertyName].forEach((element, index) => {
        const tempFormKey = `${formKey}[${index}]`;
        convertModelToFormData(element, formData, tempFormKey);
      });
    } else if (typeof model[propertyName] === 'object'
      && !(model[propertyName] instanceof File)) {
      // eslint-disable-next-line no-underscore-dangle
      if (model[propertyName]._keepAsObject) {
        const { _keepAsObject, ...obj } = model[propertyName];
        formData.append(formKey, obj);
      } else {
        convertModelToFormData(model[propertyName], formData, formKey);
      }
    } else {
      formData.append(formKey, model[propertyName].toString());
    }
  });
  return formData;
}

function reachUrl(
  method: string = 'GET',
  url: string,
  headers: string[][],
  body: ?(string | Object | FormData),
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

  function singleQuoteEscape(s: string) {
    return s.replace(/'/g, '\\\'');
  }

  // Put headers
  let sendAsFormData = false;
  if (Array.isArray(headers)) {
    headers.forEach((header) => {
      if (Array.isArray(header) && header.length === 2) {
        const [name, value] = header;
        if (!sendAsFormData
          && name === 'Content-Type'
          && value === 'multipart/form-data') {
          sendAsFormData = true;
        }
        xhttp.setRequestHeader(name, value);
        if (curlStr) {
          curlStr += ` -H '${singleQuoteEscape(name)}: ${singleQuoteEscape(
            value,
          )}'`;
        }
      }
    });
  }
  const isBodyFormData = Object.prototype.isPrototypeOf.call(FormData, body);
  if (isBodyFormData) {
    if (!sendAsFormData) {
      //xhttp.setRequestHeader('Content-Type', 'multipart/form-data');
      sendAsFormData = true;
    }
  }

  // Prepare body
  let bodyStr: ?string = null;
  let formData: ?FormData = null;
  if (sendAsFormData) {
    if (typeof body === 'string') {
      formData = convertModelToFormData(body);
    } else {
      formData = body;
    }
    if (curlStr) {
      curlStr += ` -d '${JSON.stringify(formData)}'`;
    }
  } else if (body) {
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
  xhttp.send(bodyStr || formData);

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
        if (Math.floor(xhttp.status / 100) === 2) {
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
  HttpError, reachUrl, reachUrlWithPromise, responseToString,
  responseToObject, convertModelToFormData,
};
export type UrlPromiseParamsType = ParamsType;
