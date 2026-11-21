import {
  useEffect,
  useState,
} from 'react';

import {
  issueFor,
  summaryFor,
} from '@/web/api.ts';
import { appConfig } from '@/web/app-config.ts';
import { FieldLabel } from '@/web/field-label.tsx';
import { formatDate } from '@/web/format.ts';
import {
  Button,
  Icon,
} from '@/web/primitives.tsx';
import { showToast } from '@/web/toast.ts';
import { useEscapeKey } from '@/web/use-escape-key.ts';

import type {
  Web_Components_TokenDialog_Expiry,
  Web_Components_TokenDialog_Props,
} from '@/types/web/components.d.ts';
import type {
  Web_TokenDialog_ExpiryDate_Expiry,
  Web_TokenDialog_ExpiryDate_Returns,
  Web_TokenDialog_IncludingScope_Including,
  Web_TokenDialog_IncludingScope_Returns,
  Web_TokenDialog_IncludingScope_Scope,
  Web_TokenDialog_IncludingScope_Scopes,
  Web_TokenDialog_ScopeOptions,
  Web_TokenDialog_TokenDialog_Allowed,
  Web_TokenDialog_TokenDialog_AllowedScopes,
  Web_TokenDialog_TokenDialog_Busy,
  Web_TokenDialog_TokenDialog_BusyState,
  Web_TokenDialog_TokenDialog_Copied,
  Web_TokenDialog_TokenDialog_CopiedState,
  Web_TokenDialog_TokenDialog_CreatedToken,
  Web_TokenDialog_TokenDialog_CreatedTokenState,
  Web_TokenDialog_TokenDialog_Editing,
  Web_TokenDialog_TokenDialog_Endpoints,
  Web_TokenDialog_TokenDialog_Error,
  Web_TokenDialog_TokenDialog_ErrorState,
  Web_TokenDialog_TokenDialog_Expiry,
  Web_TokenDialog_TokenDialog_ExpiryState,
  Web_TokenDialog_TokenDialog_IncludedBy,
  Web_TokenDialog_TokenDialog_Name,
  Web_TokenDialog_TokenDialog_NameIssue,
  Web_TokenDialog_TokenDialog_NameState,
  Web_TokenDialog_TokenDialog_OnClose,
  Web_TokenDialog_TokenDialog_OnCreate,
  Web_TokenDialog_TokenDialog_OnUpdate,
  Web_TokenDialog_TokenDialog_Open,
  Web_TokenDialog_TokenDialog_Returns,
  Web_TokenDialog_TokenDialog_Scopes,
  Web_TokenDialog_TokenDialog_ScopesIssue,
  Web_TokenDialog_TokenDialog_ScopesState,
  Web_TokenDialog_TokenDialog_SetBusy,
  Web_TokenDialog_TokenDialog_SetCopied,
  Web_TokenDialog_TokenDialog_SetCreatedToken,
  Web_TokenDialog_TokenDialog_SetError,
  Web_TokenDialog_TokenDialog_SetExpiry,
  Web_TokenDialog_TokenDialog_SetName,
  Web_TokenDialog_TokenDialog_SetScopes,
  Web_TokenDialog_TokenDialog_Submit,
  Web_TokenDialog_TokenDialog_Submit_Event,
  Web_TokenDialog_TokenDialog_Submit_ExpiresAt,
  Web_TokenDialog_TokenDialog_Submit_NextToken,
  Web_TokenDialog_TokenDialog_Submit_OrderedScopes,
  Web_TokenDialog_TokenDialog_Submit_Returns,
  Web_TokenDialog_TokenDialog_Summary,
  Web_TokenDialog_TokenDialog_ToggleScope,
  Web_TokenDialog_TokenDialog_ToggleScope_Included,
  Web_TokenDialog_TokenDialog_ToggleScope_Option,
  Web_TokenDialog_TokenDialog_ToggleScope_Returns,
  Web_TokenDialog_TokenDialog_Token,
} from '@/types/web/token-dialog.d.ts';

/**
 * Token Dialog - Scope Options.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const scopeOptions: Web_TokenDialog_ScopeOptions = appConfig['tokenScopes'];

// expiryDate turns a choice like "in 90 days" into the timestamp the API stores.

/**
 * Token Dialog - Expiry Date.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @param {Web_TokenDialog_ExpiryDate_Expiry} expiry - Expiry.
 *
 * @returns {Web_TokenDialog_ExpiryDate_Returns}
 *
 * @since 2.0.0
 */
