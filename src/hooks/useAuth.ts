import * as React from "react";

type User = { username: string; wallet: string } | null;

export function useAuth() {
  const [user, setUser] = React.useState<User>(null);
  const [token, setToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = localStorage.getItem("fermento.jwt");
    if (t) {
      setToken(t);
      try {
        const payload = JSON.parse(atob(t.split(".")[1]));
        setUser({ username: payload.sub, wallet: payload.wallet });
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const save = (t: string) => {
    localStorage.setItem("fermento.jwt", t);
    setToken(t);
    const payload = JSON.parse(atob(t.split(".")[1]));
    setUser({ username: payload.sub, wallet: payload.wallet });
  };

  const logout = () => {
    localStorage.removeItem("fermento.jwt");
    setUser(null);
    setToken(null);
  };

  return { user, token, save, logout };
}
