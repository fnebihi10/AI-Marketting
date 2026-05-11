import { completePhotoJob } from './api';
import { ensurePuter } from './puter';

// We use the global Window type for Puter defined in puter.ts

/**
 * Generates an image using Puter.js (browser-side, free, no API key needed).
 * Returns the generated image as a Blob.
 */
const generateWithPuter = async (prompt: string): Promise<Blob> => {
  // Truncate prompt to 100 chars for extreme safety
  const safePrompt = prompt.length > 100 ? prompt.slice(0, 97) + '...' : prompt;

  console.log('[Puter] Sending prompt to AI:', safePrompt);

  try {
    const puter = await ensurePuter();
    // Puter returns an HTMLImageElement with a blob src
    const imgElement = await puter.ai.txt2img(safePrompt);

    // Fetch the blob from the src URL
    const response = await fetch(imgElement.src);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob from Puter: ${response.status}`);
    }

    return response.blob();
  } catch (err: any) {
    // Puter often throws objects, not Error instances
    const errorString = typeof err === 'object' ? JSON.stringify(err) : String(err);
    console.error('[Puter] Raw error from AI:', err);
    throw new Error(`Puter AI Error: ${errorString}`);
  }
};

/**
 * Handles the full Puter image generation flow for a photo job.
 * Called when the backend emits the 'pending-image-generation' stage.
 */
export const handlePuterImageGeneration = async (
  jobId: string,
  imagePrompt: string,
  onProgress?: (message: string) => void
): Promise<void> => {
  onProgress?.('Generating image with Puter AI...');

  const blob = await generateWithPuter(imagePrompt);

  onProgress?.('Image generated — uploading to server...');

  await completePhotoJob(jobId, blob);

  onProgress?.('Done!');
};
