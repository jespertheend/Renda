const endNode = {};

/**
 * @template K
 * @template V
 */
export default class MultiKeyWeakMap {
	constructor(iterable) {
		this.maps = new WeakMap();
		if (iterable) {
			for (const [keys, value] of iterable) {
				this.set(keys, value);
			}
		}
	}

	getLastMap(keys, create = false) {
		let map = this.maps;
		for (const key of keys) {
			if (map.has(key)) {
				map = map.get(key);
			} else if (create) {
				const newMap = new WeakMap();
				map.set(key, newMap);
				map = newMap;
			} else {
				return undefined;
			}
		}
		return map;
	}

	set(keys, value) {
		const map = this.getLastMap(keys, true);
		map.set(endNode, value);
		return this;
	}

	get(keys) {
		const map = this.getLastMap(keys);
		if (!map) return undefined;
		return map.get(endNode);
	}

	has(keys) {
		const map = this.getLastMap(keys);
		if (!map) return false;
		return map.has(endNode);
	}

	delete(keys) {
		const map = this.getLastMap(keys);
		if (!map) return false;
		return map.delete(endNode);
	}
}
