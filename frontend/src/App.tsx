import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ElementType,
} from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Eye,
  Folder,
  History,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import logoWhite from './assets/logo-white.png';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import type { PhotoJob, VideoJob } from './lib/api';

import ResetPasswordPage from './pages/ResetPasswordPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import { useJobs, useCampaignForm, type CampaignKind, type DashboardJob } from './hooks';
import { generatePhotoAdSet } from './lib/puter';
import { createPhotoAd, fetchPhotoAds } from './lib/api';

type SectionKey = 'dashboard' | 'create' | 'workspace' | 'history';
type CreateFocus = CampaignKind | 'upload';
type WorkspaceFocus = 'preview' | 'brief';

const createModes: Array<{
  kind: CampaignKind;
  label: string;
}> = [
  { kind: 'video', label: 'Video' },
  { kind: 'photo', label: 'Photo' },
];

const createStyles = [
  { value: 'energetic', label: 'Energetic', tone: 'Fast hook, bold cadence, punchy CTA' },
  { value: 'luxury', label: 'Luxury', tone: 'Premium tone, refined pacing, elegant product framing' },
  { value: 'minimal', label: 'Minimal', tone: 'Clean visuals, crisp copy, understated confidence' },
  { value: 'cinematic', label: 'Cinematic', tone: 'Atmospheric, emotive, brand-film energy' },
];

