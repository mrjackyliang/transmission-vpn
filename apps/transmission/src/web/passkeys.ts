import type {
  Web_Passkeys_JsonObject,
  Web_Passkeys_PublicKeyCredentialStatic,
} from '@/types/web/passkeys.d.ts';

/**
 * Passkeys - Base64 URL to buffer.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const base64UrlToBuffer = (value: string): ArrayBuffer => {
  const base64: string = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded: string = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary: string = atob(padded);
  const buffer: ArrayBuffer = new ArrayBuffer(binary.length);
  const bytes: Uint8Array = new Uint8Array(buffer);

  for (let index: number = 0; index < binary.length; index += 1) {
    Reflect.set(bytes, index, binary.charCodeAt(index));
  }

  return buffer;
};

/**
 * Passkeys - Buffer to base64 URL.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const bufferToBase64Url = (buffer: ArrayBuffer): string => {
  const bytes: Uint8Array = new Uint8Array(buffer);
  let binary: string = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
};

/**
 * Passkeys - Credential static.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const credentialStatic = (): Web_Passkeys_PublicKeyCredentialStatic => (
  window.PublicKeyCredential as unknown as Web_Passkeys_PublicKeyCredentialStatic
);

// Converts descriptor ids in an allow/exclude list from base64url to bytes.

/**
 * Passkeys - Convert descriptors.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const convertDescriptors = (descriptors: unknown): PublicKeyCredentialDescriptor[] | undefined => {
  if (!Array.isArray(descriptors)) {
    return undefined;
  }

  return descriptors.map((descriptor): PublicKeyCredentialDescriptor => {
    const entry: Web_Passkeys_JsonObject = descriptor as Web_Passkeys_JsonObject;

    return {
      ...entry,
      id: base64UrlToBuffer(String(entry['id'])),
      type: 'public-key',
    } as PublicKeyCredentialDescriptor;
  });
};

/**
 * Passkeys - Supported.
 *
 * Browsers only offer passkeys in a secure context (https or localhost) and on a
 * domain name, never a bare IP address.
 *
 * @returns {boolean}
 *
 * @since 2.0.0
 */
export const passkeysSupported = (): boolean => {
  const hostname: string = window.location.hostname;
  const isIPAddress: boolean = /^[\d.]+$/u.test(hostname) || hostname.includes(':') || hostname.startsWith('[');

  return window.isSecureContext && typeof window.PublicKeyCredential === 'function' && !isIPAddress;
};

/**
 * Passkeys - Create Passkey.
 *
 * Runs the browser's passkey creation for server options and returns the credential
 * as JSON for the API.
 *
 * @param {Web_Passkeys_JsonObject} options - Options.
 *
 * @returns {Promise<Web_Passkeys_JsonObject>}
 *
 * @since 2.0.0
 */
export const createPasskey = async (options: Web_Passkeys_JsonObject): Promise<Web_Passkeys_JsonObject> => {
  const staticCredential: Web_Passkeys_PublicKeyCredentialStatic = credentialStatic();
  const user: Web_Passkeys_JsonObject = options['user'] as Web_Passkeys_JsonObject;
  const publicKey: PublicKeyCredentialCreationOptions = (typeof staticCredential['parseCreationOptionsFromJSON'] === 'function') ? staticCredential.parseCreationOptionsFromJSON(options) : {
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: base64UrlToBuffer(String(options['challenge'])),
    excludeCredentials: convertDescriptors(options['excludeCredentials']) ?? [],
    user: {
      ...(user as unknown as PublicKeyCredentialUserEntity),
      id: base64UrlToBuffer(String(user['id'])),
    },
  };

  const credential: Credential | null = await navigator.credentials.create({ publicKey });

  if (credential === null) {
    throw new Error('No passkey was created.');
  }

  return credentialToJson(credential as PublicKeyCredential);
};

/**
 * Passkeys - Get Passkey.
 *
 * Runs the browser's passkey sign-in for server options and returns the assertion as
 * JSON for the API.
 *
 * @param {Web_Passkeys_JsonObject} options - Options.
 *
 * @returns {Promise<Web_Passkeys_JsonObject>}
 *
 * @since 2.0.0
 */
export const getPasskey = async (options: Web_Passkeys_JsonObject): Promise<Web_Passkeys_JsonObject> => {
  const staticCredential: Web_Passkeys_PublicKeyCredentialStatic = credentialStatic();
  const allowCredentials: PublicKeyCredentialDescriptor[] | undefined = convertDescriptors(options['allowCredentials']);
  const publicKey: PublicKeyCredentialRequestOptions = (typeof staticCredential['parseRequestOptionsFromJSON'] === 'function') ? staticCredential.parseRequestOptionsFromJSON(options) : {
    ...(options as unknown as PublicKeyCredentialRequestOptions),
    challenge: base64UrlToBuffer(String(options['challenge'])),
    ...((allowCredentials === undefined) ? {} : { allowCredentials }),
  };

  const credential: Credential | null = await navigator.credentials.get({ publicKey });

  if (credential === null) {
    throw new Error('No passkey was chosen.');
  }

  return credentialToJson(credential as PublicKeyCredential);
};

// Serializes a credential the way PublicKeyCredential.toJSON() does, for browsers
// that don't have it yet.

/**
 * Passkeys - Credential to JSON.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const credentialToJson = (credential: PublicKeyCredential): Web_Passkeys_JsonObject => {
  // Older browsers ship PublicKeyCredential without toJSON() even though the types declare it.
  if (typeof (credential as Partial<PublicKeyCredential>).toJSON === 'function') {
    return credential.toJSON() as unknown as Web_Passkeys_JsonObject;
  }

  const response: AuthenticatorResponse = credential.response;
  const base: Web_Passkeys_JsonObject = {
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults() as unknown as Web_Passkeys_JsonObject,
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
  };

  if ('attestationObject' in response) {
    const attestation: AuthenticatorAttestationResponse = response as AuthenticatorAttestationResponse;

    return {
      ...base,
      response: {
        attestationObject: bufferToBase64Url(attestation.attestationObject),
        clientDataJSON: bufferToBase64Url(attestation.clientDataJSON),
        transports: (typeof attestation.getTransports === 'function') ? attestation.getTransports() : [],
      },
    };
  }

  const assertion: AuthenticatorAssertionResponse = response as AuthenticatorAssertionResponse;

  return {
    ...base,
    response: {
      authenticatorData: bufferToBase64Url(assertion.authenticatorData),
      clientDataJSON: bufferToBase64Url(assertion.clientDataJSON),
      signature: bufferToBase64Url(assertion.signature),
      ...((assertion.userHandle === null) ? {} : { userHandle: bufferToBase64Url(assertion.userHandle) }),
    },
  };
};
