import { useEffect, useState, type ReactNode } from 'react';
import { useTheme } from '../../context/ThemeContext';
import likoshaniLogo from '../../assets/likoshani-company.png';

const LOADER_DURATION_MS = 3200; // Adjusted slightly for better feel
const LOADER_FADE_MS = 500;

type AppLoadingScreenProps = {
  children: ReactNode;
};

export default function AppLoadingScreen({ children }: AppLoadingScreenProps) {
  const { theme } = useTheme();
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isAppVisible, setIsAppVisible] = useState(false);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      setIsFadingOut(true);
      setIsAppVisible(true);
    }, LOADER_DURATION_MS);

    const completeTimer = window.setTimeout(() => {
      setIsLoadingComplete(true);
    }, LOADER_DURATION_MS + LOADER_FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(completeTimer);
    };
  }, []);

  return (
    <>
      <div 
        className={`app-shell ${isAppVisible ? 'app-shell--ready' : 'app-shell--hidden'}`}
        aria-hidden={!isAppVisible}
      >
        {children}
      </div>

      {!isLoadingComplete ? (
        <div 
          className={`app-loader ${theme === 'dark' ? 'app-loader--dark' : 'app-loader--light'} ${
            isFadingOut ? 'app-loader--fade-out' : ''
          }`}
          role="status"
          aria-live="polite"
          aria-label="Loading Likoshani Company"
        >
          <div className="app-loader__content">
            <div className="app-loader__logo-wrap">
              <div className="app-loader__glow" />
              <div className="app-loader__logo-card">
                <img src={likoshaniLogo} alt="Likoshani Company logo" className="app-loader__logo" />
              </div>
            </div>
            <div className="app-loader__title">Likoshani Company</div>
            <div className="app-loader__subtitle">AI Marketing Studio</div>
            <div className="app-loader__status">
              <span className="app-loader__status-dot" aria-hidden="true" />
              Preparing your workspace
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
