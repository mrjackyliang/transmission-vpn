import {
  base64PaddingPattern,
  dottedHostnamePattern,
} from '@/web/regex.js';

import type {
  Web_Passkeys_Base64UrlToBuffer_Base64,
  Web_Passkeys_Base64UrlToBuffer_Binary,
  Web_Passkeys_Base64UrlToBuffer_Buffer,
  Web_Passkeys_Base64UrlToBuffer_Bytes,
  Web_Passkeys_Base64UrlToBuffer_Padded,
  Web_Passkeys_Base64UrlToBuffer_Returns,
  Web_Passkeys_Base64UrlToBuffer_Value,
  Web_Passkeys_BufferToBase64Url_Binary,
  Web_Passkeys_BufferToBase64Url_Buffer,
  Web_Passkeys_BufferToBase64Url_Bytes,
  Web_Passkeys_BufferToBase64Url_Returns,
  Web_Passkeys_ConvertDescriptors_Descriptor,
  Web_Passkeys_ConvertDescriptors_Descriptors,
  Web_Passkeys_ConvertDescriptors_Entry,
  Web_Passkeys_ConvertDescriptors_Returns,
  Web_Passkeys_CreatePasskey_Credential,
  Web_Passkeys_CreatePasskey_Options,
  Web_Passkeys_CreatePasskey_OptionsValue,
  Web_Passkeys_CreatePasskey_PublicKey,
  Web_Passkeys_CreatePasskey_PublicKeyCredential,
  Web_Passkeys_CreatePasskey_Returns,
  Web_Passkeys_CreatePasskey_StaticCredential,
  Web_Passkeys_CreatePasskey_User,
  Web_Passkeys_CreatePasskey_UserEntity,
  Web_Passkeys_CreatePasskey_UserValue,
  Web_Passkeys_CredentialStatic_PublicKeyCredential,
  Web_Passkeys_CredentialStatic_Returns,
  Web_Passkeys_CredentialToJson_Assertion,
  Web_Passkeys_CredentialToJson_Attestation,
  Web_Passkeys_CredentialToJson_Base,
  Web_Passkeys_CredentialToJson_Credential,
  Web_Passkeys_CredentialToJson_Json,
  Web_Passkeys_CredentialToJson_PartialCredential,
  Web_Passkeys_CredentialToJson_Response,
  Web_Passkeys_CredentialToJson_Returns,
  Web_Passkeys_GetPasskey_AllowCredentials,
  Web_Passkeys_GetPasskey_Credential,
  Web_Passkeys_GetPasskey_Options,
  Web_Passkeys_GetPasskey_OptionsValue,
  Web_Passkeys_GetPasskey_PublicKey,
  Web_Passkeys_GetPasskey_PublicKeyCredential,
  Web_Passkeys_GetPasskey_Returns,
  Web_Passkeys_GetPasskey_StaticCredential,
  Web_Passkeys_PasskeysSupported_DottedHostname,
  Web_Passkeys_PasskeysSupported_Hostname,
  Web_Passkeys_PasskeysSupported_IsIPAddress,
  Web_Passkeys_PasskeysSupported_Returns,
} from '@/types/web/passkeys.d.ts';

/**
 * Passkeys - Base64 URL To Buffer.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_Passkeys_Base64UrlToBuffer_Value} value - Value.
 *
 * @returns {Web_Passkeys_Base64UrlToBuffer_Returns}
 *
 * @since 2.0.0
 */
const base64UrlToBuffer = (value: Web_Passkeys_Base64UrlToBuffer_Value): Web_Passkeys_Base64UrlToBuffer_Returns => {
  const base64: Web_Passkeys_Base64UrlToBuffer_Base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded: Web_Passkeys_Base64UrlToBuffer_Padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary: Web_Passkeys_Base64UrlToBuffer_Binary = atob(padded);
  const buffer: Web_Passkeys_Base64UrlToBuffer_Buffer = new ArrayBuffer(binary.length);
  const bytes: Web_Passkeys_Base64UrlToBuffer_Bytes = new Uint8Array(buffer);

  for (let index = 0; index < binary.length; index += 1) {
    Reflect.set(bytes, index, binary.charCodeAt(index));
  }

  return buffer;
};

