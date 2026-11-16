import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { setToken } from '../../portal';
import Modal from '../../components/Modal';
import PasswordField, { passwordProblem } from '../../components/PasswordField';
import {
  Activity, Users, ScrollText, AlertTriangle, LogOut, ExternalLink, RefreshCw, Search, Plus, KeyRound, UserCog, Power, Eye, Terminal,
} from 'lucide-react';

const ROLES = ['student', 'warden', 'admin', 'security', 'developer'];
const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—');
const errMsg = (err, fallback) => err.response?.data?.message || fallback;

// Opens a portal in a new tab with the given token. It replaces any sign-in
// that portal already had in this browser.
const openPortal = (portal, token) => {
  // localStorage: a new tab doesn't share this tab's sessionStorage.
  setToken(token, portal, true);
  window.open(`/${portal}/`, '_blank', 'noopener');
};

const Card = ({ title, children, action }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
    {(title || action) && (
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
    )}
    {children}
  </div>
);

const Stat = ({ label, value, tone = 'text-slate-800' }) => (
  <div className="bg-slate-50 rounded-xl p-4">
    <p className="text-xs text-slate-500">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
  </div>
);

const Pager = ({ page, pages, onPage }) => (pages > 1 ? (
  <div className="flex items-center justify-end gap-2 mt-4 text-sm">
    <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40">Previous</button>
    <span className="text-slate-500">Page {page} of {pages}</span>
    <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40">Next</button>
  </div>
) : null);

