import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("transport_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("transport_token");
      localStorage.removeItem("transport_user");
      if (!window.location.pathname.startsWith("/login"))
        window.location.assign("/login");
    }
    return Promise.reject(error);
  },
);

export const unwrap = (response) => response.data;
export const apiError = (error) =>
  error.response?.data?.message || "Something went wrong. Please try again.";
export default api;
