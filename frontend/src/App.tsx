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
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  Folder,
  History,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
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
import { createPhotoAd, fetchPhotoAds, createCheckoutSession, verifyBillingSession, deleteJob } from './lib/api';
import CreditStoreModal from './components/CreditStoreModal';

type SectionKey = 'dashboard' | 'create' | 'workspace' | 'history';
type CreateFocus = CampaignKind | 'upload';
type WorkspaceFocus = 'preview' | 'publish';

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
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 8;
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
  const [copied, setCopied] = useState(false);
  const [activeSocialModal, setActiveSocialModal] = useState<'facebook' | 'instagram' | 'tiktok' | null>(null);
  const [customAlert, setCustomAlert] = useState<{ title: string; message: string } | null>(null);
  const [isCreditStoreOpen, setIsCreditStoreOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handlePurchaseInitiated = async (packageId: string) => {
    try {
      const data = await createCheckoutSession(packageId);
      if (data && data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setCustomAlert({
        title: 'Payment Error',
        message: err.message || 'Could not connect to Stripe. Please try again later.'
      });
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');

    if (payment === 'success' && sessionId) {
      verifyBillingSession(sessionId)
        .then((res) => {
          if (res.success) {
            setCustomAlert({
              title: 'Purchase Successful!',
              message: `Thank you for your purchase! ${res.credits} credits have been successfully added to your account.`
            });
            refreshUser();
          }
        })
        .catch((err) => {
          setCustomAlert({
            title: 'Verification Failed',
            message: err.message || 'Could not verify your payment session.'
          });
        })
        .finally(() => {
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        });
    } else if (payment === 'cancel') {
      setCustomAlert({
        title: 'Payment Cancelled',
        message: 'Your credit purchase transaction was cancelled. No charges were made.'
      });
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => current === msg ? null : current);
    }, 4000);
  };

  const handleCopyCaption = () => {
    let textToCopy = '';
    if (creatorMode === 'photo' && selectedPhotoAd) {
      textToCopy = selectedPhotoAd.caption || selectedPhotoAd.prompt;
    } else if (activeJob && activeJob.kind === 'video') {
      const vJob = activeJob as VideoJob;
      textToCopy = vJob.caption || '';
      if (!textToCopy && vJob.script) {
        textToCopy = `${vJob.script.hook || vJob.script.title || vJob.description} ${vJob.script.cta}`;
      }
    }
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadAsset = () => {
    if (!activeOutputUrl) return;
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const filename = `campaign-asset-${Date.now()}.${creatorMode === 'video' ? 'mp4' : 'jpg'}`;
    let downloadUrl = `${baseUrl}/jobs/download?url=${encodeURIComponent(activeOutputUrl)}&filename=${encodeURIComponent(filename)}`;
    if (token) {
      downloadUrl += `&token=${encodeURIComponent(token)}`;
    }
    const a = document.createElement('a');
    a.href = downloadUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const {
    jobs,
    combinedJobs,
    isLoading: isLoadingJobs,
    error: loadError,
    loadJobs,
    setJobs,
    removeJob
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
    (createdJob) => {
      setJobs((current) => {
        if (createMode === 'video') {
          return {
            ...current,
            videoJobs: current.videoJobs.some((job) => job._id === createdJob._id)
              ? current.videoJobs
              : [createdJob as VideoJob, ...current.videoJobs],
          };
        }

        return {
          ...current,
          photoJobs: current.photoJobs.some((job) => job._id === createdJob._id)
            ? current.photoJobs
            : [createdJob as PhotoJob, ...current.photoJobs],
        };
      });
      setSelectedJobId(createdJob._id);
      setHistoryMode(createMode);
      setCreatorMode(createMode);
      setWorkspaceFocus('preview');
      setActiveWorkspaceTab('preview');
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

  const filteredHistory = combinedJobs.filter((job) => job.kind === historyMode);
  const totalHistoryPages = Math.ceil(filteredHistory.length / historyPageSize) || 1;
  const selectedHistory = filteredHistory.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);

  const filteredPhotoAds = photoAds;
  const totalPhotoHistoryPages = Math.ceil(filteredPhotoAds.length / historyPageSize) || 1;
  const selectedPhotoAds = filteredPhotoAds.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);

  const activeProgress =
    activeJob?.progress ?? (activeJob?.status === 'completed' ? 100 : activeJob?.status ? 20 : 0);
  const [puterStatus, setPuterStatus] = useState<string>('');
  useEffect(() => {
    (window as any).onPuterStatus = (msg: string) => setPuterStatus(msg);
    return () => { (window as any).onPuterStatus = null; };
  }, []);
  const userInitials = getInitials(user?.email);
  const userLabel = user?.email?.split('@')[0] || 'AI Studio';
  const userDisplayName = user?.name || userLabel.split('.').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const createCopy =
    createMode === 'video'
      ? {
          tag: 'VIDEO',
          title: 'Create a Video Campaign',
          description: 'Turn a short brief into a polished video asset with style, category, and upload controls ready.',
          submit: 'CREATE',
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
      return (
        job.output?.preview?.url ||
        job.output?.video?.url ||
        (job as any).previewUrl ||
        (job as any).videoUrl ||
        ''
      );
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
    setCreatorMode(mode);
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
    setCreatorMode(mode);
    setHistoryPage(1);
    setActiveSection('history');
    setExpandedSection('history');
  };

  const handleDeleteJob = async (jobId: string, type: 'job' | 'ad', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    try {
      await deleteJob(jobId);
      if (type === 'job') {
        removeJob(jobId);
        if (selectedJobId === jobId) setSelectedJobId(null);
      } else {
        setPhotoAds((current) => current.filter(ad => ad._id !== jobId));
        if (selectedPhotoAdId === jobId) setSelectedPhotoAdId(null);
      }
      showToast('Job deleted successfully');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete job.');
    }
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
          aspectRatio: photoAspectRatio as any,
          style: form.style,
          productCategory: form.productCategory,
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
  const [isOutputViewerOpen, setIsOutputViewerOpen] = useState(false);

  const handleHistoryCardClick = (job: DashboardJob) => {
    setSelectedPhotoAdId(null);
    setSelectedJobId(job._id);
    setHistoryMode(job.kind);
    setCreatorMode(job.kind);
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
    setIsOutputViewerOpen(true);
  };

  useEffect(() => {
    if (!isOutputViewerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOutputViewerOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.classList.add('is-output-viewer-open');

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('is-output-viewer-open');
    };
  }, [isOutputViewerOpen]);

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
                        className={`sidebar-dropdown-item${workspaceFocus === 'publish' ? ' is-active' : ''}`}
                        onClick={() => {
                          selectWorkspaceFocus('publish');
                          setActiveSection('workspace');
                          setTimeout(() => {
                            const el = document.querySelector('.social-simulator-actions');
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              el.classList.add('highlight-flash');
                              setTimeout(() => el.classList.remove('highlight-flash'), 1800);
                            }
                          }, 100);
                        }}
                      >
                        <span>Social Publish</span>
                        <small>Simulate post on FB, IG, TikTok</small>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <strong>{userLabel}</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                  <button
                    type="button"
                    onClick={() => setIsCreditStoreOpen(true)}
                    style={{
                      fontSize: '9px',
                      color: '#a78bfa',
                      background: 'rgba(139, 92, 246, 0.15)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 800,
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      lineHeight: '1.2'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#8b5cf6';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                      e.currentTarget.style.color = '#a78bfa';
                    }}
                  >
                    + BUY
                  </button>
                </div>
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
                        ? (isSubmitting ? 'CREATING...' : 'CREATE') 
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

                  {createMode === 'video' && (
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
                  )}
                </div>
              </div>
            </section>
          )}

          {activeSection === 'workspace' && (
            <section className="feature-section feature-section--workspace-unified" ref={workspaceSectionRef}>
              <div className="feature-section__header">
                <div>
                  <div className="panel-kicker">WORKSPACE</div>
                  <h2>Live preview & campaign details</h2>
                  <p>
                    Review the active asset, copy the AI-generated caption, and access your original brief below.
                  </p>
                </div>
              </div>

              <div className="feature-section__body feature-section__body--workspace-unified">
                <div className="workspace-main-column">
                  <article className="panel panel--workspace-large">
                    <div className="panel-kicker">LIVE PREVIEW</div>
                    
                    <div className="player player--large">
                      {/* Caption Top Block */}
                      <div className="player__caption-box">
                        <div className="player__caption-header">
                          <div className="player__label">
                            <Sparkles size={14} strokeWidth={2.4} />
                            <span>AI CAPTION</span>
                          </div>
                          <button type="button" className="mini-button mini-button--ghost" onClick={handleCopyCaption}>
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? 'COPIED' : 'COPY'}
                          </button>
                        </div>
                        <div className="player__caption-content">
                          {(() => {
                            if (creatorMode === 'photo') {
                              if (!selectedPhotoAd) return 'Select a photo set from history';
                              return (
                                <>
                                  <p>{selectedPhotoAd.caption || selectedPhotoAd.prompt}</p>
                                </>
                              );
                            }
                            if (!activeJob) return 'No job selected yet';
                            if (activeJob.kind === 'video') {
                              const vJob = activeJob as VideoJob;
                              if (vJob.caption) {
                                return (
                                  <>
                                    <p>{vJob.caption}</p>
                                    {vJob.script?.hashtags && vJob.script.hashtags.length > 0 && (
                                      <div className="photo-caption-tags">
                                        {vJob.script.hashtags.map((tag) => (
                                          <span key={tag} className="photo-caption-tag">#{tag.replace(/^#/, '')}</span>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                );
                              }
                              if (vJob.script) {
                                return (
                                  <>
                                    <p>{vJob.script.hook || vJob.script.title || vJob.description} {vJob.script.cta}</p>
                                    <div className="photo-caption-tags">
                                      {(vJob.script.hashtags || []).map((tag) => (
                                        <span key={tag} className="photo-caption-tag">#{tag.replace(/^#/, '')}</span>
                                      ))}
                                    </div>
                                  </>
                                );
                              }
                            } else {
                              const pJob = activeJob as PhotoJob;
                              if (pJob.caption) {
                                return <p>{pJob.caption}</p>;
                              }
                            }
                            return <p>{activeJob.description}</p>;
                          })()}
                        </div>
                      </div>

                      <div className="player__topline" style={{ marginTop: '1rem' }}>
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

                      {(activeJob?.status === 'processing' || activeJob?.status === 'queued' || activeProgress < 100) && activeJob?.status !== 'completed' && (
                        <div className="player__timing" style={{ marginTop: '1rem', padding: '16px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                          <div className="player__timing-head" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1px', color: '#6366f1' }}>
                            <span>GENERATING...</span>
                            <span>{Math.min(100, Math.max(0, activeProgress || 0)).toFixed(0)}%</span>
                          </div>
                          <div className="player__bar" style={{ height: '6px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                            <div
                              className="player__knob"
                              style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${Math.min(100, Math.max(0, activeProgress || 0))}%`, background: '#6366f1', transition: 'width 0.3s ease' }}
                            />
                          </div>
                        </div>
                      )}

                      <div className={`player__preview player__preview--large${creatorMode === 'photo' ? ' player__preview--photo' : ''}`}>
                        <div className={`player__preview-surface${creatorMode === 'photo' ? ' player__preview-surface--photo' : ''}`}>
                          {creatorMode === 'photo' ? (
                            selectedPhotoAd ? (
                              <div className="photo-studio-preview">
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
                                        onClick={(e) => {
                                          e.preventDefault();
                                          const token = localStorage.getItem('token');
                                          const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
                                          const filename = `${(selectedPhotoAd.title || 'photo').replace(/\s+/g, '-')}-concept-${index + 1}.jpg`;
                                          let downloadUrl = `${baseUrl}/jobs/download?url=${encodeURIComponent(image.url)}&filename=${encodeURIComponent(filename)}`;
                                          if (token) {
                                            downloadUrl += `&token=${encodeURIComponent(token)}`;
                                          }
                                          const a = document.createElement('a');
                                          a.href = downloadUrl;
                                          document.body.appendChild(a);
                                          a.click();
                                          document.body.removeChild(a);
                                        }}
                                      >
                                        ⬇ SAVE PHOTO
                                      </a>
                                    </div>
                                  ))}
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

                      <div className="player__actions player__actions--split" style={creatorMode === 'photo' ? { display: 'none' } : {}}>
                        <button
                          type="button"
                          className="player-button player-button--ghost"
                          onClick={handleDownloadAsset}
                          disabled={!activeOutputUrl}
                        >
                          <Download size={16} />
                          DOWNLOAD ASSET
                        </button>
                        <button
                          type="button"
                          className="player-button player-button--solid"
                          onClick={openOutput}
                          disabled={!activeOutputUrl}
                        >
                          {activeOutputUrl ? 'OPEN ASSET' : 'NO OUTPUT'}
                        </button>
                      </div>

                      {/* Mock Social Publish Section */}
                      <div className="social-simulator-actions" style={{ marginTop: '1.2rem', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-quiet)', marginBottom: '10px', textAlign: 'center' }}>
                          CREATE SIMULATED POST (PREVIEW & POST)
                        </div>
                        <div className="social-sim-buttons-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                          <button
                            type="button"
                            className="social-sim-btn social-sim-btn--fb"
                            onClick={() => setActiveSocialModal('facebook')}
                            disabled={!activeOutputUrl && !selectedPhotoAd}
                          >
                            <span style={{ fontSize: '1.1rem', marginRight: '6px' }}>📘</span> FACEBOOK
                          </button>
                          <button
                            type="button"
                            className="social-sim-btn social-sim-btn--ig"
                            onClick={() => setActiveSocialModal('instagram')}
                            disabled={!activeOutputUrl && !selectedPhotoAd}
                          >
                            <span style={{ fontSize: '1.1rem', marginRight: '6px' }}>📸</span> INSTAGRAM
                          </button>
                          <button
                            type="button"
                            className="social-sim-btn social-sim-btn--tt"
                            onClick={() => setActiveSocialModal('tiktok')}
                            disabled={!activeOutputUrl && !selectedPhotoAd}
                          >
                            <span style={{ fontSize: '1.1rem', marginRight: '6px' }}>🎵</span> TIKTOK
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="panel panel--brief-integrated">
                    <div className="brief-head">
                      <div className="panel-kicker">CAMPAIGN BRIEF</div>
                      <div className="brief-count">{activeJob?.description?.length || 0}/800</div>
                    </div>
                    <div className="brief-integrated-grid">
                      <div className="brief-integrated-col">
                        <div className="brief-editor__line brief-editor__line--main" style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                          <Users size={16} /> TARGET AUDIENCE
                        </div>
                        <div className="brief-editor__line" style={{ marginTop: '12px' }}>
                          {activeJob?.audience 
                            ? activeJob.audience 
                            : activeJob 
                              ? `Primary target: High-intent consumers interested in ${activeJob.style || 'modern'} ${activeJob.productCategory || 'products'}.`
                              : 'Define who this campaign is for.'}
                        </div>
                      </div>
                      <div className="brief-integrated-col">
                        <div className="brief-editor__line brief-editor__line--main" style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                          <Tag size={16} /> THE OFFER
                        </div>
                        <div className="brief-editor__line" style={{ marginTop: '12px' }}>
                          {activeJob?.offer 
                            ? activeJob.offer 
                            : activeJob 
                              ? `The core promise: High-end ${activeJob.title || 'product'} visual storytelling with ${activeJob.style} aesthetics.`
                              : 'What are you selling?'}
                        </div>
                      </div>
                      <div className="brief-integrated-col">
                        <div className="brief-editor__line brief-editor__line--main" style={{ color: '#ec4899', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                          <ShieldCheck size={16} /> PROOF & VALUE
                        </div>
                        <div className="brief-editor__line" style={{ marginTop: '12px' }}>
                          {activeJob?.proof 
                            ? activeJob.proof 
                            : activeJob 
                              ? `Value Proposition: Professional grade AI-rendered assets optimized for social conversion.`
                              : 'Why should they trust you?'}
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
                    <>
                      <div className="history-grid">
                        {selectedHistory.map((job) => (
                          <div key={job._id} style={{ position: 'relative' }}>
                            <div
                              role="button"
                              tabIndex={0}
                              className={`history-card${selectedJobId === job._id ? ' is-active' : ''}`}
                              onClick={() => handleHistoryCardClick(job)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  handleHistoryCardClick(job);
                                }
                              }}
                              style={{ width: '100%', cursor: 'pointer', textAlign: 'left', display: 'block' }}
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
                            </div>
                            <button
                              className="history-delete-btn"
                              onClick={(e) => handleDeleteJob(job._id, 'job', e)}
                              title="Delete job"
                              style={{
                                position: 'absolute',
                                bottom: '12px',
                                right: '12px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-quiet)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-quiet)'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {totalHistoryPages > 1 && (
                        <div className="pagination-controls" style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '24px' }}>
                          <button
                            type="button"
                            onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                            disabled={historyPage === 1}
                            style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-elevated)', color: historyPage === 1 ? 'var(--text-quiet)' : 'var(--text-main)', border: '1px solid var(--border)', cursor: historyPage === 1 ? 'not-allowed' : 'pointer' }}
                          >
                            Prev
                          </button>
                          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-quiet)' }}>
                            Page {historyPage} of {totalHistoryPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                            disabled={historyPage === totalHistoryPages}
                            style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-elevated)', color: historyPage === totalHistoryPages ? 'var(--text-quiet)' : 'var(--text-main)', border: '1px solid var(--border)', cursor: historyPage === totalHistoryPages ? 'not-allowed' : 'pointer' }}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="history-empty">
                      {isLoadingJobs ? 'Loading backend jobs...' : 'No video jobs found.'}
                    </div>
                  )
                ) : (
                  selectedPhotoAds.length > 0 ? (
                    <>
                      <div className="history-grid">
                        {selectedPhotoAds.map((ad) => (
                          <div key={ad._id} style={{ position: 'relative' }}>
                            <div
                              role="button"
                              tabIndex={0}
                              className={`history-card${selectedPhotoAdId === ad._id ? ' is-active' : ''}`}
                              onClick={() => handlePhotoCardClick(ad)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  handlePhotoCardClick(ad);
                                }
                              }}
                              style={{ width: '100%', cursor: 'pointer', textAlign: 'left', display: 'block' }}
                            >
                              <div className="history-card__top">
                                <span className="history-card__title">{ad.title || 'Untitled photo set'}</span>
                                <span className="history-card__date">{formatDate(ad.createdAt)}</span>
                              </div>
                              <div className="history-card__meta">
                                <span className="history-pill history-pill--ready">READY</span>
                                <span className="history-card__note">{ad.images.length} concepts · {ad.aspectRatio}</span>
                              </div>
                            </div>
                            <button
                              className="history-delete-btn"
                              onClick={(e) => handleDeleteJob(ad._id, 'ad', e)}
                              title="Delete photo set"
                              style={{
                                position: 'absolute',
                                bottom: '12px',
                                right: '12px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-quiet)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-quiet)'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {totalPhotoHistoryPages > 1 && (
                        <div className="pagination-controls" style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '24px' }}>
                          <button
                            type="button"
                            onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                            disabled={historyPage === 1}
                            style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-elevated)', color: historyPage === 1 ? 'var(--text-quiet)' : 'var(--text-main)', border: '1px solid var(--border)', cursor: historyPage === 1 ? 'not-allowed' : 'pointer' }}
                          >
                            Prev
                          </button>
                          <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-quiet)' }}>
                            Page {historyPage} of {totalPhotoHistoryPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setHistoryPage(p => Math.min(totalPhotoHistoryPages, p + 1))}
                            disabled={historyPage === totalPhotoHistoryPages}
                            style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-elevated)', color: historyPage === totalPhotoHistoryPages ? 'var(--text-quiet)' : 'var(--text-main)', border: '1px solid var(--border)', cursor: historyPage === totalPhotoHistoryPages ? 'not-allowed' : 'pointer' }}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
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

      {activeSocialModal && (
        <div className="social-modal-overlay" onClick={() => setActiveSocialModal(null)}>
          <div className="social-modal-container" onClick={(e) => e.stopPropagation()}>
            
            {activeSocialModal === 'facebook' && (
              <div className="fb-post-modal">
                <div className="fb-post-modal__header">
                  <h3>Create post</h3>
                  <button className="fb-post-modal__close" onClick={() => setActiveSocialModal(null)}><X size={20} /></button>
                </div>
                
                <div className="fb-post-modal__body">
                  <div className="fb-post-modal__user-row">
                    <div className="fb-post-modal__avatar">{userInitials}</div>
                    <div className="fb-post-modal__user-info">
                      <div className="fb-post-modal__name">{userDisplayName}</div>
                      <div className="fb-post-modal__privacy">
                        <Users size={12} />
                        <span>Friends</span>
                        <ChevronDown size={12} />
                      </div>
                    </div>
                  </div>

                  <div className="fb-post-modal__text-area" contentEditable suppressContentEditableWarning>
                    {(() => {
                      if (creatorMode === 'photo' && selectedPhotoAd) return selectedPhotoAd.caption || selectedPhotoAd.prompt;
                      if (activeJob?.kind === 'video') {
                        const vJob = activeJob as VideoJob;
                        return vJob.caption || (vJob.script ? `${vJob.script.hook || vJob.script.title || vJob.description} ${vJob.script.cta}` : activeJob.description);
                      }
                      return activeJob?.description;
                    })()}
                  </div>

                  <div className="fb-post-modal__media-container">
                    <button className="fb-post-modal__edit-btn">✏️ Edit</button>
                    <button className="fb-post-modal__remove-btn" onClick={() => setActiveSocialModal(null)}><X size={16} /></button>
                    
                    {creatorMode === 'photo' && selectedPhotoAd ? (
                      <img src={selectedPhotoAd.images[0]?.url} alt="Fb Post Preview" />
                    ) : activeOutputUrl ? (
                      <video src={activeOutputUrl} controls autoPlay muted loop />
                    ) : null}
                  </div>

                  <div className="fb-post-modal__add-to-post">
                    <span>Add to your post</span>
                    <div className="fb-post-modal__add-icons">
                      <span className="fb-icon-btn img-icon">🖼️</span>
                      <span className="fb-icon-btn tag-icon">👥</span>
                      <span className="fb-icon-btn emoji-icon">😀</span>
                      <span className="fb-icon-btn location-icon">📍</span>
                      <span className="fb-icon-btn gif-icon">GIF</span>
                      <span className="fb-icon-btn more-icon">•••</span>
                    </div>
                  </div>
                </div>

                <div className="fb-post-modal__footer">
                  <button className="fb-post-modal__submit-btn" onClick={() => {
                    setCustomAlert({
                      title: 'Simulation Mode',
                      message: 'This is a mock preview! To post on real platforms, download the asset and copy the caption.'
                    });
                    setActiveSocialModal(null);
                  }}>Post</button>
                </div>
              </div>
            )}

            {activeSocialModal === 'instagram' && (
              <div className="ig-post-modal">
                <div className="ig-post-modal__header">
                  <button className="ig-post-modal__cancel" onClick={() => setActiveSocialModal(null)}>Cancel</button>
                  <h3>Create new post</h3>
                  <button className="ig-post-modal__share-top" onClick={() => {
                    setCustomAlert({
                      title: 'Simulation Mode',
                      message: 'This is a mock preview! To post on real platforms, download the asset and copy the caption.'
                    });
                    setActiveSocialModal(null);
                  }}>Share</button>
                </div>
                
                <div className="ig-post-modal__body">
                  <div className="ig-post-modal__media">
                    {creatorMode === 'photo' && selectedPhotoAd ? (
                      <img src={selectedPhotoAd.images[0]?.url} alt="Ig Post Preview" />
                    ) : activeOutputUrl ? (
                      <video src={activeOutputUrl} controls autoPlay muted loop />
                    ) : null}
                  </div>
                  
                  <div className="ig-post-modal__details">
                    <div className="ig-post-modal__user">
                      <div className="ig-post-modal__avatar">{userInitials}</div>
                      <span className="ig-post-modal__username">{userLabel.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}</span>
                    </div>
                    
                    <textarea 
                      className="ig-post-modal__caption-input" 
                      placeholder="Write a caption..."
                      defaultValue={(() => {
                        if (creatorMode === 'photo' && selectedPhotoAd) return selectedPhotoAd.caption || selectedPhotoAd.prompt;
                        if (activeJob?.kind === 'video') {
                          const vJob = activeJob as VideoJob;
                          return vJob.caption || (vJob.script ? `${vJob.script.hook || vJob.script.title || vJob.description} ${vJob.script.cta}` : activeJob.description);
                        }
                        return activeJob?.description;
                      })()}
                    />
                    
                    <div className="ig-post-modal__menu-list">
                      <div className="ig-post-modal__menu-item">Add Location <span>📍</span></div>
                      <div className="ig-post-modal__menu-item">Tag People <span>👤</span></div>
                      <div className="ig-post-modal__menu-item">Advanced Settings <span>⚙️</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSocialModal === 'tiktok' && (
              <div className="tt-post-modal">
                <div className="tt-post-modal__header">
                  <h3>Post to TikTok</h3>
                  <button className="tt-post-modal__close" onClick={() => setActiveSocialModal(null)}><X size={20} /></button>
                </div>

                <div className="tt-post-modal__body">
                  <div className="tt-post-modal__left">
                    <div className="tt-post-modal__phone-frame">
                      {creatorMode === 'photo' && selectedPhotoAd ? (
                        <img src={selectedPhotoAd.images[0]?.url} alt="TikTok Post Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : activeOutputUrl ? (
                        <video src={activeOutputUrl} controls autoPlay muted loop style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : null}
                    </div>
                  </div>

                  <div className="tt-post-modal__right">
                    <div className="tt-post-modal__field">
                      <label>Caption</label>
                      <textarea 
                        defaultValue={(() => {
                          if (creatorMode === 'photo' && selectedPhotoAd) return selectedPhotoAd.caption || selectedPhotoAd.prompt;
                          if (activeJob?.kind === 'video') {
                            const vJob = activeJob as VideoJob;
                            return vJob.caption || (vJob.script ? `${vJob.script.hook || vJob.script.title || vJob.description} ${vJob.script.cta}` : activeJob.description);
                          }
                          return activeJob?.description;
                        })()}
                      />
                      <div className="tt-post-modal__char-count">0 / 4000</div>
                    </div>

                    <div className="tt-post-modal__options">
                      <div className="tt-post-modal__option-row">
                        <span>Who can watch this video</span>
                        <select>
                          <option>Public</option>
                          <option>Friends</option>
                          <option>Private</option>
                        </select>
                      </div>
                      <div className="tt-post-modal__option-row">
                        <span>Allow users to:</span>
                        <div className="tt-post-modal__checkboxes">
                          <label><input type="checkbox" defaultChecked /> Comment</label>
                          <label><input type="checkbox" defaultChecked /> Duet</label>
                          <label><input type="checkbox" defaultChecked /> Stitch</label>
                        </div>
                      </div>
                    </div>

                    <div className="tt-post-modal__actions">
                      <button className="tt-btn tt-btn--discard" onClick={() => setActiveSocialModal(null)}>Discard</button>
                      <button className="tt-btn tt-btn--post" onClick={() => {
                        setCustomAlert({
                          title: 'Simulation Mode',
                          message: 'This is a mock preview! To post on real platforms, download the asset and copy the caption.'
                        });
                        setActiveSocialModal(null);
                      }}>Post</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {isOutputViewerOpen && activeOutputUrl && (
        <div
          className="output-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Campaign output preview"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOutputViewerOpen(false);
            }
          }}
        >
          <div className="output-viewer__panel">
            <div className="output-viewer__topbar">
              <span>Output preview</span>
              <button
                type="button"
                className="output-viewer__close"
                aria-label="Close output preview"
                onClick={() => setIsOutputViewerOpen(false)}
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="output-viewer__frame">
              <video
                key={`viewer-${activeOutputUrl}`}
                className="output-viewer__asset"
                controls
                playsInline
                autoPlay
                loop
                preload="auto"
              >
                <source src={activeOutputUrl.replace('localhost', '127.0.0.1')} type="video/mp4" />
                <source src={activeOutputUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      )}
      {toastMessage && (
        <div className="custom-toast">
          <div className="custom-toast__icon">💡</div>
          <div className="custom-toast__content">{toastMessage}</div>
          <button className="custom-toast__close" onClick={() => setToastMessage(null)}>×</button>
        </div>
      )}
      {customAlert && (
        <div className="custom-alert-overlay" onClick={() => setCustomAlert(null)}>
          <div className="custom-alert-container" onClick={(e) => e.stopPropagation()}>
            <div className="custom-alert__icon">💡</div>
            <h3>{customAlert.title}</h3>
            <p>{customAlert.message}</p>
            <button className="custom-alert__btn" onClick={() => setCustomAlert(null)}>OK</button>
          </div>
        </div>
      )}
      {isCreditStoreOpen && (
        <CreditStoreModal
          onClose={() => setIsCreditStoreOpen(false)}
          onPurchaseInitiated={handlePurchaseInitiated}
        />
      )}
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
