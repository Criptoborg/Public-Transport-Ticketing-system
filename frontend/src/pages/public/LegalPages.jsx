import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { apiError, unwrap } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import Notice from "../../components/common/Notice";

function OwnerConfirm({ children }) {
  return <strong className="owner-confirm">[OWNER TO CONFIRM: {children}]</strong>;
}

function LegalShell({ eyebrow, title, legalConfig, children }) {
  const effectiveDate = legalConfig?.effectiveDate ? new Date(`${legalConfig.effectiveDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "unavailable";
  return <main className="page-shell narrow legal-page"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="legal-meta">Effective {effectiveDate} · Version {legalConfig?.legalVersion || "unavailable"}</p>{children}</main>;
}

function useLegalConfig() {
  const [state, setState] = useState({ data: null, error: "" });
  useEffect(() => {
    api.get("/api/legal/config").then((response) => setState({ data: unwrap(response).data, error: "" }))
      .catch((error) => setState({ data: null, error: apiError(error) }));
  }, []);
  return state;
}

export function PrivacyPolicy() {
  const { data: config } = useLegalConfig();
  return (
    <LegalShell eyebrow="LEGAL · PRIVACY" title="Privacy Policy" legalConfig={config}>
      <Notice type="info">Draft for owner review. The Nigeria Data Protection Act 2023 (NDPA) is treated as the likely governing data-protection law; applicability, lawful bases, and required notices must be confirmed by a qualified Nigerian privacy lawyer before launch.</Notice>
      <section><h2>Who operates Routely</h2><p>Routely is operated by <OwnerConfirm>legal company or trading name</OwnerConfirm>, with registered address <OwnerConfirm>registered business address</OwnerConfirm>. Privacy requests can be sent to <OwnerConfirm>privacy/data-rights contact email</OwnerConfirm>. DPO/contact person: <OwnerConfirm>DPO or contact-person name and contact details, or confirm none is appointed</OwnerConfirm>.</p></section>
      <section><h2>Information and purposes</h2><p>We use the information needed to create accounts, authenticate users, find and book trips, process payments/refunds, issue and validate tickets, send operational emails, secure the service, and meet accounting obligations. The detailed fields, storage locations, recipients, and current retention behavior are documented in the repository's data inventory.</p>
        <ul><li>Name, email, password hash, account role, timestamps, and recorded terms acceptance support account operation, security, and consent records.</li><li>Ticket, booking, trip, seat, fare, payment-reference/status, refund, and boarding details support travel and accounting workflows.</li><li>A password-reset token digest is stored for reset verification; its link expires after 15 minutes.</li><li>The browser stores the login JWT and safe user profile in localStorage. The JWT expires after one day; clear it by signing out or clearing browser storage.</li><li>Client IP addresses are used in process memory for rate limiting; application access-log middleware is not configured.</li><li>Emails contain only the operational details needed for welcome, password reset, booking, refund, and trip reminders.</li></ul>
      </section>
      <section><h2>Legal basis and rights</h2><p>Potential bases may include steps requested to provide a booking/account, performance of a contract, legal/accounting obligations, security interests, and consent for acceptance of the Terms and Privacy Policy. The operator must confirm the applicable NDPA lawful bases with qualified counsel; this draft does not make that legal determination.</p><p>Subject to applicable law, you may request access, correction, deletion, or object to processing, and may complain to the Nigeria Data Protection Commission (NDPC). Contact <OwnerConfirm>privacy/data-rights contact email</OwnerConfirm> with your account email and request. We may need to verify your identity before responding. An in-app JSON export and account deletion are available from Profile.</p></section>
      <section><h2>Recipients and international transfers</h2><p>MongoDB Atlas stores application records; Render hosts the frontend/API and may process operational connection/log data; Resend delivers emails; Paystack hosts checkout and processes payments/refunds; OpenRouteService may receive route coordinates only. Card details are entered on Paystack's hosted page and never touch Routely servers. Hosting providers are outside Nigeria; the exact processing regions and applicable transfer safeguards require <OwnerConfirm>owner confirmation of provider regions and transfer arrangements</OwnerConfirm>. The complete recipient and field list is documented in the repository's data inventory.</p></section>
      <section><h2>Retention and security</h2><p>The application has no scheduled purge for account, ticket/payment, provider-message, or hosting-log data. Account deletion anonymises direct identity and credentials but retains pseudonymised ticket/payment records for accounting and refund follow-up; the retention period must be confirmed by the owner after legal/accounting review. Reset links expire after 15 minutes and authentication JWTs after one day.</p><p>Current technical measures include bcrypt password hashing, signed expiring JWTs, database-backed role checks, authentication and general rate limits, Helmet security headers, restricted CORS, and server-side validation. The app does not intentionally store card details. These measures do not promise that all provider backups/logs are immediately erased. Provider retention and backup settings must be confirmed.</p></section>
      <section><h2>Cookies, tracking, and children</h2><p>Routely does not currently include analytics, advertising, tracking pixels, or tracking SDKs, and does not use tracking cookies. Login state is stored in browser localStorage. This service is drafted as not directed to people under 18; the owner must confirm the intended age range and applicable consent requirements.</p></section>
      <section><h2>Changes and contact</h2><p>We will update this notice when data practices change and increment the legal version when required. For privacy requests use <OwnerConfirm>privacy/data-rights contact email</OwnerConfirm>. Effective date: {config?.effectiveDate || "unavailable"}.</p></section>
      <section id="inventory"><h2>Data inventory</h2><p>The full engineering inventory is maintained in <code>docs/DATA_INVENTORY.md</code> in the source repository and describes fields, purposes, processors, and known retention behavior.</p></section>
    </LegalShell>
  );
}

export function TermsOfService() {
  const { data: config, error } = useLegalConfig();
  return (
    <LegalShell eyebrow="LEGAL · SERVICE TERMS" title="Terms of Service" legalConfig={config}>
      <Notice type="info">Draft for owner review. Have a qualified Nigerian lawyer review these terms and confirm the NDPA 2023 references, liability provisions, and governing venue before launch.</Notice>
      <section><h2>Operator and contact</h2><p>This service is operated by <OwnerConfirm>legal company or trading name</OwnerConfirm>, registered at <OwnerConfirm>registered business address</OwnerConfirm>. Contact: <OwnerConfirm>support/legal contact email</OwnerConfirm>.</p></section>
      <section><h2>Accounts and security</h2><p>Provide accurate account details, keep your password confidential, and use your own account. You are responsible for activity performed using your credentials. We may suspend access to protect users, investigate abuse, comply with law, or enforce these terms. Account deletion is available from Profile after password confirmation.</p></section>
      <section><h2>Acceptable use</h2><p>Do not attempt unauthorised access, interfere with the API or another user's account, submit fraudulent payment information, misuse tickets, or disrupt transport operators or other users. Do not use the service unlawfully.</p></section>
      <section><h2>Bookings and payments</h2><p>Trip availability, fare, departure, and seat selection are shown before booking but may change until a reservation is created. A booking creates a pending reservation for {config ? `${config.pendingTicketMinutes} minute(s)` : "a limited period"}; unpaid reservations then expire and release held seats. Payment is processed by Paystack's hosted checkout in Nigerian Naira (NGN); Routely does not collect card details. A ticket becomes active only after payment verification. Keep your ticket reference/QR private.</p></section>
      <section><h2>Ticket validity and boarding</h2><p>A ticket is valid only for the trip and passenger booking represented by its ticket record, and only when its status is active and payment is confirmed. Staff may scan the signed QR or enter the ticket reference. When configuration is available, boarding validation opens {config ? `${config.boardingWindowMinutes.before} minute(s) before` : "before"} and closes {config ? `${config.boardingWindowMinutes.after} minute(s) after` : "after"} the scheduled departure. A used, cancelled, expired, unpaid, or otherwise invalid ticket does not grant boarding.</p></section>
      <section><h2>Cancellations and refunds</h2><p>{error ? "Cancellation settings are temporarily unavailable; check the current API configuration before relying on a cutoff." : config ? `A passenger may request cancellation only before departure and earlier than ${config.cancelCutoffHours} hour(s) before scheduled departure. A passenger cancellation inside that window is not accepted by the current API.` : "Loading current cancellation settings..."}</p><p>{config ? `The current refund function requests ${config.refundPolicy.amountType === "full-ticket-amount" ? "the full ticket amount" : "the configured refund amount"} (${config.refundPolicy.amountFormula}); an application fee is ${config.refundPolicy.applicationFeeDeducted ? "deducted" : "not deducted"} by the current function. Paystack processes the request, and bank/card posting times are outside Routely's control. A provider failure is recorded as refund_failed for admin follow-up.` : "The refund amount and fee wording will appear when the API legal configuration is available."}</p><p>Trip cancellation by the operator may trigger ticket cancellation/refund handling. An account deletion request separately cancels every upcoming active paid ticket and requests its refund before account anonymisation; this deletion workflow does not apply the ordinary passenger cancellation cutoff. Refunds remain subject to provider acceptance and applicable law.</p><p>See the <Link to="/refund-policy">Refund Policy</Link>. Current values are returned by <code>GET /api/legal/config</code> and generated from the same cutoff/refund code used by the API.</p></section>
      <section><h2>Availability and liability</h2><p>We aim to keep the service available but do not guarantee uninterrupted access, error-free data, or that a third-party transport operator will operate as scheduled. To the extent allowed by applicable law, the operator is not liable for indirect or consequential loss arising from use or temporary unavailability. Nothing in these terms excludes liability that cannot lawfully be excluded or limits consumer rights that cannot be waived. Final wording requires lawyer review.</p></section>
      <section><h2>Termination and changes</h2><p>You may stop using Routely and request account deletion. We may suspend or terminate access for security, misuse, legal compliance, or material breach. We may change these terms; where acceptance is required, the app will ask signed-in users to accept the current version before continuing. Continued use after notice is subject to applicable law.</p></section>
      <section><h2>Privacy and governing law</h2><p>Our Privacy Policy describes personal-data practices and references the Nigeria Data Protection Act 2023 (NDPA), subject to confirmation of applicability and wording by a qualified Nigerian privacy lawyer. Governing law is intended to be Nigeria, subject to <OwnerConfirm>governing court and venue</OwnerConfirm> and lawyer confirmation.</p></section>
    </LegalShell>
  );
}

