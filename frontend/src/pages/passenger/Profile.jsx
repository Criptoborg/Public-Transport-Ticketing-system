import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError, unwrap } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import Notice from "../../components/common/Notice";
import { LoadingState } from "../../components/common/PageStates";

const initialPassword = { currentPassword: "", newPassword: "", confirmPassword: "" };
const passwordValid = (value) => value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);

export default function Profile() {
  const { updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState(initialPassword);
  const [deleteForm, setDeleteForm] = useState({ currentPassword: "", confirmation: "" });
  const [state, setState] = useState({ loading: true, savingName: false, savingPassword: false, exporting: false, deleting: false, error: "", success: "" });

  useEffect(() => {
    api.get("/api/auth/me")
      .then((response) => {
        const user = unwrap(response).data;
        setName(user.name);
        updateUser(user);
      })
      .catch((error) => setState((current) => ({ ...current, error: apiError(error) })))
      .finally(() => setState((current) => ({ ...current, loading: false })));
  }, []);

  const saveName = async (event) => {
    event.preventDefault();
    setState((current) => ({ ...current, savingName: true, error: "", success: "" }));
    try {
      const user = unwrap(await api.patch("/api/auth/me", { name })).data;
      updateUser(user);
      setState((current) => ({ ...current, savingName: false, success: "Profile updated." }));
    } catch (error) {
      setState((current) => ({ ...current, savingName: false, error: apiError(error) }));
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (!passwordValid(password.newPassword)) {
      setState((current) => ({ ...current, error: "Password must be at least 8 characters and include a letter and a number.", success: "" }));
      return;
    }
    if (password.newPassword !== password.confirmPassword) {
      setState((current) => ({ ...current, error: "New passwords do not match.", success: "" }));
      return;
    }
    setState((current) => ({ ...current, savingPassword: true, error: "", success: "" }));
    try {
      const response = unwrap(await api.post("/api/auth/change-password", { currentPassword: password.currentPassword, newPassword: password.newPassword }));
      setPassword(initialPassword);
      setState((current) => ({ ...current, savingPassword: false, success: response.message }));
    } catch (error) {
      setState((current) => ({ ...current, savingPassword: false, error: apiError(error) }));
    }
  };

  const exportData = async () => {
    setState((current) => ({ ...current, exporting: true, error: "", success: "" }));
    try {
      const response = await api.get("/api/auth/me/export");
      const file = new Blob([JSON.stringify(response.data.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "routely-account-data.json";
      link.click();
      URL.revokeObjectURL(url);
      setState((current) => ({ ...current, exporting: false, success: "Your account data export has been downloaded." }));
    } catch (error) {
      setState((current) => ({ ...current, exporting: false, error: apiError(error) }));
    }
  };

  const deleteAccount = async (event) => {
    event.preventDefault();
    setState((current) => ({ ...current, deleting: true, error: "", success: "" }));
    try {
      const response = unwrap(await api.delete("/api/auth/me", { data: deleteForm }));
      logout();
      navigate("/", { replace: true, state: { notice: response.message } });
    } catch (error) {
      setState((current) => ({ ...current, deleting: false, error: apiError(error) }));
    }
  };

  if (state.loading) return <main className="page-shell"><LoadingState label="Loading your profile..." /></main>;

  return (
    <main className="page-shell narrow profile-page">
      <div className="page-title"><div><p className="eyebrow">ACCOUNT SETTINGS</p><h1>Your profile</h1></div></div>
      <Notice type="success">{state.success}</Notice><Notice>{state.error}</Notice>
      <section className="profile-section">
        <h2>Personal details</h2>
        <form className="admin-form" onSubmit={saveName}>
          <label className="field"><span>Full name</span><input required minLength="2" maxLength="100" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <button type="submit" className="button button-primary" disabled={state.savingName}>{state.savingName ? "Saving..." : "Save name"}</button>
        </form>
      </section>
      <section className="profile-section">
        <h2>Account data</h2>
        <p>Download a JSON copy of your profile, tickets, bookings, and payment references.</p>
        <button type="button" className="button button-quiet" disabled={state.exporting} onClick={exportData}>{state.exporting ? "Preparing export..." : "Download my data"}</button>
      </section>
      <section className="profile-section profile-danger-zone">
        <h2>Delete my account</h2>
        <p>This anonymises your account and revokes existing sessions. Ticket and payment records may remain pseudonymised for accounting and refund follow-up.</p>
        <form className="admin-form" onSubmit={deleteAccount}>
          <label className="field"><span>Current password</span><input type="password" autoComplete="current-password" required value={deleteForm.currentPassword} onChange={(event) => setDeleteForm((current) => ({ ...current, currentPassword: event.target.value }))} /></label>
          <label className="field"><span>Type DELETE to confirm</span><input required pattern="DELETE" value={deleteForm.confirmation} onChange={(event) => setDeleteForm((current) => ({ ...current, confirmation: event.target.value }))} /></label>
          <button type="submit" className="button button-danger" disabled={state.deleting || deleteForm.confirmation !== "DELETE"}>{state.deleting ? "Deleting account..." : "Delete my account"}</button>
        </form>
      </section>
      <section className="profile-section">
        <h2>Change password</h2>
        <form className="admin-form" onSubmit={savePassword}>
          <label className="field"><span>Current password</span><input type="password" autoComplete="current-password" required value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} /></label>
          <label className="field"><span>New password</span><input type="password" autoComplete="new-password" minLength="8" pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" required value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} /></label>
          <p className="field-hint">Use at least 8 characters, including a letter and a number.</p>
          <label className="field"><span>Confirm new password</span><input type="password" autoComplete="new-password" required value={password.confirmPassword} onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))} /></label>
          <button type="submit" className="button button-primary" disabled={state.savingPassword}>{state.savingPassword ? "Changing..." : "Change password"}</button>
        </form>
      </section>
    </main>
  );
}
