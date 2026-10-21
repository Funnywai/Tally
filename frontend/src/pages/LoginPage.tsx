import { type FormEvent, useState } from 'react';
import { EyeIcon, EyeOffIcon, LoaderIcon, LockIcon } from '../components/Icons';
import { TallyMark } from '../components/TallyMark';
import { isApiError, isNetworkError, login } from '../lib/api';

interface LoginPageProps {
  readonly onAuthenticated: () => void;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [passcode, setPasscode] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passcode.trim() === '' || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(passcode);
      setPasscode('');
      onAuthenticated();
    } catch (caught: unknown) {
      if (isNetworkError(caught)) {
        setError('無法連線，請檢查網絡後再試。');
      } else if (isApiError(caught) && caught.status === 401) {
        setError('通行碼不正確。');
      } else if (isApiError(caught) && caught.status === 429) {
        setError('嘗試次數過多，請稍後再試。');
      } else if (isApiError(caught)) {
        setError(caught.message);
      } else {
        setError('登入失敗，請再試一次。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login">
      <div className="login__atmosphere" aria-hidden="true" />
      <div className="login__mark" aria-hidden="true">
        <TallyMark size={220} />
      </div>
      <section className="login__card" aria-labelledby="login-title">
        <div className="login__brand">
          <TallyMark size={34} className="login__brand-mark" />
          <div>
            <h1 id="login-title" className="login__wordmark">
              Tally
            </h1>
            <p className="login__tagline">麻雀計分 · 私人帳簿</p>
          </div>
        </div>

        <form className="login__form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="field">
            <label className="field__label" htmlFor="passcode">
              通行碼
            </label>
            <span className="field__control">
              <LockIcon size={18} className="field__icon" />
              <input
                id="passcode"
                className="field__input field__input--with-icon"
                type={show ? 'text' : 'password'}
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                autoComplete="current-password"
                enterKeyHint="go"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-describedby={error === null ? undefined : 'login-error'}
                required
              />
              <button
                type="button"
                className="field__reveal"
                aria-label={show ? '隱藏通行碼' : '顯示通行碼'}
                onClick={() => setShow((value) => !value)}
              >
                {show ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </button>
            </span>
          </div>

          {error === null ? null : (
            <p id="login-error" className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="button button--primary button--block" disabled={loading}>
            {loading ? <LoaderIcon size={18} className="spin" /> : null}
            {loading ? '驗證中…' : '進入'}
          </button>
        </form>
      </section>
    </main>
  );
}
