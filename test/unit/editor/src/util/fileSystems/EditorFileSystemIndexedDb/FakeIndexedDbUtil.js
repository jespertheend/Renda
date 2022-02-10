/** @type {Map<string, Database>} */
const databases = new Map();

class Database {
	/**
	 * @param {string[]} objectStoreNames
	 */
	constructor(objectStoreNames) {
		/** @type {Map<string, Map<string, unknown>>} */
		this.objectStores = new Map();
		for (const name of objectStoreNames) {
			this.objectStores.set(name, new Map());
		}
	}

	/**
	 * @param {string} objectStoreName
	 */
	#getObjectStore(objectStoreName) {
		const objectStore = this.objectStores.get(objectStoreName);
		if (!objectStore) {
			// Not sure what the behaviour should be but this shouldn't happen
			// anyway so we'll just throw.
			throw new Error(`Object store ${objectStoreName} does not exist`);
		}
		return objectStore;
	}

	/**
	 * @param {string} objectStoreName
	 * @param {string} key
	 */
	get(objectStoreName, key) {
		const store = this.#getObjectStore(objectStoreName);
		return store.get(key);
	}

	/**
	 * @param {string} objectStoreName
	 * @param {string} key
	 * @param {unknown} value
	 */
	set(objectStoreName, key, value) {
		const store = this.#getObjectStore(objectStoreName);
		store.set(key, value);
	}

	/**
	 * @param {string} objectStoreName
	 * @param {string} key
	 */
	delete(objectStoreName, key) {
		const store = this.#getObjectStore(objectStoreName);
		store.delete(key);
	}
}

export class FakeIndexedDbUtil {
	#dbName;
	#db;
	#objectStoreNames;

	constructor(dbName = "keyValuesDb", {
		objectStoreNames = ["keyValues"],
		enableLocalStorageFallback = false,
	} = {}) {
		this.#dbName = dbName;

		const existingDb = databases.get(dbName);
		if (existingDb) {
			this.#db = existingDb;
		} else {
			this.#db = new Database(objectStoreNames);
			databases.set(dbName, this.#db);
		}

		this.#objectStoreNames = [...objectStoreNames];
	}

	#assertDbExists() {
		if (!databases.has(this.#dbName)) {
			// Not sure what would happen here in the real IndexedDbUtil,
			// but this shouldn't happen so we'll just throw.
			throw new Error(`Database ${this.#dbName} has been deleted.`);
		}
	}

	/**
	 * @param {string} key
	 */
	get(key, objectStoreName = this.#objectStoreNames[0]) {
		return this.#db.get(objectStoreName, key);
	}

	/**
	 * @param {string} key
	 * @param {unknown} value
	 */
	set(key, value, objectStoreName = this.#objectStoreNames[0]) {
		return this.#db.set(objectStoreName, key, value);
	}

	/**
	 * @param {string} key
	 */
	delete(key, objectStoreName = this.#objectStoreNames[0]) {
		return this.#db.delete(objectStoreName, key);
	}

	deleteDb() {
		databases.delete(this.#dbName);
	}
}