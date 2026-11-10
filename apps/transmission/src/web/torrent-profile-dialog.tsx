import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ApiError,
  connectionBeingRemovedMessage,
  issueFor,
} from '@/web/api.ts';
import { DirectoryBrowserDialog } from '@/web/directory-browser-dialog.tsx';
import {
  parseDefaultTorrentProfileInput,
  parseTorrentProfileInput,
} from '@/web/form-validation.ts';
import { LabelPicker } from '@/web/organization-controls.tsx';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { torrentMoveResultLabel } from '@/web/torrent-move-result.ts';
import { torrentProfileDialogFields } from '@/web/torrent-profile-fields.ts';
import {
  torrentNameMatchesPattern,
  torrentPatternsOverlap,
} from '@/web/torrent-profile-matcher.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  FormEvent,
  ReactElement,
} from 'react';

import type {
  Web_Api_DefaultTorrentProfileInput,
  Web_Api_MovedTorrent,
  Web_Api_TorrentProfile,
  Web_Api_TorrentProfileInput,
  Web_Api_TorrentProfileOverlap,
} from '@/types/web/api.d.ts';
import type { Web_Components_TorrentProfileDialog_Props } from '@/types/web/components.d.ts';
import type { TorrentProfileField } from '@/web/torrent-profile-fields.ts';

/**
 * Torrent Profile Dialog - Parses list.
 *
 * Converts comma-separated labels into the API's string array.
 * Whitespace-only entries are discarded before validation.
 *
 * @since 2.0.0
 */
const parseLabelList = (value: string): string[] => value
  .split(',')
  .map((item: string): string => item.trim())
  .filter((item: string): boolean => item !== '');

/**
 * Torrent Profile Dialog - Parses patterns.
 *
 * Treats every non-empty row as one automatic-match pattern.
 * Trimming rows avoids invisible trailing characters in a glob.
 *
 * @since 2.0.0
 */
const parsePatterns = (rows: string[]): string[] => rows
  .map((pattern: string): string => pattern.trim())
  .filter((pattern: string): boolean => pattern !== '');

/**
 * Torrent Profile Dialog.
 *
 * Creates named profiles and edits named or Default profile-owned folder,
 * label, and Transmission option bundles.
 *
 * @since 2.0.0
 */
