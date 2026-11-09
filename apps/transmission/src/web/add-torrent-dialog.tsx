import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  connectionBeingRemovedMessage,
  getTransmissionFreeSpace,
  isVPNConnectionRequiredError,
  previewTorrentLinks,
} from '@/web/api.ts';
import { FieldLabel } from '@/web/field-label.tsx';
import { LabelPicker } from '@/web/organization-controls.tsx';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { showToast } from '@/web/toast.ts';
import { formatBytes } from '@/web/torrent-format.ts';
import { summarizeTorrentAddBatch } from '@/web/torrent-library.ts';
import {
  matchTorrentProfiles,
  torrentNameFromFile,
  torrentNameFromLink,
  torrentNameMatchesPattern,
} from '@/web/torrent-profile-matcher.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactElement,
} from 'react';

import type {
  Web_Api_AddTorrentInput,
  Web_Api_DefaultTorrentProfile,
  Web_Api_Torrent,
  Web_Api_TorrentAddResult,
  Web_Api_TorrentLinkPreview,
  Web_Api_TorrentLinkPreviewResponse,
  Web_Api_TorrentProfile,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_AddTorrentDialog_Props,
  Web_Components_AddTorrentResult,
  Web_Components_AddTorrentSource,
} from '@/types/web/components.d.ts';

/**
 * Add Torrent Dialog - Maximum torrent file bytes.
 *
 * Matches the browser-side metainfo ceiling used by form validation.
 * Files outside this range are rejected before conversion to base64.
 *
 * @since 2.0.0
 */
const maximumTorrentFileBytes: number = 700 * 1024;

/**
 * Add Torrent Dialog - Maximum preview batch size.
 *
 * Matches the server route's per-request limit while allowing larger pasted lists
 * to be split into independently bounded requests.
 *
 * @since UNRELEASED
 */
const maximumTorrentPreviewLinks: number = 20;

/**
 * Add Torrent Dialog - Link preview debounce.
 *
 * Avoids starting protected downloads for every keystroke while keeping pasted
 * links responsive.
 *
 * @since UNRELEASED
 */
const torrentPreviewDebounceMilliseconds: number = 300;

/**
 * Add Torrent Dialog - Default profile selection value.
 *
 * Keeps the explicit Default choice distinct from an unresolved empty selection.
 * The sentinel never leaves the browser request builder.
 *
 * @since UNRELEASED
 */
const defaultProfileSelectionValue: string = '__default__';

/**
 * Add Torrent Dialog - Automatic profile selection.
 *
 * Selects one match, Default for no matches, and nothing for an ambiguous match.
 * An explicit row override always takes precedence over this value.
 *
 * @since UNRELEASED
 */
const automaticProfileSelectionValue = (source: Web_Components_AddTorrentSource): string => {
  if (source['matchedProfileIds'].length === 1) {
    return source['matchedProfileIds'][0] ?? '';
  }
  if (source['matchedProfileIds'].length === 0) {
    return defaultProfileSelectionValue;
  }

  return '';
};

/**
 * Add Torrent Dialog - File as base64.
 *
 * Reads metainfo in the encoding expected by the torrent add route.
 * The data URL prefix is removed before the request is built.
 *
 * @since 2.0.0
 */
const fileAsBase64 = async (file: File): Promise<string> => new Promise<string>((resolve, reject): void => {
  const reader: FileReader = new FileReader();
  reader.onerror = (): void => reject(new Error('The torrent file could not be read.'));
  reader.onload = (): void => {
    const result: string = (typeof reader.result === 'string') ? reader.result : '';
    const commaIndex: number = result.indexOf(',');
    resolve((commaIndex >= 0) ? result.slice(commaIndex + 1) : result);
  };
  reader.readAsDataURL(file);
});

/**
 * Add Torrent Dialog - Duplicate notice.
 *
 * Names the existing torrent and its durable profile and VPN owners without
 * treating Transmission's duplicate result as a failed add.
 *
 * @since UNRELEASED
 */
const duplicateNotice = (result: Web_Api_TorrentAddResult): string => (
  `Already added: ${result['name']}, in ${result['profileName']} on ${result['connectionName']}.`
);

/**
 * Add Torrent Dialog - Checks torrent file.
 *
 * Accepts the standard extension or browser-provided BitTorrent MIME type.
 * Size validation remains separate so the error can explain the exact limit.
 *
 * @since 2.0.0
 */
