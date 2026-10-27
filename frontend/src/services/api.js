import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
  headers: { "Content-Type": "application/json" },
});
let slowRequestCount = 0;

const finishRequest = (config) => {
  clearTimeout(config?.__slowRequestTimer);
  if (config?.__isSlowRequest) {
    slowRequestCount = Math.max(0, slowRequestCount - 1);
    window.dispatchEvent(new CustomEvent("routely:api-slow", { detail: slowRequestCount > 0 }));
  }
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("transport_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    finishRequest(response.config);
    return response;
  },
  (error) => {
    finishRequest(error.config);
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("routely:unauthorized"));
    }
    return Promise.reject(error);
  },
);

api.interceptors.request.use((config) => {
  config.__slowRequestTimer = window.setTimeout(() => {
    config.__isSlowRequest = true;
    slowRequestCount += 1;
    window.dispatchEvent(new CustomEvent("routely:api-slow", { detail: true }));
  }, 4000);
  return config;
});

export const unwrap = (response) => response.data;
export const apiError = (error) =>
  error.response?.data?.message || "Something went wrong. Please try again.";
export default api;
