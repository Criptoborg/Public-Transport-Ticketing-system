import { useEffect, useState } from "react";
import api, { apiError, unwrap } from "../../services/api";
import Notice from "../../components/common/Notice";
import { EmptyState, LoadingState } from "../../components/common/PageStates";
import Sidebar from "../../components/layout/Sidebar";

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return <nav className="pagination" aria-label="Pagination"><button type="button" className="button button-quiet" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="button button-quiet" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button></nav>;
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [state, setState] = useState({ loading: true, error: "", success: "", saving: null });

  const load = () => {
    setState((current) => ({ ...current, loading: true }));
    api.get("/api/admin/users", { params: { page, limit: 20, ...(search ? { search } : {}) } })
      .then((response) => {
        const result = unwrap(response);
        setUsers(result.data || []);
        setPages(result.meta?.pages || 1);
      })
      .catch((error) => setState((current) => ({ ...current, error: apiError(error) })))
      .finally(() => setState((current) => ({ ...current, loading: false })));
  };

  useEffect(() => { load(); }, [page, search]);

  const changeRole = async (user, role) => {
    if (user.role === "admin" && role !== "admin" && !window.confirm(`Demote ${user.name}? Ensure another admin remains available.`)) return;
    setState((current) => ({ ...current, saving: user._id, error: "", success: "" }));
    try {
      const response = unwrap(await api.patch(`/api/admin/users/${user._id}/role`, { role }));
      setState((current) => ({ ...current, saving: null, success: response.message }));
      load();
    } catch (error) {
      setState((current) => ({ ...current, saving: null, error: apiError(error) }));
    }
  };

  return (
    <div className="admin-layout"><Sidebar /><main className="admin-content page-shell">
      <div className="page-title"><div><p className="eyebrow">ACCESS MANAGEMENT</p><h1>Users</h1></div></div>
      <Notice type="success">{state.success}</Notice>
      <Notice>{state.error}</Notice>
      <div className="user-toolbar">
        <input aria-label="Search users" placeholder="Search name or email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <span>{users.length} shown</span>
      </div>
      {state.loading ? <LoadingState label="Loading users..." /> : users.length ? (
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Change role</th></tr></thead><tbody>
          {users.map((user) => <tr key={user._id}>
            <td>{user.name}</td><td>{user.email}</td><td><span className={`status status-${user.role}`}>{user.role}</span></td><td>{new Date(user.createdAt).toLocaleDateString()}</td>
            <td><select aria-label={`Change role for ${user.name}`} value={user.role} disabled={state.saving === user._id} onChange={(event) => changeRole(user, event.target.value)}>{["passenger", "conductor", "admin"].map((role) => <option value={role} key={role}>{role}</option>)}</select></td>
          </tr>)}
        </tbody></table></div>
      ) : <EmptyState title="No users found">Try a different search.</EmptyState>}
      {!state.loading && <Pagination page={page} pages={pages} onChange={setPage} />}
    </main></div>
  );
}
