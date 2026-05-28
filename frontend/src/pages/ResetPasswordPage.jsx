import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { resetPassword } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo';

const ResetPasswordPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) =>
    setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const { password, confirmPassword } = formData;

    if (!password || !confirmPassword) {
      setError(t('errorRequired'));
      return;
    }

    if (password.length < 6) {
      setError(t('errorPassLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('errorPassMatch'));
      return;
    }

    setLoading(true);
    try {
      const payload = await resetPassword(token, password);

      if (payload.token && payload.user) {
        localStorage.setItem('token', payload.token);
        localStorage.setItem('user_email', payload.user.email);
        window.location.href = '/';
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-controls-row">
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
          <p className="auth-subtitle">{t('resetTitle')}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="password">{t('newPasswordLabel')}</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder={t('passwordMinFormat')}
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              placeholder={t('passwordPlaceholder')}
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : t('resetButton')}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/login">← {t('backToLogin')}</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
