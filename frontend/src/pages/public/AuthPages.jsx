import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api, { apiError, unwrap } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import Notice from "../../components/common/Notice";

function AuthFrame({ eyebrow, title, children, footer }) {
  return (
    <main className="auth-page">
      <div className="auth-panel">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
        {footer}
      </div>
      <div className="auth-aside">
        <span className="aside-number">01</span>
        <p>Move through the city with less waiting and more certainty.</p>
      </div>
    </main>
  );
}
function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [state, setState] = useState({ loading: false, error: "" });
  const submit = async (event) => {
    event.preventDefault();
    setState({ loading: true, error: "" });
    try {
      const data = unwrap(await api.post("/api/auth/login", form));
      login(data.data);
      navigate(
        data.data.user.role === "admin"
          ? "/admin"
          : location.state?.from?.pathname || "/dashboard",
        { replace: true },
      );
    } catch (error) {
      setState({ loading: false, error: apiError(error) });
    }
  };
  return (
    <AuthFrame eyebrow="WELCOME BACK" title="Log in to your routes">
      <Notice>{state.error}</Notice>
      <form onSubmit={submit} className="form-stack">
        <Field
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Field
          label="Password"
          type="password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button className="button button-primary" disabled={state.loading}>
          {state.loading ? "Logging in..." : "Log in"}
        </button>
      </form>
      <Link className="form-link" to="/forgot-password">
        Forgot your password?
      </Link>
      <p className="auth-foot">
        New to Routely? <Link to="/register">Create an account</Link>
      </p>
    </AuthFrame>
  );
}

export function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [state, setState] = useState({
    loading: false,
    error: "",
    success: "",
  });
  const submit = async (event) => {
    event.preventDefault();
    if (form.password.length < 6)
      return setState({
        ...state,
        error: "Password must be at least 6 characters long.",
      });
    setState({ loading: true, error: "", success: "" });
    try {
      const data = unwrap(await api.post("/api/auth/register", form));
      setState({
        loading: false,
        error: "",
        success: data.message || "Account created successfully.",
      });
      setTimeout(() => navigate("/login"), 1200);
    } catch (error) {
      setState({ loading: false, error: apiError(error), success: "" });
    }
  };
  return (
    <AuthFrame eyebrow="JOIN ROUTELY" title="Your next trip is closer">
      <Notice type="success">{state.success}</Notice>
      <Notice>{state.error}</Notice>
      <form onSubmit={submit} className="form-stack">
        <Field
          label="Full name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Field
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Field
          label="Password"
          type="password"
          minLength="6"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button className="button button-primary" disabled={state.loading}>
          {state.loading ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="auth-foot">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </AuthFrame>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState({
    loading: false,
    message: "",
    error: "",
  });
  const submit = async (event) => {
    event.preventDefault();
    setState({ loading: true, message: "", error: "" });
    try {
      const data = unwrap(
        await api.post("/api/auth/forgot-password", { email }),
      );
      setState({ loading: false, message: data.message, error: "" });
    } catch (error) {
      setState({ loading: false, message: "", error: apiError(error) });
    }
  };
  return (
    <AuthFrame eyebrow="ACCOUNT RECOVERY" title="Find your way back">
      <Notice type="success">{state.message}</Notice>
      <Notice>{state.error}</Notice>
      <form onSubmit={submit} className="form-stack">
        <Field
          label="Email address"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="button button-primary" disabled={state.loading}>
          {state.loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="auth-foot">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthFrame>
  );
}

export function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ newPassword: "", confirm: "" });
  const [state, setState] = useState({
    loading: false,
    message: "",
    error: "",
  });
  const submit = async (event) => {
    event.preventDefault();
    if (form.newPassword.length < 6)
      return setState({
        ...state,
        error: "Password must be at least 6 characters long.",
      });
    if (form.newPassword !== form.confirm)
      return setState({ ...state, error: "Passwords do not match." });
    setState({ loading: true, message: "", error: "" });
    try {
      const data = unwrap(
        await api.post("/api/auth/reset-password", {
          token,
          newPassword: form.newPassword,
        }),
      );
      setState({ loading: false, message: data.message, error: "" });
      setTimeout(() => navigate("/login"), 1300);
    } catch (error) {
      setState({ loading: false, message: "", error: apiError(error) });
    }
  };
  return (
    <AuthFrame eyebrow="NEW PASSWORD" title="Set a fresh password">
      <Notice type="success">{state.message}</Notice>
      <Notice>{state.error}</Notice>
      <form onSubmit={submit} className="form-stack">
        <Field
          label="New password"
          type="password"
          minLength="6"
          required
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
        />
        <Field
          label="Confirm password"
          type="password"
          minLength="6"
          required
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
        />
        <button className="button button-primary" disabled={state.loading}>
          {state.loading ? "Resetting password..." : "Reset password"}
        </button>
      </form>
    </AuthFrame>
  );
}
