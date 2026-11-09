import type { Dispatch, ReactElement, SetStateAction } from 'react';

/**
 * Pages - Home.
 *
 * @since 0.0.0
 */
export type Pages_Index_Home_Returns = ReactElement;

/**
 * Pages - Home - Download Step.
 *
 * @since 0.0.0
 */
export type Pages_Index_Home_DownloadStep = number;

/**
 * Pages - Home - Download Step State.
 *
 * @since 0.0.0
 */
export type Pages_Index_Home_DownloadStepState = [Pages_Index_Home_DownloadStep, Pages_Index_Home_SetDownloadStep];

/**
 * Pages - Home - Set Download Step.
 *
 * @since 0.0.0
 */
export type Pages_Index_Home_SetDownloadStep = Dispatch<SetStateAction<Pages_Index_Home_DownloadStep>>;

/**
 * Pages - Home - Reduced Motion.
 *
 * @since 0.0.0
 */
export type Pages_Index_Home_ReducedMotion = boolean;

/**
 * Pages - Home - Timer.
 *
 * @since 0.0.0
 */
export type Pages_Index_Home_Timer = ReturnType<typeof setInterval>;

/**
 * Pages - Home - Download Restarting.
 *
 * @since 0.0.0
 */
export type Pages_Index_Home_DownloadRestarting = boolean;

/**
 * Pages - Home - Download Percent.
 *
 * @since 0.0.0
 */
export type Pages_Index_Home_DownloadPercent = number;

/**
 * Pages - Home - Download Complete.
 *
 * @since 0.0.0
 */
export type Pages_Index_Home_DownloadComplete = boolean;
