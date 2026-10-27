import { Component } from "react";
import { Link } from "react-router-dom";

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="page-shell error-page" role="alert">
        <p className="eyebrow">ROUTELY</p>
        <h1>Something went wrong.</h1>
        <p>We could not load this page. Return home and try again.</p>
        <Link className="button button-primary" to="/">Go to Routely home</Link>
      </main>
    );
  }
}