export const TorrentProfileDialog = ({
  connections,
  defaultProfile,
  labelPresets,
  mode,
  onClose,
  onSave,
  open,
  profile,
  profiles,
}: Web_Components_TorrentProfileDialog_Props): ReactElement | null => {
  const [
    name,
    setName,
  ] = useState<string>('');
  const [
    downloadDirectory,
    setDownloadDirectory,
  ] = useState<string>('/data/downloads/new');
  const [
    labels,
    setLabels,
  ] = useState<string>('');
  const [
    startPaused,
    setStartPaused,
  ] = useState<boolean>(false);
  const [
    seedingMode,
    setSeedingMode,
  ] = useState<'limit' | 'never'>('never');
  const [
    ratio,
    setRatio,
  ] = useState<string>('');
  const [
    idleMinutes,
    setIdleMinutes,
  ] = useState<string>('');
  const [
    downloadLimited,
    setDownloadLimited,
  ] = useState<boolean>(false);
  const [
    downloadLimit,
    setDownloadLimit,
  ] = useState<string>('1000');
  const [
    uploadLimited,
    setUploadLimited,
  ] = useState<boolean>(false);
  const [
    uploadLimit,
    setUploadLimit,
  ] = useState<string>('500');
  const [
    priority,
    setPriority,
  ] = useState<-1 | 0 | 1>(0);
  const [
    peerLimit,
    setPeerLimit,
  ] = useState<string>('50');
  const [
    queue,
    setQueue,
  ] = useState<'normal' | 'top'>('normal');
  const [
    patterns,
    setPatterns,
  ] = useState<string[]>([]);
  const [
    patternTryName,
    setPatternTryName,
  ] = useState<string>('');
  const patternInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pendingPatternFocusRef = useRef<number | null>(null);
  const [
    connectionID,
    setConnectionID,
  ] = useState<string>('');
  const [
    browserOpen,
    setBrowserOpen,
  ] = useState<boolean>(false);
  const [
    moveConfirmation,
    setMoveConfirmation,
  ] = useState<{
    count: number
    input: Web_Api_DefaultTorrentProfileInput | Web_Api_TorrentProfileInput
    message: string
  } | null>(null);
  const [
    moveResults,
    setMoveResults,
  ] = useState<Web_Api_MovedTorrent[] | null>(null);
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    saveError,
    setSaveError,
  ] = useState<unknown>(null);

  useEffect((): void => {
    const pendingIndex: number | null = pendingPatternFocusRef.current;
    if (pendingIndex !== null) {
      patternInputRefs.current[pendingIndex]?.focus();
      pendingPatternFocusRef.current = null;
    }
  }, [patterns]);

  useEffect((): void => {
    if (!open) {
      return;
    }

    const source = (mode === 'default') ? defaultProfile : profile;
    const options = source?.['options'];
    setName(source?.['name'] ?? '');
    setDownloadDirectory(source?.['downloadDirectory'] ?? '/data/downloads/new');
    setLabels(source?.['labels'].join(', ') ?? '');
    setStartPaused(source?.['startPaused'] ?? false);
    setSeedingMode(options?.['seeding']['mode'] ?? 'never');
    setRatio(options?.['seeding']['ratio']?.toString() ?? '');
    setIdleMinutes(options?.['seeding']['idleMinutes']?.toString() ?? '');
    setDownloadLimited(options?.['downloadLimitKBps'] !== null && options?.['downloadLimitKBps'] !== undefined);
    setDownloadLimit(options?.['downloadLimitKBps']?.toString() ?? '1000');
    setUploadLimited(options?.['uploadLimitKBps'] !== null && options?.['uploadLimitKBps'] !== undefined);
    setUploadLimit(options?.['uploadLimitKBps']?.toString() ?? '500');
    setPriority(options?.['bandwidthPriority'] ?? 0);
    setPeerLimit(options?.['peerLimit'].toString() ?? '50');
    setQueue(options?.['queue'] ?? 'normal');
    setPatterns(profile?.['matchPatterns'] ?? []);
    setPatternTryName('');
    setConnectionID(profile?.['connectionId'] ?? '');
    setBrowserOpen(false);
    setMoveConfirmation(null);
    setMoveResults(null);
    setBusy(false);
    setSaveError(null);
  }, [
    defaultProfile,
    mode,
    open,
    profile,
  ]);

  useEscapeKey(onClose, open && !busy && !browserOpen);

  if (!open) {
    return null;
  }

  /**
   * Torrent Profile Dialog - Connection name.
   *
   * Resolves a nullable named-profile choice through the current default VPN.
   * Missing relationships use neutral wording in the save confirmation.
   *
   * @since 2.0.0
   */
  const connectionName = (targetId: string): string => {
    const connection = (targetId === '') ? connections.find((candidate): boolean => candidate['default']) : connections.find((candidate): boolean => candidate['id'] === targetId);

    return connection?.['name'] ?? 'the selected connection';
  };

  /**
   * Torrent Profile Dialog - Builds profile input.
   *
   * Normalizes the shared controls and selects the matching Default or named
   * profile parser before a request leaves the dialog.
   *
   * @since 2.0.0
   */
  const buildInput = (): Web_Api_DefaultTorrentProfileInput | Web_Api_TorrentProfileInput => {
    const sharedInput: Web_Api_DefaultTorrentProfileInput = {
      downloadDirectory: downloadDirectory.trim(),
      labels: parseLabelList(labels),
      name,
      options: {
        bandwidthPriority: priority,
        downloadLimitKBps: (downloadLimited) ? Number(downloadLimit) : null,
        peerLimit: Number(peerLimit),
        queue,
        seeding: {
          idleMinutes: (seedingMode === 'limit' && idleMinutes !== '') ? Number(idleMinutes) : null,
          mode: seedingMode,
          ratio: (seedingMode === 'limit' && ratio !== '') ? Number(ratio) : null,
        },
        uploadLimitKBps: (uploadLimited) ? Number(uploadLimit) : null,
      },
      startPaused,
    };
    if (mode === 'default') {
      return parseDefaultTorrentProfileInput(sharedInput);
    }

    return parseTorrentProfileInput({
      ...sharedInput,
      connectionId: (connectionID === '') ? null : connectionID,
      matchPatterns: parsePatterns(patterns),
      name,
    });
  };

  /**
   * Torrent Profile Dialog - Saves profile.
   *
   * Opens the move confirmation when the API reports that an existing folder
   * or VPN change must move assigned torrents.
   *
   * @since 2.0.0
   */
  const saveProfile = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setSaveError(null);

    try {
      const input: Web_Api_DefaultTorrentProfileInput | Web_Api_TorrentProfileInput = buildInput();
      await onSave(input);
      onClose();
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError['code'] === 'torrents_must_move') {
        setMoveConfirmation({
          count: (typeof caughtError['details']['torrents'] === 'number') ? caughtError['details']['torrents'] : 0,
          input: buildInput(),
          message: caughtError.message,
        });
        setMoveResults(null);

        return;
      }
      setSaveError(caughtError);
    } finally {
      setBusy(false);
    }
  };

  const defaultConnection = connections.find((connection): boolean => connection['default']);
  const nameIssue: string = issueFor(saveError, 'name');
  const folderIssue: string = issueFor(saveError, 'downloadDirectory');
  const generalError: string = (folderIssue !== '' || nameIssue !== '') ? '' : connectionBeingRemovedMessage(
    saveError,
    connectionName(connectionID),
  ) ?? ((saveError instanceof Error) ? saveError.message : '');
  const profilePickerID: string = (mode === 'default') ? 'default' : profile?.['id'] ?? 'new';
  const fields: TorrentProfileField[] = torrentProfileDialogFields(mode);
  const currentPatterns: string[] = parsePatterns(patterns);
  const trimmedTryName: string = patternTryName.trim();
  const tryMatches: string[] = (trimmedTryName === '') ? [] : currentPatterns.filter(
    (pattern: string): boolean => torrentNameMatchesPattern(trimmedTryName, pattern),
  );
  const patternOverlaps: Web_Api_TorrentProfileOverlap[] = profiles.flatMap(
    (otherProfile: Web_Api_TorrentProfile): Web_Api_TorrentProfileOverlap[] => {
      if (otherProfile['id'] === profile?.['id']) {
        return [];
      }

      return currentPatterns.flatMap((ownPattern: string): Web_Api_TorrentProfileOverlap[] => (
        otherProfile['matchPatterns'].flatMap((otherPattern: string): Web_Api_TorrentProfileOverlap[] => (
          (torrentPatternsOverlap(ownPattern, otherPattern)) ? [{
            ownPattern,
            pattern: otherPattern,
            profileId: otherProfile['id'],
            profileName: otherProfile['name'],
          }] : []
        ))
      ));
    },
  );
  let title: string = 'New profile';
  if (mode === 'default') {
    title = `Edit ${defaultProfile['name']}`;
  } else if (mode === 'edit' && profile !== null) {
    title = `Edit ${profile['name']} profile`;
  }
  let saveButtonLabel: string = (mode === 'create') ? 'Create profile' : 'Save profile';
  if (busy) {
    saveButtonLabel = 'Saving…';
  }

  return (
    <div className="dialog-backdrop profile-editor-backdrop" role="presentation">
      <section aria-labelledby="torrent-profile-title" aria-modal="true" className="dialog dialog-wide" role="dialog">
        <div className="dialog-heading">
          <div>
            <h2 id="torrent-profile-title">{title}</h2>
            <p>Apply the same folder, labels, and limits when a torrent uses this profile.</p>
          </div>
          <button aria-label="Close" className="icon-button" disabled={busy} onClick={onClose} type="button"><Icon name="x" /></button>
        </div>

        <form noValidate onSubmit={saveProfile}>
          <div className={(fields.includes('name')) ? 'field-row' : undefined}>
            {(!fields.includes('name')) ? null : (
              <label className="field">
                <span>Name</span>
                <input aria-invalid={nameIssue !== ''} onChange={(event): void => setName(event.currentTarget.value)} placeholder="e.g. TV shows" type="text" value={name} />
                {(nameIssue === '') ? null : <small className="field-error" role="alert">{nameIssue}</small>}
              </label>
            )}
            <div className="field">
              <span>Download folder *</span>
              <div className="directory-field-row">
                <input
                  aria-invalid={folderIssue !== ''}
                  aria-label="Download folder"
                  onChange={(event): void => setDownloadDirectory(event.currentTarget.value)}
                  readOnly={mode === 'default' && defaultProfile['downloadDirectoryLocked']}
                  type="text"
                  value={downloadDirectory}
                />
                {(mode === 'default' && defaultProfile['downloadDirectoryLocked']) ? null : (
                  <Button icon="folder" onClick={(): void => setBrowserOpen(true)} type="button">Browse</Button>
                )}
              </div>
              {(folderIssue === '') ? null : <small className="field-error" role="alert">{folderIssue}</small>}
              {(mode === 'default' && defaultProfile['downloadDirectoryLocked']) ? (
                <small>The Download directory is locked by managed configuration.</small>
              ) : <small>Choose one folder inside /data for this profile.</small>}
            </div>
          </div>

          <LabelPicker labels={labelPresets} onChange={setLabels} title="Labels" value={labels} />
          <label aria-label="Start paused" className="check-row">
            <input checked={startPaused} onChange={(event): void => setStartPaused(event.currentTarget.checked)} type="checkbox" />
            <span>
              <strong>Start paused</strong>
              <small>Review files before downloading.</small>
            </span>
          </label>

          {(mode !== 'default') ? null : (
            <label className="field">
              <span>VPN connection</span>
              <input className="profile-derived-value" readOnly type="text" value={defaultConnection?.['name'] ?? 'No default connection'} />
              <small>Always the default connection. Change it on the VPN page.</small>
            </label>
          )}

          {(!fields.includes('connectionId')) ? null : (
            <label className="field">
              <span>VPN connection</span>
              <select onChange={(event): void => setConnectionID(event.currentTarget.value)} value={connectionID}>
                <option value="">{`Default (${defaultConnection?.['name'] ?? 'connection'})`}</option>
                {connections.map((connection): ReactElement => (
                  <option key={connection['id']} value={connection['id']}>{connection['name']}</option>
                ))}
              </select>
            </label>
          )}

          <div className="dialog-divider" />
          <div className="option-card-grid">
            <section className="option-card">
              <h3>Seeding</h3>
              <label className="field">
                <span>Stop</span>
                <select onChange={(event): void => setSeedingMode(event.currentTarget.value as 'limit' | 'never')} value={seedingMode}>
                  <option value="never">Never stop</option>
                  <option value="limit">Stop at a limit</option>
                </select>
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Ratio</span>
                  <input disabled={seedingMode !== 'limit'} min="0" onChange={(event): void => setRatio(event.currentTarget.value)} step="0.1" type="number" value={ratio} />
                </label>
                <label className="field">
                  <span>Idle minutes</span>
                  <input disabled={seedingMode !== 'limit'} min="1" onChange={(event): void => setIdleMinutes(event.currentTarget.value)} type="number" value={idleMinutes} />
                </label>
              </div>
            </section>

            <section className="option-card">
              <h3>Speed</h3>
              <div className="field-row">
                <label className="field">
                  <span>Download limit</span>
                  <select onChange={(event): void => setDownloadLimited(event.currentTarget.value === 'limit')} value={(downloadLimited) ? 'limit' : 'unlimited'}>
                    <option value="unlimited">Unlimited</option>
                    <option value="limit">Limit</option>
                  </select>
                  <div className="input-suffix">
                    <input disabled={!downloadLimited} min="1" onChange={(event): void => setDownloadLimit(event.currentTarget.value)} type="number" value={downloadLimit} />
                    <span>KB/s</span>
                  </div>
                </label>
                <label className="field">
                  <span>Upload limit</span>
                  <select onChange={(event): void => setUploadLimited(event.currentTarget.value === 'limit')} value={(uploadLimited) ? 'limit' : 'unlimited'}>
                    <option value="unlimited">Unlimited</option>
                    <option value="limit">Limit</option>
                  </select>
                  <div className="input-suffix">
                    <input disabled={!uploadLimited} min="1" onChange={(event): void => setUploadLimit(event.currentTarget.value)} type="number" value={uploadLimit} />
                    <span>KB/s</span>
                  </div>
                </label>
              </div>
            </section>

            <section className="option-card">
              <h3>Torrent options</h3>
              <div className="field-row">
                <label className="field">
                  <span>Priority</span>
                  <select onChange={(event): void => setPriority(Number(event.currentTarget.value) as -1 | 0 | 1)} value={priority}>
                    <option value={-1}>Low</option>
                    <option value={0}>Normal</option>
                    <option value={1}>High</option>
                  </select>
                </label>
                <label className="field">
                  <span>Peer limit</span>
                  <input min="1" onChange={(event): void => setPeerLimit(event.currentTarget.value)} type="number" value={peerLimit} />
                  <small>50 by default.</small>
                </label>
              </div>
              <label className="field">
                <span>Queue position</span>
                <select onChange={(event): void => setQueue(event.currentTarget.value as 'normal' | 'top')} value={queue}>
                  <option value="normal">Normal</option>
                  <option value="top">Top</option>
                </select>
              </label>
            </section>

            {(!fields.includes('matchPatterns')) ? null : (
              <section className="option-card">
                <h3>Auto-detect</h3>
                <p className="option-card-intro">Torrents added by remote apps join this profile when their name matches one of these patterns.</p>
                <div className="field pattern-list-field">
                  <span id="profile-pattern-list-label">Name patterns</span>
                  <div className="settings-list-box">
                    <div className="settings-list-body">
                      {(patterns.length === 0) ? (
                        <div className="settings-list-empty-state">
                          <strong>No name patterns</strong>
                          <span>Remote apps choose this profile only by folder or label.</span>
                        </div>
                      ) : patterns.map((pattern: string, index: number): ReactElement => (
                        <div className="settings-list-item" key={index}>
                          <div className="settings-list-row">
                            <input
                              aria-label={`Name pattern ${index + 1}`}
                              autoCapitalize="off"
                              autoComplete="off"
                              className="monospace"
                              maxLength={128}
                              onChange={(event): void => {
                                const nextPatterns: string[] = [...patterns];
                                nextPatterns[index] = event.currentTarget.value;
                                setPatterns(nextPatterns);
                              }}
                              placeholder="e.g. *S??E??*"
                              ref={(input: HTMLInputElement | null): void => {
                                patternInputRefs.current[index] = input;
                              }}
                              spellCheck={false}
                              type="text"
                              value={pattern}
                            />
                            <button
                              aria-label={`Remove name pattern ${index + 1}`}
                              className="icon-button settings-list-remove"
                              onClick={(): void => setPatterns(patterns.filter((_row: string, rowIndex: number): boolean => rowIndex !== index))}
                              title="Remove"
                              type="button"
                            >
                              <Icon name="remove" size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="settings-list-footer">
                      <Button
                        disabled={patterns.length >= 64}
                        icon="add"
                        onClick={(): void => {
                          pendingPatternFocusRef.current = patterns.length;
                          setPatterns([
                            ...patterns,
                            '',
                          ]);
                        }}
                      >
                        Add pattern
                      </Button>
                      <small className="settings-list-hint">Up to 64 patterns.</small>
                    </div>
                  </div>
                  {/* Contains-style patterns overlap with almost any other, so name each other profile once in one note. */}
                  {(patternOverlaps.length === 0) ? null : (
                    <small>
                      {`Can also match the ${new Intl.ListFormat('en', { type: 'conjunction' }).format([...new Set(patternOverlaps.map((overlap: Web_Api_TorrentProfileOverlap): string => overlap['profileName']))])} ${(new Set(patternOverlaps.map((overlap: Web_Api_TorrentProfileOverlap): string => overlap['profileId'])).size === 1) ? 'profile' : 'profiles'}. A torrent that matches more than one will ask you to choose.`}
                    </small>
                  )}
                </div>

                <details className="pattern-guide">
                  <summary>How to write a pattern</summary>
                  <p>A pattern is a torrent name with stand-ins for the parts that change. It must match the whole name, and capital letters don&apos;t matter.</p>
                  <dl className="pattern-guide-symbols">
                    <div>
                      <dt><code>*</code></dt>
                      <dd>Any text, or none</dd>
                    </div>
                    <div>
                      <dt><code>?</code></dt>
                      <dd>Exactly one character</dd>
                    </div>
                  </dl>
                  <p>
                    Everything else, dots and dashes included, must appear as typed. To match a word anywhere in the name, put
                    {' '}
                    <code>*</code>
                    {' '}
                    on both sides.
                  </p>
                  <table className="pattern-guide-examples">
                    <thead>
                      <tr>
                        <th scope="col">Pattern</th>
                        <th scope="col">Matches</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>*S??E??*</code></td>
                        <td>TV episodes, like Show.Name.S01E02.1080p</td>
                      </tr>
                      <tr>
                        <td><code>*2160p*</code></td>
                        <td>Any name with 2160p in it</td>
                      </tr>
                      <tr>
                        <td><code>ubuntu-*.iso</code></td>
                        <td>Names that start with ubuntu- and end in .iso</td>
                      </tr>
                      <tr>
                        <td><code>Show Name*</code></td>
                        <td>Names that start with Show Name</td>
                      </tr>
                    </tbody>
                  </table>
                  <label className="field">
                    <span>Try a name</span>
                    <input
                      autoCapitalize="off"
                      autoComplete="off"
                      onChange={(event): void => setPatternTryName(event.currentTarget.value)}
                      placeholder="Paste a torrent name"
                      spellCheck={false}
                      type="text"
                      value={patternTryName}
                    />
                    {(trimmedTryName === '') ? null : (
                      <small aria-live="polite" className={(tryMatches.length === 0) ? 'pattern-try-result' : 'pattern-try-result pattern-try-result-match'}>
                        {(tryMatches.length === 0) ? 'No pattern matches this name.' : `Matches ${new Intl.ListFormat('en', { type: 'conjunction' }).format(tryMatches)}.`}
                      </small>
                    )}
                  </label>
                </details>
              </section>
            )}
          </div>

          {(generalError === '') ? null : <div className="form-error" role="alert">{generalError}</div>}
          <div className="dialog-actions">
            <Button disabled={busy} onClick={onClose}>Cancel</Button>
            <Button disabled={busy} type="submit" variant="primary">{saveButtonLabel}</Button>
          </div>
        </form>
      </section>

      <DirectoryBrowserDialog
        initialPath={(downloadDirectory.startsWith('/data')) ? downloadDirectory : '/data'}
        onClose={(): void => setBrowserOpen(false)}
        onSelect={(path: string): void => {
          setDownloadDirectory(path);
          setBrowserOpen(false);
          setSaveError(null);
        }}
        open={browserOpen}
        profileId={profilePickerID}
        purpose="profile"
      />

      {(moveConfirmation === null) ? null : (
        <div className="dialog-backdrop dialog-backdrop-stacked" role="presentation">
          <section aria-labelledby="move-profile-torrents-title" aria-modal="true" className="dialog dialog-small dialog-stacked" role="alertdialog">
            <div className="dialog-heading">
              <div>
                <h2 id="move-profile-torrents-title">
                  {(moveResults === null)
                    ? `Save and move ${moveConfirmation['count']} ${(moveConfirmation['count'] === 1) ? 'torrent' : 'torrents'}?`
                    : 'Move results'}
                </h2>
                <p>{(moveResults === null) ? moveConfirmation['message'] : 'The profile was saved. Review each torrent move below.'}</p>
              </div>
            </div>
            {(moveResults === null) ? null : (
              <div className="torrent-move-results">
                <ul>
                  {moveResults.map((result: Web_Api_MovedTorrent): ReactElement => (
                    <li className={(result['result'] === 'failed') ? 'move-failed' : 'move-succeeded'} key={result['hash']}>
                      <strong>{result['name']}</strong>
                      <span className="move-result-copy">
                        <span className="move-result-state">
                          {torrentMoveResultLabel(result)}
                        </span>
                        {result['warnings']?.map((warning: string): ReactElement => <small key={warning}>{warning}</small>)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(generalError === '') ? null : <div className="form-error" role="alert">{generalError}</div>}
            <div className="dialog-actions">
              {(moveResults === null) ? (
                <>
                  <Button disabled={busy} onClick={(): void => setMoveConfirmation(null)}>Cancel</Button>
                  <Button
                    disabled={busy}
                    onClick={(): void => {
                      setBusy(true);
                      setSaveError(null);
                      void onSave(moveConfirmation['input'], true).then((results: Web_Api_MovedTorrent[]): void => {
                        setMoveResults(results);
                      }).catch((caughtError: unknown): void => {
                        setSaveError(caughtError);
                      }).finally((): void => setBusy(false));
                    }}
                    variant="primary"
                  >
                    {(busy) ? 'Moving…' : 'Save and move'}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={(): void => {
                    setMoveConfirmation(null);
                    onClose();
                  }}
                  variant="primary"
                >
                  Done
                </Button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
