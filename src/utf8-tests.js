// @flow

// Adapted from https://stackoverflow.com/questions/8936984

/* eslint no-bitwise: 0, no-mixed-operators: 0, camelcase: 0 */

import UTF8 from './utf8';

import { responseToString } from './ajax-helpers';

function test() {
  // const testUrl = 'https://www.w3.org/2001/06/utf-8-test/UTF-8-demo.html';
  // eslint-disable-next-line max-len
  // const testUrl = 'https://www.cl.cam.ac.uk/~mgk25/ucs/examples/UTF-8-test.txt')
  // Currently longest Wikipedia article in chinese (about Lenin)
  const testUrl = 'https://zh.wikipedia.org/wiki/弗拉基米尔·伊里奇·列宁';
  const promises = [
    UTF8.reachUrlWithPromise({
      url: testUrl,
      responseType: 'arraybuffer',
    }),
    UTF8.reachUrlWithPromise({
      url: testUrl,
      headers: [['Accept-Encoding', 'gzip']],
      responseType: 'arraybuffer',
    }),
    UTF8.UrlWithPromise({
      url: testUrl,
    }),
  ];
  Promise.all(promises).then((results) => {
    const decoded = responseToString(results[0]);
    const gzipdecoded = responseToString(results[1]);
    const original = results[2].responseText;
    // $FlowExpectedError
    const log = console.tron.log || console.log;
    log(
      `UTF-8 decoding test: decoded; ${decoded.length}, gzip decoded: ${
        gzipdecoded.length
      }, original: ${original.length}`,
    );
  });
}

export default test;
