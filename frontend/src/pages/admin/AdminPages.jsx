import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { apiError, unwrap } from "../../services/api";
import Notice from "../../components/common/Notice";
import StatusBadge from "../../components/common/StatusBadge";
import Sidebar from "../../components/layout/Sidebar"; 
import { EmptyState, LoadingState } from "../../components/common/PageStates";

const money = (value) => `₦${Number(value || 0).toLocaleString()}`;
const date = (value) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="button button-quiet" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button type="button" className="button button-quiet" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </nav>
  );
}

// --- NEW LAYOUT WRAPPER WITH SIDEBAR ---
function AdminPageLayout({ eyebrow, title, children }) {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content page-shell">
        <div className="page-title">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

export function AdminDashboard() {
  const [counts, setCounts] = useState({ routes: 0, trips: 0, tickets: 0 });
  const [state, setState] = useState({ loading: true, error: "" });
  useEffect(() => {
    Promise.all([
      api.get("/api/routes"),
      api.get("/api/trips"),
      api.get("/api/admin/tickets"),
    ])
      .then(([routes, trips, tickets]) => setCounts({
          routes: unwrap(routes).meta?.total ?? unwrap(routes).data?.length ?? 0,
          trips: unwrap(trips).meta?.total ?? unwrap(trips).data?.length ?? 0,
          tickets: unwrap(tickets).meta?.total ?? unwrap(tickets).data?.length ?? 0,
        }))
      .catch((error) => setState({ loading: false, error: apiError(error) }))
      .finally(() => setState((current) => ({ ...current, loading: false })));
  }, []);
  
  return (
    <AdminPageLayout eyebrow="OPERATIONS" title="Control room">
      <Notice>{state.error}</Notice>
      {state.loading && <LoadingState label="Loading operations..." />}
      <section className="admin-grid">
        {[
          ["Routes", counts.routes, "/admin/routes"],
          ["Trips", counts.trips, "/admin/trips"],
          ["Tickets", counts.tickets, "/admin/tickets"],
        ].map(([label, value, href]) => (
          <Link className="admin-stat" to={href} key={label}>
            <span>{label}</span>
            <strong>{state.loading ? "..." : value}</strong>
            <small>Manage records →</small>
          </Link>
        ))}
      </section>
    </AdminPageLayout>
  );
}

const blankRoute = {
  origin: "",
  destination: "",
  fare: "",
  status: "active",
  originLatitude: "",
  originLongitude: "",
  destinationLatitude: "",
  destinationLongitude: "",
};

export function AdminRoutes() {
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState(blankRoute);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [state, setState] = useState({
    loading: true,
    saving: false,
    error: "",
    success: "",
  });
  
  const load = (currentPage = page) =>
    api
      .get("/api/routes", { params: { page: currentPage, limit: 20 } })
      .then((response) => {
        const result = unwrap(response);
        setRoutes(result.data || []);
        setPages(result.meta?.pages || 1);
      })
      .catch((err) => setState((s) => ({ ...s, error: apiError(err) })))
      .finally(() => setState((s) => ({ ...s, loading: false })));
      
  useEffect(() => {
    load();
  }, [page]);
  
  const submit = async (event) => {
    event.preventDefault();
    setState((current) => ({ ...current, saving: true, error: "", success: "" }));
    const body = {
      origin: form.origin,
      destination: form.destination,
      status: form.status,
      originCoordinates: {
        latitude: Number(form.originLatitude),
        longitude: Number(form.originLongitude),
      },
      destinationCoordinates: {
        latitude: Number(form.destinationLatitude),
        longitude: Number(form.destinationLongitude),
      },
    };
    try {
      const response = editing
        ? await api.put(`/api/routes/${editing}`, body)
        : await api.post("/api/routes", body);
      setState((current) => ({
        ...current,
        saving: false,
        success: unwrap(response).message,
        error: "",
      }));
      setForm(blankRoute);
      setEditing(null);
      load();
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: false,
        success: "",
        error: apiError(error),
      }));
    }
  };
  
  const edit = (route) => {
    setEditing(route._id);
    setForm({
      origin: route.origin,
      destination: route.destination,
      status: route.status,
      originLatitude: route.originCoordinates?.latitude ?? "",
      originLongitude: route.originCoordinates?.longitude ?? "",
      destinationLatitude: route.destinationCoordinates?.latitude ?? "",
      destinationLongitude: route.destinationCoordinates?.longitude ?? "",
    });
  };
  
  const remove = async (id) => {
    if (!window.confirm("Delete this route?")) return;
    try {
      await api.delete(`/api/routes/${id}`);
      load();
    } catch (error) {
      setState((s) => ({ ...s, error: apiError(error) }));
    }
  };
  
  return (
    <AdminPageLayout eyebrow="NETWORK DESIGN" title="Routes">
      <Notice type="success">{state.success}</Notice>
      <Notice>{state.error}</Notice>
      <div className="admin-two-col">
        <form className="admin-form" onSubmit={submit}>
          <h2>{editing ? "Edit route" : "Create route"}</h2>
          <label className="field">
            <span>Origin</span>
            <input
              required
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Destination</span>
            <input
              required
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
            />
          </label>
          <div className="form-section-label">Origin coordinates</div>
          <div className="two-fields">
            <label className="visually-hidden" htmlFor="origin-latitude">Origin latitude</label>
            <input
              id="origin-latitude"
              type="number"
              step="any"
              placeholder="Latitude"
              required
              value={form.originLatitude}
              onChange={(e) => setForm({ ...form, originLatitude: e.target.value })}
            />
            <label className="visually-hidden" htmlFor="origin-longitude">Origin longitude</label>
            <input
              id="origin-longitude"
              type="number"
              step="any"
              placeholder="Longitude"
              required
              value={form.originLongitude}
              onChange={(e) => setForm({ ...form, originLongitude: e.target.value })}
            />
          </div>
          <div className="form-section-label">Destination coordinates</div>
          <div className="two-fields">
            <label className="visually-hidden" htmlFor="destination-latitude">Destination latitude</label>
            <input
              id="destination-latitude"
              type="number"
              step="any"
              placeholder="Latitude"
              required
              value={form.destinationLatitude}
              onChange={(e) => setForm({ ...form, destinationLatitude: e.target.value })}
            />
            <label className="visually-hidden" htmlFor="destination-longitude">Destination longitude</label>
            <input
              id="destination-longitude"
              type="number"
              step="any"
              placeholder="Longitude"
              required
              value={form.destinationLongitude}
              onChange={(e) => setForm({ ...form, destinationLongitude: e.target.value })}
            />
          </div>
          <button type="submit" className="button button-primary" disabled={state.saving}>
            {state.saving ? "Saving route..." : editing ? "Update route" : "Calculate and create"}
          </button>
          {editing && (
            <button
              type="button"
              className="button button-quiet"
              onClick={() => {
                setEditing(null);
                setForm(blankRoute);
              }}
            >
              Cancel edit
            </button>
          )}
        </form>
        <div className="admin-list">
          {state.loading ? (
            <LoadingState label="Loading routes..." />
          ) : routes.length === 0 ? (
            <EmptyState title="No routes yet">Create a route to start building the network.</EmptyState>
          ) : (
            routes.map((route) => (
              <article className="admin-row" key={route._id}>
                <div>
                  <strong>{route.origin} → {route.destination}</strong>
                  <span>
                    {route.distanceKm ? `${route.distanceKm} km · ` : ""}
                    {money(route.fare)}
                  </span>
                </div>
                <div className="row-actions">
                  <StatusBadge value={route.status} />
                  <button type="button" onClick={() => edit(route)}>Edit</button>
                  <button type="button" onClick={() => remove(route._id)}>Delete</button>
                </div>
              </article>
            ))
          )}
          {!state.loading && <Pagination page={page} pages={pages} onChange={setPage} />}
        </div>
      </div>
    </AdminPageLayout>
  );
}

