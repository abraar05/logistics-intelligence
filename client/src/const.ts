export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Google OAuth sign-in flow handled by the backend.
export const startLogin = () => {
  window.location.href = "/api/auth/google/start";
};