const expiryDate = (expiry: Web_TokenDialog_ExpiryDate_Expiry): Web_TokenDialog_ExpiryDate_Returns => {
  if (expiry === 'keep') {
    return undefined;
  }

  if (expiry === 'never') {
    return null;
  }

  return new Date(Date.now() + (Number(expiry) * 24 * 60 * 60 * 1000)).toISOString();
};

/**
 * Token Dialog - Including Scope.
 *
 * Finds a selected scope that already grants another configured scope.
 * Included scopes stay checked and disabled until their parent is removed.
 *
 * @param {Web_TokenDialog_IncludingScope_Scopes} scopes - Scopes.
 * @param {Web_TokenDialog_IncludingScope_Scope}  scope  - Scope.
 *
 * @returns {Web_TokenDialog_IncludingScope_Returns}
 *
 * @since 2.0.0
 */
const includingScope = (scopes: Web_TokenDialog_IncludingScope_Scopes, scope: Web_TokenDialog_IncludingScope_Scope): Web_TokenDialog_IncludingScope_Returns => {
  const including: Web_TokenDialog_IncludingScope_Including = scopeOptions.find((option) => option['includes'] === scope && scopes.includes(option['id']));

  return (including === undefined) ? undefined : including['id'];
};

/**
 * Token Dialog - Token Dialog.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @param {Web_Components_TokenDialog_Props} props - Props.
 *
 * @returns {Web_TokenDialog_TokenDialog_Returns}
 *
 * @since 2.0.0
 */
