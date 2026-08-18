function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function decodeReportKey(encoded: string): Uint8Array {
  let decoded: Uint8Array;

  try {
    decoded = Uint8Array.from(
      atob(encoded),
      (character) => character.charCodeAt(0),
    );
  } catch {
    throw new Error("MIGRATION_REPORT_KEY must be valid base64");
  }

  if (decoded.length !== 32) {
    throw new Error("MIGRATION_REPORT_KEY must decode to 32 bytes");
  }

  return decoded;
}

export async function keyedHash(
  keyBytes: Uint8Array,
  value: string,
): Promise<string> {
  const keyCopy = new Uint8Array(keyBytes.length);
  keyCopy.set(keyBytes);
  const key = await crypto.subtle.importKey(
    "raw",
    keyCopy.buffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );

  return toHex(new Uint8Array(signature));
}
