// JavaScript has one Number type. Keep each JSON numeric token's type alongside
// its containing object/array so workflow reordering cannot detach that type.
const numbers = new WeakMap();

function remember(parent, key, value, type, raw) {
  if (!parent || typeof parent !== 'object') return;
  let entries = numbers.get(parent);
  if (!entries) { entries = new Map(); numbers.set(parent, entries); }
  entries.set(String(key), {value, type, raw});
}

export function numberType(parent, key) {
  return numbers.get(parent)?.get(String(key))?.type ||
    (Number.isInteger(parent?.[key]) ? 'integer' : 'float');
}

export function numberText(parent, key) {
  const value = parent[key], saved = numbers.get(parent)?.get(String(key));
  if (!Number.isFinite(value)) throw new Error('Numbers must be finite.');
  if (saved?.raw && Object.is(saved.value, value)) return saved.raw;
  const text = Object.is(value, -0) ? '-0' : String(value);
  return saved?.type === 'float' && !/[.eE]/.test(text) ? text + '.0' : text;
}

export function setNumber(parent, key, input, type = numberType(parent, key)) {
  const raw = String(input).trim(), value = Number(raw);
  if (!raw || !Number.isFinite(value)) throw new Error('Enter a finite number.');
  if (type === 'integer' && !Number.isInteger(value)) throw new Error('This parameter requires an integer.');
  let encoded;
  if (type === 'integer') {
    // Preserve large integer inputs without rounding them through Number.
    encoded = /^[+-]?\d+$/.test(raw) ? BigInt(raw).toString() : value.toLocaleString('en-US', {useGrouping:false, maximumFractionDigits:0});
  } else {
    try { JSON.parse(raw); encoded = raw; } catch { encoded = String(value); }
    if (!/[.eE]/.test(encoded)) encoded += '.0';
  }
  parent[key] = value;
  remember(parent, key, value, type, encoded);
  return value;
}

export function parseNumericJson(text) {
  text = String(text);
  JSON.parse(text); // Validate standard JSON before the token-preserving pass.
  let cursor = 0;
  const whitespace = () => { while (/\s/.test(text[cursor] || '') && cursor < text.length) cursor++; };
  function string() {
    const start = cursor++;
    while (cursor < text.length) {
      if (text[cursor++] === '\\') cursor++;
      else if (text[cursor - 1] === '"') break;
    }
    return JSON.parse(text.slice(start, cursor));
  }
  function read(parent, key) {
    whitespace();
    if (text[cursor] === '"') return string();
    if (text[cursor] === '{' || text[cursor] === '[') {
      const array = text[cursor++] === '[', result = array ? [] : {}, end = array ? ']' : '}';
      whitespace();
      while (text[cursor] !== end) {
        const childKey = array ? result.length : string();
        if (!array) { whitespace(); cursor++; }
        const value = read(result, childKey);
        Object.defineProperty(result, childKey, {value, enumerable:true, writable:true, configurable:true});
        if (typeof value !== 'number') numbers.get(result)?.delete(String(childKey));
        whitespace();
        if (text[cursor] !== ',') break;
        cursor++; whitespace();
      }
      cursor++;
      return result;
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(cursor))[0];
    cursor += token.length;
    const value = JSON.parse(token);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Numbers must be finite.');
      remember(parent, key, value, /[.eE]/.test(token) ? 'float' : 'integer', token);
    }
    return value;
  }
  return read(null, '');
}

export function stringifyNumericJson(value, indent = 2) {
  function encode(v, depth, parent, key) {
    if (typeof v === 'number') return parent ? numberText(parent, key) : JSON.stringify(v);
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      return '[\n' + v.map((x, i) => ' '.repeat(depth + indent) + (encode(x, depth + indent, v, i) ?? 'null')).join(',\n') + '\n' + ' '.repeat(depth) + ']';
    }
    if (v && typeof v === 'object') {
      const entries = Object.entries(v).filter(([, x]) => x !== undefined);
      if (!entries.length) return '{}';
      return '{\n' + entries.map(([k, x]) => ' '.repeat(depth + indent) + JSON.stringify(k) + ': ' + encode(x, depth + indent, v, k)).join(',\n') + '\n' + ' '.repeat(depth) + '}';
    }
    return JSON.stringify(v);
  }
  return encode(value, 0, null, '');
}

export function cloneNumericJson(value) {
  return parseNumericJson(stringifyNumericJson(value));
}

export function assignNumericJson(target, ...sources) {
  for (const source of sources) for (const [key, value] of Object.entries(source)) {
    Object.defineProperty(target, key, {value, enumerable:true, writable:true, configurable:true});
    const saved = numbers.get(source)?.get(key);
    if (saved) remember(target, key, value, saved.type, saved.raw);
    else numbers.get(target)?.delete(key);
  }
  return target;
}
