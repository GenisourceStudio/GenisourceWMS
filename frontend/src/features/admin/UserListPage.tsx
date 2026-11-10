import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../shared/api/http'
import {
  fetchUsers, createUser, updateUser, changeUserPassword,
  type UserAccount,
} from '../../shared/api/users'
import { Icon, EmptyState, TableSkeleton } from '../../shared/ui/Icon'
import { Select } from '../../shared/ui/Select'

/** C2: create operators, change passwords, disable accounts. */
export function UserListPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<UserAccount | null>(null)
  const [passwordFor, setPasswordFor] = useState<UserAccount | null>(null)

  const users = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t('nav.users')}</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          {t('users.create')}
        </button>
      </div>

      <section className="panel panel-flush">
        {users.isLoading ? (
          <TableSkeleton cols={5} rows={3} />
        ) : users.isError ? (
          <EmptyState
            tone="error"
            icon="alert"
            title={t('common.loadFailed')}
            note={users.error instanceof ApiError ? users.error.message : t('common.networkError')}
          />
        ) : users.data && users.data.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('users.username')}</th>
                <th scope="col">{t('users.displayName')}</th>
                <th scope="col">{t('users.role')}</th>
                <th scope="col">{t('sku.colStatus')}</th>
                <th scope="col">{t('users.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((user) => (
                <tr key={user.id}>
                  <td className="mono cell-code">{user.username}</td>
                  <td>{user.displayName}</td>
                  <td>
                    <span className={user.roles.includes('ADMIN') ? 'status status-done' : 'status status-draft'}>
                      {user.roles.includes('ADMIN') ? t('users.admin') : t('users.operator')}
                    </span>
                  </td>
                  <td>
                    <span className={user.enabled ? 'status status-ongoing' : 'status status-draft'}>
                      {user.enabled ? t('sku.active') : t('sku.inactive')}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="text-link" onClick={() => setEditing(user)}>
                        {t('users.edit')}
                      </button>
                      <button type="button" className="text-link" onClick={() => setPasswordFor(user)}>
                        {t('users.changePassword')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon="user" title={t('common.empty')} note={t('users.emptyNote')} />
        )}
      </section>

      {creating && (
        <UserDrawer
          onClose={() => setCreating(false)}
          onSaved={async () => { setCreating(false); await refresh() }}
        />
      )}
      {editing && (
        <UserDrawer
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refresh() }}
        />
      )}
      {passwordFor && (
        <PasswordDrawer user={passwordFor} onClose={() => setPasswordFor(null)} />
      )}
    </>
  )
}

function UserDrawer({
  user,
  onClose,
  onSaved,
}: {
  user?: UserAccount
  onClose: () => void
  onSaved: () => Promise<void> | void
}) {
  const { t } = useTranslation()
  const [username, setUsername] = useState(user?.username ?? '')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [roleCode, setRoleCode] = useState(user?.roles.includes('ADMIN') ? 'ADMIN' : 'OPERATOR')
  const [enabled, setEnabled] = useState(user?.enabled ?? true)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      if (user) {
        return updateUser(user.id, { displayName, enabled, roleCode })
      }
      return createUser({ username, password, displayName, roleCode })
    },
    onSuccess: async () => { await onSaved() },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('common.networkError')),
  })

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 className="drawer-title">{user ? t('users.edit') : t('users.create')}</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <form className="drawer-body" onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate() }}>
          <label className="field">
            <span className="field-label">{t('users.username')}</span>
            <input
              className="field-input mono"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              readOnly={Boolean(user)}
              required
              minLength={3}
            />
            {user && <span className="field-hint">{t('users.usernameLocked')}</span>}
          </label>

          {!user && (
            <label className="field">
              <span className="field-label">{t('login.password')}</span>
              <input
                className="field-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
          )}

          <label className="field">
            <span className="field-label">{t('users.displayName')}</span>
            <input className="field-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>

          <label className="field">
            <span className="field-label">{t('users.role')}</span>
            <Select
              value={roleCode}
              onChange={setRoleCode}
              options={[
                { value: 'OPERATOR', label: t('users.operator') },
                { value: 'ADMIN', label: t('users.admin') },
              ]}
            />
          </label>

          {user && (
            <label className="field field-inline">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span>{t('users.enabledLabel')}</span>
            </label>
          )}

          {error && <p className="field-error" role="alert">{error}</p>}

          <div className="drawer-foot">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

function PasswordDrawer({ user, onClose }: { user: UserAccount; onClose: () => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const mutation = useMutation({
    mutationFn: () => changeUserPassword(user.id, password),
    onSuccess: () => setDone(true),
    onError: (err) => setError(err instanceof ApiError ? err.message : t('common.networkError')),
  })

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 className="drawer-title">{t('users.changePassword')} · <span className="mono">{user.username}</span></h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <form className="drawer-body" onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate() }}>
          {done ? (
            <>
              <p className="drawer-success"><Icon name="check" size={18} />{t('users.passwordChanged')}</p>
              <div className="drawer-foot">
                <button type="button" className="btn btn-primary" onClick={onClose}>{t('common.close')}</button>
              </div>
            </>
          ) : (
            <>
              <label className="field">
                <span className="field-label">{t('users.newPassword')}</span>
                <input
                  className="field-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                />
              </label>
              {error && <p className="field-error" role="alert">{error}</p>}
              <div className="drawer-foot">
                <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
                  {mutation.isPending ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </>
          )}
        </form>
      </aside>
    </div>
  )
}
