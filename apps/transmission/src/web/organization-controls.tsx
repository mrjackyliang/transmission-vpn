import type { ReactElement } from 'react';

import type { Web_Components_LabelPicker_Props } from '@/types/web/components.d.ts';

/**
 * Organization Controls - Parses label value.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const parseLabelValue = (value: string): string[] => value
  .split(',')
  .map((label: string): string => label.trim())
  .filter((label: string): boolean => label !== '');

/**
 * Organization Controls - Label picker.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const LabelPicker = ({
  labels,
  onChange,
  title,
  value,
}: Web_Components_LabelPicker_Props): ReactElement => {
  const selectedLabels: string[] = parseLabelValue(value);

  /**
   * Organization Controls - Toggles label.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const toggleLabel = (label: string): void => {
    const normalizedLabel: string = label.toLowerCase();
    const selected: boolean = selectedLabels.some(
      (selectedLabel: string): boolean => selectedLabel.toLowerCase() === normalizedLabel,
    );
    const nextLabels: string[] = (selected) ? selectedLabels.filter(
      (selectedLabel: string): boolean => selectedLabel.toLowerCase() !== normalizedLabel,
    ) : [
      ...selectedLabels,
      label,
    ];
    onChange(nextLabels.join(', '));
  };

  return (
    <div className="field">
      <span>{title}</span>
      {(labels.length === 0) ? null : (
        <div className="label-preset-list" aria-label="Saved labels">
          {labels.map((label: string): ReactElement => {
            const selected: boolean = selectedLabels.some(
              (selectedLabel: string): boolean => selectedLabel.toLowerCase() === label.toLowerCase(),
            );

            return (
              <button
                aria-pressed={selected}
                className={(selected) ? 'label-preset label-preset-selected' : 'label-preset'}
                key={label}
                onClick={(): void => toggleLabel(label)}
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
        onChange={(event): void => onChange(event.currentTarget.value)}
        placeholder="e.g. linux, archive, priority"
        type="text"
        value={value}
      />
      <small>Pick saved labels or type your own, separated by commas.</small>
    </div>
  );
};