const blankTrip = {
  route: "",
  departureTime: "",
  arrivalTime: "",
  availableSeats: "",
  status: "scheduled",
};

export function AdminTrips() {
  const [routes, setRoutes] = useState([]);
  const [trips, setTrips] = useState([]);
  const [form, setForm] = useState(blankTrip);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [state, setState] = useState({
    loading: true,
    saving: false,
    error: "",
    success: "",
  });
  
  const load = (currentPage = page) =>
    Promise.all([api.get("/api/routes", { params: { limit: 100 } }), api.get("/api/trips", { params: { page: currentPage, limit: 20 } })])
      .then(([routeResponse, tripResponse]) => {
        setRoutes(unwrap(routeResponse).data || []);
        const result = unwrap(tripResponse);
        setTrips(result.data || []);
        setPages(result.meta?.pages || 1);
      })
      .catch((err) => setState((s) => ({ ...s, error: apiError(err) })))
      .finally(() => setState((s) => ({ ...s, loading: false })));
      
  useEffect(() => {
    load();
  }, [page]);
  
  const submit = async (event) => {
    event.preventDefault();
    setState((current) => ({ ...current, saving: true, error: "", success: "" }));
    try {
      const response = editing
        ? await api.put(`/api/trips/${editing}`, { ...form, availableSeats: Number(form.availableSeats) })
        : await api.post("/api/trips", { ...form, availableSeats: Number(form.availableSeats) });
      setState((current) => ({
        ...current,
        saving: false,
        success: unwrap(response).message,
        error: "",
      }));
      setForm(blankTrip);
      setEditing(null);
      load();
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: false,
        success: "",
        error: apiError(error),
      }));
    }
  };
  
  const edit = (trip) => {
    setEditing(trip._id);
    setForm({
      route: trip.route?._id || trip.route || "",
      departureTime: trip.departureTime?.slice(0, 16),
      arrivalTime: trip.arrivalTime?.slice(0, 16),
      availableSeats: trip.availableSeats,
      status: trip.status,
    });
  };
    
  const remove = async (id) => {
    if (!window.confirm("Delete this trip?")) return;
    try {
      await api.delete(`/api/trips/${id}`);
      load();
    } catch (error) {
      setState((s) => ({ ...s, error: apiError(error) }));
    }
  };
  
  return (
    <AdminPageLayout eyebrow="SCHEDULES" title="Trips">
      <Notice type="success">{state.success}</Notice>
      <Notice>{state.error}</Notice>
      <div className="admin-two-col">
        <form className="admin-form" onSubmit={submit}>
          <h2>{editing ? "Edit trip" : "Schedule a trip"}</h2>
          <label className="field">
            <span>Route</span>
            <select
              required
              value={form.route}
              onChange={(e) => setForm({ ...form, route: e.target.value })}
            >
              <option value="">Select route</option>
              {routes.map((route) => (
                <option value={route._id} key={route._id}>
                  {route.origin} → {route.destination}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Departure</span>
            <input
              type="datetime-local"
              required
              value={form.departureTime}
              onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Arrival</span>
            <input
              type="datetime-local"
              required
              value={form.arrivalTime}
              onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Available seats</span>
            <input
              type="number"
              min="0"
              required
              value={form.availableSeats}
              onChange={(e) => setForm({ ...form, availableSeats: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select
              aria-label="Trip status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="scheduled">scheduled</option>
              <option value="completed">completed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <button type="submit" className="button button-primary" disabled={state.saving}>
            {state.saving ? "Saving trip..." : editing ? "Update trip" : "Create trip"}
          </button>
          {editing && (
            <button
              type="button"
              className="button button-quiet"
              onClick={() => {
                setEditing(null);
                setForm(blankTrip);
              }}
            >
              Cancel edit
            </button>
          )}
        </form>
        <div className="admin-list">
          {state.loading ? (
            <LoadingState label="Loading trips..." />
          ) : trips.length === 0 ? (
            <EmptyState title="No trips scheduled">Schedule a trip to make it available to passengers.</EmptyState>
          ) : (
            trips.map((trip) => (
              <article className="admin-row" key={trip._id}>
                <div>
                  <strong>{trip.route?.origin} → {trip.route?.destination}</strong>
                  <span>
                    {date(trip.departureTime)} · {trip.availableSeats} seats · {money(trip.route?.fare)}
                  </span>
                </div>
                <div className="row-actions">
                  <StatusBadge value={trip.status} />
                  <button type="button" onClick={() => edit(trip)}>Edit</button>
                  <button type="button" onClick={() => remove(trip._id)}>Delete</button>
                </div>
              </article>
            ))
          )}
          {!state.loading && <Pagination page={page} pages={pages} onChange={setPage} />}
        </div>
      </div>
    </AdminPageLayout>
  );
}

export function AdminTickets() {
  const [tickets, setTickets] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  
  const load = (currentPage = page) =>
    api
      .get("/api/admin/tickets", { params: { page: currentPage, limit: 20 } })
      .then((response) => {
        const result = unwrap(response);
        setTickets(result.data || []);
        setPages(result.meta?.pages || 1);
      })
      .catch((err) => setState({ loading: false, error: apiError(err) }))
      .finally(() => setState((s) => ({ ...s, loading: false })));
      
  useEffect(() => {
    load();
  }, [page]);
  
  const update = async (id, status) => {
    try {
      await api.patch(`/api/admin/tickets/${id}/status`, { status });
      load();
    } catch (error) {
      setState((s) => ({ ...s, error: apiError(error) }));
    }
  };
  
  return (
    <AdminPageLayout eyebrow="BOOKING OPERATIONS" title="Issued tickets">
      <Notice>{state.error}</Notice>
      {state.loading ? (
        <LoadingState label="Loading issued tickets..." />
      ) : tickets.length === 0 ? (
        <EmptyState title="No tickets issued">Bookings will appear here.</EmptyState>
      ) : (
        <div className="admin-list">
          {tickets.map((ticket) => (
            <article className="admin-row" key={ticket._id}>
              <div>
                <strong>{ticket.ticketReference}</strong>
                <span>
                  {ticket.user?.name} · {ticket.trip?.route?.origin} → {ticket.trip?.route?.destination} · {money(ticket.amount)} · Payment: {ticket.paymentStatus || "paid"}
                </span>
              </div>
              <select
                aria-label={`Ticket status for ${ticket.ticketReference}`}
                value={ticket.status}
                onChange={(e) => update(ticket._id, e.target.value)}
              >
                <option value="active">active</option>
                <option value="used">used</option>
                <option value="cancelled">cancelled</option>
              </select>
            </article>
          ))}
        </div>
      )}
      {!state.loading && <Pagination page={page} pages={pages} onChange={setPage} />}
    </AdminPageLayout>
  );
}