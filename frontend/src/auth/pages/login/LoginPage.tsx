import { useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, Lock, User } from 'lucide-react';
import { authApi } from '../../_service/authApi';
import { setAuthToken } from '../../../shared/_service/httpClient';
import { ThemeToggle } from '../../../shared/_components/ThemeToggle';
import type { UserProfile } from '../../../shared/_types';
import { Button, IconButton, Input } from '../../../shared/ui';

export function LoginPage({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const result = await authApi.login({ username, password });
      setAuthToken(result.access_token);
      onLogin(result.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ورود ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page login-page">
      <div className="login-grid-background" aria-hidden="true" />
      <div className="login-radial-glow" aria-hidden="true" />
      <div className="login-edge-glow" aria-hidden="true" />
      <div className="login-particles" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
      </div>

      <div className="auth-theme-control">
        <ThemeToggle />
      </div>

      <main className="login-shell">
        <section className="login-brand-hero" aria-label="IOTA ML">
          <div className="login-brand">
            <img src="/iota.png" alt="IOTA" />
          </div>
          <h1>IOTA ML</h1>
          <p>پلتفرم هوش مصنوعی و یادگیری ماشین</p>
        </section>
        <div className="login-card">
          <form className="login-form" onSubmit={submit}>
            <header className="login-header">
              <h2>ورود به حساب کاربری</h2>
            </header>

            <label>
              ایمیل یا نام کاربری
              <div className="auth-input-wrap">
                <User size={16} />
                <Input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  placeholder="name@example.com"
                />
              </div>
            </label>

            <label>
              رمز عبور
              <div className="auth-input-wrap">
                <Lock size={16} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
                <IconButton
                  className="auth-eye-button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                  icon={showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                />
              </div>
            </label>

            {message && <div className="auth-error">{message}</div>}

            <Button
              className="auth-submit"
              variant="primary"
              type="submit"
              loading={busy}
              fullWidth
              leadingIcon={<CheckCircle2 size={16} />}
            >
              ورود
            </Button>
          </form>
        </div>
        <p className="login-version">IOTA ML Platform · نسخه ۲.۴.۱</p>
      </main>
    </div>
  );
}
