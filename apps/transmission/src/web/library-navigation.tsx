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

import type {
  Web_LibraryNavigation_AlwaysVisibleFilters,
  Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape,
  Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape_Event,
  Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape_Returns,
  Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside,
  Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside_Event,
  Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside_Returns,
  Web_LibraryNavigation_LibraryNavigation_DefaultProfile,
  Web_LibraryNavigation_LibraryNavigation_Filters,
  Web_LibraryNavigation_LibraryNavigation_LabelsHeadingId,
  Web_LibraryNavigation_LibraryNavigation_LabelSummaries,
  Web_LibraryNavigation_LibraryNavigation_LibraryHeadingId,
  Web_LibraryNavigation_LibraryNavigation_MenuProfile,
  Web_LibraryNavigation_LibraryNavigation_MenuProfileId,
  Web_LibraryNavigation_LibraryNavigation_MenuProfileIdState,
  Web_LibraryNavigation_LibraryNavigation_OnCreateProfile,
  Web_LibraryNavigation_LibraryNavigation_OnDeleteProfile,
  Web_LibraryNavigation_LibraryNavigation_OnEditDefaultProfile,
  Web_LibraryNavigation_LibraryNavigation_OnEditProfile,
  Web_LibraryNavigation_LibraryNavigation_OnFiltersChange,
  Web_LibraryNavigation_LibraryNavigation_OnManage,
  Web_LibraryNavigation_LibraryNavigation_OnSheetClose,
  Web_LibraryNavigation_LibraryNavigation_Organization,
  Web_LibraryNavigation_LibraryNavigation_ProfileMenu,
  Web_LibraryNavigation_LibraryNavigation_Profiles,
  Web_LibraryNavigation_LibraryNavigation_ProfilesHeadingId,
  Web_LibraryNavigation_LibraryNavigation_Props,
  Web_LibraryNavigation_LibraryNavigation_Returns,
  Web_LibraryNavigation_LibraryNavigation_SelectLabel,
  Web_LibraryNavigation_LibraryNavigation_SelectLabel_Label,
  Web_LibraryNavigation_LibraryNavigation_SelectLabel_Returns,
  Web_LibraryNavigation_LibraryNavigation_SelectProfile,
  Web_LibraryNavigation_LibraryNavigation_SelectProfile_ProfileId,
  Web_LibraryNavigation_LibraryNavigation_SelectProfile_Returns,
  Web_LibraryNavigation_LibraryNavigation_SetMenuProfileId,
  Web_LibraryNavigation_LibraryNavigation_StatusHeadingId,
  Web_LibraryNavigation_LibraryNavigation_StatusItems,
  Web_LibraryNavigation_LibraryNavigation_Torrents,
} from '@/types/web/library-navigation.d.ts';

// Status entries that always show; the rest appear only when a torrent needs them.

/**
 * Library Navigation - Always Visible Filters.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
const alwaysVisibleFilters: Web_LibraryNavigation_AlwaysVisibleFilters = [
  'all',
  'active',
  'downloading',
  'seeding',
  'paused',
];

/**
 * Library Navigation - Library Navigation.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_LibraryNavigation_LibraryNavigation_Props} props - Props.
 *
 * @returns {Web_LibraryNavigation_LibraryNavigation_Returns}
 *
 * @since 2.0.0
 */