/**
 * Passkeys - Buffer To Base64 URL.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_Passkeys_BufferToBase64Url_Buffer} buffer - Buffer.
 *
 * @returns {Web_Passkeys_BufferToBase64Url_Returns}
 *
 * @since 2.0.0
 */
const bufferToBase64Url = (buffer: Web_Passkeys_BufferToBase64Url_Buffer): Web_Passkeys_BufferToBase64Url_Returns => {
  const bytes: Web_Passkeys_BufferToBase64Url_Bytes = new Uint8Array(buffer);
  let binary: Web_Passkeys_BufferToBase64Url_Binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(new RegExp(base64PaddingPattern, 'u'), '');
};

/**
 * Passkeys - Credential Static.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @returns {Web_Passkeys_CredentialStatic_Returns}
 *
 * @since 2.0.0
 */
const credentialStatic = (): Web_Passkeys_CredentialStatic_Returns => {
  const publicKeyCredential: Web_Passkeys_CredentialStatic_PublicKeyCredential = window.PublicKeyCredential;

  return publicKeyCredential as Web_Passkeys_CredentialStatic_Returns;
};

// Converts descriptor ids in an allow/exclude list from base64url to bytes.

/**
 * Passkeys - Convert Descriptors.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_Passkeys_ConvertDescriptors_Descriptors} descriptors - Descriptors.
 *
 * @returns {Web_Passkeys_ConvertDescriptors_Returns}
 *
 * @since 2.0.0
 */
const convertDescriptors = (descriptors: Web_Passkeys_ConvertDescriptors_Descriptors): Web_Passkeys_ConvertDescriptors_Returns => {
  if (Array.isArray(descriptors) === false) {
    return undefined;
  }

  return descriptors.map((descriptor) => {
    const entry: Web_Passkeys_ConvertDescriptors_Entry = descriptor as Web_Passkeys_ConvertDescriptors_Entry;

    return {
      ...entry,
      id: base64UrlToBuffer(String(entry['id'])),
      type: 'public-key',
    } as Web_Passkeys_ConvertDescriptors_Descriptor;
  });
};

// Serializes a credential the way PublicKeyCredential.toJSON() does, for browsers
// that don't have it yet.

/**
 * Passkeys - Credential To JSON.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_Passkeys_CredentialToJson_Credential} credential - Credential.
 *
 * @returns {Web_Passkeys_CredentialToJson_Returns}
 *
 * @since 2.0.0
 */
