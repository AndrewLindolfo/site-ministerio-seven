const TYPE_KEY = "__sevenFirestoreType";
const TIMESTAMP_TYPE = "timestamp";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTimestampLike(value) {
  return isObject(value)
    && Number.isInteger(value.seconds)
    && Number.isInteger(value.nanoseconds)
    && value.nanoseconds >= 0
    && value.nanoseconds < 1_000_000_000
    && (typeof value.toDate === "function" || value.constructor?.name === "Timestamp");
}

export function encodeFirestoreValue(value, depth = 0) {
  if (depth > 20) throw new Error("Estrutura do backup excede a profundidade permitida.");
  if (value === undefined || value === null) return null;
  if (isTimestampLike(value)) {
    return { [TYPE_KEY]: TIMESTAMP_TYPE, seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (Array.isArray(value)) return value.map((item) => encodeFirestoreValue(item, depth + 1));
  if (isObject(value)) {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "function") continue;
      output[key] = encodeFirestoreValue(item, depth + 1);
    }
    return output;
  }
  return value;
}

export function decodeFirestoreValue(value, timestampFactory, depth = 0) {
  if (depth > 20) throw new Error("Estrutura do backup excede a profundidade permitida.");
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.slice(0, 5000).map((item) => decodeFirestoreValue(item, timestampFactory, depth + 1));
  if (isObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 2
      && keys.includes("seconds")
      && keys.includes("nanoseconds")
      && Number.isInteger(value.seconds)
      && Number.isInteger(value.nanoseconds)
      && value.nanoseconds >= 0
      && value.nanoseconds < 1_000_000_000) {
      return timestampFactory(value.seconds, value.nanoseconds);
    }
    if (keys.length === 3
      && value[TYPE_KEY] === TIMESTAMP_TYPE
      && Number.isInteger(value.seconds)
      && Number.isInteger(value.nanoseconds)
      && value.nanoseconds >= 0
      && value.nanoseconds < 1_000_000_000) {
      return timestampFactory(value.seconds, value.nanoseconds);
    }
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) continue;
      output[key.slice(0, 1500)] = decodeFirestoreValue(item, timestampFactory, depth + 1);
    }
    return output;
  }
  return typeof value === "string" ? value.slice(0, 700_000) : value;
}
