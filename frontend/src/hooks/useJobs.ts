import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchJobs, type VideoJob, type PhotoJob } from '../lib/api';
import { useJobEvents } from './useJobEvents';
import { handlePuterImageGeneration } from '../lib/puterService';
import { useAuth } from '../context/AuthContext';

export type CampaignKind = 'video' | 'photo';
export type DashboardJob = (VideoJob | PhotoJob) & { kind: CampaignKind };

export type JobsState = {
  videoJobs: VideoJob[];
  photoJobs: PhotoJob[];
};

const toDashboardJob = (job: VideoJob | PhotoJob, kind: CampaignKind): DashboardJob => ({
  ...job,
  kind,
});

export const useJobs = (activeJobId: string | null) => {
  const { logout, setIsExpired } = useAuth();
  const [jobs, setJobs] = useState<JobsState>({ videoJobs: [], photoJobs: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const payload = await fetchJobs();
      setJobs(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data.';
      if (message === 'UNAUTHORIZED') {
        setIsExpired?.(true);
        logout?.();
        setError('Connect a valid session to load dashboard data.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [logout, setIsExpired]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const combinedJobs = useMemo<DashboardJob[]>(() => {
    const video = jobs.videoJobs.map((job) => toDashboardJob(job, 'video'));
    const photo = jobs.photoJobs.map((job) => toDashboardJob(job, 'photo'));

    return [...video, ...photo].sort(
      (left, right) => +new Date(right.createdAt || 0) - +new Date(left.createdAt || 0)
    );
  }, [jobs]);

  useJobEvents(activeJobId, (payload) => {
    if (!activeJobId) return;

    // Merge SSE update into the local job list
    setJobs((current) => ({
      videoJobs: current.videoJobs.map((job) =>
        job._id === activeJobId ? ({ ...job, ...payload } as VideoJob) : job
      ),
      photoJobs: current.photoJobs.map((job) =>
        job._id === activeJobId ? ({ ...job, ...payload } as PhotoJob) : job
      ),
    }));

    // When backend is ready for image generation, trigger Puter in the browser
    if (payload.stage === 'pending-image-generation' && payload.imagePrompt) {
      handlePuterImageGeneration(activeJobId, payload.imagePrompt, (msg) => {
        console.log('[Puter]', msg);
        if (typeof (window as any).onPuterStatus === 'function') {
          (window as any).onPuterStatus(msg);
        }
      })
        .then(() => {
          loadJobs();
          if (typeof (window as any).onPuterStatus === 'function') {
            (window as any).onPuterStatus('');
          }
        })
        .catch((err: Error) => {
          console.error('[Puter] Image generation failed:', err.message);
          if (typeof (window as any).onPuterStatus === 'function') {
            (window as any).onPuterStatus(`Error: ${err.message}`);
          }
        });
    }
  });

  return {
    jobs,
    setJobs,
    combinedJobs,
    isLoading,
    error,
    loadJobs,
  };
};