export const LibraryNavigation = (props: Web_LibraryNavigation_LibraryNavigation_Props): Web_LibraryNavigation_LibraryNavigation_Returns => {
  const defaultProfile: Web_LibraryNavigation_LibraryNavigation_DefaultProfile = props['defaultProfile'];
  const filters: Web_LibraryNavigation_LibraryNavigation_Filters = props['filters'];
  const onCreateProfile: Web_LibraryNavigation_LibraryNavigation_OnCreateProfile = props['onCreateProfile'];
  const onDeleteProfile: Web_LibraryNavigation_LibraryNavigation_OnDeleteProfile = props['onDeleteProfile'];
  const onEditDefaultProfile: Web_LibraryNavigation_LibraryNavigation_OnEditDefaultProfile = props['onEditDefaultProfile'];
  const onEditProfile: Web_LibraryNavigation_LibraryNavigation_OnEditProfile = props['onEditProfile'];
  const onFiltersChange: Web_LibraryNavigation_LibraryNavigation_OnFiltersChange = props['onFiltersChange'];
  const onManage: Web_LibraryNavigation_LibraryNavigation_OnManage = props['onManage'];
  const onSheetClose: Web_LibraryNavigation_LibraryNavigation_OnSheetClose = props['onSheetClose'];
  const organization: Web_LibraryNavigation_LibraryNavigation_Organization = props['organization'];
  const profiles: Web_LibraryNavigation_LibraryNavigation_Profiles = props['profiles'];
  const torrents: Web_LibraryNavigation_LibraryNavigation_Torrents = props['torrents'];
  const menuProfileIdState: Web_LibraryNavigation_LibraryNavigation_MenuProfileIdState = useState<Web_LibraryNavigation_LibraryNavigation_MenuProfileId>(null);
  const menuProfileId: Web_LibraryNavigation_LibraryNavigation_MenuProfileId = menuProfileIdState[0];
  const setMenuProfileId: Web_LibraryNavigation_LibraryNavigation_SetMenuProfileId = menuProfileIdState[1];
  const libraryHeadingId: Web_LibraryNavigation_LibraryNavigation_LibraryHeadingId = useId();
  const labelsHeadingId: Web_LibraryNavigation_LibraryNavigation_LabelsHeadingId = `${libraryHeadingId}-labels`;
  const profilesHeadingId: Web_LibraryNavigation_LibraryNavigation_ProfilesHeadingId = `${libraryHeadingId}-profiles`;
  const statusHeadingId: Web_LibraryNavigation_LibraryNavigation_StatusHeadingId = `${libraryHeadingId}-status`;

  useEffect(() => {
    if (menuProfileId === null) {
      return undefined;
    }

    /**
     * Library Navigation - Close Menu Outside.
     *
     * Closes the profile menu when a press lands anywhere but the menu or a menu button.
     * A press on another row's menu button opens that row's menu instead.
     *
     * @param {Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside_Event} event - Event.
     *
     * @returns {Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside_Returns}
     *
     * @since 2.0.0
     */
    const closeMenuOutside: Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside = (event: Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside_Event): Web_LibraryNavigation_LibraryNavigation_CloseMenuOutside_Returns => {
      if (event.target instanceof Element && event.target.closest('.profile-menu, .library-row-menu-button') !== null) {
        return;
      }

      setMenuProfileId(null);

      return;
    };

    /**
     * Library Navigation - Close Menu On Escape.
     *
     * Closes the profile menu when Escape is pressed.
     * The app's other menus close the same way.
     *
     * @param {Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape_Event} event - Event.
     *
     * @returns {Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape_Returns}
     *
     * @since 2.0.0
     */
    const closeMenuOnEscape: Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape = (event: Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape_Event): Web_LibraryNavigation_LibraryNavigation_CloseMenuOnEscape_Returns => {
      if (event.key === 'Escape') {
        setMenuProfileId(null);
      }

      return;
    };

    document.addEventListener('pointerdown', closeMenuOutside);
    document.addEventListener('keydown', closeMenuOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeMenuOutside);
      document.removeEventListener('keydown', closeMenuOnEscape);

      return;
    };
  }, [menuProfileId]);

  const labelSummaries: Web_LibraryNavigation_LibraryNavigation_LabelSummaries = useMemo(() => (
    buildTorrentLabelSummaries(torrents, (organization === null) ? [] : organization['labels'])
  ), [
    organization,
    torrents,
  ]);

  const statusItems: Web_LibraryNavigation_LibraryNavigation_StatusItems = torrentLibraryFilters.filter((filter) => {
    if (filter['id'] === 'needs-profile') {
      return torrents.some((torrent) => torrentMatchesFilter(torrent, filter['id']));
    }

    return (
      alwaysVisibleFilters.includes(filter['id'])
      || filter['id'] === filters['status']
      || torrents.some((torrent) => torrentMatchesFilter(torrent, filter['id']))
    );
  });

  /**
   * Library Navigation - Select Label.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_LibraryNavigation_LibraryNavigation_SelectLabel_Label} label - Label.
   *
   * @returns {Web_LibraryNavigation_LibraryNavigation_SelectLabel_Returns}
   *
   * @since 2.0.0
   */
  const selectLabel: Web_LibraryNavigation_LibraryNavigation_SelectLabel = (label: Web_LibraryNavigation_LibraryNavigation_SelectLabel_Label): Web_LibraryNavigation_LibraryNavigation_SelectLabel_Returns => {
    onFiltersChange({
      ...filters,
      label: (filters['label'] === label) ? '' : label,
    });

    if (onSheetClose !== undefined) {
      onSheetClose();
    }

    return;
  };

  /**
   * Library Navigation - Select Profile.
   *
   * Selecting the active row again clears the profile filter.
   * The Default profile sentinel follows the same toggle behavior.
   *
   * @param {Web_LibraryNavigation_LibraryNavigation_SelectProfile_ProfileId} profileId - Profile id.
   *
   * @returns {Web_LibraryNavigation_LibraryNavigation_SelectProfile_Returns}
   *
   * @since 2.0.0
   */
  const selectProfile: Web_LibraryNavigation_LibraryNavigation_SelectProfile = (profileId: Web_LibraryNavigation_LibraryNavigation_SelectProfile_ProfileId): Web_LibraryNavigation_LibraryNavigation_SelectProfile_Returns => {
    onFiltersChange({
      ...filters,
      profile: (filters['profile'] === profileId) ? '' : profileId,
    });

    if (onSheetClose !== undefined) {
      onSheetClose();
    }

    return;
  };

  const menuProfile: Web_LibraryNavigation_LibraryNavigation_MenuProfile = profiles.find(
    (profile) => profile['id'] === menuProfileId,
  );
  const profileMenu: Web_LibraryNavigation_LibraryNavigation_ProfileMenu = (
    <div className="menu profile-menu" role="menu">
      <button
        onClick={() => {
          setMenuProfileId(null);

          if (onSheetClose !== undefined) {
            onSheetClose();
          }

          if (menuProfileId === 'default') {
            onEditDefaultProfile();
          } else if (menuProfile !== undefined) {
            onEditProfile(menuProfile);
          }

          return;
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
            onClick={() => {
              setMenuProfileId(null);

              if (onSheetClose !== undefined) {
                onSheetClose();
              }

              onDeleteProfile(menuProfile);

              return;
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
          {statusItems.map((filter) => (
            <li key={filter['id']}>
              <button
                aria-current={(filters['status'] === filter['id']) ? 'true' : undefined}
                className="library-row"
                onClick={() => {
                  onFiltersChange({
                    ...filters,
                    status: filter['id'],
                  });

                  if (onSheetClose !== undefined) {
                    onSheetClose();
                  }

                  return;
                }}
                type="button"
              >
                <Icon name={filter['icon']} size={15} />
                <span className="library-row-label">{filter['label']}</span>
                <span className="library-count">
                  {torrents.filter((torrent) => torrentMatchesFilter(torrent, filter['id'])).length}
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
            onClick={() => {
              if (onSheetClose !== undefined) {
                onSheetClose();
              }

              onCreateProfile();

              return;
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
                onClick={() => selectProfile(defaultProfileFilterValue)}
                type="button"
              >
                <Icon name="settings" size={15} />
                <span className="library-row-label">{defaultProfile['name']}</span>
                <span className="library-count">{torrents.filter((torrent) => torrent['profileId'] === null).length}</span>
              </button>
              <button
                aria-expanded={menuProfileId === 'default'}
                aria-label={`${defaultProfile['name']} menu`}
                className="icon-button library-row-menu-button"
                onClick={() => setMenuProfileId((menuProfileId === 'default') ? null : 'default')}
                type="button"
              >
                <Icon name="more" size={15} />
              </button>
              {(menuProfileId === 'default') ? profileMenu : null}
            </div>
          </li>
          {profiles.map((profile) => (
            <li key={profile['id']}>
              <div className="library-row-wrap profile-row-wrap">
                <button
                  aria-current={(filters['profile'] === profile['id']) ? 'true' : undefined}
                  className="library-row"
                  onClick={() => selectProfile(profile['id'])}
                  type="button"
                >
                  <Icon name="settings" size={15} />
                  <span className="library-row-label">{profile['name']}</span>
                  <span className="library-count">{torrents.filter((torrent) => torrent['profileId'] === profile['id']).length}</span>
                </button>
                <button
                  aria-expanded={menuProfileId === profile['id']}
                  aria-label={`${profile['name']} menu`}
                  className="icon-button library-row-menu-button"
                  onClick={() => setMenuProfileId((menuProfileId === profile['id']) ? null : profile['id'])}
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
            onClick={() => {
              if (onSheetClose !== undefined) {
                onSheetClose();
              }

              onManage();

              return;
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
            {labelSummaries.map((labelSummary) => (
              <li key={labelSummary['label']}>
                <button
                  aria-current={(filters['label'] === labelSummary['label']) ? 'true' : undefined}
                  className="library-row"
                  onClick={() => selectLabel(labelSummary['label'])}
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
