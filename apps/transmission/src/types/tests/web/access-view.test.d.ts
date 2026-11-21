import type { ComponentType } from 'react';

import type { Web_Api_WebProxy } from '@/types/web/api.d.ts';
import type { Web_Components_AccessView_Props } from '@/types/web/components.d.ts';

/**
 * Access View.
 *
 * @since 2.4.1
 */
export type Tests_Web_AccessView_AccessViewModule_AccessView = ComponentType<Web_Components_AccessView_Props>;

export type Tests_Web_AccessView_AccessViewModule = {
  AccessView: Tests_Web_AccessView_AccessViewModule_AccessView;
};

/**
 * Access View.
 *
 * @since 2.4.1
 */
export type Tests_Web_AccessView_Markup = string;

/**
 * Access View.
 *
 * @since 2.4.1
 */
export type Tests_Web_AccessView_Props = Web_Components_AccessView_Props;

/**
 * Access View.
 *
 * @since 2.4.1
 */
export type Tests_Web_AccessView_Unavailable_Returns = Promise<never>;

export type Tests_Web_AccessView_Unavailable = () => Tests_Web_AccessView_Unavailable_Returns;

/**
 * Access View.
 *
 * @since 2.4.1
 */
export type Tests_Web_AccessView_WebProxy = Web_Api_WebProxy;
