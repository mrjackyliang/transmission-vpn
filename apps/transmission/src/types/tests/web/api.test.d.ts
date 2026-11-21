import type {
  Web_Api_BlocklistStatus,
  Web_Api_DeleteTorrentProfileResponse,
  Web_Api_DeleteVpnConnectionResponse,
  Web_Api_Directory,
  Web_Api_MovedTorrent,
  Web_Api_SetTorrentProfileResponse,
  Web_Api_TorrentDetail,
  Web_Api_TorrentOrganization,
  Web_Api_TorrentProfileInput,
  Web_Api_UpdateTorrentProfileResponse,
  Web_Api_VpnConnectionsResponse,
  Web_Api_VpnDefaultResponse,
  Web_Api_WebProxy,
} from '@/types/web/api.d.ts';

/**
 * API.
 *
 * @since 2.4.1
 */
export type Tests_Web_Api_Status = Web_Api_BlocklistStatus;
export type Tests_Web_Api_RequestMethod = string;
export type Tests_Web_Api_RequestPath = string;
export type Tests_Web_Api_FetchInput = RequestInfo | URL;
export type Tests_Web_Api_FetchOptions = RequestInit;
export type Tests_Web_Api_FetchResponse = Promise<Response>;
export type Tests_Web_Api_Hash = string;
export type Tests_Web_Api_ProfileId = string;
export type Tests_Web_Api_RequestBody = Record<string, unknown>;
export type Tests_Web_Api_ProfileDeletion_Result = Web_Api_DeleteTorrentProfileResponse;
export type Tests_Web_Api_ConnectionId = string;
export type Tests_Web_Api_DefaultConnection_Result = Web_Api_VpnDefaultResponse;
export type Tests_Web_Api_Directory = Web_Api_Directory;
export type Tests_Web_Api_Organization = Web_Api_TorrentOrganization;
export type Tests_Web_Api_VpnConnections_Response = Web_Api_VpnConnectionsResponse;
export type Tests_Web_Api_Request_Body = Record<string, unknown>;
export type Tests_Web_Api_Request_Method = string;
export type Tests_Web_Api_Request_Path = string;
export type Tests_Web_Api_Request = {
  body: Tests_Web_Api_Request_Body;
  method: Tests_Web_Api_Request_Method;
  path: Tests_Web_Api_Request_Path;
};
export type Tests_Web_Api_Requests = Tests_Web_Api_Request[];
export type Tests_Web_Api_Path = string;
export type Tests_Web_Api_Body = Record<string, unknown>;
export type Tests_Web_Api_ResponseBody = Record<string, unknown>;
export type Tests_Web_Api_Warning = string;
export type Tests_Web_Api_Moved = Web_Api_MovedTorrent[];
export type Tests_Web_Api_ProfileInput = Web_Api_TorrentProfileInput;
export type Tests_Web_Api_Removal = Web_Api_DeleteVpnConnectionResponse;
export type Tests_Web_Api_Profile = Web_Api_UpdateTorrentProfileResponse;
export type Tests_Web_Api_Assignment = Web_Api_SetTorrentProfileResponse;
export type Tests_Web_Api_RemovalMoved = Web_Api_MovedTorrent | undefined;
export type Tests_Web_Api_ProfileMoved = Web_Api_MovedTorrent | undefined;
export type Tests_Web_Api_AssignmentMoved = Web_Api_MovedTorrent | undefined;
export type Tests_Web_Api_WebProxy_Response = Web_Api_WebProxy;
export type Tests_Web_Api_Detail = Web_Api_TorrentDetail;
