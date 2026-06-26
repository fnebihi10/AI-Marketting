import { useEffect, useRef } from 'react';
import { getJobEventsUrl } from '../lib/api';

export const useJobEvents = (
  jobId: string | null,
  onMessage: (payload: any) => void,
  enabled = true
) => {
  const onMessageRef = useRef(onMessage);
  
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!jobId || !enabled) return;

    const source = new EventSource(getJobEventsUrl(jobId));
    source.onmessage = (event) => {
      onMessageRef.current(JSON.parse(event.data));
    };
    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [enabled, jobId]);
};
