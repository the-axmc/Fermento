import { Button, Icon, Layout } from "@stellar/design-system";
import "./App.module.css";
import ConnectAccount from "./components/ConnectAccount.tsx";
import { Routes, Route, Outlet, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Catalogue from "./pages/Catalogue"; // <-- new
import Debugger from "./pages/Debugger.tsx";

const NavPill: React.FC<{ to: string; label: string; icon?: React.ReactNode }> = ({
  to,
  label,
  icon,
}) => (
  <NavLink to={to} style={{ textDecoration: "none" }}>
    {({ isActive }) => (
      <Button variant={isActive ? "primary" : "tertiary"} size="md" disabled={isActive}>
        {icon}
        {label}
      </Button>
    )}
  </NavLink>
);

const AppLayout: React.FC = () => (
  <main>
    <Layout.Header
      projectId="Fermentation Tracker"
      projectTitle="Fermentation Tracker"
      contentRight={
        <>
          <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <NavPill to="/" label="Home" icon={<Icon.Home02 size="md" />} />
            <NavPill
              to="/catalogue"
              label="Catalogue"
              icon={
                <img
                  src="/logo.png" // ensure public/logo.png exists
                  alt="Catalogue"
                  style={{ width: 18, height: 18, marginRight: 6, borderRadius: 4, display: "inline-block" }}
                />
              }
            />
            <NavPill to="/debug" label="Debugger" icon={<Icon.Code02 size="md" />} />
          </nav>
          <ConnectAccount />
        </>
      }
    />
    <Outlet />
    <Layout.Footer>
      <span>
        © {new Date().getFullYear()} Fermentation Tracker. Licensed under the{" "}
        <a
          href="http://www.apache.org/licenses/LICENSE-2.0"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apache License, Version 2.0. Built with Aya Labs Scaffold.
        </a>
        .
      </span>
    </Layout.Footer>
  </main>
);

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/catalogue" element={<Catalogue />} />
        <Route path="/debug" element={<Debugger />} />
        <Route path="/debug/:contractName" element={<Debugger />} />
        {/* optional catch-all */}
        {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
      </Route>
    </Routes>
  );
}

export default App;
