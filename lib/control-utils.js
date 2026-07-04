function resolveControlInput(msg, cfg) {
  const payload = (msg && msg.payload && typeof msg.payload === 'object') ? msg.payload : {};
  const serial = (payload.serial || msg && msg.serial || cfg && cfg.serial || '').toString().trim();
  const key = (payload.key || msg && msg.key || cfg && cfg.key || '').toString().trim();
  const code = payload.code !== undefined ? payload.code : (msg && msg.code !== undefined ? msg.code : cfg && cfg.code);
  const value = payload.value !== undefined ? payload.value : (msg && msg.value !== undefined ? msg.value : cfg && cfg.value);
  return { serial, key, code, value };
}

module.exports = { resolveControlInput };