// Dangerous actions must be confirmed by typing the account's email.
const ConfirmModal = ({ title, user, children, confirmLabel, onConfirm, onClose, extraValid = true }) => {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = typed.trim().toLowerCase() === user.email.toLowerCase() && extraValid;
  const run = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(errMsg(err, 'That did not work.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={run} className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
        {children}
        <div>
          <label className="block text-sm text-slate-600 mb-1">Type <b>{user.email}</b> to confirm</label>
          <input className={inputCls} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={!ok || busy} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-medium py-2.5 rounded-xl">
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const Overview = ({ me }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    api.get('/developer/overview').then((r) => setData(r.data)).catch((err) => setError(errMsg(err, 'Could not load the overview.')));
  }, []);
  useEffect(load, [load]);

  const [opening, setOpening] = useState('');
  const open = async (portal) => {
    setOpening(portal);
    try {
      const res = await api.post('/developer/portal-token', { portal });
      openPortal(res.data.portal, res.data.token);
    } catch (err) {
      setError(errMsg(err, 'Could not open that portal.'));
    } finally {
      setOpening('');
    }
  };

  return (
    <div className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
      <Card title="Open a portal with full rights" action={<span className="text-xs text-slate-400">Signed in as {me.email}</span>}>
        <p className="text-sm text-slate-500 mb-4">Opens in a new tab as you (with admin powers). It replaces any sign-in that portal had in this browser. Everything you change is recorded in the audit log.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[['staff', 'Staff portal'], ['student', 'Student portal'], ['gate', 'Gate portal']].map(([p, label]) => (
            <button key={p} onClick={() => open(p)} disabled={opening === p} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
              <ExternalLink size={16} /> {opening === p ? 'Opening...' : label}
            </button>
          ))}
        </div>
      </Card>
      {data && (
        <>
          <Card title="Health" action={<button onClick={load} className="text-slate-500 hover:text-indigo-600" aria-label="Refresh"><RefreshCw size={16} /></button>}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Database" value={data.database.ok ? `OK · ${data.database.latency_ms} ms` : 'DOWN'} tone={data.database.ok ? 'text-green-600' : 'text-red-600'} />
              <Stat label="Server uptime" value={`${Math.floor(data.server.uptime_seconds / 3600)}h ${Math.floor((data.server.uptime_seconds % 3600) / 60)}m`} />
              <Stat label="Errors (24 h)" value={data.last_24h.server_errors} tone={data.last_24h.server_errors ? 'text-red-600' : 'text-slate-800'} />
              <Stat label="Developer actions (24 h)" value={data.last_24h.developer_actions} />
            </div>
            <p className="text-xs text-slate-400 mt-3">Node {data.server.node} · {data.server.environment} · server time {when(data.server.time)}</p>
            {data.database.error && <p className="text-xs text-red-600 mt-1">{data.database.error}</p>}
          </Card>
          <Card title="Active accounts">
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {Object.entries(data.users.active_by_role).map(([role, n]) => <Stat key={role} label={role} value={n} />)}
              <Stat label="inactive" value={data.users.inactive} tone="text-slate-500" />
            </div>
          </Card>
          <Card title="Open items">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Outpasses" value={data.open.outpasses} />
              <Stat label="Complaints" value={data.open.complaints} />
              <Stat label="SOS alerts" value={data.open.sos} tone={data.open.sos ? 'text-red-600' : 'text-slate-800'} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

const UsersPanel = ({ me }) => {
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pages: 1, total: 0 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(() => {
    const params = { page, limit: 25 };
    for (const k of ['search', 'role', 'status']) if (filters[k]) params[k] = filters[k];
    api.get('/developer/users', { params }).then((r) => setResult(r.data)).catch((err) => setError(errMsg(err, 'Could not load users.')));
  }, [filters, page]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const setFilter = (k, v) => { setPage(1); setFilters((f) => ({ ...f, [k]: v })); };
  const done = (msg) => { setNotice(msg); load(); };

  return (
    <Card title={`Users (${result.total})`} action={<button onClick={() => setModal({ kind: 'create' })} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-sm"><Plus size={16} /> New user</button>}>
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-3">{error}</div>}
      {notice && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 mb-3">{notice}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <div className="relative sm:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} pl-9`} placeholder="Name, email or roll number" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} />
        </div>
        <select className={inputCls} value={filters.role} onChange={(e) => setFilter('role', e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className={inputCls} value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Email</th>
              <th className="py-2 pr-3 font-medium">Role</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((u) => {
              const self = u._id === me._id;
              return (
                <tr key={u._id} className="border-b border-slate-50">
                  <td className="py-2.5 pr-3 text-slate-800">{u.name}{u.roll_no ? <span className="text-slate-400"> · {u.roll_no}</span> : null}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{u.email}</td>
                  <td className="py-2.5 pr-3"><span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs">{u.role}</span></td>
                  <td className="py-2.5 pr-3">{u.is_active === false ? <span className="text-slate-400">Inactive</span> : <span className="text-green-600">Active</span>}</td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1">
                      <button title="Edit" onClick={() => setModal({ kind: 'edit', user: u })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><UserCog size={16} /></button>
                      <button title="Reset password" onClick={() => setModal({ kind: 'password', user: u })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><KeyRound size={16} /></button>
                      {!self && <button title={u.is_active === false ? 'Activate' : 'Deactivate'} onClick={() => setModal({ kind: 'active', user: u })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><Power size={16} /></button>}
                      {!self && u.role !== 'developer' && u.is_active !== false && <button title="Open as this user" onClick={() => setModal({ kind: 'impersonate', user: u })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><Eye size={16} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!result.items.length && <tr><td colSpan={5} className="py-8 text-center text-slate-400">No users match.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={result.page || page} pages={result.pages} onPage={setPage} />

      {modal?.kind === 'create' && <CreateUserModal onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === 'edit' && <EditUserModal user={modal.user} self={modal.user._id === me._id} onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === 'password' && <PasswordModal user={modal.user} onClose={() => setModal(null)} onDone={done} />}
      {modal?.kind === 'active' && (
        <ConfirmModal
          title={modal.user.is_active === false ? 'Activate account' : 'Deactivate account'}
          user={modal.user}
          confirmLabel={modal.user.is_active === false ? 'Activate' : 'Deactivate'}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await api.patch(`/developer/users/${modal.user._id}`, { is_active: modal.user.is_active === false });
            done(`${modal.user.name} is now ${modal.user.is_active === false ? 'active' : 'inactive'}.`);
          }}
        >
          <p className="text-sm text-slate-600">{modal.user.is_active === false ? 'They will be able to sign in again.' : 'They will be signed out and cannot sign in until activated again.'}</p>
        </ConfirmModal>
      )}
      {modal?.kind === 'impersonate' && (
        <ConfirmModal
          title="Open as this user"
          user={modal.user}
          confirmLabel="Open their portal"
          onClose={() => setModal(null)}
          onConfirm={async () => {
            const res = await api.post('/developer/impersonate', { user_id: modal.user._id });
            openPortal(res.data.portal, res.data.token);
            done(`Opened the ${res.data.portal} portal as ${modal.user.name} (valid for 1 hour, only on this computer).`);
          }}
        >
          <p className="text-sm text-slate-600">Opens their portal in a new tab, seeing exactly what {modal.user.name} sees. Anything you do there is done as them and recorded in the audit log.</p>
        </ConfirmModal>
      )}
    </Card>
  );
};

const CreateUserModal = ({ onClose, onDone }) => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'warden', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const problem = passwordProblem(form.password);
    if (problem) return setError(`Password: ${problem}`);
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/developer/users', form);
      onDone(`Created ${res.data.role} account for ${res.data.name}.`);
      onClose();
    } catch (err) {
      setError(errMsg(err, 'Could not create the account.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="New user" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
        <input className={inputCls} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className={inputCls} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className={inputCls} placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <PasswordField id="dev-new-pw" label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} showStrength />
        <button type="submit" disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl">{busy ? 'Creating...' : 'Create account'}</button>
      </form>
    </Modal>
  );
};

const EditUserModal = ({ user, self, onClose, onDone }) => {
  const [form, setForm] = useState({ name: user.name || '', email: user.email || '', phone: user.phone || '', role: user.role });
  const [confirming, setConfirming] = useState(false);
  const roleChanged = form.role !== user.role;
  const save = async () => {
    const body = { name: form.name, email: form.email, phone: form.phone };
    if (roleChanged) body.role = form.role;
    await api.patch(`/developer/users/${user._id}`, body);
    onDone(`Saved ${form.name}.`);
  };
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    // Changing someone's role changes what they can do: confirm it.
    if (roleChanged) return setConfirming(true);
    try {
      await save();
      onClose();
    } catch (err) {
      setError(errMsg(err, 'Could not save.'));
    }
  };
  if (confirming) {
    return (
      <ConfirmModal title="Change role" user={user} confirmLabel={`Make ${form.role}`} onClose={onClose} onConfirm={save}>
        <p className="text-sm text-slate-600">{user.name} will change from <b>{user.role}</b> to <b>{form.role}</b> and will have to sign in to the {form.role === 'student' ? 'student' : form.role === 'security' ? 'gate' : form.role === 'developer' ? 'developer' : 'staff'} portal from now on.</p>
      </ConfirmModal>
    );
  }
  return (
    <Modal title={`Edit ${user.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
        <input className={inputCls} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className={inputCls} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className={inputCls} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <select className={inputCls} value={form.role} disabled={self} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {self && <p className="text-xs text-slate-400">You can't change your own role.</p>}
        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl">Save</button>
      </form>
    </Modal>
  );
};

const PasswordModal = ({ user, onClose, onDone }) => {
  const [password, setPassword] = useState('');
  return (
    <ConfirmModal
      title={`Reset password for ${user.name}`}
      user={user}
      confirmLabel="Reset password"
      extraValid={!passwordProblem(password)}
      onClose={onClose}
      onConfirm={async () => {
        const res = await api.put(`/developer/users/${user._id}/password`, { password });
        onDone(res.data.message);
      }}
    >
      <PasswordField id="dev-reset-pw" label="New password" value={password} onChange={setPassword} showStrength />
      <p className="text-xs text-slate-500">They will be signed out on every device.</p>
    </ConfirmModal>
  );
};

const LogTable = ({ url, columns, empty }) => {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pages: 1 });
  const [error, setError] = useState('');
  const load = useCallback(() => {
    api.get(url, { params: { page, limit: 50 } }).then((r) => setResult(r.data)).catch((err) => setError(errMsg(err, 'Could not load.')));
  }, [url, page]);
  useEffect(load, [load]);
  return (
    <>
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-3">{error}</div>}
      <div className="flex justify-end mb-2"><button onClick={load} className="text-slate-500 hover:text-indigo-600" aria-label="Refresh"><RefreshCw size={16} /></button></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              {columns.map(([label]) => <th key={label} className="py-2 pr-3 font-medium">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {result.items.map((row) => (
              <tr key={row._id || row.id || row.ref} className="border-b border-slate-50 align-top">
                {columns.map(([label, render]) => <td key={label} className="py-2.5 pr-3 text-slate-700 break-words max-w-xs">{render(row)}</td>)}
              </tr>
            ))}
            {!result.items.length && <tr><td colSpan={columns.length} className="py-8 text-center text-slate-400">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={result.page || page} pages={result.pages} onPage={setPage} />
    </>
  );
};

const AUDIT_COLUMNS = [
  ['When', (r) => when(r.created_at)],
  ['Developer', (r) => r.developer?.name || '—'],
  ['As', (r) => (r.acting_as ? `${r.acting_as.name} (${r.acting_as.role})` : '—')],
  ['Action', (r) => <span className="font-mono text-xs">{r.action}</span>],
  ['Target', (r) => <span className="font-mono text-xs">{r.target || '—'}</span>],
  ['Result', (r) => <span className={r.status >= 400 ? 'text-red-600' : 'text-green-600'}>{r.status ?? '—'}</span>],
];

const ERROR_COLUMNS = [
  ['When', (r) => when(r.created_at)],
  ['Ref', (r) => <span className="font-mono text-xs">{r.ref}</span>],
  ['Request', (r) => <span className="font-mono text-xs">{r.method} {r.path}</span>],
  ['Detail', (r) => <span className="font-mono text-xs text-red-700">{r.detail}</span>],
];

const TABS = [
  ['overview', 'Overview', Activity],
  ['users', 'Users', Users],
  ['audit', 'Audit log', ScrollText],
  ['errors', 'Server errors', AlertTriangle],
];

const DevConsole = () => {
  const { logout } = useAuth();
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/developer/me').then((r) => setMe(r.data)).catch((err) => setError(errMsg(err, 'This console only works on the developer\'s own computer.')));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-md text-center space-y-4">
          <p className="text-slate-700">{error}</p>
          <button onClick={logout} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm">Sign out</button>
        </div>
      </div>
    );
  }
  if (!me) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-semibold"><Terminal size={20} className="text-indigo-600" /> Developer console</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-slate-500">{me.name}</span>
            <button onClick={logout} className="flex items-center gap-1.5 text-slate-600 hover:text-red-600"><LogOut size={16} /> Sign out</button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm whitespace-nowrap ${tab === key ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
        {tab === 'overview' && <Overview me={me} />}
        {tab === 'users' && <UsersPanel me={me} />}
        {tab === 'audit' && <Card title="Audit log"><LogTable url="/developer/audit" columns={AUDIT_COLUMNS} empty="No developer actions yet." /></Card>}
        {tab === 'errors' && <Card title="Server errors"><LogTable url="/developer/errors" columns={ERROR_COLUMNS} empty="No server errors recorded." /></Card>}
      </main>
    </div>
  );
};

export default DevConsole;
