// @flow

// Adapted from https://stackoverflow.com/questions/8936984

/* eslint no-bitwise: 0, no-mixed-operators: 0, camelcase: 0 */

const { StringDecoder } = require('string_decoder');
const { Buffer } = require('safe-buffer');

class UTF8 {
  static EOF_byte: number = -1;

  static EOF_code_point: number = -1;

  static encoderError(code_point: number) {
    console.error('UTF8 encoderError', code_point);
  }

  static decoderError(fatal: boolean, opt_code_point?: number): number {
    if (fatal) console.error('UTF8 decoderError', opt_code_point);
    return opt_code_point || 0xfffd;
  }

  static inRange(a: number, min: number, max: number) {
    return min <= a && a <= max;
  }

  static div(n: number, d: number) {
    return Math.floor(n / d);
  }

  static stringToCodePoints(string: string) {
    /** @type {Array.<number>} */
    const cps = [];
    // Based on http://www.w3.org/TR/WebIDL/#idl-DOMString
    let i = 0;
    const n = string.length;
    while (i < string.length) {
      const c = string.charCodeAt(i);
      if (!this.inRange(c, 0xd800, 0xdfff)) {
        cps.push(c);
      } else if (this.inRange(c, 0xdc00, 0xdfff)) {
        cps.push(0xfffd);
      } else if (i === n - 1) {
        // (inRange(c, 0xD800, 0xDBFF))
        cps.push(0xfffd);
      } else {
        const d = string.charCodeAt(i + 1);
        if (this.inRange(d, 0xdc00, 0xdfff)) {
          const a = c & 0x3ff;
          const b = d & 0x3ff;
          i += 1;
          cps.push(0x10000 + (a << 10) + b);
        } else {
          cps.push(0xfffd);
        }
      }
      i += 1;
    }
    return cps;
  }

  static encode(str: string): Uint8Array {
    let pos: number = 0;
    const codePoints = this.stringToCodePoints(str);
    const outputBytes = [];

    while (codePoints.length > pos) {
      const code_point: number = codePoints[pos++];

      if (this.inRange(code_point, 0xd800, 0xdfff)) {
        this.encoderError(code_point);
      } else if (this.inRange(code_point, 0x0000, 0x007f)) {
        outputBytes.push(code_point);
      } else {
        let count = 0;
        let offset = 0;
        if (this.inRange(code_point, 0x0080, 0x07ff)) {
          count = 1;
          offset = 0xc0;
        } else if (this.inRange(code_point, 0x0800, 0xffff)) {
          count = 2;
          offset = 0xe0;
        } else if (this.inRange(code_point, 0x10000, 0x10ffff)) {
          count = 3;
          offset = 0xf0;
        }

        outputBytes.push(this.div(code_point, 64 ** count) + offset);

        while (count > 0) {
          const temp = this.div(code_point, 64 ** (count - 1));
          outputBytes.push(0x80 + (temp % 64));
          count -= 1;
        }
      }
    }
    return new Uint8Array(outputBytes);
  }

  static decode(data: Uint8Array): string {
    // Takes ~50ms for a 100K data on iPhoneX in release
    const fatal: boolean = false;
    let pos: number = 0;
    let result: string = '';
    let code_point: ?number;
    let utf8_code_point = 0;
    let utf8_bytes_needed = 0;
    let utf8_bytes_seen = 0;
    let utf8_lower_boundary = 0;

    while (data.length > pos) {
      const byte = data[pos++];

      if (byte === this.EOF_byte) {
        if (utf8_bytes_needed !== 0) {
          code_point = this.decoderError(fatal);
        } else {
          code_point = this.EOF_code_point;
        }
      } else if (utf8_bytes_needed === 0) {
        if (byte >= 0x00 && byte <= 0x7f) {
          code_point = byte;
        } else {
          if (byte >= 0xc2 && byte <= 0xdf) {
            utf8_bytes_needed = 1;
            utf8_lower_boundary = 0x80;
            utf8_code_point = byte - 0xc0;
          } else if (byte >= 0xe0 && byte <= 0xef) {
            utf8_bytes_needed = 2;
            utf8_lower_boundary = 0x800;
            utf8_code_point = byte - 0xe0;
          } else if (byte >= 0xf0 && byte <= 0xf4) {
            utf8_bytes_needed = 3;
            utf8_lower_boundary = 0x10000;
            utf8_code_point = byte - 0xf0;
          } else {
            this.decoderError(fatal);
          }
          utf8_code_point *= 64 ** utf8_bytes_needed;
          code_point = null;
        }
      } else if (!(byte >= 0x80 && byte <= 0xbf)) {
        utf8_code_point = 0;
        utf8_bytes_needed = 0;
        utf8_bytes_seen = 0;
        utf8_lower_boundary = 0;
        pos--;
        code_point = this.decoderError(fatal, byte);
      } else {
        utf8_bytes_seen += 1;
        utf8_code_point
          += (byte - 0x80) * 64 ** (utf8_bytes_needed - utf8_bytes_seen);

        if (utf8_bytes_seen !== utf8_bytes_needed) {
          code_point = null;
        } else {
          const cp = utf8_code_point;
          const lower_boundary = utf8_lower_boundary;
          utf8_code_point = 0;
          utf8_bytes_needed = 0;
          utf8_bytes_seen = 0;
          utf8_lower_boundary = 0;
          if (
            lower_boundary <= cp
            && cp <= 0x10ffff
            && !(cp >= 0xd800 && cp <= 0xdfff)
          ) {
            code_point = cp;
          } else {
            code_point = this.decoderError(fatal, byte);
          }
        }
      }

      // Decode string
      if (code_point !== null && code_point !== this.EOF_code_point) {
        if (code_point <= 0xffff) {
          if (code_point > 0) {
            result += String.fromCharCode(code_point);
          }
        } else {
          code_point -= 0x10000;
          result += String.fromCharCode(0xd800 + ((code_point >> 10) & 0x3ff));
          result += String.fromCharCode(0xdc00 + (code_point & 0x3ff));
        }
      }
    }
    return result;
  }

