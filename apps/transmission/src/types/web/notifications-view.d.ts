import type {
  Dispatch,
  ReactElement,
  SetStateAction,
} from 'react';

import type {
  Web_Notifications_Event,
  Web_Notifications_Target,
  Web_Notifications_TestResult,
} from '@/types/web/notifications.d.ts';

/**
 * Notifications View.
 *
 * @since 2.4.1
 */
export type Web_NotificationsView_DescribeTarget_Target = Web_Notifications_Target;
export type Web_NotificationsView_DescribeTarget_Returns = string;
export type Web_NotificationsView_DescribeTarget_EventNoun = string;
export type Web_NotificationsView_DescribeTarget_EventCount = string;

/**
 * Notifications View.
 *
 * @since 2.4.1
 */
export type Web_NotificationsView_FailedSendText_Target = Web_Notifications_Target;
export type Web_NotificationsView_FailedSendText_Returns = string;

/**
 * Notifications View.
 *
 * @since 2.4.1
 */
export type Web_NotificationsView_FieldPhrase_Label = string;
export type Web_NotificationsView_FieldPhrase_Returns = string;
export type Web_NotificationsView_FieldPhrase_FirstWord = string;

/**
 * Notifications View.
 *
 * @since 2.4.1
 */
export type Web_NotificationsView_MissingSecretsText_Target = Web_Notifications_Target;
export type Web_NotificationsView_MissingSecretsText_Returns = string;
export type Web_NotificationsView_MissingSecretsText_Labels = string[];

/**
 * Notifications View.
 *
 * @since 2.4.1
 */
export type Web_NotificationsView_NotificationsView_Returns = ReactElement;
export type Web_NotificationsView_NotificationsView_Interpreter = string;
export type Web_NotificationsView_NotificationsView_OnChange = (() => void) | undefined;
export type Web_NotificationsView_NotificationsView_TargetsState = [Web_Notifications_Target[] | null, Dispatch<SetStateAction<Web_Notifications_Target[] | null>>];
export type Web_NotificationsView_NotificationsView_Targets = Web_Notifications_Target[] | null;
export type Web_NotificationsView_NotificationsView_SetTargets = Dispatch<SetStateAction<Web_Notifications_Target[] | null>>;
export type Web_NotificationsView_NotificationsView_EventsState = [Web_Notifications_Event[], Dispatch<SetStateAction<Web_Notifications_Event[]>>];
export type Web_NotificationsView_NotificationsView_Events = Web_Notifications_Event[];
export type Web_NotificationsView_NotificationsView_SetEvents = Dispatch<SetStateAction<Web_Notifications_Event[]>>;
export type Web_NotificationsView_NotificationsView_DialogOpenState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_NotificationsView_NotificationsView_DialogOpen = boolean;
export type Web_NotificationsView_NotificationsView_SetDialogOpen = Dispatch<SetStateAction<boolean>>;
export type Web_NotificationsView_NotificationsView_EditingTargetState = [Web_Notifications_Target | null, Dispatch<SetStateAction<Web_Notifications_Target | null>>];
export type Web_NotificationsView_NotificationsView_EditingTarget = Web_Notifications_Target | null;
export type Web_NotificationsView_NotificationsView_SetEditingTarget = Dispatch<SetStateAction<Web_Notifications_Target | null>>;
export type Web_NotificationsView_NotificationsView_RemovingState = [Web_Notifications_Target | null, Dispatch<SetStateAction<Web_Notifications_Target | null>>];
export type Web_NotificationsView_NotificationsView_Removing = Web_Notifications_Target | null;
export type Web_NotificationsView_NotificationsView_SetRemoving = Dispatch<SetStateAction<Web_Notifications_Target | null>>;
export type Web_NotificationsView_NotificationsView_RemoveErrorState = [string, Dispatch<SetStateAction<string>>];
export type Web_NotificationsView_NotificationsView_RemoveError = string;
export type Web_NotificationsView_NotificationsView_SetRemoveError = Dispatch<SetStateAction<string>>;
export type Web_NotificationsView_NotificationsView_TestingState = [string, Dispatch<SetStateAction<string>>];
export type Web_NotificationsView_NotificationsView_Testing = string;
export type Web_NotificationsView_NotificationsView_SetTesting = Dispatch<SetStateAction<string>>;
export type Web_NotificationsView_NotificationsView_BusyState = [boolean, Dispatch<SetStateAction<boolean>>];
export type Web_NotificationsView_NotificationsView_Busy = boolean;
export type Web_NotificationsView_NotificationsView_SetBusy = Dispatch<SetStateAction<boolean>>;
export type Web_NotificationsView_NotificationsView_ErrorState = [string, Dispatch<SetStateAction<string>>];
export type Web_NotificationsView_NotificationsView_Error = string;
export type Web_NotificationsView_NotificationsView_SetError = Dispatch<SetStateAction<string>>;
export type Web_NotificationsView_NotificationsView_Load_Returns = Promise<void>;
export type Web_NotificationsView_NotificationsView_Load_Results = [Web_Notifications_Target[], Web_Notifications_Event[]];
export type Web_NotificationsView_NotificationsView_Load_NextTargets = Web_Notifications_Target[];
export type Web_NotificationsView_NotificationsView_Load_NextEvents = Web_Notifications_Event[];
export type Web_NotificationsView_NotificationsView_Load = () => Web_NotificationsView_NotificationsView_Load_Returns;
export type Web_NotificationsView_NotificationsView_Reload_Returns = Promise<void>;
export type Web_NotificationsView_NotificationsView_Reload = () => Web_NotificationsView_NotificationsView_Reload_Returns;
export type Web_NotificationsView_NotificationsView_Remove_Target = Web_Notifications_Target;
export type Web_NotificationsView_NotificationsView_Remove_Returns = Promise<void>;
export type Web_NotificationsView_NotificationsView_Remove = (target: Web_NotificationsView_NotificationsView_Remove_Target) => Web_NotificationsView_NotificationsView_Remove_Returns;
export type Web_NotificationsView_NotificationsView_SendTest_Target = Web_Notifications_Target;
export type Web_NotificationsView_NotificationsView_SendTest_Returns = Promise<void>;
export type Web_NotificationsView_NotificationsView_SendTest_Result = Web_Notifications_TestResult;
export type Web_NotificationsView_NotificationsView_SendTest = (target: Web_NotificationsView_NotificationsView_SendTest_Target) => Web_NotificationsView_NotificationsView_SendTest_Returns;
export type Web_NotificationsView_NotificationsView_DestinationNoun = string;
export type Web_NotificationsView_NotificationsView_RemovingName = string;
