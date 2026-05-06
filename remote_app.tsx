import { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Activity,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileImage,
  ImagePlus,
  Layout,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  Moon,
  Palette,
  PenTool,
  RefreshCcw,
  Scissors,
  Sparkles,
  Sun,
  Target,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  createJob,
  fetchJob,
  createPhotoAd,
  fetchJobs,
  fetchPhotoAds,
  fetchMe,
  forgotPassword,
  loginUser,
  PhotoAd,
  registerUser,
  trimJob,
  VideoJob
} from './lib/api';
import { ensurePuter, generatePhotoAdSet, type PhotoAspectRatio } from './lib/puter';
import { useJobEvents } from './hooks/useJobEvents';
import { useLanguage } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';
import ResetPasswordPage from './pages/ResetPasswordPage';

const styles = [
  { value: 'energetic', label: 'Energetic', tone: 'Fast hook, bold cadence, punchy CTA' },
  { value: 'luxury', label: 'Luxury', tone: 'Premium tone, refined pacing, elegant product framing' },
  { value: 'minimal', label: 'Minimal', tone: 'Clean visuals, crisp copy, understated confidence' },
  { value: 'cinematic', label: 'Cinematic', tone: 'Atmospheric, emotive, brand-film energy' },
];

const categories = [
  { value: 'beauty-skincare', label: 'Beauty & Skincare' },
  { value: 'beverages-energy-drinks', label: 'Beverages & Energy Drinks' },
  { value: 'perfume-fragrance', label: 'Perfume & Fragrance' },
  { value: 'food-dessert', label: 'Food & Dessert' },
  { value: 'fashion-accessories', label: 'Fashion & Accessories' },
  { value: 'fitness-wellness', label: 'Fitness & Wellness' },
  { value: 'gaming-esports', label: 'Gaming & Esports' },
  { value: 'sports-football', label: 'Sports / Football' },
  { value: 'tech-gadgets', label: 'Tech & Gadgets' },
  { value: 'home-lifestyle', label: 'Home & Lifestyle' },
  { value: 'jewelry-luxury', label: 'Jewelry & Luxury' },
  { value: 'pet-products', label: 'Pet Products' },
];

const categoryLabelMap = new Map(categories.map((item) => [item.value, item.label]));

const formatCategoryLabel = (value: string) =>
  categoryLabelMap.get(value) ||
  value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const quickBriefs = [
  {
    id: 'sneakers',
    label: 'Sneaker drop',
    category: 'fashion-accessories',
    style: 'cinematic',
    description:
      'Premium black sneakers for stylish young athletes. Show 5 scenes: shoe close-up, lacing up, city walk, fast footwork or running, final product shot with CTA. Keep the shoes visible in every scene and avoid generic luxury lifestyle filler.',
  },
  {
    id: 'beauty',
    label: 'Beauty launch',
    category: 'beauty-skincare',
    style: 'luxury',
    description:
      'A brightening serum for women 28+ who want smoother, more even skin without a long routine. Show texture, glow, before-and-after feeling, and end with a subscribe-and-save CTA.',
  },
  {
    id: 'energy',
    label: 'Energy launch',
    category: 'beverages-energy-drinks',
    style: 'energetic',
    description:
      'A bold energy drink for young adults who want cold refreshment, nightlife energy, and instant momentum. Focus on the can, condensation, ice, nightlife lifestyle, and a strong grab-it-now CTA.',
  },
  {
    id: 'dessert',
    label: 'Food craving',
    category: 'food-dessert',
    style: 'energetic',
    description:
      'A pistachio dessert box for people who want cafe-quality treats at home. Focus on texture, close-up indulgence, giftability, and a limited weekly drop.',
  },
  {
    id: 'tech',
    label: 'Tech utility',
    category: 'tech-gadgets',
    style: 'minimal',
    description:
      'A pocket-size wireless charger for remote workers who need clean desk setups and reliable battery backup while traveling. Emphasize convenience, portability, and daily use.',
  },
  {
    id: 'esports',
    label: 'Esports hype',
    category: 'gaming-esports',
    style: 'cinematic',
    description:
      'A cinematic esports tournament promo inspired by Counter-Strike 2. Show arena lights, focused players at PCs, keyboard and mouse closeups, headset comms, roaring crowds, trophy moments, and a high-stakes final match atmosphere.',
  },
  {
    id: 'football',
    label: 'Match hype',
    category: 'sports-football',
    style: 'cinematic',
    description:
      'A cinematic, high-intensity short-form video for a major soccer match. Show stadium lights, fans chanting, kickoff, fast dribbles, tackles, goal celebrations, and a bold final CTA to watch the highlights.',
  },
];

const photoPromptPresets = [
  {
    id: 'luxury-product',
    label: 'Luxury product',
    title: 'Midnight Elixir',
    category: 'beauty-skincare',
    style: 'luxury',
    prompt: 'Create a premium skincare campaign around a black glass serum bottle with gold details, moody reflections, soft haze, and elevated luxury beauty direction.',
  },
  {
    id: 'dessert-editorial',
    label: 'Dessert editorial',
    title: 'Pistachio Velvet',
    category: 'food-dessert',
    style: 'energetic',
    prompt: 'Generate a refined dessert campaign with pistachio textures, elegant plating, creamy layers, and rich editorial food photography for a premium launch.',
  },
  {
    id: 'tech-launch',
    label: 'Tech launch',
    title: 'Orbit Charge',
    category: 'tech-gadgets',
    style: 'minimal',
    prompt: 'Design a high-end product ad for a compact wireless charger with sculpted shadows, brushed materials, clean surfaces, and crisp modern lighting.',
  },
];

const photoAspectRatios: Array<{ value: PhotoAspectRatio; label: string }> = [
  { value: '1:1', label: 'Square' },
  { value: '4:5', label: 'Portrait' },
  { value: '16:9', label: 'Landscape' },
];

type CreatorMode = 'video' | 'photo';

const stageLabels: Record<string, string> = {
  'queued': 'Queued',
  'writing-script': 'Writing script...',
  'finding-media': 'Finding media...',
  'generating-voice': 'Generating voice...',
  'rendering-video': 'Rendering video...',
  'uploading-assets': 'Uploading assets...',
  'completed': 'Ready',
  'failed': 'Failed',
};
const stageSequence = ['writing-script', 'generating-voice', 'finding-media', 'rendering-video', 'uploading-assets', 'completed'];
const stageDescriptions: Record<string, string> = {
  'writing-script': 'OpenAI script package and scene story are being assembled.',
  'generating-voice': 'Voice timing is generated while the pipeline prepares scene assets.',
  'finding-media': 'Pexels and fallbacks are sourcing stronger visuals scene by scene.',
  'rendering-video': 'FFmpeg is rendering scene clips in parallel before the final master.',
  'uploading-assets': 'The master video, voice track, and scene exports are being published.',
  'completed': 'Everything is ready for preview, export, and trimming.',
};

const DESCRIPTION_MAX_LENGTH = 2000;

const formatSeconds = (value: number) => `${value.toFixed(1)}s`;
const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatPhotoErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    const message = error.message.trim();

    if (/popup|sign-?in|permission/i.test(message)) {
      return 'Puter needs a popup sign-in first. Allow the popup, complete the Puter connect step, and try again.';
    }

    if (/load puter|connection/i.test(message)) {
      return 'Puter could not load in the browser. Check your connection, disable strict blockers for this page, and try again.';
    }

    return message;
  }

  return 'Unable to generate photo ads right now. If Puter opened or tried to open a popup, allow it and try again.';
};