  /*
  static decode(data: Uint8Array): string {
    // Takes ~50ms for a 100K data on iPhoneX in release
    const fatal: boolean = false;
    let pos: number = 0;
    let result: string = '';
    let code_point: ?number;
    let utf8_code_point = 0;
    let utf8_bytes_needed = 0;
    let utf8_bytes_seen = 0;
    let utf8_lower_boundary = 0;

    while (data.length > pos) {
      const byte = data[pos++];

      if (byte === this.EOF_byte) {
        if (utf8_bytes_needed !== 0) {
          code_point = this.decoderError(fatal);
        } else {
          code_point = this.EOF_code_point;
        }
      } else if (utf8_bytes_needed === 0) {
        if (this.inRange(byte, 0x00, 0x7f)) {
          code_point = byte;
        } else {
          if (this.inRange(byte, 0xc2, 0xdf)) {
            utf8_bytes_needed = 1;
            utf8_lower_boundary = 0x80;
            utf8_code_point = byte - 0xc0;
          } else if (this.inRange(byte, 0xe0, 0xef)) {
            utf8_bytes_needed = 2;
            utf8_lower_boundary = 0x800;
            utf8_code_point = byte - 0xe0;
          } else if (this.inRange(byte, 0xf0, 0xf4)) {
            utf8_bytes_needed = 3;
            utf8_lower_boundary = 0x10000;
            utf8_code_point = byte - 0xf0;
          } else {
            this.decoderError(fatal);
          }
          utf8_code_point *= 64 ** utf8_bytes_needed;
          code_point = null;
        }
      } else if (!this.inRange(byte, 0x80, 0xbf)) {
        utf8_code_point = 0;
        utf8_bytes_needed = 0;
        utf8_bytes_seen = 0;
        utf8_lower_boundary = 0;
        pos--;
        code_point = this.decoderError(fatal, byte);
      } else {
        utf8_bytes_seen += 1;
        utf8_code_point +=
          (byte - 0x80) * 64 ** (utf8_bytes_needed - utf8_bytes_seen);

        if (utf8_bytes_seen !== utf8_bytes_needed) {
          code_point = null;
        } else {
          const cp = utf8_code_point;
          const lower_boundary = utf8_lower_boundary;
          utf8_code_point = 0;
          utf8_bytes_needed = 0;
          utf8_bytes_seen = 0;
          utf8_lower_boundary = 0;
          if (
            this.inRange(cp, lower_boundary, 0x10ffff) &&
            !this.inRange(cp, 0xd800, 0xdfff)
          ) {
            code_point = cp;
          } else {
            code_point = this.decoderError(fatal, byte);
          }
        }
      }
      // Decode string
      if (code_point !== null && code_point !== this.EOF_code_point) {
        if (code_point <= 0xffff) {
          if (code_point > 0) result += String.fromCharCode(code_point);
        } else {
          code_point -= 0x10000;
          result += String.fromCharCode(0xd800 + ((code_point >> 10) & 0x3ff));
          result += String.fromCharCode(0xdc00 + (code_point & 0x3ff));
        }
      }
    }
    return result;
  }
  */

  static decodeWithDecoder(data: Uint8Array): string {
    const decoder = new StringDecoder('utf8');
    return decoder.write(Buffer.from(data));
  }
}

export default UTF8;
