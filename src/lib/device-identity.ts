// =====================================================
// Ed25519 Device Identity for OpenClaw Integration
// =====================================================
// Supports both raw nacl key pairs and PEM-format
// Ed25519 keys (as used by OpenClaw).
// =====================================================

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { generateId } from './utils';
import { createChildLogger } from './logger';
import type { DeviceIdentity } from '@/types';

const logger = createChildLogger('device-identity');
const IDENTITY_PATH = path.join(process.cwd(), '.data', 'device-identity.json');

// =====================================================
// Base64 URL Encoding (matching OpenClaw)
// =====================================================

function base64UrlEncode(buffer: Buffer | Uint8Array): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// =====================================================
// Node.js Crypto Signing (for OpenClaw compatibility)
// =====================================================

export function signWithNodeCrypto(privateKeyPem: string, message: string): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(message, 'utf8'), key);
  return base64UrlEncode(signature);
}

export function getPublicKeyFromPem(privateKeyPem: string): string {
  const publicKeyDer = crypto.createPublicKey(privateKeyPem).export({
    type: 'spki',
    format: 'der',
  });
  const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
  if (publicKeyDer.length === ED25519_SPKI_PREFIX.length + 32) {
    return base64UrlEncode(publicKeyDer.slice(ED25519_SPKI_PREFIX.length));
  }
  return base64UrlEncode(Buffer.from(publicKeyDer.slice(-32)));
}

// =====================================================
// PEM Key Parsing & Conversion
// =====================================================

/**
 * Ed25519 private key OID prefix in DER encoding.
 * PKCS#8 wrapping: SEQUENCE { INTEGER(0), SEQUENCE { OID(1.3.101.112) }, OCTET_STRING { OCTET_STRING { 32-byte seed } } }
 * The hex prefix for a 48-byte PKCS#8 Ed25519 private key is:
 * 302e020100300506032b657004220420 (16 bytes) followed by the 32-byte seed.
 */
const ED25519_PKCS8_PREFIX = Buffer.from(
  '302e020100300506032b657004220420',
  'hex'
);

/**
 * Check if a string looks like a PEM-encoded key
 */
export function isPEMFormat(key: string): boolean {
  const trimmed = key.trim();
  return (
    trimmed.startsWith('-----BEGIN') &&
    trimmed.includes('-----END')
  );
}

/**
 * Decode a PEM string to its raw DER bytes.
 * Strips the header/footer lines and decodes the base64 body.
 */
export function decodePEM(pem: string): Buffer {
  const lines = pem.trim().split('\n');
  // Remove header and footer lines (-----BEGIN ... / -----END ...)
  const base64Body = lines
    .filter((line) => !line.startsWith('-----'))
    .join('')
    .replace(/\s/g, '');
  return Buffer.from(base64Body, 'base64');
}

/**
 * Extract the 32-byte Ed25519 seed from a PEM private key.
 *
 * Supports:
 * - PKCS#8 format (-----BEGIN PRIVATE KEY-----) — 48 bytes DER
 * - Raw Ed25519 format (-----BEGIN OPENSSH PRIVATE KEY----- or similar)
 * - Handles both 32-byte (seed only) and 64-byte (seed + pubkey) raw keys
 *
 * The nacl library expects a 64-byte "secret key" which is seed(32) || publicKey(32).
 * We extract the 32-byte seed and use nacl.sign.keyPair.fromSeed() to derive the full key pair.
 */
