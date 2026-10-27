import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { apiError, unwrap } from "../../services/api";
import Notice from "../../components/common/Notice";
import { LoadingState } from "../../components/common/PageStates";

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  const [state, setState] = useState({ loading: true, error: "", tickets: [], latePayment: false });

  useEffect(() => {
    if (!reference) {
      setState({ loading: false, error: "No payment reference was provided.", tickets: [], latePayment: false });
      return;
    }
    api.get(`/api/payments/verify/${encodeURIComponent(reference)}`)
      .then((response) => setState({ loading: false, error: "", tickets: unwrap(response).data?.tickets || [], latePayment: unwrap(response).data?.latePayment || false }))
      .catch((error) => setState({ loading: false, error: apiError(error), tickets: [], latePayment: false }));
  }, [reference]);

  if (state.loading) return <main className="page-shell"><LoadingState label="Confirming your payment..." /></main>;

  if (state.error) {
    return (
      <main className="page-shell narrow payment-result">
        <p className="eyebrow">PAYMENT NOT CONFIRMED</p>
        <h1>Your ticket is not active yet.</h1>
        <Notice>{state.error} If you closed checkout, your payment may still complete through the secure provider notification.</Notice>
        <div className="hero-actions">
          <Link className="button button-primary" to="/tickets">View my tickets</Link>
          <Link className="button button-quiet" to="/trips">Try another trip</Link>
        </div>
      </main>
    );
  }

  const ticketId = state.tickets[0]?._id;
  return (
    <main className="page-shell narrow payment-result">
      <p className="eyebrow">{state.latePayment ? "REFUND INITIATED" : "PAYMENT CONFIRMED"}</p>
      <h1>{state.latePayment ? "Your reservation expired before payment completed." : "Your Routely tickets are ready."}</h1>
      <Notice type={state.latePayment ? "info" : "success"}>
        {state.latePayment ? "Payment was received after the reservation expired. Your tickets were not activated and a refund was initiated." : "Payment verified and your booking is active."}
      </Notice>
      <div className="hero-actions">
        <Link className="button button-primary" to={ticketId ? `/tickets?ticketId=${ticketId}` : "/tickets"}>View ticket</Link>
        <Link className="button button-quiet" to="/trips">Find another trip</Link>
      </div>
    </main>
  );
}