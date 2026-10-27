import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import api, { apiError, unwrap } from "../../services/api";
import Notice from "../../components/common/Notice";
import { LoadingState } from "../../components/common/PageStates";

const resultStyles = {
  valid: "validation-result valid",
  already_used: "validation-result invalid",
  cancelled: "validation-result invalid",
  expired: "validation-result invalid",
  unpaid: "validation-result invalid",
  wrong_trip: "validation-result invalid",
  not_found: "validation-result invalid"
};

export default function ValidateTickets() {
  const [code, setCode] = useState("");
  const [state, setState] = useState({ checking: false, error: "", result: null, cameraError: "" });
  const [history, setHistory] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef(null);
  const scannerRunning = useRef(false);

  const validate = async (value = code) => {
    const submitted = value.trim();
    if (!submitted || state.checking) return;
    setState((current) => ({ ...current, checking: true, error: "", result: null }));
    try {
      const response = unwrap(await api.post("/api/tickets/validate", { code: submitted }));
      const result = response.data;
      setState((current) => ({ ...current, checking: false, result }));
      setHistory((current) => [{ reference: result.reference || submitted, message: response.message, result: result.result, at: new Date().toISOString() }, ...current].slice(0, 10));
    } catch (error) {
      setState((current) => ({ ...current, checking: false, error: apiError(error) }));
      setHistory((current) => [{ reference: submitted, message: apiError(error), result: "not_found", at: new Date().toISOString() }, ...current].slice(0, 10));
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRunning.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRunning.current = false;
      setCameraActive(false);
    }
    scannerRef.current?.clear();
    scannerRef.current = null;
  };

  const startScanner = async () => {
    if (scannerRunning.current) return;
    setState((current) => ({ ...current, cameraError: "" }));
    try {
      const scanner = new Html5Qrcode("ticket-camera-reader");
      scannerRef.current = scanner;
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, async (decoded) => {
        await stopScanner();
        setCode(decoded);
        validate(decoded);
      });
      scannerRunning.current = true;
      setCameraActive(true);
    } catch (error) {
      setState((current) => ({ ...current, cameraError: "Camera unavailable. Enter the ticket reference instead." }));
      await stopScanner();
    }
  };

  useEffect(() => () => { stopScanner(); }, []);

  return (
    <main className="page-shell validation-page">
      <div className="page-title">
        <div><p className="eyebrow">BOARDING OPERATIONS</p><h1>Validate tickets</h1></div>
      </div>
      <div className="validation-layout">
        <section className="validation-tools">
          <form className="validation-form" onSubmit={(event) => { event.preventDefault(); validate(); }}>
            <label className="field" htmlFor="ticket-code">
              <span>Ticket reference or QR token</span>
              <input id="ticket-code" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} placeholder="TKT-..." />
            </label>
            <button type="submit" className="button button-primary" disabled={state.checking || !code.trim()}>{state.checking ? "Checking..." : "Validate ticket"}</button>
          </form>
          <div className="scanner-controls no-print">
            <button type="button" className="button button-quiet" onClick={startScanner} disabled={cameraActive}>Scan with camera</button>
            {cameraActive && <button type="button" className="button button-quiet" onClick={stopScanner}>Stop camera</button>}
          </div>
          <div id="ticket-camera-reader" className="ticket-camera" aria-label="Ticket QR camera scanner" />
          <Notice>{state.cameraError}</Notice>
          {state.checking && <LoadingState label="Checking ticket..." />}
          {state.error && <div className="validation-result invalid" role="alert"><strong>INVALID</strong><span>{state.error}</span></div>}
          {state.result && (
            <div className={resultStyles[state.result.result] || "validation-result invalid"} role="status" aria-live="assertive">
              <strong>{state.result.result === "valid" ? "VALID" : state.result.result === "already_used" ? "ALREADY USED" : "INVALID"}</strong>
              <span>{state.result.message}</span>
              {state.result.passengerFirstName && <span>Passenger: {state.result.passengerFirstName}</span>}
              {state.result.route && <span>{state.result.route.origin} → {state.result.route.destination}</span>}
              {state.result.usedAt && <span>Used at {new Date(state.result.usedAt).toLocaleString()}</span>}
            </div>
          )}
        </section>
        <section className="scan-history">
          <h2>Recent scans</h2>
          {history.length ? (
            <ol>{history.map((item, index) => <li key={`${item.at}-${index}`}><span className={`history-mark ${item.result === "valid" ? "is-valid" : "is-invalid"}`} /><div><strong>{item.reference}</strong><span>{item.message}</span><small>{new Date(item.at).toLocaleTimeString()}</small></div></li>)}</ol>
          ) : <p>No scans yet.</p>}
        </section>
      </div>
    </main>
  );
}
