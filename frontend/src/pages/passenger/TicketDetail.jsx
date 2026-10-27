import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import api, { apiError, unwrap } from "../../services/api";
import Notice from "../../components/common/Notice";
import StatusBadge from "../../components/common/StatusBadge";
import { LoadingState } from "../../components/common/PageStates";

const money = (value) => `₦${Number(value || 0).toLocaleString()}`;
const formatDate = (value) => new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [state, setState] = useState({ loading: true, error: "", cancelling: false, paying: false });

  const load = () => api.get(`/api/tickets/${id}`)
    .then((response) => setTicket(unwrap(response).data))
    .catch((error) => setState((current) => ({ ...current, error: apiError(error) })))
    .finally(() => setState((current) => ({ ...current, loading: false })));

  useEffect(() => { load(); }, [id]);

  const cancel = async () => {
    if (!window.confirm("Cancel this ticket?")) return;
    setState((current) => ({ ...current, cancelling: true, error: "" }));
    try {
      await api.delete(`/api/tickets/${id}`);
      await load();
    } catch (error) {
      setState((current) => ({ ...current, error: apiError(error), cancelling: false }));
    }
  };

  const pay = async () => {
    setState((current) => ({ ...current, paying: true, error: "" }));
    try {
      const response = unwrap(await api.post("/api/payments/initialize", { ticketId: id }));
      window.location.assign(response.data.authorizationUrl);
    } catch (error) {
      setState((current) => ({ ...current, paying: false, error: apiError(error) }));
    }
  };

  if (state.loading) return <main className="page-shell"><LoadingState label="Loading ticket..." /></main>;
  if (!ticket) return <main className="page-shell"><Notice>{state.error || "Ticket not found."}</Notice></main>;

  const trip = ticket.trip || {};
  const route = trip.route || {};
  const payable = ticket.status === "pending" && ticket.paymentStatus === "unpaid";
  const canCancel = ticket.cancellationAllowed;

  const printTicket = () => window.print();
  return (
    <main className="page-shell narrow ticket-detail-page">
      <Link to="/tickets" className="back-link">Back to my tickets</Link>
      <Notice>{state.error}</Notice>
      <article className="ticket-detail print-ticket">
        <header className="ticket-detail-header">
          <div>
            <p className="eyebrow">ROUTELY BOARDING PASS</p>
            <h1>{route.origin} <span>→</span> {route.destination}</h1>
          </div>
          <StatusBadge value={ticket.status} />
        </header>
        <div className="ticket-detail-grid">
          <div><small>DEPARTURE</small><strong>{formatDate(trip.departureTime)}</strong></div>
          <div><small>ARRIVAL</small><strong>{formatDate(trip.arrivalTime)}</strong></div>
          <div><small>AMOUNT</small><strong>{money(ticket.amount)}</strong></div>
          <div><small>REFERENCE</small><strong>{ticket.ticketReference}</strong></div>
          <div><small>PAYMENT</small><strong>{ticket.paymentStatus?.replaceAll("_", " ") || "paid"}</strong></div>
        </div>
        {ticket.paymentStatus === "paid" && ticket.qrToken ? (
          <div className="ticket-qr" aria-label="Signed ticket QR code">
            <QRCodeSVG value={ticket.qrToken} size={220} level="M" includeMargin />
            <span>Show this code when boarding</span>
          </div>
        ) : (
          <Notice type="info">A boarding QR is available after payment is confirmed.</Notice>
        )}
        <div className="ticket-detail-actions no-print">
          {payable && <button type="button" className="button button-primary" disabled={state.paying} onClick={pay}>{state.paying ? "Opening checkout..." : "Pay now"}</button>}
          {canCancel && <button type="button" className="button button-quiet" disabled={state.cancelling} onClick={cancel}>{state.cancelling ? "Cancelling..." : "Cancel ticket"}</button>}
          <button type="button" className="button button-dark" onClick={printTicket}>Download / print ticket</button>
        </div>
      </article>
    </main>
  );
}