const productCategories = [
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

const sidebarItems: Array<{
  label: string;
  description: string;
  icon: ElementType;
  action: SectionKey;
}> = [
  {
    label: 'Dashboard',
    description: 'Campaign overview',
    icon: LayoutDashboard,
    action: 'dashboard',
  },
  {
    label: 'Create',
    description: 'Video and photo campaigns',
    icon: Plus,
    action: 'create',
  },
  {
    label: 'Workspace',
    description: 'Preview and brief',
    icon: Folder,
    action: 'workspace',
  },
  {
    label: 'History',
    description: 'Recent jobs and queue status',
    icon: History,
    action: 'history',
  },
];

const getStatusLabel = (status: DashboardJob['status']) => {
  if (status === 'completed') return 'Ready';
  if (status === 'processing' || status === 'queued') return 'Queued';
  return 'Draft';
};

const getStatusTone = (status: DashboardJob['status']) => {
  if (status === 'completed') return 'ready';
  if (status === 'processing' || status === 'queued') return 'queued';
  return 'draft';
};

const formatDate = (value?: string) => {
  if (!value) return 'Today';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getInitials = (email?: string) => {
  if (!email) return 'AL';
  const [name] = email.split('@');
  const parts = name.split(/[._-]+/).filter(Boolean);

  if (parts.length === 0) {
    return name.slice(0, 2).toUpperCase() || 'AL';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'AL';
};

function DashboardPage() {
  const { theme, toggleTheme } = useTheme();
  const { logout, user, loading, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      refreshUser();
      fetchPhotoAds().then(res => setPhotoAds(res)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [createMode, setCreateMode] = useState<CampaignKind>('video');
  const [historyMode, setHistoryMode] = useState<CampaignKind>('video');
  const [activeSection, setActiveSection] = useState<SectionKey>('dashboard');
  const [expandedSection, setExpandedSection] = useState<SectionKey | null>('create');
  const [createFocus, setCreateFocus] = useState<CreateFocus>('video');
  const [workspaceFocus, setWorkspaceFocus] = useState<WorkspaceFocus>('preview');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [photoAds, setPhotoAds] = useState<any[]>([]);
  const [selectedPhotoAdId, setSelectedPhotoAdId] = useState<string | null>(null);
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoPrompt, setPhotoPrompt] = useState('');
  const [photoAspectRatio, setPhotoAspectRatio] = useState('1:1');
  const [photoGenerating, setPhotoGenerating] = useState(false);
  const [photoProgressLabel, setPhotoProgressLabel] = useState('');
  const [error, setError] = useState('');
  const [selectedPhotoImageIdx, setSelectedPhotoImageIdx] = useState<number | null>(null);
  const [briefTab, setBriefTab] = useState<'audience' | 'offer' | 'proof'>('audience');

  const {
    jobs,
    combinedJobs,
    isLoading: isLoadingJobs,
    error: loadError,
    loadJobs
  } = useJobs(selectedJobId);

  const dashboardSectionRef = useRef<HTMLElement | null>(null);
  const createSectionRef = useRef<HTMLElement | null>(null);
  const workspaceSectionRef = useRef<HTMLElement | null>(null);
  const historySectionRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeJob = useMemo(() => {
    // Try to find in combinedJobs first (Video/Photo Jobs)
    const job = combinedJobs.find((j) => j._id === selectedJobId);
    if (job) return job;

    // Then try to find in photoAds
    const ad = photoAds.find((a) => a._id === selectedJobId || a._id === selectedPhotoAdId);
    if (ad) {
      return {
        ...ad,
        kind: 'photo',
        description: ad.prompt || ad.description, // PhotoAds use 'prompt' for description
      };
    }

    return combinedJobs[0] || null;
  }, [combinedJobs, photoAds, selectedJobId, selectedPhotoAdId]);

  useEffect(() => {
    if (combinedJobs.length === 0) {
      setSelectedJobId(null);
      return;
    }

    const stillExists = combinedJobs.some((job) => job._id === selectedJobId);
    if (!selectedJobId || !stillExists) {
      setSelectedJobId(combinedJobs[0]._id);
    }
  }, [combinedJobs, selectedJobId]);

  useEffect(() => {
    if (photoAds.length > 0 && !selectedPhotoAdId) {
      setSelectedPhotoAdId(photoAds[0]._id);
    }
  }, [photoAds, selectedPhotoAdId]);

  const {
    form,
    setForm,
    isSubmitting,
    error: submitError,
    handleFileChange,
    handleSubmit: handleCreateSubmit
  } = useCampaignForm(
    createMode,
    (jobId) => {
      setSelectedJobId(jobId);
      setHistoryMode(createMode);
      setWorkspaceFocus('preview');
      setActiveSection('workspace');
      setExpandedSection('workspace');
      refreshUser();
    },
    loadJobs
  );

  const videoCount = jobs.videoJobs.length;
  const photoCount = jobs.photoJobs.length + photoAds.length;
  const totalCount = combinedJobs.length + photoAds.length;
  const readyCount = combinedJobs.filter((job) => job.status === 'completed').length + photoAds.length;
  const queuedCount = combinedJobs.filter(
    (job) => job.status === 'processing' || job.status === 'queued'
  ).length;
  const selectedHistory = combinedJobs.filter((job) => job.kind === historyMode).slice(0, 8);
  const activeProgress =
    activeJob?.progress ?? (activeJob?.status === 'completed' ? 100 : activeJob?.status ? 20 : 0);
  const [puterStatus, setPuterStatus] = useState<string>('');
  useEffect(() => {
    (window as any).onPuterStatus = (msg: string) => setPuterStatus(msg);
    return () => { (window as any).onPuterStatus = null; };
  }, []);
  const userInitials = getInitials(user?.email);
  const userLabel = user?.email?.split('@')[0] || 'AI Studio';

  const createCopy =
    createMode === 'video'
      ? {
          tag: 'VIDEO',
          title: 'Create a Video Campaign',
          description: 'Turn a short brief into a polished video asset with style, category, and upload controls ready.',
          submit: 'QUEUE VIDEO',
        }
      : {
          tag: 'PHOTO',
          title: 'Create a Photo Campaign',
          description: 'Generate still campaign visuals from the same brief, style, category, and source image setup.',
          submit: 'QUEUE PHOTO',
        };

  const focusItems = [
    { label: 'Mode', value: createMode === 'video' ? 'Video' : 'Photo' },
    { label: 'Style', value: createStyles.find(s => s.value === form.style)?.label || form.style },
    { label: 'Category', value: productCategories.find(c => c.value === form.productCategory)?.label || form.productCategory },
    { label: 'Images', value: form.images.length > 0 ? `${form.images.length} selected` : 'None' },
    { label: 'Queue', value: isSubmitting ? 'Sending' : 'Ready' },
  ];

  const activeOutputUrl = useMemo(() => {
    if (!activeJob) return '';

    if (activeJob.kind === 'video') {
      const job = activeJob as VideoJob;
      return job.output?.preview?.url || job.output?.video?.url || '';
    }

    const job = activeJob as PhotoJob;
    return job.output?.final?.url || job.output?.variants?.[0]?.url || '';
  }, [activeJob]);

  const handleSidebarSelect = (section: SectionKey) => {
    if (section === 'create') {
      selectCreateMode('video');
      return;
    }
    
    setActiveSection(section);
    setExpandedSection(section);

    if (section === 'dashboard') {
      setExpandedSection(null);
      navigate('/dashboard', { replace: true });
    }
  };

  const selectCreateMode = (mode: CampaignKind) => {
    setCreateMode(mode);
    setHistoryMode(mode);
    setCreateFocus(mode);
    setActiveSection('create');
    setExpandedSection('create');
  };

  const selectWorkspaceFocus = (focus: WorkspaceFocus) => {
    setWorkspaceFocus(focus);
    setActiveSection('workspace');
    setExpandedSection('workspace');
  };

  const selectHistoryMode = (mode: CampaignKind) => {
    setHistoryMode(mode);
    setActiveSection('history');
    setExpandedSection('history');
  };

  const handlePhotoCardClick = (ad: any) => {
    setSelectedJobId(null);
    setCreatorMode('photo');
    setSelectedPhotoAdId(ad._id);
    setSelectedPhotoImageIdx(null);
    setActiveWorkspaceTab('preview');
    setActiveSection('workspace');
    setExpandedSection('workspace');
    setWorkspaceFocus('preview');
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
        productCategory: form.productCategory,
        style: form.style,
        source: 'puter',
        imageDataUrls,
      });

      const nextSet = result.data;
      if (typeof result.credits === 'number') {
        localStorage.setItem('user_credits', String(result.credits));
        refreshUser();
      }

      setPhotoAds((current) => [nextSet, ...current]);
      setSelectedJobId(null);
      setSelectedPhotoAdId(nextSet._id);
      setPhotoProgressLabel('Photo set saved and ready.');
      setPhotoTitle('');
      setPhotoPrompt('');
      
      // Navigate to workspace
      setActiveSection('workspace');
      setExpandedSection('workspace');
      setWorkspaceFocus('preview');
      setCreatorMode('photo');
    } catch (nextError: any) {
      console.error('Photo ad generation failed:', nextError);
      setError(nextError?.message || 'Photo generation failed.');
      setPhotoProgressLabel('');
    } finally {
      setPhotoGenerating(false);
    }
  };

  const selectedPhotoAd = useMemo(() => {
    return photoAds.find((ad) => ad._id === selectedPhotoAdId) || null;
  }, [photoAds, selectedPhotoAdId]);

  const [creatorMode, setCreatorMode] = useState<'video' | 'photo'>('video');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'preview' | 'brief' | 'overview'>('overview');

  const handleHistoryCardClick = (job: DashboardJob) => {
    setSelectedPhotoAdId(null);
    setSelectedJobId(job._id);
    setHistoryMode(job.kind);
    setWorkspaceFocus('preview');
    setActiveSection('workspace');
    setExpandedSection('workspace');
  };


  const handleFileChangeLocal = (event: ChangeEvent<HTMLInputElement>) => {
    handleFileChange(event);
    setCreateFocus('upload');
    setActiveSection('create');
    setExpandedSection('create');
  };

  const openOutput = () => {
    if (!activeOutputUrl) return;
    window.open(activeOutputUrl, '_blank', 'noopener,noreferrer');
  };

  const overviewCards = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      title: 'Campaign work at a glance',
      detail: 'Track generated assets, queued jobs, and ready outputs from one focused dashboard.',
      stat: isLoadingJobs ? '...' : `${totalCount} jobs`,
      actionLabel: 'Open overview',
      onClick: () => handleSidebarSelect('dashboard'),
      icon: LayoutDashboard,
    },
    {
      key: 'create',
      label: 'Create',
      title: 'Build video or photo campaigns',
      detail: 'Choose the format, write the brief, set the visual direction, and queue the job.',
      stat: createMode === 'video' ? 'Video flow' : 'Photo flow',
      actionLabel: 'Open create',
      onClick: () => handleSidebarSelect('create'),
      icon: Plus,
    },
    {
      key: 'workspace',
      label: 'Workspace',
      title: 'Review every active output',
      detail: 'Open the selected asset, follow progress, and keep the campaign brief close.',
      stat: (creatorMode === 'photo' && selectedPhotoAd) ? 'Photo set active' : (activeJob ? getStatusLabel(activeJob.status) : 'No active asset'),
      actionLabel: 'Open workspace',
      onClick: () => handleSidebarSelect('workspace'),
      icon: Folder,
    },
    {
      key: 'history',
      label: 'History',
      title: 'Recent jobs grouped by type',
      detail: 'Browse recent video and photo work with status, dates, and backend notes.',
      stat: isLoadingJobs ? '...' : `${totalCount} items`,
      actionLabel: 'Open history',
      onClick: () => handleSidebarSelect('history'),
      icon: History,
    },
  ];

  return (
    <div className={`studio-page ${theme === 'dark' ? 'is-dark' : ''}`}>
      <aside className="studio-sidebar">
        <div className="studio-sidebar__top">
          <div className="sidebar-brand">
            <img className="sidebar-logo" src={logoWhite} alt="AI Marketing Studio" />
            <div className="sidebar-brand__copy">
              <span>AI Marketing</span>
              <small>Campaign workspace</small>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Primary">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.action;
              const isExpandable = item.action !== 'dashboard';
              const isExpanded = expandedSection === item.action;

              return (
                <div key={item.label} className="sidebar-nav-group">
                  <button
                    type="button"
                    className={`sidebar-nav-item${isActive ? ' is-active' : ''}`}
                    onClick={() => handleSidebarSelect(item.action)}
                    aria-expanded={isExpandable ? isExpanded : undefined}
                  >
                    <span className="sidebar-nav-item__icon">
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <span className="sidebar-nav-item__copy">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    {isExpandable ? (
                      <ChevronDown
                        size={15}
                        className={`nav-caret${isExpanded ? ' is-open' : ''}`}
                      />
                    ) : null}
                  </button>

                  {item.action === 'create' && isExpanded ? (
                    <div className="sidebar-dropdown" role="menu" aria-label="Create options">
                      <button
                        type="button"
                        className={`sidebar-dropdown-item${createMode === 'video' && createFocus !== 'upload' ? ' is-active' : ''}`}
                        onClick={() => selectCreateMode('video')}
                      >
                        <span>Video Campaign</span>
                        <small>Brief, style and queue</small>
                      </button>
                      <button
                        type="button"
                        className={`sidebar-dropdown-item${createMode === 'photo' && createFocus !== 'upload' ? ' is-active' : ''}`}
                        onClick={() => selectCreateMode('photo')}
                      >
                        <span>Photo Campaign</span>
                        <small>Separate still-image flow</small>
                      </button>
                    </div>
                  ) : null}

                  {item.action === 'workspace' && isExpanded ? (
                    <div className="sidebar-dropdown" role="menu" aria-label="Workspace options">
                      <button
                        type="button"
                        className={`sidebar-dropdown-item${workspaceFocus === 'preview' ? ' is-active' : ''}`}
                        onClick={() => selectWorkspaceFocus('preview')}
                      >
                        <span>Live Preview</span>
                        <small>Output, progress and controls</small>
                      </button>
                      <button
                        type="button"
                        className={`sidebar-dropdown-item${workspaceFocus === 'brief' ? ' is-active' : ''}`}
                        onClick={() => selectWorkspaceFocus('brief')}
                      >
                        <span>Campaign Brief</span>
                        <small>Message, chips and context</small>
                      </button>
                    </div>
                  ) : null}

                  {item.action === 'history' && isExpanded ? (
                    <div className="sidebar-dropdown" role="menu" aria-label="History options">
                      <button
                        type="button"
                        className={`sidebar-dropdown-item${historyMode === 'video' ? ' is-active' : ''}`}
                        onClick={() => selectHistoryMode('video')}
                      >
                        <span>Video History</span>
                        <small>Queued and completed videos</small>
                      </button>
                      <button
                        type="button"
                        className={`sidebar-dropdown-item${historyMode === 'photo' ? ' is-active' : ''}`}
                        onClick={() => selectHistoryMode('photo')}
                      >
                        <span>Photo History</span>
                        <small>Rendered still campaigns</small>
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer__row">
            <div className="user-pill">
              <span>{userInitials}</span>
            </div>
            <div className="sidebar-footer__identity">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <strong>{userLabel}</strong>
                <span style={{ 
                  fontSize: '10px', 
                  color: '#f59e0b', 
                  background: 'rgba(245, 158, 11, 0.15)', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  fontWeight: 700,
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {user?.credits ?? 0} CREDITS
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <small>Workspace owner</small>
              </div>
            </div>
            <button type="button" className="icon-pill" aria-label="Toggle theme" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={16} strokeWidth={2.2} /> : <Moon size={16} strokeWidth={2.2} />}
            </button>
          </div>

          <button type="button" className="logout-button" onClick={handleLogout}>
            <LogOut size={14} strokeWidth={2.2} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <main className="studio-main">
        <div className="studio-main__inner">
          {activeSection === 'dashboard' && (
            <>
              <header className="studio-hero" ref={dashboardSectionRef}>
                <div className="studio-hero__copy">
                  <div className="panel-kicker">DASHBOARD</div>
                  <h1>Campaign asset studio.</h1>
                  <p>
                    Create video and photo campaigns, review outputs, and keep every marketing job
                    organized in one focused workspace.
                  </p>
                </div>

                <div className="studio-hero__stats">
                  <div className="hero-stat">
                    <span className="hero-stat__label">Total Jobs</span>
                    <strong>{isLoadingJobs ? '...' : totalCount}</strong>
                  </div>
                  <div className="hero-stat">
                    <span className="hero-stat__label">Ready Assets</span>
                    <strong>{isLoadingJobs ? '...' : readyCount}</strong>
                  </div>
                  <div className="hero-stat">
                    <span className="hero-stat__label">Queued</span>
                    <strong>{isLoadingJobs ? '...' : queuedCount}</strong>
                  </div>
                </div>
              </header>

              {loadError ? (
                <section className="studio-banner studio-banner--error" role="status">
                  <Eye size={14} strokeWidth={2.2} />
                  <span>{loadError}</span>
                </section>
              ) : null}

              <section className="feature-overview">
                {overviewCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <article key={card.key} className="feature-card">
                      <div className="feature-card__head">
                        <span className="feature-card__icon">
                          <Icon size={18} strokeWidth={2.1} />
                        </span>
                        <span className="feature-card__label">{card.label}</span>
                      </div>
                      <h2>{card.title}</h2>
                      <p>{card.detail}</p>
                      <div className="feature-card__footer">
                        <span className="feature-card__stat">{card.stat}</span>
                        <button type="button" className="mini-button mini-button--ghost" onClick={card.onClick}>
                          {card.actionLabel}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
            </>
          )}

          {activeSection === 'create' && (
            <section className="feature-section" ref={createSectionRef}>
              <div className="feature-section__header">
                <div>
                  <div className="panel-kicker">CREATE</div>
                  <h2>Build the next campaign asset</h2>
                  <p>
                    Choose video or photo, write the brief, set the style, and attach a source image when
                    the campaign needs one.
                  </p>
                </div>

                <div className="chip-switch">
                  {createModes.map((mode) => (
                    <button
                      key={mode.kind}
                      type="button"
                      className={`chip-switch__item${createMode === mode.kind ? ' is-active' : ''}`}
                      onClick={() => selectCreateMode(mode.kind)}
                    >
                      {mode.label.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="feature-section__body feature-section__body--create">
                <article className={`panel panel--create ${createFocus !== 'upload' ? 'is-emphasis' : ''}`}>
                  <div className="panel-kicker">{createCopy.tag}</div>

                  <form
                    className="campaign-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (createMode === 'video') {
                        handleCreateSubmit(event);
                      } else {
                        handlePhotoGenerate();
                      }
                    }}
                  >
                    <div className="panel-copy">
                      <h3>{createMode === 'video' ? createCopy.title : 'Photo Studio'}</h3>
                      <p>{createMode === 'video' ? createCopy.description : 'Generate high-end AI visuals for your brand.'}</p>
                    </div>

                    {createMode === 'video' ? (
                      <>
                        <label className="field">
                          <span className="field__label">Campaign Title</span>
                          <input
                            type="text"
                            className="field__control"
                            placeholder="e.g. Summer Skincare Launch"
                            value={form.title}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, title: event.target.value }))
                            }
                          />
                        </label>

                        <label className="field">
                          <span className="field__label">Brief</span>
                          <textarea
                            className="field__control field__control--textarea"
                            placeholder="Describe your video ad campaign goal..."
                            value={form.description}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, description: event.target.value }))
                            }
                            rows={4}
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="field">
                          <span className="field__label">Photo Campaign Title</span>
                          <input
                            type="text"
                            className="field__control"
                            placeholder="e.g. Luxury Watch Hero Shot"
                            value={photoTitle}
                            onChange={(event) => setPhotoTitle(event.target.value)}
                          />
                        </label>

                        <label className="field">
                          <span className="field__label">Photo Prompt</span>
                          <textarea
                            className="field__control field__control--textarea"
                            placeholder="Describe the scene, mood, materials, camera angle, lighting..."
                            value={photoPrompt}
                            onChange={(event) => setPhotoPrompt(event.target.value)}
                            rows={5}
                          />
                        </label>
                        
                        <label className="field">
                          <span className="field__label">Aspect Ratio</span>
                          <select
                            className="field__control"
                            value={photoAspectRatio}
                            onChange={(event) => setPhotoAspectRatio(event.target.value)}
                          >
                            <option value="1:1">1:1 Square</option>
                            <option value="4:5">4:5 Portrait</option>
                            <option value="16:9">16:9 Landscape</option>
                          </select>
                        </label>
                      </>
                    )}

                    <div className="field-grid">
                      <label className="field">
                        <span className="field__label">Style</span>
                        <select
                          className="field__control"
                          value={form.style}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, style: event.target.value }))
                          }
                        >
                          {createStyles.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span className="field__label">Category</span>
                        <select
                          className="field__control"
                          value={form.productCategory}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, productCategory: event.target.value }))
                          }
                        >
                          {productCategories.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {submitError || error ? (
                      <div className="studio-banner studio-banner--error">{submitError || error}</div>
                    ) : null}

                    <button 
                      type="submit" 
                      className="submit-button" 
                      disabled={createMode === 'video' ? isSubmitting : photoGenerating}
                    >
                      {createMode === 'video' 
                        ? (isSubmitting ? 'QUEUEING...' : 'QUEUE VIDEO') 
                        : (photoGenerating ? (photoProgressLabel || 'GENERATING...') : 'GENERATE 3 PHOTOS')}
                    </button>
                    {photoGenerating && photoProgressLabel && (
                      <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '8px', fontWeight: 'bold', color: '#6366f1' }}>
                        {photoProgressLabel}
                      </div>
                    )}
                  </form>
                </article>

                <div className="feature-stack">
                  <article className="panel panel--focus">
                    <div className="panel-kicker">CURRENT FOCUS</div>
                    <div className="focus-list">
                      {focusItems.map((item) => (
                        <div key={item.label} className="focus-row">
                          <span className="focus-row__label">{item.label}</span>
                          <span className="focus-row__value">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className={`panel panel--upload ${createFocus === 'upload' ? 'is-emphasis' : ''}`}>
                    <div className="panel-kicker">ASSET UPLOAD</div>
                    <div className="drop-zone">
                      <Upload size={34} strokeWidth={1.8} />
                      <div className="drop-zone__title">
                        {form.images.length === 0 && 'Drop or pick up to 2 photos'}
                        {form.images.length === 1 && '1 photo selected — add 1 more for the closing scene'}
                        {form.images.length >= 2 && '2 photos selected ✓'}
                      </div>
                      <div className="drop-zone__meta">
                        {form.images.length > 0
                          ? form.images.map((f, i) => `${i === 0 ? 'Start' : 'End'}: ${f.name}`).join(' · ')
                          : 'Photo 1 → opens video · Photo 2 → closes video'}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden-file-input"
                        onChange={handleFileChangeLocal}
                      />
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="mini-button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={form.images.length >= 2}
                        >
                          {form.images.length === 0 ? 'SELECT PHOTOS' : form.images.length === 1 ? 'ADD CLOSING PHOTO' : '2 / 2 SELECTED'}
                        </button>
                        {form.images.length > 0 && (
                          <button
                            type="button"
                            className="mini-button mini-button--ghost"
                            onClick={() => setForm((c) => ({ ...c, images: [] }))}
                          >
                            CLEAR ALL
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'workspace' && (
            <section className="feature-section" ref={workspaceSectionRef}>
              <div className="feature-section__header">
                <div>
                  <div className="panel-kicker">WORKSPACE</div>
                  <h2>Preview the selected output</h2>
                  <p>
                    Review the active asset, monitor progress, and keep the original campaign brief close
                    while the job moves through the queue.
                  </p>
                </div>

                <div className="chip-switch">
                  <button
                    type="button"
                    className={`chip-switch__item${workspaceFocus === 'preview' ? ' is-active' : ''}`}
                    onClick={() => selectWorkspaceFocus('preview')}
                  >
                    PREVIEW
                  </button>
                  <button
                    type="button"
                    className={`chip-switch__item${workspaceFocus === 'brief' ? ' is-active' : ''}`}
                    onClick={() => selectWorkspaceFocus('brief')}
                  >
                    BRIEF
                  </button>
                </div>
              </div>

              <div className="feature-section__body feature-section__body--workspace">
                <article className={`panel panel--workspace ${workspaceFocus === 'preview' ? 'is-emphasis' : ''}`}>
                  <div className="panel-kicker">LIVE PREVIEW</div>
                  <div className="player">
                    <div className="player__topline">
                      <div className="player__label">
                        <Sparkles size={14} strokeWidth={2.4} />
                        <span>
                          {creatorMode === 'video' 
                            ? (activeJob?.title || 'VIDEO REEL')
                            : (selectedPhotoAd?.title || 'PHOTO STUDIO')
                          }
                        </span>
                      </div>
                      <div className="player__badge">
                        {creatorMode === 'video' 
                          ? (activeJob ? formatDate(activeJob.createdAt) : 'NO JOB')
                          : (selectedPhotoAd ? formatDate(selectedPhotoAd.createdAt) : 'NO SET')
                        }
                      </div>
                    </div>

                    <div className="player__body">
                      <div className="player__title">
                        {(() => {
                          if (creatorMode === 'photo') {
                            if (!selectedPhotoAd) return 'Select a photo set from history';
                            return <div className="post-preview">{selectedPhotoAd.prompt}</div>;
                          }
                          if (!activeJob) return 'No job selected yet';
                          if (activeJob.kind === 'video') {
                            const vJob = activeJob as VideoJob;
                            if (vJob.script) {
                              return (
                                <div className="post-preview">
                                  <div className="post-preview__body">
                                    {vJob.script.hook || vJob.script.title || vJob.description} {vJob.script.cta}
                                  </div>
                                  <div className="post-preview__tags">
                                    {(vJob.script.hashtags || []).map((tag) => (
                                      <span key={tag}>#{tag.replace(/^#/, '')}</span>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                          } else {
                            const pJob = activeJob as PhotoJob;
                            if (pJob.caption) {
                              return <div className="post-preview">{pJob.caption}</div>;
                            }
                          }
                          return activeJob.description;
                        })()}
                      </div>
                    </div>

                    <div className="player__timing">
                      <div className="player__timing-head">
                        <span>PROGRESS</span>
                        <span>{Math.min(100, Math.max(0, activeProgress || 0)).toFixed(0)}%</span>
                      </div>
                      <div className="player__bar">
                        <div
                          className="player__knob"
                          style={{ left: `${Math.min(100, Math.max(0, activeProgress || 0))}%` }}
                        />
                      </div>
                    </div>

                    <div className="player__preview player__preview--photo">
                      <div className="player__preview-surface player__preview-surface--photo">
                        {creatorMode === 'photo' ? (
                          selectedPhotoAd ? (
                            <div className="photo-studio-preview">
                              {/* 3 Photos Horizontal with Save/Download buttons */}
                              <div className="photo-concepts-grid">
                                {selectedPhotoAd.images.map((image: any, index: number) => (
                                  <div key={index} className="photo-concept-card">
                                    <div className="photo-concept-label">Concept {index + 1}</div>
                                    <img
                                      src={image.url}
                                      alt={`Concept ${index + 1}`}
                                      className="photo-concept-img"
                                    />
                                    <a
                                      href={image.url}
                                      download={`${(selectedPhotoAd.title || 'photo').replace(/\s+/g, '-')}-concept-${index + 1}.jpg`}
                                      className="photo-concept-save"
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        try {
                                          const res = await fetch(image.url);
                                          const blob = await res.blob();
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = `${(selectedPhotoAd.title || 'photo').replace(/\s+/g, '-')}-concept-${index + 1}.jpg`;
                                          a.click();
                                          URL.revokeObjectURL(url);
                                        } catch {
                                          window.open(image.url, '_blank');
                                        }
                                      }}
                                    >
                                      ⬇ SAVE PHOTO
                                    </a>
                                  </div>
                                ))}
                              </div>

                              {/* Social Caption + Hashtags — below photos */}
                              <div className="photo-caption-block">
                                <p className="photo-caption-text">{selectedPhotoAd.prompt}</p>
                                <div className="photo-caption-tags">
                                  {(selectedPhotoAd.title || '').split(' ').filter(Boolean).slice(0, 4).map((w: string, i: number) => (
                                    <span key={i} className="photo-caption-tag">#{w.toLowerCase().replace(/[^a-z0-9]/g, '')}</span>
                                  ))}
                                  {selectedPhotoAd.style && <span className="photo-caption-tag">#{selectedPhotoAd.style}</span>}
                                  {selectedPhotoAd.productCategory && <span className="photo-caption-tag">#{selectedPhotoAd.productCategory.replace(/-/g, '')}</span>}
                                  <span className="photo-caption-tag">#aimarketing</span>
                                  <span className="photo-caption-tag">#brand</span>
                                  <span className="photo-caption-tag">#contentcreator</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="player__empty-state">
                              <span>No photo set selected</span>
                              <small>Generate a set or pick one from history</small>
                            </div>
                          )
                        ) : activeOutputUrl ? (
                          activeJob?.kind === 'photo' ? (
                            <img
                              className="player__asset"
                              src={activeOutputUrl}
                              alt={activeJob.description || 'Campaign output'}
                            />
                          ) : (
                            <video
                              id="main-video-player"
                              key={activeOutputUrl}
                              className="player__asset"
                              controls
                              playsInline
                              loop
                              autoPlay
                              preload="auto"
                              crossOrigin="anonymous"
                              onLoadedData={(e) => {
                                e.currentTarget.play().catch(() => {});
                              }}
                            >
                              <source src={activeOutputUrl.replace('localhost', '127.0.0.1')} type="video/mp4" />
                              <source src={activeOutputUrl} type="video/mp4" />
                              Your browser does not support the video tag.
                            </video>
                          )
                        ) : (
                          <div className="player__empty-state">
                            {puterStatus ? (
                              <div className="puter-loader">
                                <Sparkles className="puter-loader__icon" size={32} />
                                <span>{puterStatus}</span>
                                <small>Please wait, AI is painting your vision...</small>
                              </div>
                            ) : (
                              <>
                                <span>No preview yet</span>
                                <small>Select a job or queue a new campaign</small>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="player__actions" style={creatorMode === 'photo' ? { display: 'none' } : {}}>
                      <button
                        type="button"
                        className="player-button player-button--solid"
                        onClick={openOutput}
                        disabled={!activeOutputUrl}
                      >
                        {activeOutputUrl ? 'OPEN ASSET' : 'NO OUTPUT'}
                      </button>
                    </div>
                  </div>
                </article>

                <div className="feature-stack">
                  <article className={`panel panel--brief ${workspaceFocus === 'brief' ? 'is-emphasis' : ''}`}>
                    <div className="brief-head">
                      <div className="panel-kicker">CAMPAIGN BRIEF</div>
                      <div className="brief-count">{activeJob?.description?.length || 0}/800</div>
                    </div>
                    <div className="brief-editor">
                      <div className="brief-editor__content">
                        {briefTab === 'audience' && (
                          <>
                            <div className="brief-editor__line brief-editor__line--main" style={{ color: '#8b5cf6' }}>TARGET AUDIENCE</div>
                            <div className="brief-editor__line">
                              {activeJob?.audience 
                                ? activeJob.audience 
                                : activeJob 
                                  ? `Primary target: High-intent consumers interested in ${activeJob.style || 'modern'} ${activeJob.productCategory || 'products'}.`
                                  : 'Define who this campaign is for (e.g., "Luxury watch enthusiasts aged 25-45").'}
                            </div>
                          </>
                        )}
                        {briefTab === 'offer' && (
                          <>
                            <div className="brief-editor__line brief-editor__line--main" style={{ color: '#6366f1' }}>THE OFFER</div>
                            <div className="brief-editor__line">
                              {activeJob?.offer 
                                ? activeJob.offer 
                                : activeJob 
                                  ? `The core promise: High-end ${activeJob.title || 'product'} visual storytelling with ${activeJob.style} aesthetics.`
                                  : 'What are you selling? (e.g., "Limited edition ceramic timepiece with free shipping").'}
                            </div>
                          </>
                        )}
                        {briefTab === 'proof' && (
                          <>
                            <div className="brief-editor__line brief-editor__line--main" style={{ color: '#ec4899' }}>PROOF & VALUE</div>
                            <div className="brief-editor__line">
                              {activeJob?.proof 
                                ? activeJob.proof 
                                : activeJob 
                                  ? `Value Proposition: Professional grade AI-rendered assets optimized for social conversion.`
                                  : 'Why should they trust you? (e.g., "Swiss-made movement, scratch-resistant sapphire").'}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="brief-chips">
                      <button 
                        type="button"
                        className={`brief-chip ${briefTab === 'audience' ? 'is-active' : ''}`}
                        onClick={() => setBriefTab('audience')}
                      >
                        AUDIENCE
                      </button>
                      <button 
                        type="button"
                        className={`brief-chip ${briefTab === 'offer' ? 'is-active' : ''}`}
                        onClick={() => setBriefTab('offer')}
                      >
                        OFFER
                      </button>
                      <button 
                        type="button"
                        className={`brief-chip ${briefTab === 'proof' ? 'is-active' : ''}`}
                        onClick={() => setBriefTab('proof')}
                      >
                        PROOF
                      </button>
                    </div>
                  </article>

                  <article className="panel panel--metrics">
                    <div className="panel-kicker">WORKSPACE SNAPSHOT</div>
                    <div className="metrics-grid">
                      <div className="metric">
                        <div className="metric__number">{isLoadingJobs ? '...' : videoCount}</div>
                        <div className="metric__copy">
                          <div className="metric__label">Videos</div>
                          <div className="metric__sub">current backend jobs</div>
                        </div>
                      </div>
                      <div className="metric metric--split">
                        <div className="metric__number">{isLoadingJobs ? '...' : photoCount}</div>
                        <div className="metric__copy">
                          <div className="metric__label">Photos</div>
                          <div className="metric__sub">rendered still campaigns</div>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'history' && (
            <section className="feature-section feature-section--history" ref={historySectionRef}>
              <div className="feature-section__header">
                <div>
                  <div className="panel-kicker">HISTORY</div>
                  <h2>{historyMode === 'video' ? 'Video history' : 'Photo history'}</h2>
                  <p>
                    Move through recent campaign jobs by format, then open any item to inspect its brief,
                    status, and generated output.
                  </p>
                </div>

                <div className="history-switch">
                  {createModes.map((mode) => (
                    <button
                      key={mode.kind}
                      type="button"
                      className={`history-switch__item${historyMode === mode.kind ? ' is-active' : ''}`}
                      onClick={() => selectHistoryMode(mode.kind)}
                    >
                      {mode.label.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel panel--history">
                {historyMode === 'video' ? (
                  selectedHistory.length > 0 ? (
                    <div className="history-grid">
                      {selectedHistory.map((job) => (
                        <button
                          key={job._id}
                          type="button"
                          className={`history-card${selectedJobId === job._id ? ' is-active' : ''}`}
                          onClick={() => handleHistoryCardClick(job)}
                        >
                          <div className="history-card__top">
                            <span className="history-card__title">{job.title || job.description || 'Untitled job'}</span>
                            <span className="history-card__date">{formatDate(job.createdAt)}</span>
                          </div>
                          <div className="history-card__meta">
                            <span className={`history-pill history-pill--${getStatusTone(job.status)}`}>
                              {getStatusLabel(job.status)}
                            </span>
                            <span className="history-card__note">{job.message || 'Backend job item.'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="history-empty">
                      {isLoadingJobs ? 'Loading backend jobs...' : 'No video jobs found.'}
                    </div>
                  )
                ) : (
                  photoAds.length > 0 ? (
                    <div className="history-grid">
                      {photoAds.map((ad) => (
                        <button
                          key={ad._id}
                          type="button"
                          className={`history-card${selectedPhotoAdId === ad._id ? ' is-active' : ''}`}
                          onClick={() => handlePhotoCardClick(ad)}
                        >
                          <div className="history-card__top">
                            <span className="history-card__title">{ad.title || 'Untitled photo set'}</span>
                            <span className="history-card__date">{formatDate(ad.createdAt)}</span>
                          </div>
                          <div className="history-card__meta">
                            <span className="history-pill history-pill--ready">READY</span>
                            <span className="history-card__note">{ad.images.length} concepts · {ad.aspectRatio}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="history-empty">
                      No photo sets found. Generate one in the Create section.
                    </div>
                  )
                )}
              </div>
            </section>
          )}

          <div className="studio-footer-note">
            <Eye size={14} strokeWidth={2.2} />
            <span>Video, photo, upload, preview, brief, and history tools are ready in this workspace.</span>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
