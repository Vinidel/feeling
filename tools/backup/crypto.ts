const MAGIC = new TextEncoder().encode("STEADYB1");
const IV_BYTES = 12;
const KEY_BYTES = 32;

function concatenate(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((length, part) => length + part.length, 0),
  );
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

export function decodeEncryptionKey(encoded: string): Uint8Array {
  let decoded: Uint8Array;

  try {
    decoded = Uint8Array.from(
      atob(encoded),
      (character) => character.charCodeAt(0),
    );
  } catch {
    throw new Error("BACKUP_ENCRYPTION_KEY must be valid base64");
  }

  if (decoded.length !== KEY_BYTES) {
    throw new Error("BACKUP_ENCRYPTION_KEY must decode to 32 bytes");
  }

  return decoded;
}

async function importKey(
  keyBytes: Uint8Array,
  usage: KeyUsage,
): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "AES-GCM" },
    false,
    [usage],
  );
}

export async function encryptBytes(
  plaintext: Uint8Array,
  keyBytes: Uint8Array,
  iv = crypto.getRandomValues(new Uint8Array(IV_BYTES)),
): Promise<Uint8Array> {
  if (keyBytes.length !== KEY_BYTES) throw new Error("invalid encryption key");
  if (iv.length !== IV_BYTES) throw new Error("invalid AES-GCM IV");

  const key = await importKey(keyBytes, "encrypt");
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(plaintext),
    ),
  );

  return concatenate(MAGIC, iv, ciphertext);
}

export async function decryptBytes(
  encrypted: Uint8Array,
  keyBytes: Uint8Array,
): Promise<Uint8Array> {
  if (keyBytes.length !== KEY_BYTES) throw new Error("invalid encryption key");
  if (encrypted.length <= MAGIC.length + IV_BYTES) {
    throw new Error("encrypted backup is truncated");
  }

  const magic = encrypted.subarray(0, MAGIC.length);
  if (!equalBytes(magic, MAGIC)) throw new Error("invalid backup format");

  const iv = encrypted.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const ciphertext = encrypted.subarray(MAGIC.length + IV_BYTES);
  const key = await importKey(keyBytes, "decrypt");

  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: toArrayBuffer(iv) },
        key,
        toArrayBuffer(ciphertext),
      ),
    );
  } catch {
    throw new Error("backup authentication failed");
  }
}

async function run(): Promise<void> {
  const [operation, inputPath, outputPath] = Deno.args;
  if (
    (operation !== "encrypt" && operation !== "decrypt") || !inputPath ||
    !outputPath
  ) {
    throw new Error("usage: crypto.ts <encrypt|decrypt> <input> <output>");
  }

  const encodedKey = Deno.env.get("BACKUP_ENCRYPTION_KEY");
  if (!encodedKey) throw new Error("BACKUP_ENCRYPTION_KEY is required");

  const key = decodeEncryptionKey(encodedKey);
  const input = await Deno.readFile(inputPath);
  const output = operation === "encrypt"
    ? await encryptBytes(input, key)
    : await decryptBytes(input, key);

  await Deno.writeFile(outputPath, output, {
    createNew: true,
    mode: 0o600,
  });
}

if (import.meta.main) {
  await run();
}