export function RefundPolicy() {
  const { data: config, error } = useLegalConfig();
  return (
    <LegalShell eyebrow="LEGAL · PAYMENTS" title="Refund Policy" legalConfig={config}>
      <Notice type="info">Draft for owner review. Paystack handles payment/refund processing; bank/card posting times vary. Have counsel review before launch.</Notice>
      <section><h2>Passenger cancellations</h2><p>{config ? `The API accepts passenger cancellation requests only before departure and earlier than ${config.cancelCutoffHours} hour(s) before the scheduled departure. Account deletion separately cancels upcoming active paid tickets before anonymisation, regardless of this standard passenger cutoff.` : error ? <>Current cancellation settings could not be loaded. Please contact <OwnerConfirm>support contact email</OwnerConfirm>.</> : "Loading current cancellation settings..."}</p></section>
      <section><h2>Refund amount and processing</h2><p>{config ? `The code currently requests ${config.refundPolicy.amountType === "full-ticket-amount" ? "the full ticket amount" : "the configured amount"} using ${config.refundPolicy.amountFormula}. Application fee deducted: ${config.refundPolicy.applicationFeeDeducted ? "yes" : "no"}.` : "The refund calculation will appear when the API legal configuration is available."} Refund requests are sent to Paystack. If the provider rejects or cannot process a refund, Routely records the ticket as needing admin follow-up. The bank/card issuer controls when an accepted refund appears.</p><p>Trip cancellations may initiate refunds for paid tickets. A refund request is not a guarantee of immediate settlement.</p></section>
      <section><h2>Questions</h2><p>Contact <OwnerConfirm>support contact email</OwnerConfirm>. Refund rules and current values are exposed by <code>GET /api/legal/config</code>.</p></section>
    </LegalShell>
  );
}

export function TermsAcceptanceGate() {
  const { user, isAuthenticated, updateUser, logout } = useAuth();
  const { data: config } = useLegalConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  if (!isAuthenticated || !user || !config || user.termsVersion === config.legalVersion) return null;

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      const updatedUser = unwrap(await api.post("/api/auth/me/accept-terms", { termsAccepted: true })).data;
      updateUser(updatedUser);
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  return <div className="legal-modal-backdrop"><section className="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-update-title"><p className="eyebrow">UPDATED LEGAL TERMS</p><h2 id="legal-update-title">Review and accept to continue</h2><p>Our Terms of Service and Privacy Policy have changed. Please review the current documents.</p><p><Link to="/terms">Terms of Service</Link> · <Link to="/privacy">Privacy Policy</Link></p><label className="consent-field"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>I agree to the updated Terms of Service and Privacy Policy.</span></label><Notice>{error}</Notice><button type="button" className="button button-primary" disabled={busy || !accepted} onClick={accept}>{busy ? "Recording acceptance..." : "I agree and continue"}</button><button type="button" className="button button-quiet" onClick={logout}>Sign out</button></section></div>;
}
