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
  FormEvent,
  ReactElement,
} from 'react';

import type {
  Web_Api_CreatedToken,
  Web_Api_Scope,
} from '@/types/web/api.d.ts';
import type {
  Web_Components_ScopeOption,
  Web_Components_TokenDialog_Expiry,
  Web_Components_TokenDialog_Props,
} from '@/types/web/components.d.ts';

/**
 * Token Dialog - Scope options.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const scopeOptions: Web_Components_ScopeOption[] = appConfig['tokenScopes'];

// expiryDate turns a choice like "in 90 days" into the timestamp the API stores.

/**
 * Token Dialog - Expiry date.
 *
 * Centralizes this operation for the surrounding workflow.
 * Callers reuse one implementation instead of repeating the behavior.
 *
 * @since 2.0.0
 */
const expiryDate = (expiry: Web_Components_TokenDialog_Expiry): string | null | undefined => {
  if (expiry === 'keep') {
    return undefined;
  }

  if (expiry === 'never') {
    return null;
  }

  return new Date(Date.now() + (Number(expiry) * 24 * 60 * 60 * 1000)).toISOString();
};

/**
 * Token Dialog - Including scope.
 *
 * Finds a selected scope that already grants another configured scope.
 * Included scopes stay checked and disabled until their parent is removed.
 *
 * @param {Web_Api_Scope[]} scopes - Scopes.
 * @param {Web_Api_Scope}   scope  - Scope.
 *
 * @returns {Web_Api_Scope | undefined}
 *
 * @since 2.0.0
 */
const includingScope = (scopes: Web_Api_Scope[], scope: Web_Api_Scope): Web_Api_Scope | undefined => scopeOptions.find(
  (option: Web_Components_ScopeOption): boolean => option['includes'] === scope && scopes.includes(option['id']),
)?.['id'];

/**
 * Token Dialog.
 *
 * Stores this module-level value in one named location.
 * Related code reuses it instead of duplicating the definition.
 *
 * @since 2.0.0
 */
export const TokenDialog = ({
  allowedScopes = scopeOptions.map((option: Web_Components_ScopeOption): Web_Api_Scope => option['id']),
  onClose,
  onCreate,
  onUpdate,
  open,
  token,
}: Web_Components_TokenDialog_Props): ReactElement | null => {
  const [
    name,
    setName,
  ] = useState<string>('');
  const [
    scopes,
    setScopes,
  ] = useState<Web_Api_Scope[]>(appConfig['tokenDefaultScopes']);
  const [
    expiry,
    setExpiry,
  ] = useState<Web_Components_TokenDialog_Expiry>('never');
  const [
    error,
    setError,
  ] = useState<unknown>(null);
  const [
    busy,
    setBusy,
  ] = useState<boolean>(false);
  const [
    createdToken,
    setCreatedToken,
  ] = useState<Web_Api_CreatedToken | null>(null);
  const [
    copied,
    setCopied,
  ] = useState<boolean>(false);

  useEscapeKey(onClose, open);

  useEffect((): void => {
    if (!open) {
      return;
    }

    setName((token === null) ? '' : token['name']);
    setScopes((token === null) ? [...appConfig['tokenDefaultScopes']] : token['scopes']);
    setExpiry((token === null || token['expiresAt'] === null) ? 'never' : 'keep');
    setError(null);
    setCreatedToken(null);
    setCopied(false);
  }, [
    open,
    token,
  ]);

  if (!open) {
    return null;
  }

  const editing: boolean = token !== null;

  /**
   * Token Dialog - Toggles scope.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const toggleScope = (option: Web_Components_ScopeOption): void => {
    setScopes((current: Web_Api_Scope[]): Web_Api_Scope[] => {
      if (current.includes(option['id'])) {
        return current.filter((candidate: Web_Api_Scope): boolean => candidate !== option['id']);
      }

      const included: Web_Api_Scope | undefined = option['includes'];

      if (included === undefined || current.includes(included)) {
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
  };

  /**
   * Token Dialog - Submit.
   *
   * Centralizes this operation for the surrounding workflow.
   * Callers reuse one implementation instead of repeating the behavior.
   *
   * @since 2.0.0
   */
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const orderedScopes: Web_Api_Scope[] = scopeOptions
      .map((option: Web_Components_ScopeOption): Web_Api_Scope => option['id'])
      .filter((scope: Web_Api_Scope): boolean => scopes.includes(scope));
    const expiresAt: string | null | undefined = expiryDate(expiry);

    try {
      if (token === null) {
        const nextToken: Web_Api_CreatedToken = await onCreate({
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
  };

  const nameIssue: string = issueFor(error, 'name');
  const scopesIssue: string = issueFor(error, 'scopes');
  const summary: string = summaryFor(error, [
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
                  onClick={(): void => {
                    void navigator.clipboard.writeText(createdToken['plaintext']).then((): void => setCopied(true)).catch((): void => {
                      showToast('The token could not be copied.', false);
                    });
                  }}
                  title="Copy token"
                  type="button"
                >
                  <Icon name={(copied) ? 'check' : 'copy'} size={16} />
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
            <p>{(editing) ? 'Change its name, what it can do, or when it expires. Its value stays the same.' : 'The token is shown once, right after it\'s created.'}</p>
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
              onChange={(event): void => setName(event.currentTarget.value)}
              placeholder={appConfig['tokenNamePlaceholder']}
              value={name}
            />
            {(nameIssue === '') ? <small>{'A name you\'ll recognize, like the app that uses it.'}</small> : <small className="field-error">{nameIssue}</small>}
          </FieldLabel>

          <fieldset className="scope-fieldset">
            <legend>Scopes</legend>
            {scopeOptions.map((option: Web_Components_ScopeOption): ReactElement => {
              const allowed: boolean = allowedScopes.includes(option['id']);
              const includedBy: Web_Api_Scope | undefined = includingScope(scopes, option['id']);
              const endpoints: string[] = option['endpoints'] ?? [];

              return (
                <label aria-label={option['id']} className="check-row" key={option['id']}>
                  <input
                    checked={includedBy !== undefined || scopes.includes(option['id'])}
                    disabled={includedBy !== undefined || (!allowed && !scopes.includes(option['id']))}
                    onChange={(): void => toggleScope(option)}
                    type="checkbox"
                  />
                  <span>
                    <strong className="mono">{option['id']}</strong>
                    <small>{option['description']}</small>
                    {(option['includes'] === undefined) ? null : <small>{`Includes ${option['includes']}.`}</small>}
                    {(allowed) ? null : <small>{'Your role can\'t grant this scope.'}</small>}
                    {(endpoints.length === 0) ? null : (
                      <small className="mono scope-endpoints">
                        {endpoints.map((endpoint: string): ReactElement => <span key={endpoint}>{endpoint}</span>)}
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
            <select className="select-control" onChange={(event): void => setExpiry(event.currentTarget.value as Web_Components_TokenDialog_Expiry)} value={expiry}>
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
            <Button disabled={busy || scopes.length === 0 || name.trim() === ''} type="submit" variant="primary">
              {(editing) ? 'Save' : 'Create token'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
};
