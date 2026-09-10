import { strict as assert } from "node:assert";
import { decodeEncryptionKey, decryptBytes, encryptBytes } from "./crypto.ts";

const KEY = new Uint8Array(32).fill(7);
const IV = new Uint8Array(12).fill(11);

Deno.test("AES-GCM backup envelope round trips without plaintext exposure", async () => {
  const plaintext = new TextEncoder().encode(
    "synthetic private backup content",
  );
  const encrypted = await encryptBytes(plaintext, KEY, IV);

  assert.notDeepEqual(encrypted, plaintext);
  assert.equal(
    new TextDecoder().decode(encrypted).includes(
      "synthetic private backup content",
    ),
    false,
  );
  assert.deepEqual(await decryptBytes(encrypted, KEY), plaintext);
});

Deno.test("tampering and the wrong key fail authentication", async () => {
  const encrypted = await encryptBytes(new Uint8Array([1, 2, 3]), KEY, IV);
  const tampered = encrypted.slice();
  tampered[tampered.length - 1] ^= 1;

  await assert.rejects(() => decryptBytes(tampered, KEY), {
    message: "backup authentication failed",
  });
  await assert.rejects(
    () => decryptBytes(encrypted, new Uint8Array(32).fill(8)),
    { message: "backup authentication failed" },
  );
});

Deno.test("key decoding requires exactly 32 base64 bytes", () => {
  assert.equal(decodeEncryptionKey(btoa("a".repeat(32))).length, 32);
  assert.throws(() => decodeEncryptionKey("not base64!"));
  assert.throws(() => decodeEncryptionKey(btoa("short")));
});
