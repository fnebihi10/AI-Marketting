type PuterTxt2ImgOptions = {
  prompt?: string;
  provider?: 'openai-image-generation' | 'gemini' | 'together' | 'xai';
  model?: string;
  quality?: 'low' | 'medium' | 'high' | 'standard' | 'hd';
  width?: number;
  height?: number;
  aspect_ratio?: string;
  steps?: number;
  seed?: number;
  negative_prompt?: string;
  test_mode?: boolean;
};

type PuterTxt2ImgInput =
  | string
  | ({
      prompt: string;
    } & PuterTxt2ImgOptions);

interface PuterGlobal {
  ai: {
    txt2img: (
      promptOrOptions: PuterTxt2ImgInput,
      options?: PuterTxt2ImgOptions | boolean
    ) => Promise<HTMLImageElement>;
  };
  auth?: {
    isSignedIn: () => boolean;
    signIn: (options?: { attempt_temp_user_creation?: boolean }) => Promise<unknown>;
  };
}

declare global {
  interface Window {
    puter?: any;
  }
}

let puterPromise: Promise<PuterGlobal> | null = null;

const PUTER_SCRIPT_ID = 'puter-sdk-script';
const PUTER_SCRIPT_SRC = 'https://js.puter.com/v2/';

const PHOTO_VARIATIONS = [
  'Hero shot, centered composition, premium studio lighting, clean shadows, refined luxury aesthetic.',
  'Macro detail shot, tactile textures, glossy highlights, editorial beauty campaign finish.',
  'Lifestyle campaign shot, elevated environment, cinematic depth, polished brand storytelling.',
];

const PHOTO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '4:5': { width: 1024, height: 1280 },
  '16:9': { width: 1280, height: 720 },
};

function getPuterFromWindow(): PuterGlobal {
  const p = window.puter as PuterGlobal;
  if (!p?.ai?.txt2img) {
    throw new Error('Puter image generation is not available yet.');
  }

  return p;
}

export async function ensurePuter() {
  if (typeof window === 'undefined') {
    throw new Error('Puter can only be loaded in the browser.');
  }

  if (window.puter?.ai?.txt2img) {
    return window.puter as PuterGlobal;
  }

  if (puterPromise) {
    return puterPromise;
  }

  puterPromise = new Promise<PuterGlobal>((resolve, reject) => {
    const existingScript = document.getElementById(PUTER_SCRIPT_ID) as HTMLScriptElement | null;

    const handleLoad = () => {
      try {
        resolve(getPuterFromWindow());
      } catch (error) {
        reject(error);
      }
    };

    const handleError = () => {
      puterPromise = null;
      reject(new Error('Unable to load Puter. Check your connection and try again.'));
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = PUTER_SCRIPT_ID;
    script.src = PUTER_SCRIPT_SRC;
    script.async = true;
    script.onload = handleLoad;
    script.onerror = handleError;
    document.head.appendChild(script);
  });

  return puterPromise;
}

export async function ensurePuterSession() {
  const puter = await ensurePuter();

  if (puter.auth?.isSignedIn && !puter.auth.isSignedIn()) {
    try {
      await puter.auth.signIn({ attempt_temp_user_creation: true });
    } catch {
      throw new Error('Puter needs permission first. Allow the sign-in popup and try again.');
    }
  }

  return puter;
}

export type PhotoAspectRatio = keyof typeof PHOTO_DIMENSIONS;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read generated image.'));
    reader.readAsDataURL(blob);
  });

const getGeneratedImageSource = async (image: HTMLImageElement) => {
  if (image.src.startsWith('data:image/')) {
    return image.src;
  }

  if (!image.src.startsWith('blob:')) {
    return image.src;
  }

  const response = await fetch(image.src);
  if (!response.ok) {
    throw new Error(`Unable to load generated image (${response.status}).`);
  }

  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error('Puter returned an unsupported generated image format.');
  }

  return blobToDataUrl(blob);
};

export async function generatePhotoAdSet(
  input: {
    title: string;
    prompt: string;
    aspectRatio: PhotoAspectRatio;
    style: string;
    productCategory: string;
  },
  onProgress?: (label: string) => void
) {
  const puter = await ensurePuterSession();
  const dimensions = PHOTO_DIMENSIONS[input.aspectRatio] || PHOTO_DIMENSIONS['1:1'];
  const images: string[] = [];

  for (let index = 0; index < PHOTO_VARIATIONS.length; index += 1) {
    const variant = PHOTO_VARIATIONS[index];
    onProgress?.(`Generating concept ${index + 1} of ${PHOTO_VARIATIONS.length}`);

    const prompt = [
      `Product Category: ${input.productCategory}.`,
      `Creative Style: ${input.style}.`,
      input.title,
      input.prompt,
      'High-end commercial photography for an ad campaign.',
      'Premium lighting, polished composition, rich detail, tasteful color grading.',
      variant,
    ].join(' ');

    let image: HTMLImageElement;

    try {
      image = await puter.ai.txt2img(prompt, {
        model: 'black-forest-labs/FLUX.1-schnell',
        width: dimensions.width,
        height: dimensions.height,
        steps: 4,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to generate images with Puter right now.';

      throw new Error(`Photo concept ${index + 1} failed: ${message}`);
    }

    images.push(await getGeneratedImageSource(image));
  }

  return images;
}
