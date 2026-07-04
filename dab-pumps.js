/**
 * node-red-contrib-dab-pumps
 * DAB Pumps DConnect / DAB Live cloud API for Node-RED.
 */
module.exports = function (RED) {
  'use strict';

  const DEFAULT_HOST = 'https://dconnect.dabpumps.com';
  const UA = 'Mozilla/5.0 (Node-RED node-red-contrib-dab-pumps)';
  const { resolveControlInput } = require('./lib/control-utils');

  function mergeCookies(jar, res) {
    let list = [];
    if (typeof res.headers.getSetCookie === 'function') list = res.headers.getSetCookie();
    else { const sc = res.headers.get('set-cookie'); if (sc) list = [sc]; }
    for (const c of list) {
      const pair = c.split(';')[0];
      const i = pair.indexOf('=');
      if (i > -1) jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
    }
  }

  const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

  async function hop(url, opts, jar, max = 12) {
    let cur = url;
    let o = { ...opts, redirect: 'manual' };
    for (let i = 0; i < max; i++) {
      o.headers = { 'User-Agent': UA, ...(o.headers || {}) };
      if (Object.keys(jar).length) o.headers['Cookie'] = cookieHeader(jar);
      const res = await fetch(cur, o);
      mergeCookies(jar, res);
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return res;
        cur = new URL(loc, cur).toString();
        o = { method: 'GET', redirect: 'manual' };
        continue;
      }
      return res;
    }
    throw new Error('too many redirects');
  }

  function deepParse(v) {
    if (typeof v === 'string') {
      const s = v.trim();
      if ((s[0] === '{' && s.endsWith('}')) || (s[0] === '[' && s.endsWith(']'))) {
        try { return deepParse(JSON.parse(s)); } catch (e) { return v; }
      }
      return v;
    }
    if (Array.isArray(v)) return v.map(deepParse);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) o[k] = deepParse(v[k]);
      return o;
    }
    return v;
  }

  function findDevices(obj, acc) {
    acc = acc || [];
    if (Array.isArray(obj)) {
      obj.forEach((o) => findDevices(o, acc));
    } else if (obj && typeof obj === 'object') {
      const serial = obj.serial || obj.serial_number || obj.dum_serial;
      if (serial && typeof serial === 'string') {
        acc.push({ serial, name: obj.name || obj.dum_name || obj.description || serial });
      }
      for (const val of Object.values(obj)) findDevices(val, acc);
    }
    return acc;
  }

  async function fetchAll(host, username, password) {
    const jar = {};

    const page = await hop(host + '/', { method: 'GET' }, jar);
    const html = await page.text();
    const m = html.match(/id="kc-form-login"[^>]*action="([^"]+)"/i) ||
      html.match(/action="([^"]+)"\s+method="post"/i) ||
      html.match(/action="([^"]+)"/i);
    if (!m) throw new Error('login form not found (portal layout may have changed)');
    const action = m[1].replace(/&amp;/g, '&');

    const body = new URLSearchParams({ username, password }).toString();
    await hop(action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }, jar);

    const instRes = await hop(host + '/api/v1/gui/installation/list?lang=en', { method: 'GET' }, jar);
    if (instRes.status === 401 || instRes.status === 403) {
      throw new Error('authentication failed - check credentials (use a dedicated DAB account)');
    }
    const installations = deepParse(await instRes.json());
    const devices = findDevices(installations);
    if (!devices.length) throw new Error('no devices found in installation list');

    const results = [];
    for (const d of devices) {
      const sRes = await hop(host + '/dumstate/' + d.serial, { method: 'GET' }, jar);
      const raw = deepParse(await sRes.json());
      const status = (raw && raw.status) ? raw.status : raw;
      results.push({
        serial: d.serial,
        name: d.name,
        status,
        statusts: raw.statusts,
        lastreceived: raw.lastreceived,
      });
    }
    return results;
  }

  async function writeParameter(host, username, password, serial, key, code, value) {
    const jar = {};
    const page = await hop(host + '/', { method: 'GET' }, jar);
    const html = await page.text();
    const m = html.match(/id="kc-form-login"[^>]*action="([^"]+)"/i) ||
      html.match(/action="([^"]+)"\s+method="post"/i) ||
      html.match(/action="([^"]+)"/i);
    if (!m) throw new Error('login form not found (portal layout may have changed)');
    const action = m[1].replace(/&amp;/g, '&');

    const body = new URLSearchParams({ username, password }).toString();
    await hop(action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }, jar);

    const endpoint = host + '/dum/' + serial;
    const payload = { key, value: code !== undefined ? code : value };
    const res = await hop(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, jar);

    if (!res.ok) {
      const text = await res.text();
      throw new Error('write failed: ' + res.status + ' ' + text);
    }

    return { ok: true, status: res.status };
  }

  function DabPumpsConfigNode(cfg) {
    RED.nodes.createNode(this, cfg);
    this.host = (cfg.host && cfg.host.trim()) || DEFAULT_HOST;
  }
  RED.nodes.registerType('dab-pumps-config', DabPumpsConfigNode, {
    credentials: {
      username: { type: 'text' },
      password: { type: 'password' },
    },
  });

  function DabPumpsNode(cfg) {
    RED.nodes.createNode(this, cfg);
    const node = this;
    const account = RED.nodes.getNode(cfg.account);
    const seconds = Math.max(0, parseInt(cfg.interval, 10) || 0);
    const perDevice = cfg.output !== 'combined';
    let timer = null;
    let busy = false;

    async function poll(send, done) {
      if (busy) { if (done) done(); return; }
      if (!account) {
        node.status({ fill: 'red', shape: 'ring', text: 'no account configured' });
        if (done) done(new Error('no account configured'));
        return;
      }
      busy = true;
      node.status({ fill: 'blue', shape: 'dot', text: 'polling...' });
      try {
        const user = account.credentials && account.credentials.username;
        const pass = account.credentials && account.credentials.password;
        const devices = await fetchAll(account.host, user, pass);

        if (perDevice) {
          const msgs = devices.map((d) => ({
            payload: d.status,
            serial: d.serial,
            device: d.name,
            statusts: d.statusts,
            lastreceived: d.lastreceived,
            topic: 'dabpumps/' + d.serial,
          }));
          send([msgs]);
        } else {
          const map = {};
          devices.forEach((d) => { map[d.serial] = d; });
          send({ payload: map, topic: 'dabpumps' });
        }
        node.status({ fill: 'green', shape: 'dot', text: devices.length + ' device(s) ' + new Date().toLocaleTimeString() });
        if (done) done();
      } catch (err) {
        node.status({ fill: 'red', shape: 'ring', text: String(err.message || err) });
        if (done) done(err); else node.error(err);
      } finally {
        busy = false;
      }
    }

    node.on('input', function (msg, send, done) {
      send = send || function () { node.send.apply(node, arguments); };
      if (msg && msg.command === 'write') {
        if (!account) {
          node.status({ fill: 'red', shape: 'ring', text: 'no account configured' });
          if (done) done(new Error('no account configured'));
          return;
        }
        const user = account.credentials && account.credentials.username;
        const pass = account.credentials && account.credentials.password;
        const input = resolveControlInput(msg, cfg);
        if (!input.serial || !input.key) {
          node.status({ fill: 'red', shape: 'ring', text: 'missing serial or key' });
          if (done) done(new Error('missing serial or key'));
          return;
        }
        node.status({ fill: 'blue', shape: 'dot', text: 'writing...' });
        writeParameter(account.host, user, pass, input.serial, input.key, input.code, input.value)
          .then((result) => {
            node.status({ fill: 'green', shape: 'dot', text: 'write ok' });
            node.send({ payload: result, serial: input.serial, key: input.key, topic: 'dabpumps/' + input.serial + '/write' });
            if (done) done();
          })
          .catch((err) => {
            node.status({ fill: 'red', shape: 'ring', text: String(err.message || err) });
            if (done) done(err); else node.error(err);
          });
        return;
      }
      poll(send, done);
    });

    if (seconds > 0) {
      timer = setInterval(function () {
        poll(function () { node.send.apply(node, arguments); });
      }, seconds * 1000);
      setTimeout(function () {
        poll(function () { node.send.apply(node, arguments); });
      }, 2500);
    }

    node.on('close', function () {
      if (timer) clearInterval(timer);
      timer = null;
    });
  }

  RED.nodes.registerType('dab-pumps', DabPumpsNode);
};
