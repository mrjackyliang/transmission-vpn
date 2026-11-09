import {
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';

import { Icon } from '@/web/primitives.tsx';
import {
  buildTorrentLabelSummaries,
  defaultProfileFilterValue,
  torrentLibraryFilters,
  torrentMatchesFilter,
} from '@/web/torrent-library.ts';

import type { ReactElement } from 'react';

import type {
  Web_Api_Torrent,
  Web_Api_TorrentProfile,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_LibraryNavigation_Props,
  Web_Components_TorrentFilter,
  Web_Components_TorrentFilterItem,
  Web_Components_TorrentLabelSummary,
} from '@/types/web/components.d.ts';

// Status entries that always show; the rest appear only when a torrent needs them.

/**
 * Library Navigation - Always visible filters.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const alwaysVisibleFilters: Web_Components_TorrentFilter[] = [
  'all',
  'active',
  'downloading',
  'seeding',
  'paused',
];

/**
 * Library Navigation.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const LibraryNavigation = ({
  defaultProfile,
  filters,
  onCreateProfile,
  onDeleteProfile,
  onEditDefaultProfile,
  onEditProfile,
  onFiltersChange,
  onManage,
  onSheetClose,
  organization,
  profiles,
  torrents,
}: Web_Components_LibraryNavigation_Props): ReactElement => {
  const [
    menuProfileId,
    setMenuProfileId,
  ] = useState<string | null>(null);
  const libraryHeadingId: string = useId();
  const labelsHeadingId: string = `${libraryHeadingId}-labels`;
  const profilesHeadingId: string = `${libraryHeadingId}-profiles`;
  const statusHeadingId: string = `${libraryHeadingId}-status`;
  useEffect((): (() => void) | undefined => {
    if (menuProfileId === null) {
      return undefined;
    }

    /**
     * Library Navigation - Close menu outside.
     *
     * Closes the profile menu when a press lands anywhere but the menu or a menu button.
     * A press on another row's menu button opens that row's menu instead.
     *
     * @param {PointerEvent} event - Event.
     *
     * @since UNRELEASED
     */
    const closeMenuOutside = (event: PointerEvent): void => {
      if (event.target instanceof Element && event.target.closest('.profile-menu, .library-row-menu-button') !== null) {
        return;
      }

      setMenuProfileId(null);
    };

    /**
     * Library Navigation - Close menu on escape.
     *
     * Closes the profile menu when Escape is pressed.
     * The app's other menus close the same way.
     *
     * @param {KeyboardEvent} event - Event.
     *
     * @since UNRELEASED
     */
    const closeMenuOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setMenuProfileId(null);
      }
    };

    document.addEventListener('pointerdown', closeMenuOutside);
    document.addEventListener('keydown', closeMenuOnEscape);

    return (): void => {
      document.removeEventListener('pointerdown', closeMenuOutside);
      document.removeEventListener('keydown', closeMenuOnEscape);
    };
  }, [menuProfileId]);

  const labelSummaries: Web_Components_TorrentLabelSummary[] = useMemo((): Web_Components_TorrentLabelSummary[] => (
    buildTorrentLabelSummaries(torrents, (organization === null) ? [] : organization['labels'])
  ), [
    organization,
    torrents,
  ]);

  const statusItems: Web_Components_TorrentFilterItem[] = torrentLibraryFilters.filter((filter: Web_Components_TorrentFilterItem): boolean => (
    (filter['id'] === 'needs-profile') ? torrents.some((torrent: Web_Api_Torrent): boolean => torrentMatchesFilter(torrent, filter['id'])) : alwaysVisibleFilters.includes(filter['id'])
      || filter['id'] === filters['status']
      || torrents.some((torrent: Web_Api_Torrent): boolean => torrentMatchesFilter(torrent, filter['id']))
  ));

  /**
   * Library Navigation - Select label.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const selectLabel = (label: string): void => {
    onFiltersChange({
      ...filters,
      label: (filters['label'] === label) ? '' : label,
    });
    onSheetClose?.();
  };

  /**
   * Library Navigation - Selects profile.
   *
   * Selecting the active row again clears the profile filter.
   * The Default profile sentinel follows the same toggle behavior.
   *
   * @since UNRELEASED
   */
  const selectProfile = (profileId: string): void => {
    onFiltersChange({
      ...filters,
      profile: (filters['profile'] === profileId) ? '' : profileId,
    });
    onSheetClose?.();
  };

  const menuProfile: Web_Api_TorrentProfile | undefined = profiles.find(
    (profile: Web_Api_TorrentProfile): boolean => profile['id'] === menuProfileId,
  );
  const profileMenu: ReactElement = (
    <div className="menu profile-menu" role="menu">
      <button
        onClick={(): void => {
          setMenuProfileId(null);
          onSheetClose?.();
          if (menuProfileId === 'default') {
            onEditDefaultProfile();
          } else if (menuProfile !== undefined) {
            onEditProfile(menuProfile);
          }
        }}
        role="menuitem"
        type="button"
      >
        <Icon name="edit" size={15} />
        Edit
      </button>
      {(menuProfileId === 'default' || menuProfile === undefined) ? null : (
        <>
          <hr />
          <button
            className="menu-danger"
            onClick={(): void => {
              setMenuProfileId(null);
              onSheetClose?.();
              onDeleteProfile(menuProfile);
            }}
            role="menuitem"
            type="button"
          >
            <Icon name="remove" size={15} />
            Delete
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="library">
      <section aria-labelledby={statusHeadingId} className="library-section">
        <h2 className="library-heading" id={statusHeadingId}>Status</h2>
        <ul>
          {statusItems.map((filter: Web_Components_TorrentFilterItem): ReactElement => (
            <li key={filter['id']}>
              <button
                aria-current={(filters['status'] === filter['id']) ? 'true' : undefined}
                className="library-row"
                onClick={(): void => {
                  onFiltersChange({
                    ...filters,
                    status: filter['id'],
                  });
                  onSheetClose?.();
                }}
                type="button"
              >
                <Icon name={filter['icon']} size={15} />
                <span className="library-row-label">{filter['label']}</span>
                <span className="library-count">
                  {torrents.filter((torrent: Web_Api_Torrent): boolean => torrentMatchesFilter(torrent, filter['id'])).length}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={profilesHeadingId} className="library-section">
        <div className="library-heading-row">
          <h2 className="library-heading" id={profilesHeadingId}>Profiles</h2>
          <button
            className="library-edit library-edit-profile"
            onClick={(): void => {
              onSheetClose?.();
              onCreateProfile();
            }}
            type="button"
          >
            <Icon name="add" size={12} />
            <span>New profile</span>
          </button>
        </div>
        <ul>
          <li>
            <div className="library-row-wrap profile-row-wrap profile-row-wrap-fixed">
              <button
                aria-current={(filters['profile'] === defaultProfileFilterValue) ? 'true' : undefined}
                className="library-row"
                onClick={(): void => selectProfile(defaultProfileFilterValue)}
                type="button"
              >
                <Icon name="settings" size={15} />
                <span className="library-row-label">{defaultProfile['name']}</span>
                <span className="library-count">{torrents.filter((torrent: Web_Api_Torrent): boolean => torrent['profileId'] === null).length}</span>
              </button>
              <button
                aria-expanded={menuProfileId === 'default'}
                aria-label={`${defaultProfile['name']} menu`}
                className="icon-button library-row-menu-button"
                onClick={(): void => setMenuProfileId((menuProfileId === 'default') ? null : 'default')}
                type="button"
              >
                <Icon name="more" size={15} />
              </button>
              {(menuProfileId === 'default') ? profileMenu : null}
            </div>
          </li>
          {profiles.map((profile: Web_Api_TorrentProfile): ReactElement => (
            <li key={profile['id']}>
              <div className="library-row-wrap profile-row-wrap">
                <button
                  aria-current={(filters['profile'] === profile['id']) ? 'true' : undefined}
                  className="library-row"
                  onClick={(): void => selectProfile(profile['id'])}
                  type="button"
                >
                  <Icon name="settings" size={15} />
                  <span className="library-row-label">{profile['name']}</span>
                  <span className="library-count">{torrents.filter((torrent: Web_Api_Torrent): boolean => torrent['profileId'] === profile['id']).length}</span>
                </button>
                <button
                  aria-expanded={menuProfileId === profile['id']}
                  aria-label={`${profile['name']} menu`}
                  className="icon-button library-row-menu-button"
                  onClick={(): void => setMenuProfileId((menuProfileId === profile['id']) ? null : profile['id'])}
                  type="button"
                >
                  <Icon name="more" size={15} />
                </button>
                {(menuProfileId === profile['id']) ? profileMenu : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby={labelsHeadingId} className="library-section">
        <div className="library-heading-row">
          <h2 className="library-heading" id={labelsHeadingId}>Labels</h2>
          <button
            aria-label="Edit labels"
            className="library-edit"
            disabled={organization === null}
            onClick={(): void => {
              onSheetClose?.();
              onManage();
            }}
            type="button"
          >
            Edit
          </button>
        </div>
        {(labelSummaries.length === 0) ? (
          <p className="library-empty">No labels yet</p>
        ) : (
          <ul>
            {labelSummaries.map((labelSummary: Web_Components_TorrentLabelSummary): ReactElement => (
              <li key={labelSummary['label']}>
                <button
                  aria-current={(filters['label'] === labelSummary['label']) ? 'true' : undefined}
                  className="library-row"
                  onClick={(): void => selectLabel(labelSummary['label'])}
                  type="button"
                >
                  <Icon name="label" size={15} />
                  <span className="library-row-label">{labelSummary['label']}</span>
                  <span className="library-count">{labelSummary['count']}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