const credentialToJson = (credential: Web_Passkeys_CredentialToJson_Credential): Web_Passkeys_CredentialToJson_Returns => {
  // Older browsers ship PublicKeyCredential without toJSON() even though the types declare it.
  if (typeof (credential as Web_Passkeys_CredentialToJson_PartialCredential).toJSON === 'function') {
    const json: Web_Passkeys_CredentialToJson_Json = credential.toJSON();

    return json as Web_Passkeys_CredentialToJson_Returns;
  }

  const response: Web_Passkeys_CredentialToJson_Response = credential.response;
  const base: Web_Passkeys_CredentialToJson_Base = {
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
  };

  if ('attestationObject' in response) {
    const attestation: Web_Passkeys_CredentialToJson_Attestation = response as Web_Passkeys_CredentialToJson_Attestation;

    return {
      ...base,
      response: {
        attestationObject: bufferToBase64Url(attestation.attestationObject),
        clientDataJSON: bufferToBase64Url(attestation.clientDataJSON),
        transports: (typeof attestation.getTransports === 'function') ? attestation.getTransports() : [],
      },
    };
  }

  const assertion: Web_Passkeys_CredentialToJson_Assertion = response as Web_Passkeys_CredentialToJson_Assertion;

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

/**
 * Passkeys - Supported.
 *
 * Browsers only offer passkeys in a secure context (https or localhost) and on a
 * domain name, never a bare IP address.
 *
 * @returns {Web_Passkeys_PasskeysSupported_Returns}
 *
 * @since 2.0.0
 */
export const passkeysSupported = (): Web_Passkeys_PasskeysSupported_Returns => {
  const hostname: Web_Passkeys_PasskeysSupported_Hostname = window.location.hostname;
  const dottedHostname: Web_Passkeys_PasskeysSupported_DottedHostname = new RegExp(dottedHostnamePattern, 'u').test(hostname);
  const isIPAddress: Web_Passkeys_PasskeysSupported_IsIPAddress = (
    dottedHostname === true
    || hostname.includes(':')
    || hostname.startsWith('[')
  );

  return (
    window.isSecureContext === true
    && typeof window.PublicKeyCredential === 'function'
    && isIPAddress === false
  );
};

/**
 * Passkeys - Create Passkey.
 *
 * Runs the browser's passkey creation for server options and returns the credential
 * as JSON for the API.
 *
 * @param {Web_Passkeys_CreatePasskey_Options} options - Options.
 *
 * @returns {Web_Passkeys_CreatePasskey_Returns}
 *
 * @since 2.0.0
 */
export const createPasskey = async (options: Web_Passkeys_CreatePasskey_Options): Web_Passkeys_CreatePasskey_Returns => {
  const staticCredential: Web_Passkeys_CreatePasskey_StaticCredential = credentialStatic();
  const user: Web_Passkeys_CreatePasskey_User = options['user'] as Web_Passkeys_CreatePasskey_User;
  const optionsValue: Web_Passkeys_CreatePasskey_OptionsValue = options;
  const userValue: Web_Passkeys_CreatePasskey_UserValue = user;
  const publicKey: Web_Passkeys_CreatePasskey_PublicKey = (typeof staticCredential['parseCreationOptionsFromJSON'] === 'function') ? staticCredential.parseCreationOptionsFromJSON(options) : {
    ...(optionsValue as Web_Passkeys_CreatePasskey_PublicKey),
    challenge: base64UrlToBuffer(String(options['challenge'])),
    excludeCredentials: convertDescriptors(options['excludeCredentials']) ?? [],
    user: {
      ...(userValue as Web_Passkeys_CreatePasskey_UserEntity),
      id: base64UrlToBuffer(String(user['id'])),
    },
  };

  const credential: Web_Passkeys_CreatePasskey_Credential = await navigator.credentials.create({ publicKey });

  if (credential === null) {
    throw new Error('No passkey was created.');
  }

  return credentialToJson(credential as Web_Passkeys_CreatePasskey_PublicKeyCredential);
};

/**
 * Passkeys - Get Passkey.
 *
 * Runs the browser's passkey sign-in for server options and returns the assertion as
 * JSON for the API.
 *
 * @param {Web_Passkeys_GetPasskey_Options} options - Options.
 *
 * @returns {Web_Passkeys_GetPasskey_Returns}
 *
 * @since 2.0.0
 */
export const getPasskey = async (options: Web_Passkeys_GetPasskey_Options): Web_Passkeys_GetPasskey_Returns => {
  const staticCredential: Web_Passkeys_GetPasskey_StaticCredential = credentialStatic();
  const allowCredentials: Web_Passkeys_GetPasskey_AllowCredentials = convertDescriptors(options['allowCredentials']);
  const optionsValue: Web_Passkeys_GetPasskey_OptionsValue = options;
  const publicKey: Web_Passkeys_GetPasskey_PublicKey = (typeof staticCredential['parseRequestOptionsFromJSON'] === 'function') ? staticCredential.parseRequestOptionsFromJSON(options) : {
    ...(optionsValue as Web_Passkeys_GetPasskey_PublicKey),
    challenge: base64UrlToBuffer(String(options['challenge'])),
    ...((allowCredentials === undefined) ? {} : { allowCredentials }),
  };

  const credential: Web_Passkeys_GetPasskey_Credential = await navigator.credentials.get({ publicKey });

  if (credential === null) {
    throw new Error('No passkey was chosen.');
  }

  return credentialToJson(credential as Web_Passkeys_GetPasskey_PublicKeyCredential);
};