export function extractEd25519SeedFromPEM(pem: string): Uint8Array {
  const der = decodePEM(pem);

  // Case 1: Standard PKCS#8 format (48 bytes)
  // Structure: 16-byte prefix + 32-byte seed
  if (der.length === 48) {
    const prefix = der.subarray(0, ED25519_PKCS8_PREFIX.length);
    if (prefix.equals(ED25519_PKCS8_PREFIX)) {
      const seed = der.subarray(ED25519_PKCS8_PREFIX.length);
      logger.info('Extracted Ed25519 seed from PKCS#8 PEM (48 bytes)');
      return new Uint8Array(seed);
    }
  }

  // Case 2: Longer PKCS#8 variants — search for the OID and extract seed after it
  // The Ed25519 OID is 06 03 2b 65 70 (5 bytes)
  const ed25519OID = Buffer.from('06032b6570', 'hex');
  const oidIndex = der.indexOf(ed25519OID);
  if (oidIndex !== -1) {
    // After the OID, there's an OCTET STRING wrapping:
    // ... OID ... 04 22 04 20 <32 bytes seed>
    // We search for the pattern 04 20 (OCTET STRING of length 32) after the OID
    const searchStart = oidIndex + ed25519OID.length;
    for (let i = searchStart; i < der.length - 33; i++) {
      if (der[i] === 0x04 && der[i + 1] === 0x20) {
        const seed = der.subarray(i + 2, i + 34);
        logger.info(
          { derLength: der.length, seedOffset: i + 2 },
          'Extracted Ed25519 seed from PKCS#8 PEM (OID search)'
        );
        return new Uint8Array(seed);
      }
    }
  }

  // Case 3: Raw 32-byte key (just the seed, minimally wrapped)
  if (der.length === 32) {
    logger.info('Using raw 32-byte key as Ed25519 seed');
    return new Uint8Array(der);
  }

  // Case 4: Raw 64-byte key (seed + public key)
  if (der.length === 64) {
    logger.info('Extracting seed from raw 64-byte key (first 32 bytes)');
    return new Uint8Array(der.subarray(0, 32));
  }

  // Case 5: Try to find a 32-byte seed in longer DER structures
  // Some formats have additional wrapping; try extracting the last 32 bytes
  // before any trailing public key data
  if (der.length > 34) {
    // Look for inner OCTET STRING containing exactly 32 bytes anywhere in the DER
    for (let i = 0; i < der.length - 33; i++) {
      if (der[i] === 0x04 && der[i + 1] === 0x20) {
        const candidate = der.subarray(i + 2, i + 34);
        // Verify this produces a valid key pair
        try {
          const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(candidate));
          if (keyPair.secretKey.length === 64) {
            logger.info(
              { derLength: der.length, seedOffset: i + 2 },
              'Extracted Ed25519 seed from DER (inner OCTET STRING search)'
            );
            return new Uint8Array(candidate);
          }
        } catch {
          // Continue searching
        }
      }
    }
  }

  throw new Error(
    `Unable to extract Ed25519 seed from PEM key. DER length: ${der.length} bytes. ` +
    `Expected PKCS#8 (48 bytes) or raw key (32/64 bytes). ` +
    `Ensure the key is an Ed25519 private key in PEM format.`
  );
}

/**
 * Convert a PEM-format Ed25519 private key to the nacl 64-byte secret key format.
 * Returns the full nacl key pair (secretKey: 64 bytes, publicKey: 32 bytes).
 */
export function pemToNaclKeyPair(pem: string): nacl.SignKeyPair {
  const seed = extractEd25519SeedFromPEM(pem);
  
  if (seed.length !== 32) {
    throw new Error(
      `Invalid Ed25519 seed length: ${seed.length} bytes (expected 32). ` +
      `The PEM key may not be a valid Ed25519 private key.`
    );
  }

  const keyPair = nacl.sign.keyPair.fromSeed(seed);
  logger.info('Successfully converted PEM key to nacl key pair');
  return keyPair;
}

/**
 * Convert a base64-encoded key to nacl format.
 * Handles both raw base64 (from nacl) and PEM format (from OpenClaw).
 */
export function resolvePrivateKey(keyString: string): Uint8Array {
  if (isPEMFormat(keyString)) {
    const keyPair = pemToNaclKeyPair(keyString);
    return keyPair.secretKey; // 64 bytes: seed || publicKey
  }

  // Base64-encoded nacl secret key (64 bytes) - handle URL-safe base64
  const decoded = decodeBase64Safe(keyString);
  if (decoded.length === 64) {
    return decoded;
  }

  // If it's a 32-byte seed in base64, derive the full key pair
  if (decoded.length === 32) {
    logger.info('Converting 32-byte seed to full 64-byte nacl secret key');
    const keyPair = nacl.sign.keyPair.fromSeed(decoded);
    return keyPair.secretKey;
  }

  throw new Error(
    `Invalid private key length: ${decoded.length} bytes. ` +
    `Expected 64-byte nacl secret key, 32-byte seed, or PEM format.`
  );
}

