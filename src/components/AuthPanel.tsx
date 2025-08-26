// /src/components/AuthPanel.tsx
import * as React from "react";
import { useAuth } from "../hooks/useAuth";

const AuthPanel: React.FC = () => {
  const { user, token: _token, save, logout } = useAuth();
  const [mode, setMode] = React.useState<"login" | "signup">("signup");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [wallet, setWallet] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSignup(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, wallet, accepted: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Signup failed");
      if (data.token) save(data.token);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally { setBusy(false); }
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      if (data.token) save(data.token);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally { setBusy(false); }
  }

  if (user) {
    return (
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12 }}>
        <div style={{ fontSize:14 }}>Signed in as <b>{user.username}</b> ({user.wallet})</div>
        <button onClick={logout} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #e5e7eb", background:"#fff", cursor:"pointer" }}>Logout</button>
      </div>
    );
  }

  return (
    <div style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:12, marginBottom:12 }}>
      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
        <button onClick={() => setMode("signup")} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #e5e7eb", background: mode==="signup" ? "#eef2ff" : "#fff", cursor:"pointer" }}>Sign up</button>
        <button onClick={() => setMode("login")}  style={{ padding:"6px 10px", borderRadius:8, border:"1px solid #e5e7eb", background: mode==="login" ? "#eef2ff" : "#fff", cursor:"pointer" }}>Log in</button>
      </div>

      {mode === "signup" ? (
        <form onSubmit={onSignup} style={{ display:"grid", gap:8 }}>
          <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} style={{ padding:8, borderRadius:8, border:"1px solid #e5e7eb" }} />
          <input type="password" placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} style={{ padding:8, borderRadius:8, border:"1px solid #e5e7eb" }} />
          <input placeholder="wallet G..." value={wallet} onChange={e=>setWallet(e.target.value)} style={{ padding:8, borderRadius:8, border:"1px solid #e5e7eb" }} />
          <button disabled={busy} type="submit" style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #1f6feb", background:"#1f6feb", color:"#fff", cursor:"pointer" }}>{busy ? "Please wait…" : "Create account"}</button>
          {err && <div style={{ color:"#b91c1c", fontSize:12 }}>{err}</div>}
    </form>
      ) : (
        <form onSubmit={onLogin} style={{ display:"grid", gap:8 }}>
          <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} style={{ padding:8, borderRadius:8, border:"1px solid #e5e7eb" }} />
          <input type="password" placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} style={{ padding:8, borderRadius:8, border:"1px solid #e5e7eb" }} />
          <button disabled={busy} type="submit" style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #1f6feb", background:"#1f6feb", color:"#fff", cursor:"pointer" }}>{busy ? "Please wait…" : "Log in"}</button>
          {err && <div style={{ color:"#b91c1c", fontSize:12 }}>{err}</div>}
        </form>
      )}
    </div>
  );
};

export default AuthPanel;
