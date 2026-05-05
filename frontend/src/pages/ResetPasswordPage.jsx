import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Moon, RefreshCcw, Sparkles, Sun } from 'lucide-react';
import { resetPassword } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import BrandLogo from '../components/common/BrandLogo';

const ResetPasswordPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { token } = useParams();
  const navigate = useNavigate();
  const { lang, toggleLanguage, t } = useLanguage();

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    <div className="auth-scene">
      <div className="auth-orb auth-orb--1" />
      <div className="auth-orb auth-orb--2" />
      <div className="auth-orb auth-orb--3" />

      <div className="auth-controls-row">
        <button
          className="auth-theme-toggle"
          onClick={toggleLanguage}
          aria-label="Toggle language"
          title={lang === 'sq' ? 'Switch to English' : 'Kalo ne shqip'}
        >
          <span className="text-xs font-extrabold tracking-wide">
            {lang === 'sq' ? 'EN' : 'AL'}
          </span>
        </button>
        <button
          className="auth-theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="auth-glass-card">
        <div className="auth-card-accent" />
        <div className="auth-card-body">
          <div className="auth-brand-row">
            <div className="auth-logo-wrap">
              <BrandLogo className="h-11 w-auto" />
            </div>
            <div>
              <h1 className="auth-heading">{t('appName')}</h1>
              <p className="auth-subheading">{t('resetTitle')}</p>
            </div>
          </div>

          <p className="auth-subheading mb-6">
            {t('resetSubtitle')}
          </p>

          <div className="mb-6 rounded-[20px] border border-slate-200/70 bg-white/50 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
            <div className="mb-1 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Sparkles size={16} />
              Password refresh
            </div>
            <div>
              Use at least 6 characters and avoid reusing an old password.
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            <div className="auth-field">
              <label htmlFor="password" className="auth-field-label">{t('newPasswordLabel')}</label>
              <div className="auth-field-inner">
                <Lock size={16} className="auth-field-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder={t('passwordMinFormat')}
                  value={formData.password}
                  onChange={handleChange}
                  className="auth-field-input"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="confirmPassword" className="auth-field-label">{t('confirmPasswordLabel')}</label>
              <div className="auth-field-inner">
                <Lock size={16} className="auth-field-icon" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder={t('passwordPlaceholder')}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="auth-field-input"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="auth-error-bar">
                <span>{error}</span>
              </div>
            ) : null}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>{t('resetButton')}</span>
                  <ArrowRight size={18} className="auth-btn-arrow" />
                </>
              )}
            </button>
          </form>

          <div className="auth-switch-text">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="auth-switch-link inline-flex items-center justify-center gap-2"
            >
              <RefreshCcw size={14} />
              {t('backToLogin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
