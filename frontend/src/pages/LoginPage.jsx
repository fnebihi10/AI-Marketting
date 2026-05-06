import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isExpired, setIsExpired } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    if (isExpired) setIsExpired(false);
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isExpired) setIsExpired(false);

    const { email, password } = formData;
    if (!email || !password) {
      setError(t('errorRequired'));
      return;
    }

    setLoading(true);
    try {
      const data = await loginUser(email, password);
      login(data.user, data.token);
      // Redirect based on role
      navigate(data.user?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-controls-row">
        <button
          className="auth-theme-toggle"
          onClick={toggleLanguage}
          title={lang === 'sq' ? 'Switch to English' : 'Kalo ne shqip'}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>
            {lang === 'sq' ? 'EN' : 'AL'}
          </span>
        </button>
        <button
          className="auth-theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="auth-card">
        <div className="auth-brand">
          <BrandLogo className="auth-logo-img" />
          <h1 className="auth-title">{t('appName')}</h1>
          <p className="auth-subtitle">{t('loginTitle')}</p>
        </div>

        {isExpired && (
          <div className="form-error" style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(255, 152, 0, 0.1)', color: '#ff9800', borderColor: '#ff9800' }}>
            {t('sessionExpired')}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">{t('emailLabel')}</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder={t('emailPlaceholder')}
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label htmlFor="password" style={{ marginBottom: 0 }}>{t('passwordLabel')}</label>
              <Link to="/forgot-password" style={{ fontSize: '0.8125rem', color: 'var(--accent)', textDecoration: 'none' }}>
                {t('forgotPasswordLink')}
              </Link>
            </div>
            <input
              id="password"
              type="password"
              name="password"
              placeholder={t('passwordPlaceholder')}
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : t('loginButton')}
          </button>
        </form>

        <p className="auth-footer">
          {t('noAccount')}{' '}
          <Link to="/register">{t('createOne')}</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
