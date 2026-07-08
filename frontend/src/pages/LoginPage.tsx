import { useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, Lock, RefreshCw, User } from 'lucide-react';
import { api, setAuthToken } from '../api';
import { ThemeToggle } from '../components/ThemeToggle';
import type { UserProfile } from '../types';

export function LoginPage({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const result = await api.login({ username, password });
      setAuthToken(result.access_token);
      onLogin(result.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ورود ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page auth-page-ai auth-page-minimal">
      <div className="auth-theme-control"><ThemeToggle /></div>

      <section className="auth-shell-ai auth-shell-minimal">
        <form className="auth-card auth-card-ai auth-card-minimal" onSubmit={submit}>
          <div className="auth-card-head auth-card-head-minimal">
            <div className="auth-logo">IOTA</div>
            <div>
              <h1>ورود به پلتفرم</h1>
            </div>
          </div>

          <label>
            نام کاربری
            <div className="auth-input-wrap">
              <User size={15} />
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </div>
          </label>

          <label>
            رمز عبور
            <div className="auth-input-wrap">
              <Lock size={15} />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
              <button type="button" className="auth-eye-button" onClick={() => setShowPassword((value) => !value)} aria-label="نمایش رمز عبور">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          {message && <div className="auth-error">{message}</div>}

          <button className="primary auth-submit" disabled={busy} type="submit">
            {busy ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />}
            ورود
          </button>
        </form>
      </section>
    </div>
  );
}
