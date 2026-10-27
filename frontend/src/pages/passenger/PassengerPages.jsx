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

function TicketCard({ ticket, onCancel, onPay, paying = false }) {
  const route = ticket.trip?.route;
  return (
    <article className="ticket-card">
      <div>
        <Link className="ticket-ref" to={`/tickets/${ticket._id}`}>{ticket.ticketReference}</Link>
        <Link className="ticket-card-route" to={`/tickets/${ticket._id}`}>
          <h3>{route?.origin} <span>→</span> {route?.destination}</h3>
        </Link>
        <Link className="ticket-detail-link" to={`/tickets/${ticket._id}`}>View ticket</Link>
        <p>
          {ticket.trip
            ? date(ticket.trip.departureTime)
            : "Trip details unavailable"}
        </p>
      </div>
      <div className="ticket-side">
        <strong>{money(ticket.amount)}</strong>
        <StatusBadge value={ticket.status} />
        {ticket.paymentStatus && <span className="payment-status">Payment: {ticket.paymentStatus.replaceAll("_", " ")}</span>}
        {ticket.status === "pending" && <ReservationCountdown until={ticket.reservedUntil} />}
        {ticket.status === "pending" && onPay && (
          <button type="button" className="button button-primary" disabled={paying} onClick={() => onPay(ticket)}>
            {paying ? "Opening checkout..." : "Pay now"}
          </button>
        )}
        {ticket.status === 'active' && ticket.paymentStatus === 'paid' && onCancel && (
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

function ReservationCountdown({ until }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(until).getTime() - Date.now()));
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(Math.max(0, new Date(until).getTime() - Date.now())), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");
  return <span className="reservation-countdown" role="timer">{remaining ? `Reserved for ${minutes}:${seconds}` : "Reservation expired"}</span>;
}

export function Trips() {
  const [trips, setTrips] = useState([]);
  const [filters, setFilters] = useState({ origin: "", destination: "", date: "", from: "", to: "", minSeats: "", status: "scheduled", sort: "departure" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  useEffect(() => {
    setLoading(true);
    setError("");
    const params = Object.fromEntries(Object.entries({ page, limit: 20, ...filters }).filter(([, value]) => value !== ""));
    if (filters.date) {
      delete params.from;
      delete params.to;
    }
    api
      .get("/api/trips", { params })
      .then((response) => {
        const result = unwrap(response);
        setTrips(result.data || []);
        setPages(result.meta?.pages || 1);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [filters, page]);
  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "date" && value ? { from: "", to: "" } : {}) }));
    setPage(1);
  };
  return (
    <main className="page-shell">
      <PageTitle eyebrow="PLAN A JOURNEY" title="Find your next trip">
      </PageTitle>
      <div className="trip-search-filters">
        <label className="field"><span>Origin</span><input value={filters.origin} onChange={(event) => updateFilter("origin", event.target.value)} placeholder="Any origin" /></label>
        <label className="field"><span>Destination</span><input value={filters.destination} onChange={(event) => updateFilter("destination", event.target.value)} placeholder="Any destination" /></label>
        <label className="field"><span>Travel day</span><input type="date" value={filters.date} onChange={(event) => updateFilter("date", event.target.value)} /></label>
        <label className="field"><span>From</span><input type="date" value={filters.from} disabled={Boolean(filters.date)} onChange={(event) => updateFilter("from", event.target.value)} /></label>
        <label className="field"><span>To</span><input type="date" value={filters.to} disabled={Boolean(filters.date)} onChange={(event) => updateFilter("to", event.target.value)} /></label>
        <label className="field"><span>Minimum seats</span><input type="number" min="0" step="1" value={filters.minSeats} onChange={(event) => updateFilter("minSeats", event.target.value)} /></label>
        <label className="field"><span>Status</span><select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="scheduled">Scheduled</option><option value="">All statuses</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        <label className="field"><span>Sort by</span><select value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}><option value="departure">Departure</option><option value="price">Price</option></select></label>
      </div>
      <Notice>{error}</Notice>
      {loading ? (
            <LoadingState label="Loading trips..." />
      ) : trips.length ? (
        <div className="trip-grid">
          {trips.map((trip) => (
            <TripCard trip={trip} key={trip._id} />
          ))}
        </div>
      ) : (
        <EmptyState title="No trips match these filters">Try a different origin, date, minimum seats, or sort order.</EmptyState>
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
  const [quantity, setQuantity] = useState(1);
  const [bookingId, setBookingId] = useState(null);
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
  const startPayment = async (existingBookingId = bookingId) => {
    setState((current) => ({ ...current, booking: true, error: "", success: "" }));
    try {
      let resolvedBookingId = existingBookingId;
      if (!resolvedBookingId) {
        const bookingResponse = unwrap(await api.post("/api/tickets/createticket", { trip: id, quantity }));
        resolvedBookingId = bookingResponse.data.bookingId;
        setBookingId(resolvedBookingId);
      }
      const payment = unwrap(await api.post("/api/payments/initialize", { bookingId: resolvedBookingId }));
      window.location.assign(payment.data.authorizationUrl);
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
        <label className="field quantity-field">
          <span>Tickets</span>
          <select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>
            {Array.from({ length: Math.min(5, trip.availableSeats) }, (_, index) => index + 1).map((count) => (
              <option value={count} key={count}>{count}</option>
            ))}
          </select>
        </label>
        <div className="price-summary">
          <span>{money(route.fare)} × {quantity}</span>
          <strong>{money(Number(route.fare) * quantity)}</strong>
        </div>
        <button
          type="button"
          className="button button-primary wide"
          disabled={
            state.booking ||
            trip.status !== "scheduled" ||
            trip.availableSeats < 1
          }
          onClick={() => startPayment()}
        >
          {state.booking ? "Preparing secure checkout..." : "Continue to secure payment"}
        </button>
        {bookingId && !state.booking && <button type="button" className="button button-quiet wide" onClick={() => startPayment(bookingId)}>Resume payment</button>}
      </div>
    </main>
  );
}

export function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [payingId, setPayingId] = useState(null);
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
  const pay = async (ticket) => {
    setPayingId(ticket._id);
    setState((current) => ({ ...current, error: "" }));
    try {
      const payment = unwrap(await api.post("/api/payments/initialize", { ticketId: ticket._id }));
      window.location.assign(payment.data.authorizationUrl);
    } catch (error) {
      setState((current) => ({ ...current, error: apiError(error) }));
      setPayingId(null);
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
            <TicketCard ticket={ticket} onCancel={cancel} onPay={pay} paying={payingId === ticket._id} key={ticket._id} />
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
