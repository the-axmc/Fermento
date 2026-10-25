import { Routes, Route, Outlet, Navigate, useParams } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import AddFerment from "./pages/AddFerment";
import Batch from "./pages/Batch";
import Certify from "./pages/Certify";
import Claim from "./pages/Claim";
import Manage from "./pages/Manage";
import Market from "./pages/Market";
import Portfolio from "./pages/Portfolio";
import PrivacyCheck from "./pages/PrivacyCheck";
import Producer from "./pages/Producer";
import ProducerEdit from "./pages/ProducerEdit";
import SignIn from "./pages/SignIn";
import Wallet from "./pages/Wallet";

/** Signed-in pages: the tab bar is fixed to the viewport and rendered once here. */
const AppLayout: React.FC = () => (
  <main>
    <Outlet />
    <BottomNav />
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
      <Route path="/claim/:id" element={<Claim />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/market" replace />} />
        <Route path="/produce" element={<AddFerment />} />
        <Route path="/market" element={<Market />} />
        <Route path="/batch/:id" element={<Batch />} />
        <Route path="/batch/:id/manage" element={<Manage />} />
        <Route path="/producer/edit" element={<ProducerEdit />} />
        <Route path="/producer/:slug" element={<Producer />} />
        <Route path="/certify" element={<Certify />} />
        <Route path="/privacy-check" element={<PrivacyCheck />} />
        <Route path="/cask/:id" element={<LegacyCask />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="*" element={<Navigate to="/market" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
