// @flow

import UTF8 from './utf8';

const pako = require('pako');

type ByteArrayToStrMethod = 'auto' | 'gzip' | 'utf-8';

const byteArrayToStr = (
  byteArray: Uint8Array,
  method: ByteArrayToStrMethod = 'auto',
) => {
  let actualMethod = method;
  if (method === 'auto') {
    if (byteArray.length > 1) {
      // cf. http://www.zlib.org/rfc-gzip.html
      const ID1 = byteArray[0];
      const ID2 = byteArray[1];
      if (ID1 === 31 && ID2 === 139) {
        actualMethod = 'gzip';
      } else {
        actualMethod = 'utf-8';
      }
    } else {
      actualMethod = 'utf-8';
    }
  }
  switch (actualMethod) {
    case 'utf-8':
      return UTF8.decodeWithDecoder(byteArray);
    case 'gzip':
      return pako.inflate(byteArray, { to: 'string' });
    default:
      throw new Error(`Invalid byte array to string method: ${method}`);
  }
};

// eslint-disable-next-line import/prefer-default-export
export { byteArrayToStr };
