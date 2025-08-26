// src/components/AuthPanel.tsx
"use client";
import * as React from "react";
import { useAuth } from "../hooks/useAuth";

export default function AuthPanel() {
  const { save, token, user } = useAuth();
  const [tab, setTab] = React.useState<"login" | "signup">("signup");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [wallet, setWallet] = React.useState("");
  const [accepted, setAccepted] = React.useState(true);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, wallet, accepted }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      save(data.token);
      setMsg("Signed up!");
    } else {
      setMsg(data.error || "Signup failed");
    }
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      save(data.token);
      setMsg("Logged in!");
    } else {
      setMsg(data.error || "Login failed");
    }
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff", marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <button onClick={() => setTab("signup")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          Sign up
        </button>
        <button onClick={() => setTab("login")} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          Log in
        </button>
      </div>

      {tab === "signup" ? (
        <form onSubmit={onSignup} style={{ display: "grid", gap: 8 }}>
          <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input placeholder="wallet G..." value={wallet} onChange={(e) => setWallet(e.target.value)} />
          <label style={{ fontSize: 12 }}>
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /> Accept T&Cs
          </label>
          <button type="submit" style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff" }}>
            Sign up
          </button>
        </form>
      ) : (
        <form onSubmit={onLogin} style={{ display: "grid", gap: 8 }}>
          <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff" }}>
            Log in
          </button>
        </form>
      )}

      {msg && <div style={{ marginTop: 8, fontSize: 12 }}>{msg}</div>}
      {token && <div style={{ marginTop: 8, fontSize: 12 }}>🔐 Authenticated{user?.wallet ? ` as ${user.wallet}` : ""}</div>}
    </div>
  );
}
