// A minimal zip writer and reader (deflate, no dependency): what a .streamDeckProfile is.
// The reader exists for the tests: a profile we write must read back.

import zlib from "node:zlib";

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

export function crc32(data) {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

/** entries: [{name, data?: Buffer}] (no data = a directory, name ending with "/"). */
export function writeZip(entries) {
	const locals = [];
	const centrals = [];
	let offset = 0;
	for (const entry of entries) {
		const name = Buffer.from(entry.name, "utf8");
		const raw = entry.data ?? Buffer.alloc(0);
		const packed = raw.length > 0 ? zlib.deflateRawSync(raw) : raw;
		const method = raw.length > 0 ? 8 : 0;
		const crc = crc32(raw);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(0x0800, 6);   // names in UTF-8
		local.writeUInt16LE(method, 8);
		local.writeUInt32LE(0x00210000, 10);   // a fixed date: the same input gives the same bytes
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(packed.length, 18);
		local.writeUInt32LE(raw.length, 22);
		local.writeUInt16LE(name.length, 26);
		locals.push(local, name, packed);
		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(0x0800, 8);
		central.writeUInt16LE(method, 10);
		central.writeUInt32LE(0x00210000, 12);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(packed.length, 20);
		central.writeUInt32LE(raw.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt32LE(entry.data ? 0 : 0x10, 38);   // directory flag
		central.writeUInt32LE(offset, 42);
		centrals.push(central, name);
		offset += 30 + name.length + packed.length;
	}
	const centralSize = centrals.reduce((n, b) => n + b.length, 0);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(centralSize, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...locals, ...centrals, end]);
}

/** {name: Buffer} of a zip written by any tool (deflate or stored), CRC checked. */
export function readZip(buffer) {
	const endAt = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
	if (endAt < 0) {
		throw new Error("not a zip");
	}
	const count = buffer.readUInt16LE(endAt + 10);
	let at = buffer.readUInt32LE(endAt + 16);
	const out = {};
	for (let i = 0; i < count; i++) {
		const method = buffer.readUInt16LE(at + 10);
		const crc = buffer.readUInt32LE(at + 16);
		const packedSize = buffer.readUInt32LE(at + 20);
		const nameLength = buffer.readUInt16LE(at + 28);
		const extra = buffer.readUInt16LE(at + 30) + buffer.readUInt16LE(at + 32);
		const local = buffer.readUInt32LE(at + 42);
		const name = buffer.subarray(at + 46, at + 46 + nameLength).toString("utf8");
		const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
		const packed = buffer.subarray(start, start + packedSize);
		const data = method === 8 ? zlib.inflateRawSync(packed) : Buffer.from(packed);
		if (crc32(data) !== crc) {
			throw new Error(`bad CRC: ${name}`);
		}
		out[name] = data;
		at += 46 + nameLength + extra;
	}
	return out;
}
