// @flow

const urlRe = /^(?:(.*):)?(\/\/)([^/:]*)(?::(\d+))?([^?]*)(?:\?((?:&?[^&#]*)*))?(?:#(.*))?$/;

export default class Url {
  protocol: ?string;

  host: ?string;

  port: ?number;

  path: ?string;

  parameters: ?string;

  fragment: ?string;

  constructor(url: string) {
    const [, pr, , h, po, pat, par, f] = url.match(urlRe) || [];
    this.protocol = pr;
    this.host = h;
    this.port = po ? Number(po) : undefined;
    this.path = pat;
    this.parameters = par;
    this.fragment = f;
  }

  get params() {
    const { parameters } = this;
    if (parameters) {
      const paramRe = /([^&=]+)(?:=([^&]*))?/g;
      const res = [];
      let matches;
      // eslint-disable-next-line no-cond-assign
      while ((matches = paramRe.exec(parameters))) {
        const [, key, value] = matches;
        res.push({ key, value });
      }
      return res;
    }
    return undefined;
  }

  toString() {
    let res = '';
    const {
      protocol, host, port, path, parameters, fragment,
    } = this;
    if (protocol) {
      res += `${protocol}:`;
    }
    res += `//${host || ''}`;
    if (typeof port === 'string') {
      res += `:${port}`;
    }
    res += path || '';
    if (parameters) {
      const ps = [];
      (this.params || []).forEach((p) => {
        const { key, value } = p;
        if (value === undefined) {
          ps.push(`${encodeURIComponent(key)}`);
        } else {
          ps.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
      });
      res += `?${ps.join('&')}`;
    }
    if (fragment) {
      res += `#${fragment}`;
    }
    return res;
  }
}
