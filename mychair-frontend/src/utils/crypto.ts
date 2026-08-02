/**
 * Hashes a plaintext password on the client side using SHA-256 before transmission.
 * Ensures raw passwords are never sent in plaintext over the wire or logged in devtools.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
