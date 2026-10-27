import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { apiError, unwrap } from "../../services/api";
import Notice from "../../components/common/Notice";
import StatusBadge from "../../components/common/StatusBadge";
import Sidebar from "../../components/layout/Sidebar";
import { EmptyState, LoadingState } from "../../components/common/PageStates";

const money = (value) => `₦${Number(value || 0).toLocaleString()}`;
const date = (value) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return <nav className="pagination" aria-label="Pagination"><button type="button" className="button button-quiet" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="button button-quiet" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button></nav>;
}

function AdminPageLayout({ eyebrow, title, children }) {
  return <div className="admin-layout"><Sidebar /><main className="admin-content page-shell"><div className="page-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div></div>{children}</main></div>;
}

function BookingsChart({ data = [] }) {
  const width = 720;
  const height = 250;
  const padding = { top: 16, right: 16, bottom: 30, left: 32 };
  const maximum = Math.max(1, ...data.map((item) => item.bookings));
  const denominator = Math.max(data.length - 1, 1);
  const points = data.map((item, index) => {
    const x = padding.left + index / denominator * (width - padding.left - padding.right);
    const y = padding.top + (1 - item.bookings / maximum) * (height - padding.top - padding.bottom);
    return `${x},${y}`;
  }).join(" ");
  const labelIndexes = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);
  return <div className="chart-container"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bookings per day over the last 30 days" preserveAspectRatio="none">
    {[0, 0.5, 1].map((fraction) => {
      const y = padding.top + fraction * (height - padding.top - padding.bottom);
      return <line key={fraction} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#d9e2ec" strokeDasharray="4 4" />;
    })}
    <polyline points={points} fill="none" stroke="#147d72" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    {data.map((item, index) => labelIndexes.has(index) ? <text key={item.date} x={padding.left + index / denominator * (width - padding.left - padding.right)} y={height - 6} textAnchor="middle" fill="#64748b" fontSize="11">{item.date.slice(5)}</text> : null)}
  </svg></div>;
}

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  useEffect(() => {
    Promise.all([api.get("/api/admin/stats", { params: { days: 30 } }), api.get("/api/admin/refunds/attention")])
      .then(([statsResponse, refundResponse]) => {
        setStats(unwrap(statsResponse).data);
        setRefunds(unwrap(refundResponse).data || []);
      })
      .catch((error) => setState({ loading: false, error: apiError(error) }))
      .finally(() => setState((current) => ({ ...current, loading: false })));
  }, []);
  return <AdminPageLayout eyebrow="OPERATIONS" title="Control room">
    <Notice>{state.error}</Notice>
    {state.loading ? <LoadingState label="Loading operations..." /> : stats && <>
      <section className="admin-grid admin-kpis">
        {[["Net revenue", money(stats.totalRevenue)], ["Tickets sold", stats.ticketsSold], ["Active", stats.ticketsByStatus?.active || 0], ["Refunds needing attention", refunds.length]].map(([label, value]) => <div className="admin-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </section>
      <section className="admin-analytics-grid">
        <div className="admin-report-section"><h2>Bookings · last 30 days</h2><BookingsChart data={stats.bookingsPerDay} /></div>
        <div className="admin-report-section"><h2>Refunds needing attention</h2>{refunds.length ? <div className="admin-list">{refunds.map((ticket) => <Link className="admin-row" to="/admin/tickets" key={ticket._id}><strong>{ticket.ticketReference}</strong><span>{ticket.user?.email} · {money(ticket.amount)}</span></Link>)}</div> : <EmptyState title="No failed refunds">Manual follow-up will appear here.</EmptyState>}</div>
      </section>
      <section className="admin-report-section"><h2>Top routes</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Route</th><th>Tickets sold</th><th>Net revenue</th><th>Average seat fill</th></tr></thead><tbody>{stats.topRoutes.map((route) => <tr key={route._id}><td>{route.origin} → {route.destination}</td><td>{route.ticketsSold}</td><td>{money(route.revenue)}</td><td>{route.averageSeatFillRate}%</td></tr>)}</tbody></table></div></section>
    </>}
  </AdminPageLayout>;
}

const blankRoute = { origin: "", destination: "", status: "active", originLatitude: "", originLongitude: "", destinationLatitude: "", destinationLongitude: "" };

export function AdminRoutes() {
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState(blankRoute);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [state, setState] = useState({ loading: true, saving: false, error: "", success: "" });
  const load = (currentPage = page) => api.get("/api/routes", { params: { page: currentPage, limit: 20 } })
    .then((response) => { const result = unwrap(response); setRoutes(result.data || []); setPages(result.meta?.pages || 1); })
    .catch((error) => setState((current) => ({ ...current, error: apiError(error) })))
    .finally(() => setState((current) => ({ ...current, loading: false })));
  useEffect(() => { load(); }, [page]);
  const submit = async (event) => {
    event.preventDefault();
    setState((current) => ({ ...current, saving: true, error: "", success: "" }));
    const body = { origin: form.origin, destination: form.destination, status: form.status, originCoordinates: { latitude: Number(form.originLatitude), longitude: Number(form.originLongitude) }, destinationCoordinates: { latitude: Number(form.destinationLatitude), longitude: Number(form.destinationLongitude) } };
    try {
      const response = editing ? await api.put(`/api/routes/${editing}`, body) : await api.post("/api/routes", body);
      setState((current) => ({ ...current, saving: false, success: unwrap(response).message }));
      setForm(blankRoute); setEditing(null); load();
    } catch (error) { setState((current) => ({ ...current, saving: false, error: apiError(error) })); }
  };
  const remove = async (id) => { if (!window.confirm("Delete this route?")) return; try { await api.delete(`/api/routes/${id}`); load(); } catch (error) { setState((current) => ({ ...current, error: apiError(error) })); } };
  const edit = (route) => { setEditing(route._id); setForm({ origin: route.origin, destination: route.destination, status: route.status, originLatitude: route.originCoordinates?.latitude ?? "", originLongitude: route.originCoordinates?.longitude ?? "", destinationLatitude: route.destinationCoordinates?.latitude ?? "", destinationLongitude: route.destinationCoordinates?.longitude ?? "" }); };
  return <AdminPageLayout eyebrow="NETWORK DESIGN" title="Routes"><Notice type="success">{state.success}</Notice><Notice>{state.error}</Notice><div className="admin-two-col">
    <form className="admin-form" onSubmit={submit}><h2>{editing ? "Edit route" : "Create route"}</h2>
      <label className="field"><span>Origin</span><input required value={form.origin} onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))} /></label>
      <label className="field"><span>Destination</span><input required value={form.destination} onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))} /></label>
      {[["Origin latitude", "originLatitude"], ["Origin longitude", "originLongitude"], ["Destination latitude", "destinationLatitude"], ["Destination longitude", "destinationLongitude"]].map(([label, key]) => <label className="field" key={key}><span>{label}</span><input type="number" step="any" required value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
      <button type="submit" className="button button-primary" disabled={state.saving}>{state.saving ? "Saving..." : editing ? "Update route" : "Calculate and create"}</button>
      {editing && <button type="button" className="button button-quiet" onClick={() => { setEditing(null); setForm(blankRoute); }}>Cancel edit</button>}
    </form>
    <div className="admin-list">{state.loading ? <LoadingState label="Loading routes..." /> : routes.length ? routes.map((route) => <article className="admin-row" key={route._id}><div><strong>{route.origin} → {route.destination}</strong><span>{route.distanceKm ? `${route.distanceKm} km · ` : ""}{money(route.fare)}</span></div><div className="row-actions"><StatusBadge value={route.status} /><button type="button" onClick={() => edit(route)}>Edit</button><button type="button" onClick={() => remove(route._id)}>Delete</button></div></article>) : <EmptyState title="No routes yet">Create a route to get started.</EmptyState>}<Pagination page={page} pages={pages} onChange={setPage} /></div>
  </div></AdminPageLayout>;
}

const blankTrip = { route: "", departureTime: "", arrivalTime: "", availableSeats: "", status: "scheduled" };

export function AdminTrips() {
  const [routes, setRoutes] = useState([]); const [trips, setTrips] = useState([]); const [form, setForm] = useState(blankTrip); const [editing, setEditing] = useState(null); const [page, setPage] = useState(1); const [pages, setPages] = useState(1);
  const [state, setState] = useState({ loading: true, saving: false, error: "", success: "" });
  const load = (currentPage = page) => Promise.all([api.get("/api/routes", { params: { limit: 100 } }), api.get("/api/trips", { params: { page: currentPage, limit: 20 } })])
    .then(([routeResponse, tripResponse]) => { setRoutes(unwrap(routeResponse).data || []); const result = unwrap(tripResponse); setTrips(result.data || []); setPages(result.meta?.pages || 1); })
    .catch((error) => setState((current) => ({ ...current, error: apiError(error) })))
    .finally(() => setState((current) => ({ ...current, loading: false })));
  useEffect(() => { load(); }, [page]);
  const submit = async (event) => {
    event.preventDefault(); setState((current) => ({ ...current, saving: true, error: "", success: "" }));
    try { const response = editing ? await api.put(`/api/trips/${editing}`, { ...form, availableSeats: Number(form.availableSeats) }) : await api.post("/api/trips", { ...form, availableSeats: Number(form.availableSeats) }); setState((current) => ({ ...current, saving: false, success: unwrap(response).message })); setForm(blankTrip); setEditing(null); load(); }
    catch (error) { setState((current) => ({ ...current, saving: false, error: apiError(error) })); }
  };
  const cancel = async (trip) => { if (!window.confirm("Cancel this trip? Active tickets will be cancelled and paid tickets will have refunds initiated. Seats will not be restored.")) return; try { const response = await api.put(`/api/trips/${trip._id}`, { status: "cancelled" }); setState((current) => ({ ...current, success: unwrap(response).message })); load(); } catch (error) { setState((current) => ({ ...current, error: apiError(error) })); } };
  const remove = async (id) => { if (!window.confirm("Delete this trip?")) return; try { await api.delete(`/api/trips/${id}`); load(); } catch (error) { setState((current) => ({ ...current, error: apiError(error) })); } };
  const edit = (trip) => { setEditing(trip._id); setForm({ route: trip.route?._id || "", departureTime: trip.departureTime?.slice(0, 16), arrivalTime: trip.arrivalTime?.slice(0, 16), availableSeats: trip.availableSeats, status: trip.status }); };
  return <AdminPageLayout eyebrow="SCHEDULES" title="Trips"><Notice type="success">{state.success}</Notice><Notice>{state.error}</Notice><div className="admin-two-col">
    <form className="admin-form" onSubmit={submit}><h2>{editing ? "Edit trip" : "Schedule a trip"}</h2>
      <label className="field"><span>Route</span><select required value={form.route} onChange={(event) => setForm((current) => ({ ...current, route: event.target.value }))}><option value="">Select route</option>{routes.map((route) => <option value={route._id} key={route._id}>{route.origin} → {route.destination}</option>)}</select></label>
      <label className="field"><span>Departure</span><input type="datetime-local" required value={form.departureTime} onChange={(event) => setForm((current) => ({ ...current, departureTime: event.target.value }))} /></label>
      <label className="field"><span>Arrival</span><input type="datetime-local" required value={form.arrivalTime} onChange={(event) => setForm((current) => ({ ...current, arrivalTime: event.target.value }))} /></label>
      <label className="field"><span>Total seats</span><input type="number" min="0" required value={form.availableSeats} onChange={(event) => setForm((current) => ({ ...current, availableSeats: event.target.value }))} /></label>
      <label className="field"><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="scheduled">scheduled</option><option value="completed">completed</option><option value="cancelled">cancelled</option></select></label>
      <button type="submit" className="button button-primary" disabled={state.saving}>{state.saving ? "Saving..." : editing ? "Update trip" : "Create trip"}</button>{editing && <button type="button" className="button button-quiet" onClick={() => { setEditing(null); setForm(blankTrip); }}>Cancel edit</button>}
    </form>
    <div className="admin-list">{state.loading ? <LoadingState label="Loading trips..." /> : trips.length ? trips.map((trip) => <article className="admin-row" key={trip._id}><div><strong>{trip.route?.origin} → {trip.route?.destination}</strong><span>{date(trip.departureTime)} · {Math.max(0, (trip.totalSeats ?? trip.availableSeats) - trip.availableSeats)} sold / {trip.totalSeats ?? trip.availableSeats} seats · {money(trip.route?.fare)}</span></div><div className="row-actions"><StatusBadge value={trip.status} /><button type="button" onClick={() => edit(trip)}>Edit</button><button type="button" onClick={() => remove(trip._id)}>Delete</button>{trip.status === "scheduled" && <button type="button" onClick={() => cancel(trip)}>Cancel trip</button>}</div></article>) : <EmptyState title="No trips scheduled">Schedule a trip for passengers.</EmptyState>}<Pagination page={page} pages={pages} onChange={setPage} /></div>
  </div></AdminPageLayout>;
}

export function AdminTickets() {
  const [tickets, setTickets] = useState([]); const [routes, setRoutes] = useState([]); const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [filters, setFilters] = useState({ status: "", paymentStatus: "", route: "", startDate: "", endDate: "", search: "" }); const [state, setState] = useState({ loading: true, error: "" });
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  const load = (currentPage = page) => api.get("/api/admin/tickets", { params: { ...params, page: currentPage, limit: 20 } }).then((response) => { const result = unwrap(response); setTickets(result.data || []); setPages(result.meta?.pages || 1); }).catch((error) => setState((current) => ({ ...current, error: apiError(error) }))).finally(() => setState((current) => ({ ...current, loading: false })));
  useEffect(() => { load(); }, [page, filters]);
  useEffect(() => { api.get("/api/routes", { params: { limit: 100 } }).then((response) => setRoutes(unwrap(response).data || [])); }, []);
  const updateFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const update = async (id, status) => { try { await api.patch(`/api/admin/tickets/${id}/status`, { status }); load(); } catch (error) { setState((current) => ({ ...current, error: apiError(error) })); } };
  const exportCsv = async () => { try { const response = await api.get("/api/admin/tickets/export.csv", { params, responseType: "blob" }); const url = URL.createObjectURL(response.data); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "routely-tickets.csv"; anchor.click(); URL.revokeObjectURL(url); } catch (error) { setState((current) => ({ ...current, error: apiError(error) })); } };
  return <AdminPageLayout eyebrow="BOOKING OPERATIONS" title="Issued tickets"><Notice>{state.error}</Notice><div className="ticket-filters"><input aria-label="Search ticket reference or passenger email" placeholder="Reference or email" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} /><select aria-label="Ticket status filter" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">All ticket statuses</option>{["pending", "active", "used", "cancelled", "expired"].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Payment status filter" value={filters.paymentStatus} onChange={(event) => updateFilter("paymentStatus", event.target.value)}><option value="">All payment statuses</option>{["unpaid", "paid", "refunded", "refund_pending", "refund_failed"].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Route filter" value={filters.route} onChange={(event) => updateFilter("route", event.target.value)}><option value="">All routes</option>{routes.map((route) => <option value={route._id} key={route._id}>{route.origin} → {route.destination}</option>)}</select><label className="field"><span>From</span><input type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} /></label><label className="field"><span>To</span><input type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} /></label><button type="button" className="button button-quiet" onClick={exportCsv}>Export CSV</button></div>
    {state.loading ? <LoadingState label="Loading issued tickets..." /> : tickets.length ? <div className="admin-list">{tickets.map((ticket) => <article className="admin-row" key={ticket._id}><div><strong>{ticket.ticketReference}</strong><span>{ticket.user?.name} · {ticket.trip?.route?.origin} → {ticket.trip?.route?.destination} · {money(ticket.amount)} · Payment: {ticket.paymentStatus || "paid"}</span></div><select aria-label={`Ticket status for ${ticket.ticketReference}`} value={ticket.status} onChange={(event) => update(ticket._id, event.target.value)}><option value="active">active</option><option value="used">used</option><option value="cancelled">cancelled</option></select></article>)}</div> : <EmptyState title="No tickets match these filters">Adjust filters or clear your search.</EmptyState>}<Pagination page={page} pages={pages} onChange={setPage} />
  </AdminPageLayout>;
}
