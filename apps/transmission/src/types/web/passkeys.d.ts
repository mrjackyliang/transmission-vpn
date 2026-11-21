/**
 * Passkeys.
 *
 * @since 2.0.0
 */
export type Web_Passkeys_JsonObject = Record<string, unknown>;

/**
 * Passkeys.
 *
 * @since 2.0.0
 */
export type Web_Passkeys_PublicKeyCredentialStatic = {
  parseCreationOptionsFromJSON?: (options: Web_Passkeys_JsonObject) => PublicKeyCredentialCreationOptions;
  parseRequestOptionsFromJSON?: (options: Web_Passkeys_JsonObject) => PublicKeyCredentialRequestOptions;
};

/**
 * Passkeys.
 *
 * @since 2.4.1
 */
export type Web_Passkeys_Base64UrlToBuffer_Value = string;
export type Web_Passkeys_Base64UrlToBuffer_Returns = ArrayBuffer;
export type Web_Passkeys_Base64UrlToBuffer_Base64 = string;
export type Web_Passkeys_Base64UrlToBuffer_Padded = string;
export type Web_Passkeys_Base64UrlToBuffer_Binary = string;
export type Web_Passkeys_Base64UrlToBuffer_Buffer = ArrayBuffer;
export type Web_Passkeys_Base64UrlToBuffer_Bytes = Uint8Array;

/**
 * Passkeys.
 *
 * @since 2.4.1
 */
export type Web_Passkeys_BufferToBase64Url_Buffer = ArrayBuffer;
export type Web_Passkeys_BufferToBase64Url_Returns = string;
export type Web_Passkeys_BufferToBase64Url_Bytes = Uint8Array;
export type Web_Passkeys_BufferToBase64Url_Binary = string;

/**
 * Passkeys.
 *
 * @since 2.4.1
 */
export type Web_Passkeys_ConvertDescriptors_Descriptors = unknown;
export type Web_Passkeys_ConvertDescriptors_Returns = PublicKeyCredentialDescriptor[] | undefined;
export type Web_Passkeys_ConvertDescriptors_Entry = Record<string, unknown>;
export type Web_Passkeys_ConvertDescriptors_Descriptor = PublicKeyCredentialDescriptor;

/**
 * Passkeys.
 *
 * @since 2.4.1
 */
export type Web_Passkeys_CreatePasskey_Options = Web_Passkeys_JsonObject;
export type Web_Passkeys_CreatePasskey_Returns = Promise<Web_Passkeys_JsonObject>;
export type Web_Passkeys_CreatePasskey_StaticCredential = Web_Passkeys_PublicKeyCredentialStatic;
export type Web_Passkeys_CreatePasskey_User = Web_Passkeys_JsonObject;
export type Web_Passkeys_CreatePasskey_OptionsValue = unknown;
export type Web_Passkeys_CreatePasskey_UserValue = unknown;
export type Web_Passkeys_CreatePasskey_PublicKey = PublicKeyCredentialCreationOptions;
export type Web_Passkeys_CreatePasskey_UserEntity = PublicKeyCredentialUserEntity;
export type Web_Passkeys_CreatePasskey_Credential = Credential | null;
export type Web_Passkeys_CreatePasskey_PublicKeyCredential = PublicKeyCredential;

/**
 * Passkeys.
 *
 * @since 2.4.1
 */
export type Web_Passkeys_CredentialStatic_Returns = Web_Passkeys_PublicKeyCredentialStatic;
export type Web_Passkeys_CredentialStatic_PublicKeyCredential = unknown;

/**
 * Passkeys.
 *
 * @since 2.4.1
 */
export type Web_Passkeys_CredentialToJson_Credential = PublicKeyCredential;
export type Web_Passkeys_CredentialToJson_Returns = Web_Passkeys_JsonObject;
export type Web_Passkeys_CredentialToJson_PartialCredential = Partial<PublicKeyCredential>;
export type Web_Passkeys_CredentialToJson_Json = unknown;
export type Web_Passkeys_CredentialToJson_Response = AuthenticatorResponse;
export type Web_Passkeys_CredentialToJson_Base = Web_Passkeys_JsonObject;
export type Web_Passkeys_CredentialToJson_Attestation = AuthenticatorAttestationResponse;
export type Web_Passkeys_CredentialToJson_Assertion = AuthenticatorAssertionResponse;

/**
 * Passkeys.
 *
 * @since 2.4.1
 */
export type Web_Passkeys_GetPasskey_Options = Web_Passkeys_JsonObject;
export type Web_Passkeys_GetPasskey_Returns = Promise<Web_Passkeys_JsonObject>;
export type Web_Passkeys_GetPasskey_StaticCredential = Web_Passkeys_PublicKeyCredentialStatic;
export type Web_Passkeys_GetPasskey_AllowCredentials = PublicKeyCredentialDescriptor[] | undefined;
export type Web_Passkeys_GetPasskey_OptionsValue = unknown;
export type Web_Passkeys_GetPasskey_PublicKey = PublicKeyCredentialRequestOptions;
export type Web_Passkeys_GetPasskey_Credential = Credential | null;
export type Web_Passkeys_GetPasskey_PublicKeyCredential = PublicKeyCredential;

/**
 * Passkeys.
 *
 * @since 2.4.1
 */
export type Web_Passkeys_PasskeysSupported_Returns = boolean;
export type Web_Passkeys_PasskeysSupported_Hostname = string;
export type Web_Passkeys_PasskeysSupported_DottedHostname = boolean;
export type Web_Passkeys_PasskeysSupported_IsIPAddress = boolean;