export const TokenDialog = (props: Web_Components_TokenDialog_Props): Web_TokenDialog_TokenDialog_Returns => {
  const allowedScopes: Web_TokenDialog_TokenDialog_AllowedScopes = props['allowedScopes'] ?? scopeOptions.map((option) => option['id']);
  const onClose: Web_TokenDialog_TokenDialog_OnClose = props['onClose'];
  const onCreate: Web_TokenDialog_TokenDialog_OnCreate = props['onCreate'];
  const onUpdate: Web_TokenDialog_TokenDialog_OnUpdate = props['onUpdate'];
  const open: Web_TokenDialog_TokenDialog_Open = props['open'];
  const token: Web_TokenDialog_TokenDialog_Token = props['token'];
  const nameState: Web_TokenDialog_TokenDialog_NameState = useState<Web_TokenDialog_TokenDialog_Name>('');
  const name: Web_TokenDialog_TokenDialog_Name = nameState[0];
  const setName: Web_TokenDialog_TokenDialog_SetName = nameState[1];
  const scopesState: Web_TokenDialog_TokenDialog_ScopesState = useState<Web_TokenDialog_TokenDialog_Scopes>(appConfig['tokenDefaultScopes']);
  const scopes: Web_TokenDialog_TokenDialog_Scopes = scopesState[0];
  const setScopes: Web_TokenDialog_TokenDialog_SetScopes = scopesState[1];
  const expiryState: Web_TokenDialog_TokenDialog_ExpiryState = useState<Web_TokenDialog_TokenDialog_Expiry>('never');
  const expiry: Web_TokenDialog_TokenDialog_Expiry = expiryState[0];
  const setExpiry: Web_TokenDialog_TokenDialog_SetExpiry = expiryState[1];
  const errorState: Web_TokenDialog_TokenDialog_ErrorState = useState<Web_TokenDialog_TokenDialog_Error>(null);
  const error: Web_TokenDialog_TokenDialog_Error = errorState[0];
  const setError: Web_TokenDialog_TokenDialog_SetError = errorState[1];
  const busyState: Web_TokenDialog_TokenDialog_BusyState = useState<Web_TokenDialog_TokenDialog_Busy>(false);
  const busy: Web_TokenDialog_TokenDialog_Busy = busyState[0];
  const setBusy: Web_TokenDialog_TokenDialog_SetBusy = busyState[1];
  const createdTokenState: Web_TokenDialog_TokenDialog_CreatedTokenState = useState<Web_TokenDialog_TokenDialog_CreatedToken>(null);
  const createdToken: Web_TokenDialog_TokenDialog_CreatedToken = createdTokenState[0];
  const setCreatedToken: Web_TokenDialog_TokenDialog_SetCreatedToken = createdTokenState[1];
  const copiedState: Web_TokenDialog_TokenDialog_CopiedState = useState<Web_TokenDialog_TokenDialog_Copied>(false);
  const copied: Web_TokenDialog_TokenDialog_Copied = copiedState[0];
  const setCopied: Web_TokenDialog_TokenDialog_SetCopied = copiedState[1];

  useEscapeKey(onClose, open);

  useEffect(() => {
    if (open === false) {
      return;
    }

    setName((token === null) ? '' : token['name']);
    setScopes((token === null) ? [...appConfig['tokenDefaultScopes']] : token['scopes']);
    setExpiry((token === null || token['expiresAt'] === null) ? 'never' : 'keep');
    setError(null);
    setCreatedToken(null);
    setCopied(false);

    return;
  }, [
    open,
    token,
  ]);

  if (open === false) {
    return null;
  }

  const editing: Web_TokenDialog_TokenDialog_Editing = token !== null;

  /**
   * Token Dialog - Toggle Scope.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_TokenDialog_TokenDialog_ToggleScope_Option} option - Option.
   *
   * @returns {Web_TokenDialog_TokenDialog_ToggleScope_Returns}
   *
   * @since 2.0.0
   */
  const toggleScope: Web_TokenDialog_TokenDialog_ToggleScope = (option: Web_TokenDialog_TokenDialog_ToggleScope_Option): Web_TokenDialog_TokenDialog_ToggleScope_Returns => {
    setScopes((current) => {
      if (current.includes(option['id']) === true) {
        return current.filter((candidate) => candidate !== option['id']);
      }

      const included: Web_TokenDialog_TokenDialog_ToggleScope_Included = option['includes'];

      if (included === undefined || current.includes(included) === true) {
        return [
          ...current,
          option['id'],
        ];
      }

      return [
        ...current,
        option['id'],
        included,
      ];
    });

    return;
  };

  /**
   * Token Dialog - Submit.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @param {Web_TokenDialog_TokenDialog_Submit_Event} event - Event.
   *
   * @returns {Web_TokenDialog_TokenDialog_Submit_Returns}
   *
   * @since 2.0.0
   */
  const submit: Web_TokenDialog_TokenDialog_Submit = async (event: Web_TokenDialog_TokenDialog_Submit_Event): Web_TokenDialog_TokenDialog_Submit_Returns => {
    event.preventDefault();

    setBusy(true);
    setError(null);

    const orderedScopes: Web_TokenDialog_TokenDialog_Submit_OrderedScopes = scopeOptions
      .map((option) => option['id'])
      .filter((scope) => scopes.includes(scope));
    const expiresAt: Web_TokenDialog_TokenDialog_Submit_ExpiresAt = expiryDate(expiry);

    try {
      if (token === null) {
        const nextToken: Web_TokenDialog_TokenDialog_Submit_NextToken = await onCreate({
          ...((typeof expiresAt === 'string') ? { expiresAt } : {}),
          name,
          scopes: orderedScopes,
        });

        setCreatedToken(nextToken);
      } else {
        await onUpdate(token['id'], {
          ...((expiresAt === undefined) ? {} : { expiresAt }),
          name,
          scopes: orderedScopes,
        });
        showToast(`${name.trim()} saved.`, true);
      }

      if (token !== null) {
        onClose();
      }
    } catch (caughtError) {
      setError(caughtError);
    } finally {
      setBusy(false);
    }

    return;
  };

  const nameIssue: Web_TokenDialog_TokenDialog_NameIssue = issueFor(error, 'name');
  const scopesIssue: Web_TokenDialog_TokenDialog_ScopesIssue = issueFor(error, 'scopes');
  const summary: Web_TokenDialog_TokenDialog_Summary = summaryFor(error, [
    'name',
    'scopes',
  ], 'The token could not be saved.');

  if (createdToken !== null) {
    return (
      <div className="dialog-backdrop" role="presentation">
        <section aria-labelledby="token-dialog-title" aria-modal="true" className="dialog" role="dialog">
          <div className="dialog-heading">
            <div>
              <h2 id="token-dialog-title">{`Token for ${createdToken['token']['name']}`}</h2>
              <p>{'Copy it now. It won\'t be shown again.'}</p>
            </div>
            <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
              <Icon name="x" size={18} />
            </button>
          </div>
          <div className="dialog-body" aria-live="polite">
            <label className="field">
              <span>Token</span>
              <span className="generated-secret-field">
                <input className="monospace" readOnly type="text" value={createdToken['plaintext']} />
                <button
                  aria-label="Copy token"
                  className="icon-button generated-secret-copy"
                  onClick={() => {
                    void navigator.clipboard.writeText(createdToken['plaintext']).then(() => setCopied(true)).catch(() => {
                      showToast('The token could not be copied.', false);

                      return;
                    });

                    return;
                  }}
                  title="Copy token"
                  type="button"
                >
                  <Icon name={(copied === true) ? 'check' : 'copy'} size={16} />
                </button>
              </span>
            </label>
            <div className="dialog-actions">
              <Button onClick={onClose} variant="primary">Done</Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-labelledby="token-dialog-title" aria-modal="true" className="dialog" role="dialog">
        <div className="dialog-heading">
          <div>
            <h2 id="token-dialog-title">{(token === null) ? 'Create token' : `Edit ${token['name']}`}</h2>
            <p>{(editing === true) ? 'Change its name, what it can do, or when it expires. Its value stays the same.' : 'The token is shown once, right after it\'s created.'}</p>
          </div>
          <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
            <Icon name="x" size={18} />
          </button>
        </div>

        <form noValidate onSubmit={submit}>
          <FieldLabel>
            <span>Name</span>
            <input
              aria-invalid={nameIssue !== ''}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder={appConfig['tokenNamePlaceholder']}
              value={name}
            />
            {(nameIssue === '') ? <small>{'A name you\'ll recognize, like the app that uses it.'}</small> : <small className="field-error">{nameIssue}</small>}
          </FieldLabel>

          <fieldset className="scope-fieldset">
            <legend>Scopes</legend>
            {scopeOptions.map((option) => {
              const allowed: Web_TokenDialog_TokenDialog_Allowed = allowedScopes.includes(option['id']);
              const includedBy: Web_TokenDialog_TokenDialog_IncludedBy = includingScope(scopes, option['id']);
              const endpoints: Web_TokenDialog_TokenDialog_Endpoints = option['endpoints'] ?? [];

              return (
                <label aria-label={option['id']} className="check-row" key={option['id']}>
                  <input
                    checked={includedBy !== undefined || scopes.includes(option['id'])}
                    disabled={(
                      includedBy !== undefined
                      || (
                        allowed === false
                        && scopes.includes(option['id']) === false
                      )
                    )}
                    onChange={() => toggleScope(option)}
                    type="checkbox"
                  />
                  <span>
                    <strong className="mono">{option['id']}</strong>
                    <small>{option['description']}</small>
                    {(option['includes'] === undefined) ? null : <small>{`Includes ${option['includes']}.`}</small>}
                    {(allowed === true) ? null : <small>{'Your role can\'t grant this scope.'}</small>}
                    {(endpoints.length === 0) ? null : (
                      <small className="mono scope-endpoints">
                        {endpoints.map((endpoint) => <span key={endpoint}>{endpoint}</span>)}
                      </small>
                    )}
                  </span>
                </label>
              );
            })}
            {(scopesIssue === '') ? null : <small className="field-error">{scopesIssue}</small>}
          </fieldset>

          <FieldLabel>
            <span>Expires</span>
            <select className="select-control" onChange={(event) => setExpiry(event.currentTarget.value as Web_Components_TokenDialog_Expiry)} value={expiry}>
              {(token !== null && token['expiresAt'] !== null) ? <option value="keep">{`Keep ${formatDate(token['expiresAt'])}`}</option> : null}
              <option value="never">Never</option>
              <option value="30">In 30 days</option>
              <option value="90">In 90 days</option>
              <option value="365">In 1 year</option>
            </select>
          </FieldLabel>

          {(summary === '') ? null : (
            <div className="form-error" role="alert">
              <Icon name="warning" size={16} />
              <span>{summary}</span>
            </div>
          )}

          <div className="dialog-actions">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              disabled={(
                busy === true
                || scopes.length === 0
                || name.trim() === ''
              )}
              type="submit"
              variant="primary"
            >
              {(editing === true) ? 'Save' : 'Create token'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
};