const buildPhotoDownloadName = (title: string, index: number) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'photo-ad'}-${index + 1}.png`;

const mergeJobProgress = (job: VideoJob, payload: Partial<VideoJob> & { videoUrl?: string; previewUrl?: string; trimUrl?: string }) => ({
  ...job,
  ...payload,
  output: {
    ...job.output,
    ...(payload.output || {}),
    video: payload.videoUrl
      ? {
          ...job.output?.video,
          url: payload.videoUrl
        }
      : job.output?.video,
    preview: payload.previewUrl
      ? {
          ...job.output?.preview,
          url: payload.previewUrl
        }
      : job.output?.preview,
    trim: payload.trimUrl
      ? {
          ...job.output?.trim,
          asset: {
            ...job.output?.trim?.asset,
            url: payload.trimUrl
          }
        }
      : job.output?.trim
  }
});

function AuthScreen({
  initialError = '',
  onAuthenticated,
}: {
  initialError?: string;
  onAuthenticated: (payload: { email: string; token: string; credits: number }) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState('');
  const { lang, toggleLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  // Password strength
  const calcStrength = (p: string) => {
    let s = 0;
    if (!p) return s;
    if (p.length > 5) s++;
    if (p.length > 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^a-zA-Z0-9]/.test(p)) s++;
    return Math.min(s, 4);
  };
  const strength = calcStrength(password);
  const strengthColors = ['#ef4444', '#f59e0b', '#22c55e', '#22c55e'];
  const strengthLabels = lang === 'sq' ? ['Dobët', 'Mesatar', 'Mirë', 'Fortë'] : ['Weak', 'Fair', 'Good', 'Strong'];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const isForgot = mode === 'forgot-password';
    if (!email || (!isForgot && !password)) {
      setError(t('errorRequired'));
      return;
    }

    if (mode === 'forgot-password' && !/^\S+@\S+\.\S+$/.test(email)) {
      setError(t('errorEmail'));
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError(t('errorPassMatch'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      if (mode === 'forgot-password') {
        const payload = await forgotPassword(email);
        setSuccessMessage(payload.message || 'Reset link sent! Please check your inbox.');
      } else {
        const payload =
          mode === 'login'
            ? await loginUser(email, password)
            : await registerUser(email, password);

        localStorage.setItem('token', payload.token);
        localStorage.setItem('user_email', payload.user.email);
        localStorage.setItem('user_credits', String(payload.user.credits));
        onAuthenticated({ email: payload.user.email, token: payload.token, credits: payload.user.credits });
      }
    } catch (nextError: any) {
      setError(nextError.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-scene">
      {/* Animated background orbs */}
      <div className="auth-orb auth-orb--1" />
      <div className="auth-orb auth-orb--2" />
      <div className="auth-orb auth-orb--3" />

      {/* Top-right controls: Language + Theme */}
      <div className="auth-controls-row">
        <button
          className="auth-theme-toggle"
          onClick={toggleLanguage}
          aria-label="Toggle language"
          title={lang === 'sq' ? 'Switch to English' : 'Kaloni në Shqip'}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.02em' }}>
            {lang === 'sq' ? 'EN' : 'AL'}
          </span>
        </button>
        <button
          className="auth-theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Glass card */}
      <div className="auth-glass-card">
        <div className="auth-card-accent" />
        <div className="auth-card-body">

          {/* Brand */}
          <div className="auth-brand-row">
            <div className="auth-icon-badge">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="auth-heading">{t('appName')}</h1>
              <p className="auth-subheading">
                {mode === 'forgot-password' ? t('forgotTitle') : (mode === 'login' ? t('loginGreeting') : t('registerGreeting'))}
              </p>
            </div>
          </div>

          {mode !== 'forgot-password' && (
            <p className="auth-subheading" style={{ marginBottom: '1.5rem', opacity: 0.8 }}>
              {mode === 'login' ? t('loginTitle') : t('registerTitle')}
            </p>
          )}

          {mode === 'forgot-password' && (
            <p className="auth-subheading" style={{ marginBottom: '1.5rem', opacity: 0.9 }}>
              {t('forgotSubtitle')}
            </p>
          )}

          {/* Mode tabs */}
          {mode !== 'forgot-password' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {(['login', 'register'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { setMode(item); setError(''); setSuccessMessage(''); }}
                  style={{
                    flex: 1,
                    padding: '0.55rem 0',
                    borderRadius: '10px',
                    border: mode === item ? '1.5px solid #6366f1' : '1.5px solid var(--border-subtle)',
                    background: mode === item ? 'rgba(99,102,241,0.12)' : 'transparent',
                    color: mode === item ? '#6366f1' : 'var(--text-muted)',
                    fontWeight: mode === item ? 700 : 500,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                  }}
                >
                  {item === 'login' ? t('loginTab') : t('registerTab')}
                </button>
              ))}
            </div>
          )}

          <div className="auth-divider" />

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="auth-form">

            {/* Email */}
            <div className={`auth-field ${focused === 'email' ? 'auth-field--focused' : ''}`}>
              <label htmlFor="auth-email" className="auth-field-label">{t('emailLabel')}</label>
              <div className="auth-field-inner">
                <Mail size={16} className="auth-field-icon" />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused('')}
                  placeholder={t('emailPlaceholder')}
                  autoComplete="email"
                  className="auth-field-input"
                />
              </div>
            </div>

            {/* Password */}
            {mode !== 'forgot-password' && (
              <div className={`auth-field ${focused === 'password' ? 'auth-field--focused' : ''}`}>
                <div className="auth-field-label-row">
                  <label htmlFor="auth-password" className="auth-field-label">{t('passwordLabel')}</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="auth-forgot-link"
                      onClick={() => { setMode('forgot-password'); setError(''); setSuccessMessage(''); }}
                    >
                      {t('forgotPasswordLink')}
                    </button>
                  )}
                </div>
                <div className="auth-field-inner">
                  <Lock size={16} className="auth-field-icon" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused('')}
                    placeholder={t('passwordPlaceholder')}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="auth-field-input"
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Strength bar (register only) */}
                {mode === 'register' && password && (
                  <div className="auth-strength-wrap">
                    <div className="auth-strength-bars">
                      {[1, 2, 3, 4].map((lvl) => (
                        <div
                          key={lvl}
                          className="auth-strength-bar"
                          style={{
                            backgroundColor: lvl <= strength
                              ? strengthColors[strength - 1]
                              : 'var(--border-subtle)',
                          }}
                        />
                      ))}
                    </div>
                    <span
                      className="auth-strength-label"
                      style={{ color: strength > 0 ? strengthColors[strength - 1] : 'var(--text-muted)' }}
                    >
                      {strength > 0 ? strengthLabels[strength - 1] : ''}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Confirm Password (register only) */}
            {mode === 'register' && (
              <div className={`auth-field ${focused === 'confirm' ? 'auth-field--focused' : ''}`}>
                <label htmlFor="auth-confirm" className="auth-field-label">{t('confirmPasswordLabel')}</label>
                <div className="auth-field-inner">
                  <Lock size={16} className="auth-field-icon" />
                  <input
                    id="auth-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setFocused('confirm')}
                    onBlur={() => setFocused('')}
                    placeholder={t('passwordPlaceholder')}
                    autoComplete="new-password"
                    className="auth-field-input"
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Error/Success Messages */}
            {error && (
              <div className="auth-error-bar">
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="auth-success-bar" style={{
                background: 'rgba(52, 211, 153, 0.1)',
                color: '#34d399',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                borderRadius: '10px',
                padding: '0.65rem 0.875rem',
                fontSize: '0.8125rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle2 size={16} />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
              id="auth-submit"
            >
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>
                    {mode === 'forgot-password' ? t('forgotButton') : (mode === 'login' ? t('signInAction') : t('createAccountAction'))}
                  </span>
                  <ArrowRight size={18} className="auth-btn-arrow" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="auth-switch-text" style={{ marginTop: '1.5rem' }}>
            {mode === 'forgot-password' ? (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccessMessage(''); }}
                className="auth-switch-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '0.4rem' }}
              >
                <RefreshCcw size={14} />
                {t('backToLogin')}
              </button>
            ) : (
              <>
                {mode === 'login' ? `${t('noAccount')} ` : `${t('hasAccount')} `}
                <button
                  type="button"
                  onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccessMessage(''); }}
                  className="auth-switch-link"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
                >
                  {mode === 'login' ? t('createOne') : t('signInInstead')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLanguage } = useLanguage();
  const [creatorMode, setCreatorMode] = useState<CreatorMode>('video');
  const [auth, setAuth] = useState(() => ({
    token: localStorage.getItem('token') || '',
    email: localStorage.getItem('user_email') || '',
    credits: Number(localStorage.getItem('user_credits') || 0),
  }));
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [productCategory, setProductCategory] = useState('food-dessert');
  const [style, setStyle] = useState('energetic');
  const [enableStyleTransfer, setEnableStyleTransfer] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [secondaryFile, setSecondaryFile] = useState<File | null>(null);
  const [secondaryPreviewUrl, setSecondaryPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState('');
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimLoading, setTrimLoading] = useState(false);
  const [previewDurationSeconds, setPreviewDurationSeconds] = useState(0);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'overview' | 'preview' | 'history'>('overview');
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoPrompt, setPhotoPrompt] = useState('');
  const [photoAspectRatio, setPhotoAspectRatio] = useState<PhotoAspectRatio>('1:1');
  const [photoGenerating, setPhotoGenerating] = useState(false);
  const [photoProgressLabel, setPhotoProgressLabel] = useState('');
  const [photoAds, setPhotoAds] = useState<PhotoAd[]>([]);
  const [selectedPhotoAdId, setSelectedPhotoAdId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const secondaryFileInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const photoPromptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const insertTextAtCursor = (
    textarea: HTMLTextAreaElement,
    nextText: string,
    setter: (value: string) => void
  ) => {
    const { selectionStart, selectionEnd, value } = textarea;
    const updatedValue = `${value.slice(0, selectionStart)}${nextText}${value.slice(selectionEnd)}`;
    const nextCursor = selectionStart + nextText.length;
    setter(updatedValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleTextareaPaste = (
    event: ClipboardEvent<HTMLTextAreaElement>,
    setter: (value: string) => void
  ) => {
    const text = event.clipboardData.getData('text/plain');
    if (!text) {
      return;
    }

    event.preventDefault();
    insertTextAtCursor(event.currentTarget, text, setter);
  };

  const pasteFromClipboard = async (
    textarea: HTMLTextAreaElement | null,
    setter: (value: string) => void
  ) => {
    if (!textarea) {
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setError('Clipboard is empty or does not contain text.');
        return;
      }

      setError('');
      insertTextAtCursor(textarea, text, setter);
    } catch (nextError) {
      console.error('Clipboard paste failed:', nextError);
      setError('Clipboard access was blocked. Click into the field and try Ctrl+V or Cmd+V again.');
    }
  };

  const clearAuthSession = (message = '') => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_credits');
    setAuth({ token: '', email: '', credits: 0 });
    setJobs([]);
    setSelectedJobId(null);
    setPhotoAds([]);
    setSelectedPhotoAdId(null);
    setError('');
    setAuthError(message);
  };

  useEffect(() => {
    let isActive = true;

    if (!auth.token) {
      setJobs([]);
      setSelectedJobId(null);
      setPhotoAds([]);
      setSelectedPhotoAdId(null);
      return () => {
        isActive = false;
      };
    }

    Promise.all([fetchJobs(), fetchPhotoAds(), fetchMe()])
      .then(([jobsData, photoAdsData, user]) => {
        if (!isActive) {
          return;
        }

        localStorage.setItem('user_email', user.email);
        localStorage.setItem('user_credits', String(user.credits));
        setAuth((current) => ({
          ...current,
          email: user.email,
          credits: user.credits,
        }));
        setJobs(jobsData);
        setSelectedJobId((current) =>
          current && jobsData.some((job) => job._id === current) ? current : jobsData[0]?._id || null
        );
        setPhotoAds(photoAdsData);
        setSelectedPhotoAdId((current) =>
          current && photoAdsData.some((item) => item._id === current) ? current : photoAdsData[0]?._id || null
        );
      })
      .catch((nextError: any) => {
        if (!isActive) {
          return;
        }

        if (nextError?.status === 401) {
          clearAuthSession('Your session expired. Please sign in again.');
          return;
        }

        setJobs([]);
        setSelectedJobId(null);
        setPhotoAds([]);
        setSelectedPhotoAdId(null);
        setError(nextError.message || 'Unable to load your studio data.');
      });

    return () => {
      isActive = false;
    };
  }, [auth.token]);

  useEffect(() => {
    setSelectedPhotoAdId((current) =>
      current && photoAds.some((item) => item._id === current) ? current : photoAds[0]?._id || null
    );
  }, [photoAds]);

  useEffect(() => {
    if (creatorMode === 'video') {
      setPhotoProgressLabel('');
    }
  }, [creatorMode]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job._id === selectedJobId) || null,
    [jobs, selectedJobId]
  );
  const selectedPhotoAd = useMemo(
    () => photoAds.find((item) => item._id === selectedPhotoAdId) || null,
    [photoAds, selectedPhotoAdId]
  );
  const firstName = auth.email.split('@')[0] || 'creator';
  const jobsReady = jobs.filter((job) => job.status === 'completed').length;
  const workspaceTabs = [
    { id: 'overview' as const, label: 'Campaign' },
    { id: 'preview' as const, label: 'Preview' },
    { id: 'history' as const, label: `History${jobs.length > 0 ? ` (${jobs.length})` : ''}` },
  ];
  const jobsProcessing = jobs.filter((job) => job.status === 'processing').length;
  const dashboardStats =
    creatorMode === 'video'
      ? [
          {
            label: 'Jobs created',
            value: jobs.length,
          },
          {
            label: 'Ready exports',
            value: jobsReady,
          },
          {
            label: jobsProcessing > 0 ? 'In production' : 'Current style',
            value: jobsProcessing > 0 ? jobsProcessing : (styles.find((item) => item.value === style)?.label || style),
          },
        ]
      : [
          {
            label: 'Photo sets',
            value: photoAds.length,
          },
          {
            label: 'Images generated',
            value: photoAds.reduce((total, item) => total + item.images.length, 0),
          },
          {
            label: 'Current mode',
            value: 'Photo ads',
          },
        ];
  const sceneReadiness = useMemo(
    () =>
      (selectedJob?.script?.scenes || []).map((scene, index) => ({
        id: `${scene.sceneNumber}-${scene.headline}`,
        title: scene.headline || `Scene ${scene.sceneNumber}`,
        media: scene.media?.source ? `${scene.media.source}${scene.media?.kind ? ` • ${scene.media.kind}` : ''}` : 'Queued',
        duration: scene.voiceDuration ? formatSeconds(scene.voiceDuration) : 'Syncing',
        reason: scene.media?.selectionReason || stageDescriptions[selectedJob?.stage || 'finding-media'],
        visualQuery: scene.media?.query || scene.pexelsKeywords?.[0] || 'creative brief',
        index,
      })),
    [selectedJob]
  );
  const stageTimeline = useMemo(
    () =>
      stageSequence.map((stageId, index) => {
        const currentIndex = stageSequence.indexOf(selectedJob?.stage || 'queued');
        const state =
          selectedJob?.status === 'completed' || currentIndex > index
            ? 'done'
            : currentIndex === index || (selectedJob?.stage === 'queued' && index === 0)
              ? 'active'
              : 'pending';

        return {
          id: stageId,
          label: stageLabels[stageId] || stageId,
          description: stageDescriptions[stageId] || 'Processing step',
          state,
        };
      }),
    [selectedJob?.stage, selectedJob?.status]
  );
  const briefChecklist = [
    'Problem and audience: who should care and what pain is urgent?',
    'Offer and CTA: discount, drop, bundle, waitlist, or conversion moment.',
    'Visual anchors: what must appear on screen so stock media stays on-brief?',
  ];
  const marketingHighlights = [
    'OpenAI script, Deepgram voice, and media sourcing now run with less idle waiting.',
    'Scene renders are processed in parallel before final assembly to cut long render stalls.',
    'The workspace now surfaces timing, stage health, and scene-level readiness instead of only a percent bar.',
  ];

  useEffect(() => {
    if (!selectedJob) return;
    setTrimStart(Number(selectedJob.output?.trim?.startSeconds ?? 0) || 0);
    const persistedEnd = Number(selectedJob.output?.trim?.endSeconds ?? 0) || 0;
    const duration = Number(selectedJob.metadata?.durationSeconds ?? 0) || 0;
    setTrimEnd(persistedEnd > 0 ? persistedEnd : duration);
  }, [selectedJobId, selectedJob?.metadata?.durationSeconds]);

  useEffect(() => {
    if (!previewDurationSeconds) return;
    setTrimEnd((current) => (current > 0 ? current : previewDurationSeconds));
  }, [previewDurationSeconds]);

  useEffect(() => {
    void ensurePuter().catch(() => undefined);
  }, []);

  useEffect(() => {
    setPreviewDurationSeconds(0);
  }, [selectedJobId]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (secondaryPreviewUrl) {
        URL.revokeObjectURL(secondaryPreviewUrl);
      }
    };
  }, [previewUrl, secondaryPreviewUrl]);

  useJobEvents(
    selectedJobId,
    auth.token,
    (payload) => {
      setJobs((current) =>
        current.map((job) => (job._id === selectedJobId ? mergeJobProgress(job, payload) : job))
      );

      if (payload?.status === 'completed' || payload?.status === 'failed') {
        void fetchJob(selectedJobId!).then((freshJob) => {
          setJobs((current) => current.map((job) => (job._id === freshJob._id ? freshJob : job)));
        }).catch(() => undefined);
      }
    },
    Boolean(selectedJobId)
  );

  const handleFileChange = (nextFile: File | null, slot: 'primary' | 'secondary' = 'primary') => {
    if (slot === 'primary') {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setFile(nextFile);
      setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
    } else {
      if (secondaryPreviewUrl) {
        URL.revokeObjectURL(secondaryPreviewUrl);
      }
      setSecondaryFile(nextFile);
      setSecondaryPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
    }
    setIsPreviewOpen(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>, slot: 'primary' | 'secondary' = 'primary') => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileChange(droppedFile, slot);
    }
  };

  const onSelectFile = (event: ChangeEvent<HTMLInputElement>, slot: 'primary' | 'secondary' = 'primary') => {
    const nextFile = event.target.files?.[0] || null;
    handleFileChange(nextFile, slot);
  };

  const openFilePicker = (slot: 'primary' | 'secondary' = 'primary') => {
    if (slot === 'primary') {
      fileInputRef.current?.click();
      return;
    }

    secondaryFileInputRef.current?.click();
  };

  const clearSelectedFile = (slot: 'primary' | 'secondary' = 'primary') => {
    handleFileChange(null, slot);
    const input = slot === 'primary' ? fileInputRef.current : secondaryFileInputRef.current;
    if (input) {
      input.value = '';
    }
  };

  const clearProductFiles = () => {
    clearSelectedFile('primary');
    clearSelectedFile('secondary');
  };

  const refreshCredits = async () => {
    const user = await fetchMe();
    localStorage.setItem('user_credits', String(user.credits));
    setAuth((current) => ({
      ...current,
      email: user.email,
      credits: user.credits,
    }));
    return user.credits;
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Add a product description first.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const availableCredits = await refreshCredits();
      if (availableCredits <= 0) {
        setError('You are out of credits. Buy more credits to create another video.');
        return;
      }

      const result = await createJob({
        image: file,
        secondaryImage: secondaryFile,
        description,
        productCategory,
        style,
        enableStyleTransfer,
      });
      const job = result.data;
      if (typeof result.credits === 'number') {
        localStorage.setItem('user_credits', String(result.credits));
        setAuth((current) => ({ ...current, credits: result.credits || 0 }));
      }

      setJobs((current) => [job, ...current]);
      setSelectedJobId(job._id);
      setActiveWorkspaceTab('overview');
      setDescription('');
      clearProductFiles();
    } catch (nextError: any) {
      if (nextError?.status === 401) {
        clearAuthSession('Your session expired. Please sign in again.');
        return;
      }
      if (nextError?.status === 402) {
        localStorage.setItem('user_credits', '0');
        setAuth((current) => ({ ...current, credits: 0 }));
      }

      setError(nextError.message || 'Unable to create a video job.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrim = async () => {
    if (!selectedJobId) return;

    try {
      setTrimLoading(true);
      setError('');
      const maxSeconds = Number(selectedJob?.metadata?.durationSeconds ?? previewDurationSeconds ?? 0) || 0;
      if (!maxSeconds || !Number.isFinite(maxSeconds) || maxSeconds <= 0) {
        throw new Error('Video duration not loaded yet. Start playback once, then try trimming again.');
      }

      const safeStart = Math.max(0, Math.min(Number(trimStart) || 0, maxSeconds));
      const safeEnd = Math.max(0, Math.min(Number(trimEnd) || maxSeconds, maxSeconds));
      if (safeEnd <= safeStart + 0.05) {
        throw new Error('Out-point must be after in-point.');
      }

      setTrimStart(safeStart);
      setTrimEnd(safeEnd);
      const result = await trimJob(selectedJobId, safeStart, safeEnd);
      setJobs((current) =>
        current.map((job) =>
          job._id === selectedJobId
            ? {
              ...job,
              output: {
                ...job.output,
                trim: result.trim,
              },
            }
            : job
        )
      );
    } catch (nextError: any) {
      if (nextError?.status === 401) {
        clearAuthSession('Your session expired. Please sign in again.');
        return;
      }

      setError(nextError.message || 'Unable to trim the video.');
    } finally {
      setTrimLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession('');
  };

  const applyQuickBrief = (preset: (typeof quickBriefs)[number]) => {
    setCreatorMode('video');
    setDescription(preset.description);
    setProductCategory(preset.category);
    setStyle(preset.style);
    setError('');
  };

  const applyPhotoPromptPreset = (preset: (typeof photoPromptPresets)[number]) => {
    setCreatorMode('photo');
    setPhotoTitle(preset.title);
    setPhotoPrompt(preset.prompt);
    setProductCategory(preset.category);
    setStyle(preset.style);
    setError('');
  };

  const handleDownloadPhoto = async (imageUrl: string, fileName: string) => {
    try {
      setError('');
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('Unable to download this image right now.');
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (nextError: any) {
      setError(nextError?.message || 'Unable to download this image right now.');
    }
  };

  const handlePhotoGenerate = async () => {
    if (!photoTitle.trim()) {
      setError('Add a photo campaign name first.');
      return;
    }

    if (!photoPrompt.trim()) {
      setError('Describe the photo ad you want to generate.');
      return;
    }

    try {
      setPhotoGenerating(true);
      setPhotoProgressLabel('Connecting to Puter...');
      setError('');
      const availableCredits = await refreshCredits();
      if (availableCredits <= 0) {
        setError('You are out of credits. Buy more credits to create another photo ad set.');
        setPhotoProgressLabel('');
        return;
      }

      const imageDataUrls = await generatePhotoAdSet(
        {
          title: photoTitle.trim(),
          prompt: photoPrompt.trim(),
          aspectRatio: photoAspectRatio,
        },
        setPhotoProgressLabel
      );

      setPhotoProgressLabel('Saving photo set to your studio...');

      const result = await createPhotoAd({
        title: photoTitle.trim(),
        prompt: photoPrompt.trim(),
        aspectRatio: photoAspectRatio,
        productCategory,
        style,
        source: 'puter',
        imageDataUrls,
      });
      const nextSet = result.data;
      if (typeof result.credits === 'number') {
        localStorage.setItem('user_credits', String(result.credits));
        setAuth((current) => ({ ...current, credits: result.credits || 0 }));
      }

      setPhotoAds((current) => [nextSet, ...current]);
      setSelectedPhotoAdId(nextSet._id);
      setPhotoProgressLabel('Photo set saved and ready.');
      setPhotoTitle('');
      setPhotoPrompt('');
    } catch (nextError: any) {
      console.error('Photo ad generation failed:', nextError);
      if (nextError?.status === 401) {
        clearAuthSession('Your session expired. Please sign in again.');
        return;
      }
      if (nextError?.status === 402) {
        localStorage.setItem('user_credits', '0');
        setAuth((current) => ({ ...current, credits: 0 }));
      }
      setError(formatPhotoErrorMessage(nextError));
      setPhotoProgressLabel('');
    } finally {
      setPhotoGenerating(false);
    }
  };

  const handleRegenerate = (job: typeof jobs[number]) => {
    setCreatorMode('video');
    setDescription(job.description || '');
    setProductCategory(job.productCategory || 'food-dessert');
    setStyle(job.style || 'energetic');
    setActiveWorkspaceTab('overview');
    setError('');
    // Scroll to top of creation section
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const shellCard =
    'dashboard-shell-card rounded-[28px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55 dark:shadow-glow';
  const shellMutedCard =
    'dashboard-muted-card rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.04]';
  const getStatusBadgeClass = (status?: string) => {
    if (status === 'completed') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200';
    }

    if (status === 'failed') {
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200';
    }

    return 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200';
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          !auth.token ? (
            <AuthScreen
              initialError={authError}
              onAuthenticated={(payload) => {
                setAuthError('');
                setError('');
                setAuth(payload);
              }}
            />
          ) : (
            <div className="studio-dashboard min-h-screen text-slate-900 transition-colors dark:text-white">
              <div className="studio-dashboard__inner mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-4 py-4 lg:px-5">
                <header className="studio-dashboard__header grid gap-4 xl:grid-cols-[minmax(0,1fr),340px]">
                  <div className={`${shellCard} dashboard-hero-card relative overflow-hidden bg-gradient-to-br from-white/95 to-slate-50/90 dark:from-slate-900/90 dark:to-slate-950/90`}>
                    <div className="relative space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-cyan-500/12 p-2 text-cyan-700 dark:bg-cyan-400/12 dark:text-cyan-300">
                            <Sparkles size={18} />
                          </div>
                          <div>
                            <h1 className="text-[1.75rem] font-bold tracking-tight text-slate-900 dark:text-white md:text-[2.15rem]">
                              AI Marketing Studio
                            </h1>
                            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                              Create high-conversion short-form ads in seconds.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className="auth-theme-toggle"
                            onClick={toggleLanguage}
                            aria-label="Toggle language"
                          >
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.02em' }}>
                              {lang === 'sq' ? 'EN' : 'AL'}
                            </span>
                          </button>
                          <button
                            className="auth-theme-toggle"
                            onClick={toggleTheme}
                            aria-label="Toggle theme"
                          >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2.5 md:grid-cols-3">
                        {dashboardStats.map((item) => (
                          <div key={item.label} className={`${shellMutedCard} dashboard-stat-card group transition-all hover:bg-white/95 dark:hover:bg-white/10`}>
                            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 dark:text-slate-500">
                              {item.label}
                            </div>
                            <div className="mt-1 text-[1.9rem] font-bold tracking-tight leading-none">{item.value}</div>
                          </div>
                        ))}
                      </div>

                    </div>
                  </div>

                  <div className={`${shellCard} dashboard-account-card relative flex flex-col justify-between overflow-hidden text-slate-900 dark:text-white`}>
                    {/* Light mode beautiful frosted gradient backdrop */}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/95 to-amber-50/95 backdrop-blur-xl pointer-events-none dark:hidden" />
                    
                    {/* Light mode top-right glow */}
                    <div className="pointer-events-none absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-400/20 to-amber-300/20 blur-3xl dark:hidden" />

                    <div className="relative z-10 flex flex-wrap items-start justify-between gap-2.5">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-700 dark:text-cyan-300">Account</div>
                        <h2 className="mt-1 text-[1.55rem] font-black capitalize tracking-tight text-slate-900 dark:text-white">{firstName}</h2>
                        <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">{auth.email}</p>
                      </div>
                      <button type="button" onClick={handleLogout} className="dashboard-logout-btn group flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/50 transition-all hover:bg-rose-50 hover:text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 dark:hover:bg-rose-500 dark:hover:text-white dark:ring-0">
                        <LogOut size={16} className="text-slate-400 group-hover:text-rose-500 transition-colors dark:text-inherit" />
                      </button>
                    </div>

                    <div className="relative z-10 mt-3.5 grid grid-cols-3 gap-2.5">
                       <div className="dashboard-account-meta flex flex-col gap-1 rounded-2xl bg-white/70 p-3 shadow-sm ring-1 ring-slate-900/5 dark:bg-white/5 dark:ring-white/10">
                          <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Credits</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-white">{auth.credits}</span>
                       </div>
                       <div className="dashboard-account-meta flex flex-col gap-1 rounded-2xl bg-white/70 p-3 shadow-sm ring-1 ring-slate-900/5 dark:bg-white/5 dark:ring-white/10">
                          <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Active Style</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-white">{styles.find(s => s.value === style)?.label || style}</span>
                       </div>
                       <div className="dashboard-account-meta flex flex-col gap-1 rounded-2xl bg-white/70 p-3 shadow-sm ring-1 ring-slate-900/5 dark:bg-white/5 dark:ring-white/10">
                          <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Category</span>
                          <span className="text-sm font-bold truncate text-slate-800 dark:text-white">{formatCategoryLabel(productCategory)}</span>
                       </div>
                    </div>

                  </div>
                </header>

                <main className="studio-dashboard__main grid gap-4 xl:grid-cols-[0.96fr,1.04fr]">
                  {/* LEFT COLUMN: Creation Section */}
                  <section className={`${shellCard} dashboard-builder-card flex flex-col gap-[1.125rem]`}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h2 className="text-[1.6rem] font-bold tracking-tight text-slate-900 dark:text-white">New Campaign</h2>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Select a template or start from scratch</p>
                      </div>
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="dashboard-step-dot flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[7px] font-bold text-slate-400 dark:border-slate-900 dark:bg-slate-800">
                            {i}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCreatorMode('video')}
                        className={`dashboard-tab rounded-2xl border px-4 py-3 text-left transition-all ${
                          creatorMode === 'video'
                            ? 'border-cyan-300/80 bg-cyan-500/10 text-slate-900 dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-white'
                            : 'border-slate-200 bg-white/60 text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-black">
                          <Clapperboard size={16} />
                          Video Ads
                        </div>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-60">
                          Script, media, voice, export
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreatorMode('photo')}
                        className={`dashboard-tab rounded-2xl border px-4 py-3 text-left transition-all ${
                          creatorMode === 'photo'
                            ? 'border-cyan-300/80 bg-cyan-500/10 text-slate-900 dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-white'
                            : 'border-slate-200 bg-white/60 text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-black">
                          <Camera size={16} />
                          Photo Ads
                        </div>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-60">
                          Title, prompt, three premium shots
                        </div>
                      </button>
                    </div>

                    {/* Error Banner */}
                    {error && (
                      <div className="dashboard-error-banner flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                        <span className="mt-0.5 shrink-0 text-rose-500">⚠</span>
                        <div className="flex-1">
                          <div className="font-bold">Campaign Error</div>
                          <div className="opacity-80">{error}</div>
                        </div>
                        <button onClick={() => setError('')} className="shrink-0 opacity-50 hover:opacity-100 text-lg leading-none">×</button>
                      </div>
                    )}

                    {creatorMode === 'video' ? (
                      <>
                    <div className="dashboard-preset-grid grid gap-2.5 sm:grid-cols-3">
                      {quickBriefs.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyQuickBrief(preset)}
                          className="dashboard-preset-card group relative flex min-h-[7.25rem] flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white/40 p-4 text-left transition-all hover:border-cyan-500/40 hover:bg-white hover:shadow-xl hover:shadow-cyan-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:hover:border-cyan-300/30"
                        >
                          <div className="dashboard-preset-copy">
                            <div className="dashboard-preset-title">{preset.label}</div>
                            <div className="dashboard-preset-category">{formatCategoryLabel(preset.category)}</div>
                            <div className="dashboard-preset-style">
                                {styles.find((item) => item.value === preset.style)?.label || preset.style}
                            </div>
                          </div>
                          <div className="dashboard-preset-icon" aria-hidden="true">
                            <Zap size={12} />
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => onDrop(event, 'primary')}
                          className="dashboard-upload-zone flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-[26px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-5 backdrop-blur-sm transition-all hover:border-cyan-500/35 hover:bg-white dark:border-white/5 dark:bg-white/[0.01] dark:hover:border-cyan-300/30 dark:hover:bg-white/[0.03]"
                        >
                          {file ? (
                            <div className="flex w-full items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-300">
                              <div className="flex min-w-0 items-center gap-4">
                                <div className="rounded-2xl bg-cyan-600 p-3 text-white shadow-lg shadow-cyan-500/20 dark:bg-cyan-300 dark:text-slate-950 dark:shadow-cyan-300/10">
                                  <FileImage size={20} />
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{file.name}</div>
                                  <div className="text-[10px] font-black opacity-40 uppercase tracking-tighter">{formatFileSize(file.size)}</div>
                                </div>
                              </div>
                              <button type="button" onClick={() => clearSelectedFile('primary')} className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="rounded-3xl bg-white p-3.5 text-slate-300 shadow-sm dark:bg-white/5 dark:text-slate-600">
                                <ImagePlus size={26} />
                              </div>
                              <div className="text-center space-y-1">
                                <div className="text-[15px] font-bold text-slate-900 dark:text-white">Product Asset 1</div>
                                <p className="text-xs font-medium text-slate-400">Opening hero image</p>
                              </div>
                              <button type="button" onClick={() => openFilePicker('primary')} className="mt-1 rounded-full bg-slate-900 px-[1.125rem] py-2.5 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:scale-105 hover:bg-slate-700 active:scale-95 dark:bg-white dark:text-slate-900">
                                Select File
                              </button>
                            </>
                          )}
                        </div>
                        <div
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => onDrop(event, 'secondary')}
                          className="dashboard-upload-zone flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-[26px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-5 backdrop-blur-sm transition-all hover:border-cyan-500/35 hover:bg-white dark:border-white/5 dark:bg-white/[0.01] dark:hover:border-cyan-300/30 dark:hover:bg-white/[0.03]"
                        >
                          {secondaryFile ? (
                            <div className="flex w-full items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-300">
                              <div className="flex min-w-0 items-center gap-4">
                                <div className="rounded-2xl bg-amber-500 p-3 text-white shadow-lg shadow-amber-500/20 dark:bg-amber-300 dark:text-slate-950 dark:shadow-amber-300/10">
                                  <FileImage size={20} />
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{secondaryFile.name}</div>
                                  <div className="text-[10px] font-black opacity-40 uppercase tracking-tighter">{formatFileSize(secondaryFile.size)}</div>
                                </div>
                              </div>
                              <button type="button" onClick={() => clearSelectedFile('secondary')} className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="rounded-3xl bg-white p-3.5 text-slate-300 shadow-sm dark:bg-white/5 dark:text-slate-600">
                                <ImagePlus size={26} />
                              </div>
                              <div className="text-center space-y-1">
                                <div className="text-[15px] font-bold text-slate-900 dark:text-white">Product Asset 2</div>
                                <p className="text-xs font-medium text-slate-400">Optional closing hero</p>
                              </div>
                              <button type="button" onClick={() => openFilePicker('secondary')} className="mt-1 rounded-full bg-slate-900 px-[1.125rem] py-2.5 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:scale-105 hover:bg-slate-700 active:scale-95 dark:bg-white dark:text-slate-900">
                                Select File
                              </button>
                            </>
                          )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => onSelectFile(event, 'primary')} />
                        <input ref={secondaryFileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => onSelectFile(event, 'secondary')} />
                      </div>

                      <div className="grid gap-3.5 md:grid-cols-2">
                        <div className="space-y-2.5">
                          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
                            <Target size={12} />
                            Product Category
                          </label>
                          <select
                            value={productCategory}
                            onChange={(event) => setProductCategory(event.target.value)}
                            className="dashboard-field w-full rounded-2xl border border-slate-200 bg-white/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-cyan-500/45 hover:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-100 dark:focus:border-cyan-300/35"
                          >
                            {categories.map((item) => (
                              <option
                                key={item.value}
                                value={item.value}
                                className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                              >
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2.5">
                          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
                            <Palette size={12} />
                            Visual Style
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {styles.map((item) => (
                              <button
                                key={item.value}
                                type="button"
                                onClick={() => setStyle(item.value)}
                                aria-pressed={style === item.value}
                                title={item.tone}
                                className={`style-btn rounded-xl border p-2 text-center transition-all ${style === item.value ? 'selected' : ''}`}
                              >
                                <span className="text-[10px] font-black uppercase tracking-tight">{item.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <label className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
                          <div className="flex items-center gap-2">
                            <PenTool size={12} />
                            Proprietary Brief
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void pasteFromClipboard(descriptionTextareaRef.current, setDescription)}
                              className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 transition-all hover:border-cyan-400 hover:text-cyan-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-cyan-300/40 dark:hover:text-cyan-200"
                            >
                              Paste
                            </button>
                            <span className={`${description.length > DESCRIPTION_MAX_LENGTH - 250 ? 'text-amber-500' : 'opacity-40'}`}>{description.length}/{DESCRIPTION_MAX_LENGTH}</span>
                          </div>
                        </label>
                        <textarea
                          ref={descriptionTextareaRef}
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          onPaste={(event) => handleTextareaPaste(event, setDescription)}
                          rows={4}
                          maxLength={DESCRIPTION_MAX_LENGTH}
                          className="dashboard-field campaign-textarea w-full rounded-[24px] border border-slate-200 bg-white/50 px-4 py-3.5 text-[13px] font-medium leading-relaxed outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500/45 focus:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:focus:border-cyan-300/35 dark:placeholder:text-slate-600"
                          placeholder="Describe the product, target audience, and the problem you solve..."
                        />
                      </div>

                      <div className="pt-1">
                        <button type="button" onClick={handleSubmit} disabled={submitting} className="dashboard-submit dashboard-action-btn dashboard-action-btn--primary group relative w-full overflow-hidden rounded-[22px] bg-slate-900 py-4 text-[12px] font-black uppercase tracking-[0.18em] text-white transition-all hover:scale-[1.01] hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
                          <div className="relative z-10 flex items-center justify-center gap-3">
                            {submitting ? <LoaderCircle className="animate-spin" size={20} /> : <Sparkles size={20} />}
                            <span>{submitting ? 'Creating Studio Magic...' : 'Generate Campaign'}</span>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-600 dark:from-cyan-300 dark:to-blue-300" />
                        </button>
                      </div>
                    </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                              <div className="grid gap-2.5 sm:grid-cols-3">
                          {photoPromptPresets.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => applyPhotoPromptPreset(preset)}
                              className="dashboard-preset-card group relative flex min-h-[7.25rem] flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white/40 p-4 text-left transition-all hover:border-cyan-500/40 hover:bg-white hover:shadow-xl hover:shadow-cyan-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:hover:border-cyan-300/30"
                            >
                              <div className="dashboard-preset-copy">
                                <div className="dashboard-preset-title">{preset.label}</div>
                                <div className="dashboard-preset-category">{preset.title}</div>
                                <div className="dashboard-preset-style">
                                  {formatCategoryLabel(preset.category)} • {styles.find((item) => item.value === preset.style)?.label || preset.style}
                                </div>
                              </div>
                              <div className="dashboard-preset-icon" aria-hidden="true">
                                <Camera size={12} />
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="grid gap-3.5 md:grid-cols-2">
                          <div className="space-y-2.5">
                            <label className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                              <Sparkles size={12} />
                              Campaign Name
                            </label>
                            <input
                              value={photoTitle}
                              onChange={(event) => setPhotoTitle(event.target.value)}
                              className="dashboard-field w-full rounded-2xl border border-slate-200 bg-white/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-cyan-500/45 hover:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-100 dark:focus:border-cyan-300/35"
                              placeholder="Ex: Midnight Elixir launch"
                            />
                          </div>

                          <div className="space-y-2.5">
                            <label className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                              <Target size={12} />
                              Product Category
                            </label>
                            <select
                              value={productCategory}
                              onChange={(event) => setProductCategory(event.target.value)}
                              className="dashboard-field w-full rounded-2xl border border-slate-200 bg-white/50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-cyan-500/45 hover:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-100 dark:focus:border-cyan-300/35"
                            >
                              {categories.map((item) => (
                                <option
                                  key={item.value}
                                  value={item.value}
                                  className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                                >
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid gap-3.5 md:grid-cols-2">
                          <div className="space-y-2.5">
                            <label className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                              <Palette size={12} />
                              Visual Style
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {styles.map((item) => (
                                <button
                                  key={item.value}
                                  type="button"
                                  onClick={() => setStyle(item.value)}
                                  aria-pressed={style === item.value}
                                  title={item.tone}
                                  className={`style-btn rounded-xl border p-2 text-center transition-all ${style === item.value ? 'selected' : ''}`}
                                >
                                  <span className="text-[10px] font-black uppercase tracking-tight">{item.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            <label className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                              <Layout size={12} />
                              Aspect Ratio
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              {photoAspectRatios.map((item) => (
                                <button
                                  key={item.value}
                                  type="button"
                                  onClick={() => setPhotoAspectRatio(item.value)}
                                  aria-pressed={photoAspectRatio === item.value}
                                  className={`style-btn rounded-xl border p-2 text-center transition-all ${photoAspectRatio === item.value ? 'selected' : ''}`}
                                >
                                  <span className="text-[10px] font-black uppercase tracking-tight">{item.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <label className="ml-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                            <div className="flex items-center gap-2">
                              <PenTool size={12} />
                              Photo Prompt
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void pasteFromClipboard(photoPromptTextareaRef.current, setPhotoPrompt)}
                                className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 transition-all hover:border-cyan-400 hover:text-cyan-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-cyan-300/40 dark:hover:text-cyan-200"
                              >
                                Paste
                              </button>
                              <span className={`${photoPrompt.length > DESCRIPTION_MAX_LENGTH - 250 ? 'text-amber-500' : 'opacity-40'}`}>{photoPrompt.length}/{DESCRIPTION_MAX_LENGTH}</span>
                            </div>
                          </label>
                          <textarea
                            ref={photoPromptTextareaRef}
                            value={photoPrompt}
                            onChange={(event) => setPhotoPrompt(event.target.value)}
                            onPaste={(event) => handleTextareaPaste(event, setPhotoPrompt)}
                            rows={5}
                            maxLength={DESCRIPTION_MAX_LENGTH}
                            className="dashboard-field campaign-textarea w-full rounded-[24px] border border-slate-200 bg-white/50 px-4 py-3.5 text-[13px] font-medium leading-relaxed outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500/45 focus:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:focus:border-cyan-300/35 dark:placeholder:text-slate-600"
                            placeholder="Describe the scene, mood, materials, camera angle, lighting, and luxury ad feel you want across the photos..."
                          />
                        </div>

                        <div className="rounded-[24px] border border-slate-200/80 bg-white/60 px-4 py-3 text-[12px] font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                          Puter runs this feature in the browser. The first time you use it, Puter may ask you to connect or sign in before it generates the images.
                        </div>

                        <div className="space-y-2 pt-1">
                          <button
                            type="button"
                            onClick={handlePhotoGenerate}
                            disabled={photoGenerating}
                            className="dashboard-submit dashboard-action-btn dashboard-action-btn--primary group relative w-full overflow-hidden rounded-[22px] bg-slate-900 py-4 text-[12px] font-black uppercase tracking-[0.18em] text-white transition-all hover:scale-[1.01] hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                          >
                            <div className="relative z-10 flex items-center justify-center gap-3">
                              {photoGenerating ? <LoaderCircle className="animate-spin" size={20} /> : <Camera size={20} />}
                              <span>{photoGenerating ? (photoProgressLabel || 'Generating premium photos...') : 'Generate 3 Photo Ads'}</span>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400 via-cyan-500 to-blue-600 dark:from-amber-300 dark:to-blue-300" />
                          </button>
                          {photoProgressLabel ? (
                            <div className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                              {photoProgressLabel}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* RIGHT COLUMN: Studio Workspace */}
                  <section className={`${shellCard} dashboard-workspace-card flex flex-col gap-4 bg-white/60 dark:bg-slate-950/40 backdrop-blur-2xl border-l border-slate-200 dark:border-white/5`}>
                    <div className="flex flex-col gap-3.5">
                      <div className="dashboard-workspace-head flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
                        <div className="space-y-1">
                          <h2 className="text-[1.6rem] font-black tracking-tight text-slate-900 dark:text-white">
                            {creatorMode === 'video' ? 'Studio Workspace' : 'Photo Studio'}
                          </h2>
                          <div className="flex items-center gap-2">
                            {creatorMode === 'video' && selectedJob ? (
                              <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm ${getStatusBadgeClass(selectedJob.status)}`}>
                                {selectedJob.status}
                              </div>
                            ) : null}
                            {creatorMode === 'photo' ? (
                              <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-700 shadow-sm dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-200">
                                {photoGenerating ? 'Generating' : 'Photo mode'}
                              </div>
                            ) : null}
                            <span className="text-xs font-bold text-slate-400 truncate max-w-[200px]">
                              {creatorMode === 'video'
                                ? selectedJob?.script?.title || 'No active workspace'
                                : selectedPhotoAd?.title || 'No photo set selected'}
                            </span>
                          </div>
                        </div>
                        <div className="dashboard-workspace-icon flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-400 dark:bg-white/5">
                          {creatorMode === 'video' ? <Layout size={18} /> : <Camera size={18} />}
                        </div>
                      </div>

                      {creatorMode === 'video' ? (
                        <div className="dashboard-tabs flex gap-1 rounded-2xl bg-slate-100/50 p-1 dark:bg-white/5">
                          {workspaceTabs.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setActiveWorkspaceTab(tab.id)}
                              className={`dashboard-tab ${activeWorkspaceTab === tab.id ? 'active' : ''} flex-1 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
                      {creatorMode === 'video' ? (
                      <AnimatePresence mode="wait">
                        {activeWorkspaceTab === 'overview' && (
                          <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4 pb-3"
                          >
                            {selectedJob ? (
                              <>
                                <div className="grid gap-3.5 sm:grid-cols-2">
                                  <div className="dashboard-insight-card dashboard-insight-card--stage rounded-[24px] border border-amber-500/15 bg-amber-500/[0.04] p-[1.125rem] dark:border-amber-300/10 dark:bg-amber-300/[0.04]">
                                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-amber-600 opacity-70 dark:text-amber-300">
                                      <Activity size={14} />
                                      Production Stage
                                    </div>
                                    <div className="mt-2.5 text-[1.55rem] font-black leading-none text-slate-900 dark:text-white">
                                      {stageLabels[selectedJob.stage] || selectedJob.stage}
                                    </div>
                                  </div>

                                  <div className="dashboard-insight-card dashboard-insight-card--progress rounded-[24px] border border-emerald-500/10 bg-emerald-500/[0.03] p-[1.125rem] dark:bg-emerald-500/[0.06]">
                                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-cyan-600 opacity-70 dark:text-cyan-300">
                                      <Zap size={14} />
                                      Live Progress
                                    </div>
                                    <div className="mt-2 flex items-end gap-2">
                                      <div className="text-[1.9rem] font-black leading-none text-slate-900 dark:text-white">{selectedJob.progress}%</div>
                                    </div>
                                    <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                                      <motion.div
                                        className="h-full bg-cyan-500 shadow-[0_0_12px_rgba(14,165,233,0.35)]"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${selectedJob.progress}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="dashboard-blueprint-card space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-white/[0.02]">
                                  <div className="flex items-center justify-between border-b border-slate-50 pb-3 dark:border-white/5">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Content Blueprint</div>
                                    <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500 dark:bg-cyan-300" />
                                  </div>

                                  <div className="space-y-[1.125rem]">
                                    <div>
                                      <span className="inline-block px-3 py-1 rounded-lg bg-slate-50 dark:bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                        Campaign Title
                                      </span>
                                      <h3 className="text-[1.45rem] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                                        {selectedJob.script?.title || 'Drafting...'}
                                      </h3>
                                    </div>

                                    <div className="grid gap-[1.125rem]">
                                      <div className="space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-20">The Hook</span>
                                        <p className="text-[15px] font-bold italic leading-relaxed text-slate-700 dark:text-slate-300">
                                          "{selectedJob.script?.hook}"
                                        </p>
                                      </div>
                                      <div className="h-px bg-slate-50 dark:bg-white/5" />
                                      <div className="space-y-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-20">Call to Action</span>
                                        <p className="text-[1.05rem] font-black tracking-tight text-cyan-700 dark:text-cyan-300">
                                          {selectedJob.script?.cta}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="dashboard-empty-state flex flex-col items-center justify-center py-16 text-center">
                                <div className="relative mb-6">
                                  <div className="absolute inset-0 rounded-full bg-cyan-500/15 blur-3xl animate-pulse dark:bg-cyan-300/10" />
                                  <div className="relative rounded-full border border-slate-200 bg-white p-6 text-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-white/5">
                                    <Sparkles size={36} />
                                  </div>
                                </div>
                                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">System Ready</h3>
                                <p className="mt-2.5 max-w-[280px] text-sm font-bold leading-relaxed text-slate-400">
                                  Launch your first campaign briefly to activate the high-fidelity studio dashboard.
                                </p>
                              </div>
                            )}
                          </motion.div>
                        )}

                        {activeWorkspaceTab === 'preview' && (
                          <motion.div
                            key="preview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6 pb-3"
                          >
                            {selectedJob?.output?.preview?.url ? (
                              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
                                <div className="dashboard-preview-stage relative group mx-auto w-full max-w-[320px]">
                                  <div className="absolute -inset-6 bg-cyan-500/10 blur-[60px] opacity-0 transition-opacity duration-1000 group-hover:opacity-100 dark:bg-cyan-300/10" />
                                  <div className="dashboard-preview-frame relative overflow-hidden rounded-[40px] border-[10px] border-slate-950 bg-black shadow-2xl dark:border-slate-900">
                                    <video
                                      ref={previewVideoRef}
                                      controls
                                      playsInline
                                      src={selectedJob.output.preview.url}
                                      onLoadedMetadata={(event) => {
                                        const duration = Number(event.currentTarget.duration || 0) || 0;
                                        if (duration > 0 && Number.isFinite(duration)) {
                                          setPreviewDurationSeconds(duration);
                                        }
                                      }}
                                      className="aspect-[9/16] w-full bg-black object-contain shadow-inner"
                                    />
                                  </div>
                                </div>

                                <div className="dashboard-segment-card rounded-[30px] border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_20px_60px_rgba(99,102,241,0.12)] dark:border dark:border-white/10 dark:bg-slate-900/50 dark:text-white dark:shadow-[0_20px_60px_rgba(255,209,102,0.06)] dark:backdrop-blur-xl">
                                  <div className="mb-6 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-2 dark:border-transparent dark:bg-cyan-300/10">
                                        <Scissors size={20} className="text-cyan-700 dark:text-cyan-300" />
                                      </div>
                                      <span className="text-base font-black tracking-tight uppercase">Segment Studio</span>
                                    </div>
                                    <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:border-transparent dark:bg-amber-300/10 dark:text-amber-300">
                                      {formatSeconds(Math.max(0, trimEnd - trimStart))} Segment
                                    </div>
                                  </div>

                                  <div className="space-y-7">
                                    <div className="space-y-3.5">
                                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                                        <span>In-point</span>
                                        <span className="text-cyan-700 dark:text-cyan-300">{formatSeconds(trimStart)}</span>
                                      </div>
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const currentTime = previewVideoRef.current?.currentTime;
                                            if (currentTime == null) return;
                                            const nextStart = Number(currentTime) || 0;
                                            setTrimStart(nextStart);
                                            setTrimEnd((current) => (current > nextStart + 0.05 ? current : nextStart + 0.5));
                                          }}
                                          className="dashboard-pill-btn rounded-full border border-slate-200 bg-slate-100 px-3.5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/15 dark:hover:border-white/20"
                                        >
                                          Set from playhead
                                        </button>
                                      </div>
                                      <input
                                        type="range"
                                        min={0}
                                        max={selectedJob.metadata?.durationSeconds || previewDurationSeconds || 0}
                                        step={0.1}
                                        value={trimStart}
                                        onChange={(event) => {
                                          const nextStart = Number(event.target.value) || 0;
                                          setTrimStart(nextStart);
                                          setTrimEnd((current) => (current > nextStart + 0.05 ? current : nextStart + 0.5));
                                        }}
                                        className="w-full accent-cyan-600 dark:accent-cyan-300"
                                      />
                                    </div>
                                    <div className="space-y-3.5">
                                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                                        <span>Out-point</span>
                                        <span className="text-cyan-700 dark:text-cyan-300">{formatSeconds(trimEnd)}</span>
                                      </div>
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const currentTime = previewVideoRef.current?.currentTime;
                                            if (currentTime == null) return;
                                            const maxSeconds = Number(selectedJob.metadata?.durationSeconds ?? previewDurationSeconds ?? 0) || 0;
                                            const nextEnd = Math.max(0, Math.min(Number(currentTime) || 0, maxSeconds || Number(currentTime) || 0));
                                            setTrimEnd(nextEnd);
                                          }}
                                          className="dashboard-pill-btn rounded-full border border-slate-200 bg-slate-100 px-3.5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/15 dark:hover:border-white/20"
                                        >
                                          Set from playhead
                                        </button>
                                      </div>
                                      <input
                                        type="range"
                                        min={0}
                                        max={selectedJob.metadata?.durationSeconds || previewDurationSeconds || 0}
                                        step={0.1}
                                        value={trimEnd}
                                        onChange={(event) => {
                                          const nextEnd = Number(event.target.value) || 0;
                                          setTrimEnd(nextEnd);
                                          setTrimStart((current) => (nextEnd > current + 0.05 ? current : Math.max(0, nextEnd - 0.5)));
                                        }}
                                        className="w-full accent-cyan-600 dark:accent-cyan-300"
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-8 grid grid-cols-2 gap-3">
                                    <button disabled={trimLoading} onClick={handleTrim} className="dashboard-action-btn dashboard-action-btn--primary rounded-2xl bg-cyan-600 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-transform duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 dark:bg-gradient-to-r dark:from-cyan-300 dark:to-blue-300 dark:text-slate-900 shadow-[0_8px_24px_rgba(14,165,233,0.3)] dark:shadow-[0_8px_24px_rgba(103,232,249,0.18)]">
                                      {trimLoading ? 'Processing...' : 'Export Clip'}
                                    </button>
                                    <a href={selectedJob.output.video?.url} target="_blank" rel="noreferrer" className="dashboard-action-btn dashboard-action-btn--secondary flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-700 transition-all hover:border-cyan-200 hover:bg-slate-50 hover:text-cyan-700 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:border-cyan-300/20 dark:hover:bg-white/20 dark:hover:text-white">
                                      <Download size={16} />
                                      Full Master
                                    </a>
                                  </div>

                                  {selectedJob.output?.trim?.asset?.url ? (
                                    <div className="dashboard-export-card mt-6 space-y-3.5 rounded-[24px] border border-slate-200 bg-slate-50 p-[1.125rem] dark:border-white/10 dark:bg-white/5">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/60">
                                          Latest exported clip
                                        </div>
                                        <a
                                          href={selectedJob.output.trim.asset.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          download={`clip-${Math.round(trimStart * 10) / 10}-${Math.round(trimEnd * 10) / 10}.mp4`}
                                          className="dashboard-pill-btn inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:border-cyan-200 hover:bg-slate-50 hover:text-cyan-700 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-cyan-300/20 dark:hover:bg-white/15 dark:hover:text-white"
                                        >
                                          <Download size={14} />
                                          Download clip
                                        </a>
                                      </div>
                                      <video
                                        controls
                                        playsInline
                                        src={selectedJob.output.trim.asset.url}
                                        className="aspect-[9/16] w-full rounded-[22px] bg-black object-contain"
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <div className="dashboard-preview-empty flex flex-col items-center justify-center py-16 text-center text-slate-400">
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                  className="mb-5 rounded-full bg-slate-50 p-6 dark:bg-white/5"
                                >
                                  <Clapperboard size={36} className="opacity-20" />
                                </motion.div>
                                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Finalizing Assets</h4>
                                <p className="mt-2 text-sm font-medium opacity-50">Visual data is being processed in the background.</p>
                              </div>
                            )}
                          </motion.div>
                        )}

                        {activeWorkspaceTab === 'history' && (
                          <motion.div
                            key="history"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-4 pb-4"
                          >
                            <div className="grid gap-3">
                              {jobs.length === 0 ? (
                                <div className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Zero Records found.</div>
                              ) : (
                                jobs.map((job) => (
                                  <button
                                    key={job._id}
                                    onClick={() => setSelectedJobId(job._id)}
                                    className={`dashboard-history-item ${selectedJobId === job._id ? 'selected' : ''} group relative flex items-center justify-between rounded-[24px] border p-4 transition-all duration-300`}
                                  >
                                    <div className="flex min-w-0 flex-1 items-center gap-4">
                                      <div className={`shrink-0 h-2.5 w-2.5 rounded-full shadow-sm ${job.status === 'completed' ? 'bg-emerald-500 shadow-emerald-500/40' :
                                          job.status === 'failed' ? 'bg-rose-500 shadow-rose-500/40 animate-pulse' :
                                            'bg-amber-400 shadow-amber-400/40 animate-pulse'
                                        }`} />
                                      <div className="text-left min-w-0">
                                        <div className="max-w-[200px] truncate text-sm font-black tracking-tight text-slate-900 dark:text-white">
                                          {job.script?.title || job.style}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="text-[9px] font-black uppercase opacity-30 tracking-widest truncate">
                                            {formatCategoryLabel(job.productCategory || 'general-product')}
                                          </span>
                                          <div className="shrink-0 h-1 w-1 rounded-full bg-slate-300 dark:bg-white/20" />
                                          <span className={`text-[9px] font-black ${job.status === 'completed' ? 'text-emerald-500' :
                                              job.status === 'failed' ? 'text-rose-500' :
                                                'text-cyan-600 dark:text-cyan-300'
                                            }`}>
                                            {job.status === 'completed' ? 'Ready' : job.status === 'failed' ? 'Failed' : `${job.progress}% Sync`}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {job.status === 'failed' && (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); handleRegenerate(job); }}
                                          className="dashboard-pill-btn rounded-xl bg-cyan-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-cyan-700 transition-all hover:bg-cyan-600 hover:text-white dark:bg-cyan-300/10 dark:text-cyan-300 dark:hover:bg-cyan-300 dark:hover:text-slate-900"
                                        >
                                          Retry
                                        </button>
                                      )}
                                      <div className="flex h-9 w-9 translate-x-2 items-center justify-center rounded-2xl bg-slate-50 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 dark:bg-white/5">
                                        <ChevronRight size={18} className="text-slate-400" />
                                      </div>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      ) : (
                        <div className="space-y-4 pb-4">
                          {selectedPhotoAd ? (
                            <>
                              <div className="grid gap-3.5 sm:grid-cols-3">
                                <div className="dashboard-insight-card rounded-[24px] border border-cyan-500/10 bg-cyan-500/[0.03] p-[1.125rem] dark:bg-cyan-400/[0.05]">
                                  <div className="text-[9px] font-black uppercase tracking-widest text-cyan-600 opacity-70 dark:text-cyan-300">
                                    Campaign Name
                                  </div>
                                  <div className="mt-2.5 text-[1.2rem] font-black leading-tight text-slate-900 dark:text-white">
                                    {selectedPhotoAd.title}
                                  </div>
                                </div>
                                <div className="dashboard-insight-card rounded-[24px] border border-amber-500/10 bg-amber-500/[0.03] p-[1.125rem] dark:bg-amber-300/[0.05]">
                                  <div className="text-[9px] font-black uppercase tracking-widest text-amber-600 opacity-70 dark:text-amber-300">
                                    Category
                                  </div>
                                  <div className="mt-2.5 text-[1.2rem] font-black leading-tight text-slate-900 dark:text-white">
                                    {formatCategoryLabel(selectedPhotoAd.productCategory || 'general-product')}
                                  </div>
                                </div>
                                <div className="dashboard-insight-card rounded-[24px] border border-emerald-500/10 bg-emerald-500/[0.03] p-[1.125rem] dark:bg-emerald-400/[0.05]">
                                  <div className="text-[9px] font-black uppercase tracking-widest text-emerald-600 opacity-70 dark:text-emerald-300">
                                    Output
                                  </div>
                                  <div className="mt-2.5 text-[1.2rem] font-black leading-tight text-slate-900 dark:text-white">
                                    {selectedPhotoAd.images.length} luxury frames
                                  </div>
                                </div>
                              </div>

                              <div className="dashboard-blueprint-card space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-white/[0.02]">
                                <div className="flex items-center justify-between border-b border-slate-50 pb-3 dark:border-white/5">
                                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Photo Brief</div>
                                  <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-200">
                                    {selectedPhotoAd.aspectRatio}
                                  </div>
                                </div>
                                <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                                  {selectedPhotoAd.prompt}
                                </p>
                              </div>

                              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {selectedPhotoAd.images.map((image, index) => (
                                  <div
                                    key={`${selectedPhotoAd._id}-${index + 1}`}
                                    className="dashboard-export-card overflow-hidden rounded-[26px] border border-slate-200 bg-white p-3 transition-transform hover:-translate-y-1 dark:border-white/10 dark:bg-white/[0.03]"
                                  >
                                    <div className="mb-3 flex items-center justify-between">
                                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                        Concept 0{index + 1}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <a
                                          href={image.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="dashboard-pill-btn inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-600 transition-all hover:border-cyan-200 hover:text-cyan-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                                        >
                                          <ExternalLink size={12} />
                                          Open
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => handleDownloadPhoto(image.url || '', buildPhotoDownloadName(selectedPhotoAd.title, index))}
                                          className="dashboard-pill-btn inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-600 transition-all hover:border-cyan-200 hover:text-cyan-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                                          title="Download image"
                                        >
                                          <Download size={12} />
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                    <a href={image.url} target="_blank" rel="noreferrer">
                                      <img
                                        src={image.url}
                                        alt={`${selectedPhotoAd.title} concept ${index + 1}`}
                                        className="aspect-square w-full rounded-[18px] object-cover"
                                      />
                                    </a>
                                  </div>
                                ))}
                              </div>

                              <div className="space-y-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                  Photo History
                                </div>
                                <div className="grid gap-3">
                                  {photoAds.map((item) => (
                                    <button
                                      key={item._id}
                                      type="button"
                                      onClick={() => setSelectedPhotoAdId(item._id)}
                                      className={`dashboard-history-item ${selectedPhotoAdId === item._id ? 'selected' : ''} group relative flex items-center justify-between rounded-[24px] border p-4 text-left transition-all duration-300`}
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-black tracking-tight text-slate-900 dark:text-white">
                                          {item.title}
                                        </div>
                                        <div className="mt-1 flex items-center gap-2">
                                          <span className="truncate text-[9px] font-black uppercase tracking-widest opacity-30">
                                            {formatCategoryLabel(item.productCategory || 'general-product')}
                                          </span>
                                          <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-white/20" />
                                          <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-300">
                                            {item.images.length} images
                                          </span>
                                        </div>
                                      </div>
                                      <ChevronRight size={18} className="text-slate-400 transition-transform group-hover:translate-x-1" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="dashboard-empty-state flex min-h-[20rem] flex-col items-center justify-center gap-4 text-center">
                              <div className="rounded-full border border-slate-200 bg-white p-6 text-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-600">
                                <Camera size={34} />
                              </div>
                              <div>
                                <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                                  Photo studio ready
                                </h3>
                                <p className="mt-2 max-w-[340px] text-sm font-medium text-slate-400">
                                  Add a campaign name and a rich prompt, then the studio will generate three polished ad photo concepts for you.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                </main>

                <AnimatePresence>
                  {isPreviewOpen && previewUrl ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4 py-8"
                      onClick={() => setIsPreviewOpen(false)}
                    >
                      <motion.div
                        initial={{ scale: 0.96, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.96, opacity: 0 }}
                        className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-slate-900 p-5 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm font-medium text-white">{file?.name || 'Selected image'}</div>
                            <div className="text-xs text-slate-400">Quick preview only. The studio keeps the upload compact in the form.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsPreviewOpen(false)}
                            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white"
                          >
                            Close
                          </button>
                        </div>

                        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black">
                          <img src={previewUrl} alt="Selected product preview" className="max-h-[70vh] w-full object-contain" />
                        </div>
                      </motion.div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          )
        }
      />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