/**
 * Decode base64 (handles both standard and URL-safe).
 */
function decodeBase64Safe(input: string): Uint8Array {
  if (!input || typeof input !== 'string') {
    throw new Error(`decodeBase64Safe called with invalid input: ${JSON.stringify(input)}`);
  }
  let standard = input.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const pad = standard.length % 4;
  if (pad === 2) standard += '==';
  else if (pad === 3) standard += '=';
  const decoded = Buffer.from(standard, 'base64');
  return new Uint8Array(decoded);
}

/**
 * Resolve the public key from a private key string.
 * Useful when only a PEM private key is provided and we need the public key.
 */
export function resolvePublicKey(privateKeyString: string): Uint8Array {
  if (isPEMFormat(privateKeyString)) {
    const keyPair = pemToNaclKeyPair(privateKeyString);
    return keyPair.publicKey;
  }

  const decoded = decodeBase64Safe(privateKeyString);
  if (decoded.length === 64) {
    // nacl secret key: last 32 bytes are the public key
    return decoded.subarray(32);
  }
  if (decoded.length === 32) {
    const keyPair = nacl.sign.keyPair.fromSeed(decoded);
    return keyPair.publicKey;
  }

  throw new Error(
    `Cannot derive public key from private key of length ${decoded.length} bytes.`
  );
}

// =====================================================
// Environment Variable Key Loading
// =====================================================

/**
 * Load an Ed25519 private key from environment variable or PEM file.
 * Checks OPENCLAW_PRIVATE_KEY env var first, then OPENCLAW_PRIVATE_KEY_PATH for a file path.
 * Returns null if neither is configured.
 */
