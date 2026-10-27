import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { apiError, unwrap } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import Notice from "../../components/common/Notice";
import StatusBadge from "../../components/common/StatusBadge";
import { EmptyState, LoadingState } from "../../components/common/PageStates";

const money = (value) => `₦${Number(value || 0).toLocaleString()}`;
const date = (value) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
function PageTitle({ eyebrow, title, children }) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="button button-quiet" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>Page {page} of {pages}</span>
      <button type="button" className="button button-quiet" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketCount, setTicketCount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      api.get("/api/trips", { params: { status: "scheduled", limit: 1 } }),
      api.get("/api/tickets/my-tickets", { params: { limit: 3 } }),
    ])
      .then(([tripResponse, ticketResponse]) => {
        const tripResult = unwrap(tripResponse);
        const ticketResult = unwrap(ticketResponse);
        setTrips([{ count: tripResult.meta?.total || 0 }]);
        setTickets(ticketResult.data || []);
        setTicketCount(ticketResult.meta?.total || 0);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);
  return (
    <main className="page-shell">
      <PageTitle
        eyebrow="PASSENGER DASHBOARD"
        title={`Good to see you, ${user?.name?.split(" ")[0] || "traveller"}.`}
      >
        <Link className="button button-primary dashboard-cta" to="/trips">
          Find a trip
        </Link>
      </PageTitle>
      <Notice>{error}</Notice>
      <section className="dashboard-grid">
        <div className="feature-panel">
          <p className="eyebrow">NEXT DEPARTURES</p>
          <h2>Make your move.</h2>
          <p>
            Browse scheduled trips and book your seat when the route feels
            right.
          </p>
          <Link className="button button-dark" to="/trips">
            Explore trips
          </Link>
        </div>
        <div className="metric-panel">
          <span className="metric-label">Scheduled trips</span>
          <strong aria-live="polite">
            {loading ? "..." : trips[0]?.count || 0}
          </strong>
          <span>available in the network</span>
        </div>
        <div className="metric-panel accent">
          <span className="metric-label">Tickets held</span>
          <strong aria-live="polite">{loading ? "..." : ticketCount}</strong>
          <span>in your travel history</span>
        </div>
      </section>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR LAST TICKETS</p>
            <h2>Travel history</h2>
          </div>
          <Link to="/tickets">View all</Link>
        </div>
        {loading ? (
          <LoadingState label="Loading your tickets..." />
        ) : tickets.length ? (
          <div className="ticket-list">
            {tickets.slice(0, 3).map((ticket) => (
              <TicketCard ticket={ticket} key={ticket._id} />
            ))}
          </div>
        ) : (
          <EmptyState title="No tickets yet">Your booked tickets will appear here.</EmptyState>
        )}
      </section>
    </main>
  );
}

function TicketCard({ ticket, onCancel }) {
  const route = ticket.trip?.route;
  return (
    <article className="ticket-card">
      <div>
        <span className="ticket-ref">{ticket.ticketReference}</span>
        <h3>
          {route?.origin} <span>→</span> {route?.destination}
        </h3>
        <p>
          {ticket.trip
            ? date(ticket.trip.departureTime)
            : "Trip details unavailable"}
        </p>
      </div>
      <div className="ticket-side">
        <strong>{money(ticket.amount)}</strong>
        <StatusBadge value={ticket.status} />
        {ticket.status === "active" && onCancel && (
          <button
            type="button"
            className="button button-quiet"
            onClick={() => onCancel(ticket._id)}
          >
            Cancel ticket
          </button>
        )}
      </div>
    </article>
  );
}

