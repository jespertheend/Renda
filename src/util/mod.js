export {StorageType, default as BinaryComposer} from "./BinaryComposer.js";
export {default as BinaryDecomposer} from "./BinaryDecomposer.js";
export {default as MultiKeyWeakMap} from "./MultiKeyWeakMap.js";
export {default as OrbitControls} from "./OrbitControls.js";
export {default as SingleInstancePromise} from "./SingleInstancePromise.js";

/**
 * Clamps a value between `min` and `max`.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

/**
 * Clamps a value between 0 and 1.
 * @param {number} value
 * @returns {number}
 */
export function clamp01(value) {
	return clamp(value, 0, 1);
}

/**
 * In javascript, the `%` operator calculates the _remainder_ of two numbers.
 * This has the effect that negative numbers have a different result from what
 * you might expect. For example: `-1 % 4` results in `-1`, even though you
 * might expect `3`. The modulo function takes care of this: `mod(-1, 4)`
 * results in `3`.
 *
 * This returns a value between `0` and `m` where `m` is exclusive,
 * so `mod(4,4)` returns `0`.
 * @param {number} n
 * @param {number} m
 * @returns {number}
 */
export function mod(n, m) {
	return ((n % m) + m) % m;
}

/**
 * Linearly interpolate between `a` and `b`.
 * @param {number} a The first value.
 * @param {number} b The secodd value.
 * @param {number} t The value to use for interpolation.
 * @returns {number}
 */
export function lerp(a, b, t) {
	return a + t * (b - a);
}

/**
 * The inverse of {@link lerp}. Returns a value between `0` and `1` when `t` is
 * between `a` and `b`.
 * @param {number} a The first value.
 * @param {number} b The secodd value.
 * @param {number} t The value to use for interpolation.
 * @returns {number}
 */
export function iLerp(a, b, t) {
	return (t - a) / (b - a);
}

/**
 * Maps `value` from `fromMin` to `toMin` and from `fromMax` to `toMax`.
 * @param {number} fromMin
 * @param {number} fromMax
 * @param {number} toMin
 * @param {number} toMax
 * @param {number} value The value to map.
 * @param {boolean} performClamp Whether to clamp the result between `toMin` and `toMax`.
 * @returns {number}
 */
export function mapValue(fromMin, fromMax, toMin, toMax, value, performClamp = false) {
	let lerpedVal = iLerp(fromMin, fromMax, value);
	if (performClamp) lerpedVal = clamp01(lerpedVal);
	return lerp(toMin, toMax, lerpedVal);
}

export async function *streamAsyncIterator(stream) {
	const reader = stream.getReader();
	try {
		while (true) {
			const {done, value} = await reader.read();
			if (done) return;
			yield value;
		}
	} finally {
		reader.releaseLock();
	}
}

export function isUuid(uuidStr) {
	const re = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gmi;
	return re.test(uuidStr);
}

export function arrayBufferToBase64(buffer) {
	let binaryStr = "";
	const bytes = new Uint8Array(buffer);
	const length = bytes.byteLength;
	for (let i = 0; i < length; i++) {
		binaryStr += String.fromCharCode(bytes[i]);
	}
	return btoa(binaryStr);
}

export function base64ToArrayBuffer(base64) {
	const binaryStr = atob(base64);
	const length = binaryStr.length;
	const bytes = new Uint8Array(length);
	for (let i = 0; i < length; i++) {
		bytes[i] = binaryStr.charCodeAt(i);
	}
	return bytes.buffer;
}