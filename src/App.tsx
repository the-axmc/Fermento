import { Routes, Route, Outlet, Navigate, useParams } from "react-router-dom";
import AddFerment from "./pages/AddFerment";
import Batch from "./pages/Batch";
import Claim from "./pages/Claim";
import Home from "./pages/Home";
import Market from "./pages/Market";
import Portfolio from "./pages/Portfolio";
import SignIn from "./pages/SignIn";
import Wallet from "./pages/Wallet";

const AppLayout: React.FC = () => (
  <main>
    <Outlet />
  </main>
);

/** Old labels printed with /cask/<id> keep working. */
const LegacyCask: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/batch/${id ?? ""}`} replace />;
};

function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/market" replace />} />
        <Route path="/produce" element={<AddFerment />} />
        <Route path="/producer" element={<Home />} />
        <Route path="/market" element={<Market />} />
        <Route path="/batch/:id" element={<Batch />} />
        <Route path="/cask/:id" element={<LegacyCask />} />
        <Route path="/claim/:id" element={<Claim />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="*" element={<Navigate to="/market" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