export function Trips() {
  const [trips, setTrips] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "scheduled" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  useEffect(() => {
    setLoading(true);
    api
      .get("/api/trips", {
        params: { page, limit: 20, ...(filters.status ? { status: filters.status } : {}) },
      })
      .then((response) => {
        const result = unwrap(response);
        setTrips(result.data || []);
        setPages(result.meta?.pages || 1);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [filters.status, page]);
  const visible = trips.filter((trip) => {
    const value =
      `${trip.route?.origin} ${trip.route?.destination}`.toLowerCase();
    return value.includes(filters.search.toLowerCase());
  });
  return (
    <main className="page-shell">
      <PageTitle eyebrow="PLAN A JOURNEY" title="Find your next trip">
        <div className="filter-row">
          <input
            aria-label="Search trips"
            placeholder="Search origin or destination"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <select
            value={filters.status}
            onChange={(e) => {
              setFilters((current) => ({ ...current, status: e.target.value }));
              setPage(1);
            }}
          >
            <option value="scheduled">Scheduled</option>
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </PageTitle>
      <Notice>{error}</Notice>
      {loading ? (
            <LoadingState label="Loading trips..." />
      ) : visible.length ? (
        <div className="trip-grid">
          {visible.map((trip) => (
            <TripCard trip={trip} key={trip._id} />
          ))}
        </div>
      ) : (
        <EmptyState title="No trips match this search">Try a different origin, destination, or status.</EmptyState>
      )}
      {!loading && <Pagination page={page} pages={pages} onChange={setPage} />}
    </main>
  );
}
function TripCard({ trip }) {
  const navigate = useNavigate();
  const route = trip.route || {};
  return (
    <article className="trip-card">
      <div className="trip-card-top">
        <StatusBadge value={trip.status} />
        <span>{trip.availableSeats} seats left</span>
      </div>
      <h2>
        {route.origin} <span>→</span> {route.destination}
      </h2>
      <div className="trip-times">
        <div>
          <small>DEPARTS</small>
          <strong>{date(trip.departureTime)}</strong>
        </div>
        <div>
          <small>ARRIVES</small>
          <strong>{date(trip.arrivalTime)}</strong>
        </div>
      </div>
      <div className="trip-footer">
        <div>
          <small>FARE</small>
          <strong>{money(route.fare)}</strong>
        </div>
        <button
          type="button"
          className="button button-primary"
          disabled={trip.status !== "scheduled" || trip.availableSeats < 1}
          onClick={() => navigate(`/trips/${trip._id}`)}
        >
          View trip
        </button>
      </div>
    </article>
  );
}

export function TripDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [state, setState] = useState({
    loading: true,
    booking: false,
    error: "",
    success: "",
  });
  useEffect(() => {
    api
      .get(`/api/trips/${id}`)
      .then((response) => setTrip(unwrap(response).data))
      .catch((err) => setState((current) => ({ ...current, error: apiError(err) })))
      .finally(() => setState((current) => ({ ...current, loading: false })));
  }, [id]);
  const book = async () => {
    setState((current) => ({ ...current, booking: true, error: "", success: "" }));
    try {
      const data = unwrap(
        await api.post("/api/tickets/createticket", { trip: id }),
      );
      setState((current) => ({ ...current, booking: false, success: data.message }));
      setTimeout(() => navigate("/tickets"), 1000);
    } catch (error) {
      setState((current) => ({ ...current, booking: false, error: apiError(error) }));
    }
  };
  if (state.loading)
    return (
      <main className="page-shell">
            <LoadingState label="Loading trip..." />
      </main>
    );
  if (!trip)
    return (
      <main className="page-shell">
        <Notice>{state.error || "Trip not found."}</Notice>
      </main>
    );
  const route = trip.route || {};
  return (
    <main className="page-shell narrow">
      <Link className="back-link" to="/trips">
        ← Back to trips
      </Link>
      <div className="detail-panel">
        <div className="detail-header">
          <div>
            <p className="eyebrow">TRIP DETAILS</p>
            <h1>
              {route.origin} <span>→</span> {route.destination}
            </h1>
          </div>
          <StatusBadge value={trip.status} />
        </div>
        <Notice type="success">{state.success}</Notice>
        <Notice>{state.error}</Notice>
        <div className="detail-grid">
          <div>
            <small>DEPARTURE</small>
            <strong>{date(trip.departureTime)}</strong>
          </div>
          <div>
            <small>ARRIVAL</small>
            <strong>{date(trip.arrivalTime)}</strong>
          </div>
          <div>
            <small>AVAILABLE SEATS</small>
            <strong>{trip.availableSeats}</strong>
          </div>
          <div>
            <small>FARE</small>
            <strong className="fare">{money(route.fare)}</strong>
          </div>
        </div>
        <button
          type="button"
          className="button button-primary wide"
          disabled={
            state.booking ||
            trip.status !== "scheduled" ||
            trip.availableSeats < 1
          }
          onClick={book}
        >
          {state.booking ? "Booking ticket..." : "Book this trip"}
        </button>
      </div>
    </main>
  );
}

export function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const load = (currentPage = page) =>
    api
      .get("/api/tickets/my-tickets", { params: { page: currentPage, limit: 20 } })
      .then((response) => {
        const result = unwrap(response);
        setTickets(result.data || []);
        setPages(result.meta?.pages || 1);
      })
      .catch((err) => setState({ loading: false, error: apiError(err) }))
      .finally(() => setState((current) => ({ ...current, loading: false })));
  useEffect(() => {
    load();
  }, [page]);
  const cancel = async (id) => {
    if (!window.confirm("Cancel this ticket?")) return;
    try {
      await api.delete(`/api/tickets/${id}`);
      load();
    } catch (error) {
      setState((current) => ({ ...current, error: apiError(error) }));
    }
  };
  return (
    <main className="page-shell">
      <PageTitle eyebrow="YOUR WALLET" title="My tickets">
        <Link className="button button-primary" to="/trips">
          Book a trip
        </Link>
      </PageTitle>
      <Notice>{state.error}</Notice>
      {state.loading ? (
        <LoadingState label="Loading tickets..." />
      ) : tickets.length ? (
        <div className="ticket-list">
          {tickets.map((ticket) => (
            <TicketCard ticket={ticket} onCancel={cancel} key={ticket._id} />
          ))}
        </div>
      ) : (
        <EmptyState title="No tickets yet" action={<Link className="button button-primary" to="/trips">Find a trip</Link>}>
          Choose a trip and your first ticket will be saved here.
        </EmptyState>
      )}
      {!state.loading && <Pagination page={page} pages={pages} onChange={setPage} />}
    </main>
  );
}
