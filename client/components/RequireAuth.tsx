import { Navigate, Outlet, useLocation } from "react-router-dom";

function isAuthenticated() {
  return localStorage.getItem("auth") === "true";
}

export default function RequireAuth() {
  const location = useLocation();
  if (isAuthenticated()) return <Outlet />;
  return <Navigate to="/login" replace state={{ from: location }} />;
}