const isTorrentFile = (file: File): boolean => (
  file.name.toLowerCase().endsWith('.torrent')
  || file.type === 'application/x-bittorrent'
);

/**
 * Add Torrent Dialog - Parses labels.
 *
 * Converts the editable comma-separated field into an API label list.
 * Empty segments are ignored in the same way as the organization controls.
 *
 * @since UNRELEASED
 */
const parseLabels = (value: string): string[] => value
  .split(',')
  .map((label: string): string => label.trim())
  .filter((label: string): boolean => label !== '');

/**
 * Add Torrent Dialog - Profile option rows.
 *
 * Lists the server-applied options that are not individually editable here, one per line
 * with the profile editor's labels. Folder, labels, and paused state stay explicit fields.
 *
 * @since UNRELEASED
 */
const profileOptionRows = (profile: Web_Api_DefaultTorrentProfile | Web_Api_TorrentProfile): [string, string][] => {
  const options = profile['options'];
  const limits: string[] = [];

  if (options['seeding']['ratio'] !== null) {
    limits.push(`at ratio ${options['seeding']['ratio']}`);
  }

  if (options['seeding']['idleMinutes'] !== null) {
    limits.push(`after ${options['seeding']['idleMinutes']} idle minutes`);
  }

  const priorityLabels: Record<-1 | 0 | 1, string> = {
    '-1': 'Low',
    '0': 'Normal',
    '1': 'High',
  };

  return [
    [
      'Seeding',
      (options['seeding']['mode'] === 'never' || limits.length === 0) ? 'Never stop' : `Stop ${limits.join(' or ')}`,
    ],
    [
      'Download limit',
      (options['downloadLimitKBps'] === null) ? 'Unlimited' : `${options['downloadLimitKBps'].toLocaleString()} KB/s`,
    ],
    [
      'Upload limit',
      (options['uploadLimitKBps'] === null) ? 'Unlimited' : `${options['uploadLimitKBps'].toLocaleString()} KB/s`,
    ],
    [
      'Priority',
      priorityLabels[options['bandwidthPriority']],
    ],
    [
      'Peer limit',
      String(options['peerLimit']),
    ],
    [
      'Queue position',
      (options['queue'] === 'top') ? 'Top' : 'Normal',
    ],
  ];
};

/**
 * Add Torrent Dialog.
 *
 * Adds one source with editable profile defaults or processes many in order.
 * Ambiguous automatic matches wait for an explicit profile choice.
 *
 * @since 2.0.0
 */
