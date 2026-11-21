import type { ReactElement } from 'react';

import type { Web_Components_LabelPicker_Props } from '@/types/web/components.d.ts';

/**
 * Organization Controls.
 *
 * @since 2.4.1
 */
export type Web_OrganizationControls_LabelPicker_Props = Web_Components_LabelPicker_Props;
export type Web_OrganizationControls_LabelPicker_Returns = ReactElement;
export type Web_OrganizationControls_LabelPicker_Labels = Web_Components_LabelPicker_Props['labels'];
export type Web_OrganizationControls_LabelPicker_OnChange = Web_Components_LabelPicker_Props['onChange'];
export type Web_OrganizationControls_LabelPicker_Title = Web_Components_LabelPicker_Props['title'];
export type Web_OrganizationControls_LabelPicker_Value = Web_Components_LabelPicker_Props['value'];
export type Web_OrganizationControls_LabelPicker_SelectedLabels = string[];
export type Web_OrganizationControls_LabelPicker_ToggleLabel_Label = string;
export type Web_OrganizationControls_LabelPicker_ToggleLabel_Returns = void;
export type Web_OrganizationControls_LabelPicker_ToggleLabel = (label: Web_OrganizationControls_LabelPicker_ToggleLabel_Label) => Web_OrganizationControls_LabelPicker_ToggleLabel_Returns;
export type Web_OrganizationControls_LabelPicker_ToggleLabel_NormalizedLabel = string;
export type Web_OrganizationControls_LabelPicker_ToggleLabel_Selected = boolean;
export type Web_OrganizationControls_LabelPicker_ToggleLabel_NextLabels = string[];
export type Web_OrganizationControls_LabelPicker_Selected = boolean;

/**
 * Organization Controls.
 *
 * @since 2.4.1
 */
export type Web_OrganizationControls_ParseLabelValue_Value = string;
export type Web_OrganizationControls_ParseLabelValue_Returns = string[];
