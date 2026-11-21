import type {
  Web_OrganizationControls_LabelPicker_Labels,
  Web_OrganizationControls_LabelPicker_OnChange,
  Web_OrganizationControls_LabelPicker_Props,
  Web_OrganizationControls_LabelPicker_Returns,
  Web_OrganizationControls_LabelPicker_Selected,
  Web_OrganizationControls_LabelPicker_SelectedLabels,
  Web_OrganizationControls_LabelPicker_Title,
  Web_OrganizationControls_LabelPicker_ToggleLabel,
  Web_OrganizationControls_LabelPicker_ToggleLabel_Label,
  Web_OrganizationControls_LabelPicker_ToggleLabel_NextLabels,
  Web_OrganizationControls_LabelPicker_ToggleLabel_NormalizedLabel,
  Web_OrganizationControls_LabelPicker_ToggleLabel_Returns,
  Web_OrganizationControls_LabelPicker_ToggleLabel_Selected,
  Web_OrganizationControls_LabelPicker_Value,
  Web_OrganizationControls_ParseLabelValue_Returns,
  Web_OrganizationControls_ParseLabelValue_Value,
} from '@/types/web/organization-controls.d.ts';

/**
 * Organization Controls - Parse Label Value.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_OrganizationControls_ParseLabelValue_Value} value - Value.
 *
 * @returns {Web_OrganizationControls_ParseLabelValue_Returns}
 *
 * @since 2.0.0
 */
const parseLabelValue = (value: Web_OrganizationControls_ParseLabelValue_Value): Web_OrganizationControls_ParseLabelValue_Returns => {
  return value
    .split(',')
    .map((label) => label.trim())
    .filter((label) => label !== '');
};

/**
 * Organization Controls - Label Picker.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_OrganizationControls_LabelPicker_Props} props - Props.
 *
 * @returns {Web_OrganizationControls_LabelPicker_Returns}
 *
 * @since 2.0.0
 */
export const LabelPicker = (props: Web_OrganizationControls_LabelPicker_Props): Web_OrganizationControls_LabelPicker_Returns => {
  const labels: Web_OrganizationControls_LabelPicker_Labels = props['labels'];
  const onChange: Web_OrganizationControls_LabelPicker_OnChange = props['onChange'];
  const title: Web_OrganizationControls_LabelPicker_Title = props['title'];
  const value: Web_OrganizationControls_LabelPicker_Value = props['value'];
  const selectedLabels: Web_OrganizationControls_LabelPicker_SelectedLabels = parseLabelValue(value);

  /**
   * Organization Controls - Toggle Label.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_OrganizationControls_LabelPicker_ToggleLabel_Label} label - Label.
   *
   * @returns {Web_OrganizationControls_LabelPicker_ToggleLabel_Returns}
   *
   * @since 2.0.0
   */
  const toggleLabel: Web_OrganizationControls_LabelPicker_ToggleLabel = (label: Web_OrganizationControls_LabelPicker_ToggleLabel_Label): Web_OrganizationControls_LabelPicker_ToggleLabel_Returns => {
    const normalizedLabel: Web_OrganizationControls_LabelPicker_ToggleLabel_NormalizedLabel = label.toLowerCase();
    const selected: Web_OrganizationControls_LabelPicker_ToggleLabel_Selected = selectedLabels.some(
      (selectedLabel) => selectedLabel.toLowerCase() === normalizedLabel,
    );
    const nextLabels: Web_OrganizationControls_LabelPicker_ToggleLabel_NextLabels = (selected === true) ? selectedLabels.filter(
      (selectedLabel) => selectedLabel.toLowerCase() !== normalizedLabel,
    ) : [
      ...selectedLabels,
      label,
    ];

    onChange(nextLabels.join(', '));

    return;
  };

  return (
    <div className="field">
      <span>{title}</span>
      {(labels.length === 0) ? null : (
        <div className="label-preset-list" aria-label="Saved labels">
          {labels.map((label) => {
            const selected: Web_OrganizationControls_LabelPicker_Selected = selectedLabels.some(
              (selectedLabel) => selectedLabel.toLowerCase() === label.toLowerCase(),
            );

            return (
              <button
                aria-pressed={selected}
                className={(selected === true) ? 'label-preset label-preset-selected' : 'label-preset'}
                key={label}
                onClick={() => toggleLabel(label)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      <input
        aria-label={title}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="e.g. linux, archive, priority"
        type="text"
        value={value}
      />
      <small>Pick saved labels or type your own, separated by commas.</small>
    </div>
  );
};