export const AddTorrentDialog = ({
  connections,
  defaultProfile,
  labelPresets,
  open,
  onAdd,
  onClose,
  onOpenVPN,
  profiles,
  torrents,
}: Web_Components_AddTorrentDialog_Props): ReactElement | null => {
  const [
    sourceMode,
    setSourceMode,
  ] = useState<'link' | 'file'>('link');
  const [
    linkText,
    setLinkText,
  ] = useState<string>('');
  const [
    files,
    setFiles,
  ] = useState<File[]>([]);
  const [
    profileOverrides,
    setProfileOverrides,
  ] = useState<Record<string, string>>({});
  const [
    labels,
    setLabels,
  ] = useState<string>('');
  const [
    paused,
    setPaused,
  ] = useState<boolean>(false);
  const [
    dragActive,
    setDragActive,
  ] = useState<boolean>(false);
  const [
    results,
    setResults,
  ] = useState<Record<string, Web_Components_AddTorrentResult>>({});
  const [
    error,
    setError,
  ] = useState<string>('');
  const [
    requiresVPNConnection,
    setRequiresVPNConnection,
  ] = useState<boolean>(false);
  const [
    submitting,
    setSubmitting,
  ] = useState<boolean>(false);
  const [
    freeSpace,
    setFreeSpace,
  ] = useState<number | null>(null);
  const [
    linkPreviews,
    setLinkPreviews,
  ] = useState<Record<number, Web_Api_TorrentLinkPreview>>({});
  const [
    previewingLinks,
    setPreviewingLinks,
  ] = useState<boolean>(false);
  const singleDefaultsKeyRef = useRef<string>('');

  const links: string[] = useMemo((): string[] => (
    linkText.split(/\r?\n/u)
      .map((link: string): string => link.trim())
      .filter((link: string): boolean => link !== '')
  ), [linkText]);

  const linkSources: Web_Components_AddTorrentSource[] = useMemo((): Web_Components_AddTorrentSource[] => (
    links.map((link: string, index: number): Web_Components_AddTorrentSource => {
      const preview: Web_Api_TorrentLinkPreview | undefined = linkPreviews[index];
      const name: string = torrentNameFromLink(link, preview?.['name']);
      const matchedProfiles: Web_Api_TorrentProfile[] = matchTorrentProfiles(name, profiles);
      const hash: string | null = preview?.['hash'].toLowerCase() ?? null;

      return {
        alreadyAdded: hash !== null && torrents.some(
          (torrent: Web_Api_Torrent): boolean => torrent['hashString'].toLowerCase() === hash,
        ),
        checking: previewingLinks && preview === undefined,
        displayName: name,
        hash,
        key: `link-${index}-${link}`,
        kind: 'link',
        link,
        matchedProfileIds: matchedProfiles.map((profile: Web_Api_TorrentProfile): string => profile['id']),
        name,
        size: preview?.['totalSize'] ?? null,
      };
    })
  ), [
    linkPreviews,
    links,
    previewingLinks,
    profiles,
    torrents,
  ]);

  const fileSources: Web_Components_AddTorrentSource[] = useMemo((): Web_Components_AddTorrentSource[] => (
    files.map((file: File, index: number): Web_Components_AddTorrentSource => {
      const name: string = torrentNameFromFile(file.name);
      const matchedProfiles: Web_Api_TorrentProfile[] = matchTorrentProfiles(name, profiles);

      return {
        alreadyAdded: false,
        checking: false,
        displayName: file.name,
        file,
        hash: null,
        key: `file-${index}-${file.name}-${file.lastModified}`,
        kind: 'file',
        matchedProfileIds: matchedProfiles.map((profile: Web_Api_TorrentProfile): string => profile['id']),
        name,
        size: file.size,
      };
    })
  ), [
    files,
    profiles,
  ]);

  const sources: Web_Components_AddTorrentSource[] = (sourceMode === 'link') ? linkSources : fileSources;
  const hasUnresolvedProfileChoice: boolean = sources.some(
    (source: Web_Components_AddTorrentSource): boolean => (
      source['matchedProfileIds'].length > 1
      && profileOverrides[source['key']] === undefined
    ),
  );
  const singleSource: Web_Components_AddTorrentSource | undefined = (sources.length === 1) ? sources[0] : undefined;
  const selectedSingleProfileId: string = (singleSource === undefined) ? defaultProfileSelectionValue : profileOverrides[singleSource['key']]
    ?? automaticProfileSelectionValue(singleSource);
  const selectedSingleProfile: Web_Api_TorrentProfile | undefined = profiles.find(
    (profile: Web_Api_TorrentProfile): boolean => profile['id'] === selectedSingleProfileId,
  );
  const selectedSingleProfileData: Web_Api_DefaultTorrentProfile | Web_Api_TorrentProfile = selectedSingleProfile ?? defaultProfile;
  const selectedDownloadDirectory: string = selectedSingleProfileData['downloadDirectory'];

  useEffect((): void => {
    if (!open) {
      setSourceMode('link');
      setLinkText('');
      setFiles([]);
      setProfileOverrides({});
      setLabels('');
      setPaused(false);
      setDragActive(false);
      setResults({});
      setError('');
      setRequiresVPNConnection(false);
      setSubmitting(false);
      setFreeSpace(null);
      setLinkPreviews({});
      setPreviewingLinks(false);
      singleDefaultsKeyRef.current = '';
    }
  }, [open]);

  useEffect((): (() => void) | undefined => {
    if (!open || sourceMode !== 'link' || links.length === 0) {
      setLinkPreviews({});
      setPreviewingLinks(false);

      return undefined;
    }

    let cancelled: boolean = false;
    setLinkPreviews({});
    setPreviewingLinks(true);
    const timeout: number = window.setTimeout((): void => {
      const batches: string[][] = [];
      for (let index: number = 0; index < links.length; index += maximumTorrentPreviewLinks) {
        batches.push(links.slice(index, index + maximumTorrentPreviewLinks));
      }

      void Promise.all(batches.map(async (
        batch: string[],
        batchIndex: number,
      ): Promise<{
        batchIndex: number
        response: Web_Api_TorrentLinkPreviewResponse | null
      }> => {
        try {
          return {
            batchIndex,
            response: await previewTorrentLinks(batch),
          };
        } catch {
          return {
            batchIndex,
            response: null,
          };
        }
      })).then((responses: {
        batchIndex: number
        response: Web_Api_TorrentLinkPreviewResponse | null
      }[]): void => {
        if (cancelled) {
          return;
        }

        const previews: Record<number, Web_Api_TorrentLinkPreview> = {};
        for (const batchResponse of responses) {
          const batchIndex: number = batchResponse['batchIndex'];
          const response: Web_Api_TorrentLinkPreviewResponse | null = batchResponse['response'];
          if (response === null) {
            continue;
          }
          for (const preview of response['items']) {
            if (preview['index'] >= 0 && preview['index'] < (batches[batchIndex]?.length ?? 0)) {
              Reflect.set(
                previews,
                (batchIndex * maximumTorrentPreviewLinks) + preview['index'],
                preview,
              );
            }
          }
        }
        setLinkPreviews(previews);
        setPreviewingLinks(false);
      });
    }, torrentPreviewDebounceMilliseconds);

    return (): void => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    links,
    open,
    sourceMode,
  ]);

  useEffect((): void => {
    if (singleSource === undefined) {
      singleDefaultsKeyRef.current = '';

      return;
    }

    const defaultsKey: string = `${singleSource['key']}:${selectedSingleProfileId}`;
    if (singleDefaultsKeyRef.current === defaultsKey) {
      return;
    }
    singleDefaultsKeyRef.current = defaultsKey;
    setLabels(selectedSingleProfileData['labels'].join(', '));
    setPaused(selectedSingleProfileData['startPaused']);
  }, [
    selectedSingleProfileData,
    selectedSingleProfileId,
    singleSource,
  ]);

  useEffect((): (() => void) | undefined => {
    if (!open || singleSource === undefined) {
      setFreeSpace(null);

      return undefined;
    }

    let cancelled: boolean = false;
    setFreeSpace(null);
    void getTransmissionFreeSpace(selectedDownloadDirectory).then((availableBytes: number): void => {
      if (!cancelled) {
        setFreeSpace(availableBytes);
      }
    }).catch((): void => {
      if (!cancelled) {
        setFreeSpace(null);
      }
    });

    return (): void => {
      cancelled = true;
    };
  }, [
    open,
    selectedDownloadDirectory,
    singleSource,
  ]);

  useEscapeKey(onClose, open && !submitting);

  if (!open) {
    return null;
  }

  /**
   * Add Torrent Dialog - Accepts files.
   *
   * Adds every valid dropped or selected file while reporting rejected entries.
   * Repeated file selections append so a person can build one ordered batch.
   *
   * @since UNRELEASED
   */
  const acceptFiles = (nextFiles: File[]): void => {
    const validFiles: File[] = nextFiles.filter((file: File): boolean => (
      isTorrentFile(file)
      && file.size > 0
      && file.size <= maximumTorrentFileBytes
    ));
    setFiles((currentFiles: File[]): File[] => [
      ...currentFiles,
      ...validFiles,
    ]);
    setSourceMode('file');
    setResults({});
    setRequiresVPNConnection(false);
    setError((validFiles.length === nextFiles.length) ? '' : 'Some files were skipped. Choose non-empty .torrent files smaller than 700 KiB.');
  };

  /**
   * Add Torrent Dialog - Selects profile.
   *
   * Stores an explicit choice separately from an automatic match.
   * This also removes the Matched tag after a person changes the selection.
   *
   * @since UNRELEASED
   */
  const selectProfile = (sourceKey: string, profileId: string): void => {
    setProfileOverrides((currentOverrides: Record<string, string>): Record<string, string> => ({
      ...currentOverrides,
      [sourceKey]: profileId,
    }));
    setResults({});
    setRequiresVPNConnection(false);
  };

  /**
   * Add Torrent Dialog - Source connection name.
   *
   * Resolves the selected profile through the current default when needed.
   * Conflict messages name the same connection the backend tried to use.
   *
   * @param {Web_Components_AddTorrentSource} source - Source.
   *
   * @returns {string}
   *
   * @since UNRELEASED
   */
  const sourceConnectionName = (source: Web_Components_AddTorrentSource): string => {
    const profileId: string = profileOverrides[source['key']]
      ?? ((source['matchedProfileIds'].length === 1) ? source['matchedProfileIds'][0] ?? '' : defaultProfileSelectionValue);
    const profile: Web_Api_TorrentProfile | undefined = profiles.find(
      (candidate: Web_Api_TorrentProfile): boolean => candidate['id'] === profileId,
    );
    let connectionId: string | undefined = profile?.['connectionId'] ?? undefined;
    if (profile === undefined || profile['connectionId'] === null) {
      connectionId = connections.find((connection): boolean => connection['default'])?.['id'];
    }

    return connections.find((connection): boolean => connection['id'] === connectionId)?.['name'] ?? 'The selected connection';
  };

  /**
   * Add Torrent Dialog - Profile connection label.
   *
   * Names an explicit connection or the current default used by profiles whose
   * connection follows the container default.
   *
   * @since UNRELEASED
   */
  const profileConnectionLabel = (profile: Web_Api_DefaultTorrentProfile | Web_Api_TorrentProfile): string => {
    const defaultConnection = connections.find((connection): boolean => connection['default']);
    if (!('connectionId' in profile) || profile['connectionId'] === null) {
      return `Default (${defaultConnection?.['name'] ?? 'connection'})`;
    }

    return connections.find((connection): boolean => connection['id'] === profile['connectionId'])?.['name'] ?? 'Unavailable connection';
  };

  /**
   * Add Torrent Dialog - Builds input.
   *
   * Applies editable values for one source and profile defaults for a batch.
   * Source content is converted only when its request is ready to run.
   *
   * @since UNRELEASED
   */
  const buildInput = async (
    source: Web_Components_AddTorrentSource,
    multiple: boolean,
  ): Promise<Web_Api_AddTorrentInput> => {
    const profileId: string = profileOverrides[source['key']]
      ?? ((source['matchedProfileIds'].length === 1) ? source['matchedProfileIds'][0] ?? '' : defaultProfileSelectionValue);
    const profile: Web_Api_TorrentProfile | undefined = profiles.find(
      (candidate: Web_Api_TorrentProfile): boolean => candidate['id'] === profileId,
    );
    const profileData: Web_Api_DefaultTorrentProfile | Web_Api_TorrentProfile = profile ?? defaultProfile;
    const input: Web_Api_AddTorrentInput = {
      paused: (multiple) ? profileData['startPaused'] : paused,
    };
    const nextLabels: string[] = (multiple) ? profileData['labels'] : parseLabels(labels);
    if (profile !== undefined) {
      input['profileId'] = profile['id'];
    }
    input['labels'] = nextLabels;
    if (source['kind'] === 'link' && source['link'] !== undefined) {
      input['filename'] = source['link'];
    } else if (source['file'] !== undefined) {
      input['metainfo'] = await fileAsBase64(source['file']);
    }

    return input;
  };

  /**
   * Add Torrent Dialog - Adds batch source.
   *
   * Recurses after each settled request to preserve the visible source order.
   * Every source gets an independent success, duplicate, or failure result.
   *
   * @since UNRELEASED
   */
  const addBatchSource = async (index: number): Promise<void> => {
    const source: Web_Components_AddTorrentSource | undefined = sources[index];
    if (source === undefined) {
      return;
    }

    try {
      const input: Web_Api_AddTorrentInput = await buildInput(source, true);
      const result: Web_Api_TorrentAddResult = await onAdd(input);
      const profileId: string = profileOverrides[source['key']]
        ?? ((source['matchedProfileIds'].length === 1) ? source['matchedProfileIds'][0] ?? '' : defaultProfileSelectionValue);
      const profile: Web_Api_TorrentProfile | undefined = profiles.find(
        (candidate: Web_Api_TorrentProfile): boolean => candidate['id'] === profileId,
      );
      const addedDownloadDirectory: string = (profile ?? defaultProfile)['downloadDirectory'];
      setResults((currentResults: Record<string, Web_Components_AddTorrentResult>): Record<string, Web_Components_AddTorrentResult> => ({
        ...currentResults,
        [source['key']]: {
          detail: (result['duplicate']) ? duplicateNotice(result) : `Added to ${addedDownloadDirectory}`,
          status: (result['duplicate']) ? 'duplicate' : 'added',
        },
      }));
    } catch (caughtError) {
      const detail: string = connectionBeingRemovedMessage(
        caughtError,
        sourceConnectionName(source),
      ) ?? ((caughtError instanceof Error) ? caughtError.message : 'The torrent could not be added.');
      setResults((currentResults: Record<string, Web_Components_AddTorrentResult>): Record<string, Web_Components_AddTorrentResult> => ({
        ...currentResults,
        [source['key']]: {
          detail,
          requiresVPNConnection: isVPNConnectionRequiredError(caughtError),
          status: 'failed',
        },
      }));
    }

    await addBatchSource(index + 1);
  };

  /**
   * Add Torrent Dialog - Submits sources.
   *
   * Closes after one successful source and retains multi-source result rows.
   * This makes partial batch failures visible without losing their reasons.
   *
   * @since UNRELEASED
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');
    setRequiresVPNConnection(false);
    if (sources.length === 0) {
      setError((sourceMode === 'link') ? 'Enter at least one torrent URL or magnet link.' : 'Choose at least one .torrent file.');

      return;
    }
    if (hasUnresolvedProfileChoice) {
      setError('Pick a profile for every torrent that matches more than one profile.');

      return;
    }

    setSubmitting(true);
    setResults({});
    try {
      if (sources.length > 1) {
        await addBatchSource(0);

        return;
      }

      const source: Web_Components_AddTorrentSource | undefined = sources[0];
      if (source === undefined) {
        return;
      }
      const result: Web_Api_TorrentAddResult = await onAdd(await buildInput(source, false));
      if (result['duplicate']) {
        showToast(duplicateNotice(result), true);
      }
      onClose();
    } catch (caughtError) {
      const source: Web_Components_AddTorrentSource | undefined = sources[0];
      const connectionName: string = (source === undefined) ? 'The selected connection' : sourceConnectionName(source);

      setError(connectionBeingRemovedMessage(caughtError, connectionName) ?? (
        (caughtError instanceof Error) ? caughtError.message : 'The torrent could not be added.'
      ));
      setRequiresVPNConnection(isVPNConnectionRequiredError(caughtError));
    } finally {
      setSubmitting(false);
    }
  };

  const allProcessed: boolean = sources.length > 1
    && sources.every((source: Web_Components_AddTorrentSource): boolean => results[source['key']] !== undefined);
  const batchSummary = summarizeTorrentAddBatch(sources.flatMap(
    (source: Web_Components_AddTorrentSource): Web_Components_AddTorrentResult['status'][] => {
      const result: Web_Components_AddTorrentResult | undefined = results[source['key']];

      return (result === undefined) ? [] : [result['status']];
    },
  ));
  let dialogTitle: string = 'Add torrent';
  if (allProcessed) {
    dialogTitle = batchSummary['title'];
  } else if (sources.length > 1) {
    dialogTitle = 'Add torrents';
  }
  let fileDropTitle: string | undefined = `${files.length} .torrent files`;
  if (files.length === 0) {
    fileDropTitle = 'Drop .torrent files here';
  } else if (files.length === 1) {
    fileDropTitle = files[0]?.name;
  }
  let submitLabel: string = 'Add torrent';
  if (submitting) {
    submitLabel = 'Adding…';
  } else if (sources.length > 1) {
    submitLabel = 'Add torrents';
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby="add-torrent-title"
        aria-modal="true"
        className={(sources.length > 1) ? 'dialog dialog-wide' : 'dialog'}
        role="dialog"
      >
        <div className="dialog-heading">
          <div>
            <h2 id="add-torrent-title">{dialogTitle}</h2>
            {(allProcessed) ? <p>{batchSummary['detail']}</p> : null}
            {(!allProcessed && sources.length > 1) ? <p>Review the matched profile for each source.</p> : null}
            {(!allProcessed && singleSource !== undefined) ? (
              <p className="torrent-preview-summary">
                <span>{singleSource['displayName']}</span>
                {(singleSource['size'] === null) ? null : <span>{formatBytes(singleSource['size'])}</span>}
                {(singleSource['checking']) ? <span className="torrent-preview-checking">Checking…</span> : null}
                {(singleSource['alreadyAdded']) ? <span className="torrent-preview-duplicate">Already added</span> : null}
              </p>
            ) : null}
          </div>
          <button aria-label="Close" className="icon-button" disabled={submitting} onClick={onClose} type="button">
            <Icon name="x" />
          </button>
        </div>

        {(!allProcessed) ? (
          <div className="source-tabs" role="tablist">
            <button
              aria-selected={sourceMode === 'link'}
              onClick={(): void => {
                setSourceMode('link');
                setResults({});
              }}
              role="tab"
              type="button"
            >
              Links or magnets
            </button>
            <button
              aria-selected={sourceMode === 'file'}
              onClick={(): void => {
                setSourceMode('file');
                setResults({});
              }}
              role="tab"
              type="button"
            >
              Torrent files
            </button>
          </div>
        ) : null}

        <form noValidate onSubmit={handleSubmit}>
          {(!allProcessed && sourceMode === 'link') ? (
            <FieldLabel>
              <span>Torrent URLs or magnet links</span>
              <textarea
                onChange={(event): void => {
                  setLinkText(event.currentTarget.value);
                  setResults({});
                }}
                placeholder={'One per line\nmagnet:?xt=urn:btih:…'}
                rows={4}
                value={linkText}
              />
              <small>Enter one link per line.</small>
            </FieldLabel>
          ) : null}

          {(!allProcessed && sourceMode === 'file') ? (
            <label
              className={(dragActive) ? 'file-drop file-drop-active' : 'file-drop'}
              onDragEnter={(): void => setDragActive(true)}
              onDragLeave={(): void => setDragActive(false)}
              onDragOver={(event: DragEvent<HTMLLabelElement>): void => event.preventDefault()}
              onDrop={(event: DragEvent<HTMLLabelElement>): void => {
                event.preventDefault();
                setDragActive(false);
                acceptFiles([...event.dataTransfer.files]);
              }}
            >
              <Icon name="upload" size={24} />
              <strong>{fileDropTitle}</strong>
              <span>{(files.length === 0) ? 'or browse from this device' : 'Drop more files here, or browse this device'}</span>
              <input
                accept=".torrent,application/x-bittorrent"
                multiple
                onChange={(event: ChangeEvent<HTMLInputElement>): void => acceptFiles([...(event.currentTarget.files ?? [])])}
                type="file"
              />
            </label>
          ) : null}

          {(sources.length <= 1 || singleSource !== undefined) ? null : (
            <div className="torrent-file-list">
              {sources.map((source: Web_Components_AddTorrentSource): ReactElement => {
                const result: Web_Components_AddTorrentResult | undefined = results[source['key']];
                const ambiguousMatch: boolean = source['matchedProfileIds'].length > 1
                  && profileOverrides[source['key']] === undefined;
                const selectedProfileId: string = profileOverrides[source['key']]
                  ?? automaticProfileSelectionValue(source);
                const automaticallyMatched: boolean = profileOverrides[source['key']] === undefined
                  && source['matchedProfileIds'].length === 1;
                let resultLabel: string = 'Failed';
                if (result?.['status'] === 'added') {
                  resultLabel = 'Added';
                } else if (result?.['status'] === 'duplicate') {
                  resultLabel = 'Already added';
                }

                return (
                  <div className="torrent-file-row" key={source['key']}>
                    <div className="torrent-file-copy">
                      <div className="torrent-file-title">
                        <strong title={source['displayName']}>{source['displayName']}</strong>
                        {(source['checking']) ? <span className="torrent-preview-checking">Checking…</span> : null}
                        {(source['alreadyAdded']) ? <span className="torrent-preview-duplicate">Already added</span> : null}
                      </div>
                      <small>{(source['size'] === null) ? source['link'] : formatBytes(source['size'])}</small>
                    </div>
                    {(result === undefined) ? (
                      <div className="profile-select-with-tag">
                        <select
                          aria-label={`Profile for ${source['displayName']}`}
                          className="select-control"
                          disabled={submitting}
                          onChange={(event): void => selectProfile(source['key'], event.currentTarget.value)}
                          value={selectedProfileId}
                        >
                          {(ambiguousMatch) ? (
                            <option disabled value="">{`Matches ${source['matchedProfileIds'].length} profiles. Pick one.`}</option>
                          ) : null}
                          <option value={defaultProfileSelectionValue}>{defaultProfile['name']}</option>
                          {profiles.map((profile: Web_Api_TorrentProfile): ReactElement => (
                            <option key={profile['id']} value={profile['id']}>{profile['name']}</option>
                          ))}
                        </select>
                        {(automaticallyMatched) ? <span className="tag match-tag">Matched</span> : null}
                      </div>
                    ) : (
                      <div className="torrent-result">
                        <span className={`state-chip result-${result['status']}`}>{resultLabel}</span>
                        <small>{result['detail']}</small>
                        {(result['requiresVPNConnection'] === true) ? (
                          <button className="inline-link-button" onClick={onOpenVPN} type="button">Add VPN connection</button>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {(singleSource === undefined) ? null : (
            <>
              <label className="field">
                <span>Profile</span>
                <span className="profile-select-with-tag">
                  <select
                    onChange={(event): void => selectProfile(singleSource['key'], event.currentTarget.value)}
                    value={selectedSingleProfileId}
                  >
                    {(singleSource['matchedProfileIds'].length > 1 && profileOverrides[singleSource['key']] === undefined) ? (
                      <option disabled value="">{`Matches ${singleSource['matchedProfileIds'].length} profiles. Pick one.`}</option>
                    ) : null}
                    <option value={defaultProfileSelectionValue}>{defaultProfile['name']}</option>
                    {profiles.map((profile: Web_Api_TorrentProfile): ReactElement => (
                      <option key={profile['id']} value={profile['id']}>{profile['name']}</option>
                    ))}
                  </select>
                  {(profileOverrides[singleSource['key']] === undefined && singleSource['matchedProfileIds'].length === 1) ? <span className="tag match-tag">Matched</span> : null}
                </span>
                {(singleSource['matchedProfileIds'].length === 1) ? (
                  <small>{`Matched by ${profiles.find((profile: Web_Api_TorrentProfile): boolean => profile['id'] === singleSource['matchedProfileIds'][0])?.['matchPatterns'].find((pattern: string): boolean => torrentNameMatchesPattern(singleSource['name'], pattern)) ?? 'a profile pattern'}`}</small>
                ) : null}
                {(singleSource['matchedProfileIds'].length > 1 && profileOverrides[singleSource['key']] === undefined) ? (
                  <small>{`Matches ${singleSource['matchedProfileIds'].length} profiles. Pick one.`}</small>
                ) : null}
              </label>

              <div className="field-row">
                <label className="field">
                  <span>Download location</span>
                  <input className="profile-derived-value" readOnly type="text" value={selectedDownloadDirectory} />
                  {(freeSpace === null) ? null : <small className="free-space-value">{`${formatBytes(freeSpace)} free`}</small>}
                </label>
                <label className="field">
                  <span>VPN connection</span>
                  <input className="profile-derived-value" readOnly type="text" value={profileConnectionLabel(selectedSingleProfileData)} />
                </label>
              </div>

              <LabelPicker
                labels={labelPresets}
                onChange={setLabels}
                title="Labels"
                value={labels}
              />

              <label aria-label="Add paused" className="check-row">
                <input checked={paused} onChange={(event): void => setPaused(event.currentTarget.checked)} type="checkbox" />
                <span>
                  <strong>Add paused</strong>
                  <small>Review files and options before it starts.</small>
                </span>
              </label>

              <div className="also-applies">
                <Icon name="settings" size={16} />
                <div>
                  <strong>Also applies</strong>
                  <dl>
                    {profileOptionRows(selectedSingleProfileData).map((row: [string, string]): ReactElement => (
                      <div key={row[0]}>
                        <dt>{row[0]}</dt>
                        <dd>{row[1]}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </>
          )}

          {(error === '') ? null : (
            <div className="form-error" role="alert">
              <span>{error}</span>
              {(requiresVPNConnection) ? <button className="inline-link-button" onClick={onOpenVPN} type="button">Add VPN connection</button> : null}
            </div>
          )}

          <div className="dialog-actions">
            {(allProcessed) ? (
              <Button onClick={onClose} variant="primary">Done</Button>
            ) : (
              <>
                <Button disabled={submitting} onClick={onClose}>Cancel</Button>
                <Button disabled={submitting || previewingLinks || sources.length === 0 || hasUnresolvedProfileChoice} icon="add" type="submit" variant="primary">
                  {submitLabel}
                </Button>
              </>
            )}
          </div>
        </form>
      </section>
    </div>
  );
};