export function loadKeyFromEnvironment(): { publicKey: string; privateKey: string } | null {
  // Check for inline PEM key in environment variable
  const envKey = process.env.OPENCLAW_PRIVATE_KEY;
  if (envKey) {
    try {
      // Handle escaped newlines in env vars (common in Docker/CI)
      const normalizedKey = envKey.replace(/\\n/g, '\n');
      const secretKey = resolvePrivateKey(normalizedKey);
      const publicKey = secretKey.subarray(32); // Last 32 bytes of nacl secret key
      
      logger.info('Loaded Ed25519 key from OPENCLAW_PRIVATE_KEY environment variable');
      return {
        publicKey: naclUtil.encodeBase64(publicKey),
        privateKey: naclUtil.encodeBase64(secretKey),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to parse OPENCLAW_PRIVATE_KEY environment variable');
    }
  }

  // Check for PEM file path
  const keyFilePath = process.env.OPENCLAW_PRIVATE_KEY_PATH;
  if (keyFilePath) {
    try {
      const absolutePath = path.isAbsolute(keyFilePath)
        ? keyFilePath
        : path.join(process.cwd(), keyFilePath);
      
      if (fs.existsSync(absolutePath)) {
        const pemContent = fs.readFileSync(absolutePath, 'utf-8');
        const secretKey = resolvePrivateKey(pemContent);
        const publicKey = secretKey.subarray(32);

        logger.info({ path: absolutePath }, 'Loaded Ed25519 key from PEM file');
        return {
          publicKey: naclUtil.encodeBase64(publicKey),
          privateKey: naclUtil.encodeBase64(secretKey),
        };
      } else {
        logger.warn({ path: absolutePath }, 'OPENCLAW_PRIVATE_KEY_PATH file not found');
      }
    } catch (error) {
      logger.error({ error, path: keyFilePath }, 'Failed to load PEM key from file');
    }
  }

  return null;
}

// =====================================================
// Device ID Derivation
// =====================================================

/**
 * Derive the device ID from the raw public key using SHA-256.
 * OpenClaw requires: deviceId = SHA-256(rawPublicKey).hex
 * This must match the `deriveDeviceIdFromPublicKey()` function in OpenClaw.
 */
export function deriveDeviceIdFromPublicKey(publicKeyBase64: string): string {
  const publicKeyBytes = naclUtil.decodeBase64(publicKeyBase64);
  const hash = crypto.createHash('sha256').update(Buffer.from(publicKeyBytes)).digest('hex');
  return hash;
}

// =====================================================
// Core Identity Functions
// =====================================================

/**
 * Generate a new Ed25519 key pair for device identity
 */
export function generateDeviceIdentity(): DeviceIdentity {
  const publicKeyBase64 = naclUtil.encodeBase64(keyPair.publicKey);
  // OpenClaw requires deviceId = SHA-256(rawPublicKey).hex
  const deviceId = deriveDeviceIdFromPublicKey(publicKeyBase64);
  
  const identity: DeviceIdentity = {
    publicKey: publicKeyBase64,
    privateKey: naclUtil.encodeBase64(keyPair.secretKey),
    deviceId,
    createdAt: new Date(),
  };

  logger.info({ deviceId: identity.deviceId }, 'Generated new device identity');
  return identity;
}

/**
 * Save device identity to disk
 */
export function saveDeviceIdentity(identity: DeviceIdentity): void {
  const dir = path.dirname(IDENTITY_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(IDENTITY_PATH, JSON.stringify(identity, null, 2));
  logger.info({ path: IDENTITY_PATH }, 'Saved device identity');
}

/**
 * Load device identity from disk
 */
export function loadDeviceIdentity(): DeviceIdentity | null {
  if (!fs.existsSync(IDENTITY_PATH)) {
    return null;
  }

  try {
    const data = fs.readFileSync(IDENTITY_PATH, 'utf-8');
    const identity = JSON.parse(data) as DeviceIdentity;
    logger.info({ deviceId: identity.deviceId }, 'Loaded device identity');
    return identity;
  } catch (error) {
    logger.error({ error }, 'Failed to load device identity');
    return null;
  }
}

/**
 * Get or create device identity.
 * 
 * Priority order:
 * 1. Environment variable keys (OPENCLAW_PRIVATE_KEY or OPENCLAW_PRIVATE_KEY_PATH)
 *    — These always take precedence, enabling PEM key support for OpenClaw integration.
 * 2. Saved identity on disk (.data/device-identity.json)
 * 3. Generate a new identity
 */
export function getOrCreateDeviceIdentity(): DeviceIdentity {
  // Priority 1: Environment variable (supports PEM format from OpenClaw)
  const envKeys = loadKeyFromEnvironment();
  if (envKeys) {
    // Check if we have a saved identity with a matching public key
    const saved = loadDeviceIdentity();
    if (saved && saved.publicKey === envKeys.publicKey) {
      // Update the private key in case the format changed, and ensure deviceId is derived from public key
      saved.privateKey = envKeys.privateKey;
      saved.publicKey = envKeys.publicKey;
      saved.deviceId = deriveDeviceIdFromPublicKey(envKeys.publicKey);
      return saved;
    }

    // Create a new identity from the environment key
    // OpenClaw requires deviceId = SHA-256(rawPublicKey).hex
    const derivedDeviceId = deriveDeviceIdFromPublicKey(envKeys.publicKey);
    logger.info({ derivedDeviceId, envPublicKey: envKeys.publicKey }, 'Creating identity with derived deviceId');
    const identity: DeviceIdentity = {
      publicKey: envKeys.publicKey,
      privateKey: envKeys.privateKey,
      deviceId: derivedDeviceId,
      createdAt: new Date(),
    };
    saveDeviceIdentity(identity);
    logger.info({ deviceId: identity.deviceId }, 'Created device identity from environment key (PEM/raw)');
    return identity;
  }

  // Priority 2: Load from disk
  let identity = loadDeviceIdentity();
  if (identity) {
    // Ensure deviceId is derived correctly (migrate old UUID-based IDs)
    const correctDeviceId = deriveDeviceIdFromPublicKey(identity.publicKey);
    if (identity.deviceId !== correctDeviceId) {
      logger.info(
        { oldDeviceId: identity.deviceId, newDeviceId: correctDeviceId },
        'Migrating deviceId from UUID to SHA-256(publicKey).hex format'
      );
      identity.deviceId = correctDeviceId;
      saveDeviceIdentity(identity);
    }
    return identity;
  }

  // Priority 3: Generate new identity
  identity = generateDeviceIdentity();
  saveDeviceIdentity(identity);
  return identity;
}

/**
 * Convert a nacl Ed25519 secret key (64 bytes) to PKCS#8 PEM format.
 */
function naclKeyToPem(naclSecretKey: Uint8Array): string {
  const seed = naclSecretKey.slice(0, 32);
  const pkcs8Header = Buffer.from('302e020100300506032b657004220420', 'hex');
  const pkcs8Key = Buffer.concat([pkcs8Header, Buffer.from(seed)]);
  const base64Key = pkcs8Key.toString('base64');
  return '-----BEGIN PRIVATE KEY-----\n' + base64Key.match(/.{1,64}/g).join('\n') + '\n-----END PRIVATE KEY-----';
}

/**
 * Sign a message using the device's private key.
 * Always uses Node.js crypto for signing (matching OpenClaw's approach).
 */
export function signMessage(message: string, identity: DeviceIdentity): string {
  let pemKey: string;

  if (isPEMFormat(identity.privateKey)) {
    pemKey = identity.privateKey;
  } else {
    const naclKey = resolvePrivateKey(identity.privateKey);
    pemKey = naclKeyToPem(naclKey);
  }

  const privateKey = crypto.createPrivateKey(pemKey);
  const signature = crypto.sign(null, Buffer.from(message, 'utf8'), privateKey);
  return base64UrlEncode(signature);
}

/**
 * Verify a signed message
 */
export function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = naclUtil.decodeUTF8(message);
    const signatureBytes = decodeBase64Safe(signature);
    const publicKeyBytes = decodeBase64Safe(publicKey);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Create authentication payload for OpenClaw Gateway
 * (Legacy format – kept for backwards compatibility with older gateways)
 */
export function createAuthPayload(identity: DeviceIdentity): {
  deviceId: string;
  publicKey: string;
  timestamp: number;
  signature: string;
} {
  const timestamp = Date.now();
  const message = `${identity.deviceId}:${timestamp}`;
  const signature = signMessage(message, identity);

  return {
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    timestamp,
    signature,
  };
}

// =====================================================
// OpenClaw Protocol v3 Challenge-Response Helpers
// =====================================================

/**
 * Build the v3 signature payload from the challenge nonce and connection params.
 * Must match OpenClaw's expected format: v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily
 */
function buildV2SignaturePayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  nonce: string;
  token?: string;
  platform?: string;
  deviceFamily?: string;
}): string {
  const scopeStr = params.scopes.join(',');
  const token = params.token ?? '';
  const platform = params.platform ?? '';
  const deviceFamily = params.deviceFamily ?? '';
  return [
    'v3',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopeStr,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join('|');
}

/**
 * Sign an OpenClaw v3 `connect.challenge` nonce and produce the `device` block
 * required by the `connect` request.
 *
 * Uses the v2 signature payload format (pipe-delimited), which is the standard
 * format accepted by OpenClaw gateways. The v3 format adds platform/deviceFamily
 * but v2 is universally accepted.
 *
 * @param identity    Current device identity (keys + deviceId)
 * @param nonce       The nonce string received in the `connect.challenge` event
 * @param options     Connection parameters (clientId, clientMode, role, scopes, token)
 * @returns           The `device` object to embed in `connect` params
 */
export function signChallenge(
  identity: DeviceIdentity,
  nonce: string,
  options: {
    clientId: string;
    clientMode: string;
    role: string;
    scopes: string[];
    token?: string;
    platform?: string;
    deviceFamily?: string;
  },
): {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce: string;
} {
  const signedAt = Date.now();

  // Ensure deviceId is derived correctly from public key
  const deviceId = deriveDeviceIdFromPublicKey(identity.publicKey);
  if (deviceId !== identity.deviceId) {
    logger.warn(
      { storedDeviceId: identity.deviceId, derivedDeviceId: deviceId },
      'DeviceId mismatch: using derived SHA-256(publicKey).hex for signature'
    );
  }

  const payload = buildV2SignaturePayload({
    deviceId,
    clientId: options.clientId,
    clientMode: options.clientMode,
    role: options.role,
    scopes: options.scopes,
    signedAtMs: signedAt,
    nonce,
    token: options.token,
    platform: options.platform,
    deviceFamily: options.deviceFamily,
  });
  const signature = signMessage(payload, identity);

  return {
    id: deviceId,
    publicKey: identity.publicKey,
    signature,
    signedAt,
    nonce,
  };
}
