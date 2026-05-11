import fs from 'node:fs/promises';
import path from 'node:path';
import { VideoJob } from '../models/VideoJob';
import { ScriptScene, SceneRenderPlan, MediaCandidate } from '../types';
import { publishJobProgress } from './jobProgressService';
import { generateScriptPackage } from './openAiService';
import { findSceneMedia } from './pexelsService';
import { createReplicateStyledImages, createStabilityFallbackImage } from './imageFallbackService';
import { downloadToFile } from './downloadService';
import { generateVoiceSegments } from './voiceService';
import { renderMarketingVideo } from './renderService';
import { uploadAsset } from './storageService';
import { selectBackgroundMusic } from './musicService';
import { config } from '../config';
import { ensureDir, relativeFrom } from '../utils/files';

const TARGET_ASPECT_RATIO = 9 / 16;
const genericQueryTokens = new Set([
  'abstract',
  'background',
  'branding',
  'business',
  'corporate',
  'digital',
  'generic',
  'innovation',
  'marketing',
  'media',
  'office',
  'success',
  'technology'
]);
const foodMismatchTokens = new Set(['cake', 'cream', 'cupcake', 'frosting', 'icing', 'whipped']);
const fitnessMismatchTokens = new Set(['conversation', 'desk', 'interview', 'meeting', 'office', 'podcast', 'talking']);
const footballMismatchTokens = new Set(['nfl', 'touchdown', 'quarterback', 'superbowl', 'helmet', 'american']);
const esportsMismatchTokens = new Set([
  'business',
  'coding',
  'conference',
  'console',
  'controller',
  'office',
  'phone',
  'programming',
  'smartphone',
  'vr'
]);
const esportsBriefTokens = [
  'counter strike',
  'counter-strike',
  'cs2',
  'esports',
  'e sports',
  'gaming tournament',
  'major finals'
];
type MediaStrategy = {
  anchors: string[];
  avoidTokens: string[];
  preferStillImages: boolean;
  requireAnchorMatch: boolean;
  minimumVideoDurationRatio: number;
  minimumVideoSeconds: number;
  useHeroUploadForFirstScene: boolean;
  useHeroUploadForLastScene: boolean;
};

const isEsportsBrief = (description: string, productCategory: string) => {
  const normalized = `${productCategory} ${description}`.toLowerCase();
  return productCategory === 'gaming-esports' || esportsBriefTokens.some((token) => normalized.includes(token));
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);

const createUploadFallback = (
  productImagePath: string,
  reason = 'Used the uploaded product image because stock matches were weak or off-brief.'
): MediaCandidate => ({
  kind: 'image',
  source: 'upload',
  url: '',
  width: 1080,
  height: 1920,
  query: 'uploaded product image',
  localPath: productImagePath,
  selectionScore: 0,
  selectionReason: reason
});

const buildMediaStrategy = (description: string, productCategory: string): MediaStrategy => {
  const descriptionTokens = Array.from(new Set(tokenize(description)));

  if (productCategory === 'food-dessert' && (descriptionTokens.includes('baklava') || descriptionTokens.includes('bakllava'))) {
    return {
      anchors: ['baklava', 'pistachio', 'pastry', 'turkish'],
      avoidTokens: Array.from(foodMismatchTokens),
      preferStillImages: true,
      requireAnchorMatch: true,
      minimumVideoDurationRatio: 0.95,
      minimumVideoSeconds: 6,
      useHeroUploadForFirstScene: true,
      useHeroUploadForLastScene: true
    };
  }

  if (productCategory === 'food-dessert') {
    return {
      anchors: descriptionTokens.filter((token) =>
        ['dessert', 'sweet', 'pistachio', 'pastry', 'chocolate', 'cookie', 'baklava', 'bakllava'].includes(token)
      ),
      avoidTokens: Array.from(foodMismatchTokens),
      preferStillImages: false,
      requireAnchorMatch: false,
      minimumVideoDurationRatio: 0.8,
      minimumVideoSeconds: 5,
      useHeroUploadForFirstScene: false,
      useHeroUploadForLastScene: false
    };
  }

  if (productCategory === 'fitness-wellness') {
    return {
      anchors: descriptionTokens.filter((token) =>
        ['fitness', 'home', 'workout', 'training', 'exercise', 'stronger', 'program', 'progress'].includes(token)
      ),
      avoidTokens: Array.from(fitnessMismatchTokens),
      preferStillImages: false,
      requireAnchorMatch: false,
      minimumVideoDurationRatio: 0.82,
      minimumVideoSeconds: 5,
      useHeroUploadForFirstScene: false,
      useHeroUploadForLastScene: false
    };
  }

  if (productCategory === 'sports-football') {
    const anchors = Array.from(
      new Set([
        ...descriptionTokens.filter((token) =>
          [
            'soccer',
            'football',
            'match',
            'stadium',
            'fans',
            'crowd',
            'goal',
            'celebration',
            'highlights',
            'kickoff',
            'dribble',
            'tackle',
            'referee',
            'rivalry'
          ].includes(token)
        ),
        'soccer',
        'stadium',
        'goal',
        'fans'
      ])
    );

    return {
      anchors,
      avoidTokens: Array.from(footballMismatchTokens),
      preferStillImages: false,
      requireAnchorMatch: false,
      minimumVideoDurationRatio: 0.82,
      minimumVideoSeconds: 4,
      useHeroUploadForFirstScene: false,
      useHeroUploadForLastScene: false
    };
  }

  if (isEsportsBrief(description, productCategory)) {
    return {
      anchors: descriptionTokens.filter((token) =>
        [
          'arena',
          'crowd',
          'esports',
          'gaming',
          'headset',
          'keyboard',
          'major',
          'mouse',
          'player',
          'stage',
          'tournament',
          'trophy'
        ].includes(token)
      ),
      avoidTokens: Array.from(esportsMismatchTokens),
      preferStillImages: false,
      requireAnchorMatch: false,
      minimumVideoDurationRatio: 0.8,
      minimumVideoSeconds: 4,
      useHeroUploadForFirstScene: false,
      useHeroUploadForLastScene: false
    };
  }

  return {
    anchors: descriptionTokens.slice(0, 6),
    avoidTokens: [],
    preferStillImages: false,
    requireAnchorMatch: false,
    minimumVideoDurationRatio: 0.75,
    minimumVideoSeconds: 4,
    useHeroUploadForFirstScene: true,
    useHeroUploadForLastScene: true
  };
};

const scoreCandidate = ({
  candidate,
  scene,
  productCategory,
  targetDuration,
  description,
  strategy
}: {
  candidate: MediaCandidate;
  scene: ScriptScene;
  productCategory: string;
  targetDuration: number;
  description: string;
  strategy: MediaStrategy;
}) => {
  const sceneTokens = Array.from(
    new Set(
      tokenize(
        [
          scene.headline,
          scene.visualBrief,
          ...(scene.onScreenText || []),
          ...(scene.pexelsKeywords || [])
        ].join(' ')
      )
    )
  );
  const categoryTokens = Array.from(new Set(tokenize(productCategory.replace(/-/g, ' '))));
  const queryTokens = Array.from(new Set(tokenize(candidate.query)));
  const descriptionTokens = Array.from(new Set(tokenize(description)));
  const anchorTokens = strategy.anchors.length ? strategy.anchors : descriptionTokens.slice(0, 6);
  const matchedSceneTokens = sceneTokens.filter((token) => queryTokens.includes(token)).length;
  const matchedCategoryTokens = categoryTokens.filter((token) => queryTokens.includes(token)).length;
  const matchedAnchorTokens = anchorTokens.filter((token) => queryTokens.includes(token)).length;
  const genericPenalty = queryTokens.filter((token) => genericQueryTokens.has(token)).length;
  const mismatchPenalty = queryTokens.filter(
    (token) => strategy.avoidTokens.includes(token) && !descriptionTokens.includes(token)
  ).length;
  const aspect = candidate.width / Math.max(candidate.height, 1);
  const aspectScore = Math.max(0, 2.6 - Math.abs(aspect - TARGET_ASPECT_RATIO) * 4.5);
  const resolutionScore =
    candidate.width * candidate.height >= 1080 * 1920
      ? 1.5
      : candidate.width * candidate.height >= 720 * 1280
        ? 1
        : 0.4;

  let score =
    matchedSceneTokens * 0.9 +
    matchedCategoryTokens * 0.6 +
    matchedAnchorTokens * 1.35 +
    aspectScore +
    resolutionScore;

  if (candidate.kind === 'video') {
    score += 1.8;

    if (candidate.duration) {
      if (candidate.duration >= targetDuration + 1) {
        score += 2.6;
      } else if (candidate.duration >= targetDuration * strategy.minimumVideoDurationRatio) {
        score += 1.4;
      } else {
        score -= Math.min((targetDuration - candidate.duration) * 1.7, 4.8);
      }

      if (candidate.duration < strategy.minimumVideoSeconds) {
        score -= 3.2;
      }
    } else {
      score -= 0.8;
    }
  } else {
    score += strategy.preferStillImages ? 1.2 : -0.7;
  }

  score -= genericPenalty * 0.35;
  score -= mismatchPenalty * 2.2;
  if (strategy.requireAnchorMatch && matchedAnchorTokens === 0) {
    score -= 3.4;
  }

  return Number(score.toFixed(2));
};

const shouldPreferImageOverVideo = ({
  bestCandidate,
  imageCandidate,
  targetDuration,
  strategy,
  description
}: {
  bestCandidate: MediaCandidate;
  imageCandidate?: MediaCandidate;
  targetDuration: number;
  strategy: MediaStrategy;
  description: string;
}) => {
  if (bestCandidate.source === 'upload') {
    return false;
  }

  if (bestCandidate.kind !== 'video') {
    return false;
  }

  const descriptionTokens = Array.from(new Set(tokenize(description)));
  const queryTokens = Array.from(new Set(tokenize(bestCandidate.query)));
  const matchedAnchorTokens = strategy.anchors.filter((token) => queryTokens.includes(token)).length;
  const durationTooShort =
    typeof bestCandidate.duration === 'number' &&
    bestCandidate.duration <
      Math.max(targetDuration * strategy.minimumVideoDurationRatio, strategy.minimumVideoSeconds);
  const mismatchedSubject = queryTokens.some(
    (token) => strategy.avoidTokens.includes(token) && !descriptionTokens.includes(token)
  );

  if (strategy.preferStillImages && (durationTooShort || mismatchedSubject || matchedAnchorTokens === 0)) {
    return Boolean(imageCandidate);
  }

  return false;
};

const buildSelectionReason = ({
  candidate,
  score,
  targetDuration
}: {
  candidate: MediaCandidate;
  score: number;
  targetDuration: number;
}) => {
  if (candidate.kind === 'video') {
    if ((candidate.duration || 0) >= targetDuration) {
      return `Selected a video match with better vertical framing and enough duration for the ${targetDuration.toFixed(1)}s scene.`;
    }

    return `Selected the strongest available video match and will hold the ending frame instead of looping it. Score ${score.toFixed(1)}.`;
  }

  return `Selected a still image because it matched the brief better than the available video clips. Score ${score.toFixed(1)}.`;
};

const chooseMedia = async ({
  scene,
  productImagePaths,
  style,
  productCategory,
  description,
  sceneDir,
  allowStyleTransfer,
  targetDuration,
  sceneIndex,
  sceneCount,
  usedMediaKeys
}: {
  scene: ScriptScene;
  productImagePaths: string[];
  style: string;
  productCategory: string;
  description: string;
  sceneDir: string;
  allowStyleTransfer: boolean;
  targetDuration: number;
  sceneIndex: number;
  sceneCount: number;
  usedMediaKeys: Set<string>;
}): Promise<MediaCandidate> => {
  const strategy = buildMediaStrategy(description, productCategory);
  
  if (productImagePaths.length > 0 && sceneIndex === 0) {
    // First image always opens the video
    return createUploadFallback(
      productImagePaths[0],
      'Used the first uploaded product image to open with a product-faithful hero scene.'
    );
  }

  if (productImagePaths.length >= 2 && sceneIndex === sceneCount - 1) {
    // Second image always closes the video
    return createUploadFallback(
      productImagePaths[1],
      'Used the second uploaded product image to close with a clear product-and-CTA hero shot.'
    );
  }

  if (productImagePaths.length === 1 && sceneIndex === sceneCount - 1) {
    // Only one image uploaded — reuse it for the closing scene too
    return createUploadFallback(
      productImagePaths[0],
      'Reused the uploaded product image to close with a clear product-and-CTA hero shot.'
    );
  }

  const candidates = await findSceneMedia(scene, productCategory, description);

  if (candidates.length >= 1) {
    const ranked = [...candidates]
      .filter((candidate) => !usedMediaKeys.has(candidate.externalId || candidate.url))
      .map((candidate) => ({
        candidate,
        score: scoreCandidate({
          candidate,
          scene,
          productCategory,
          targetDuration,
          description,
          strategy
        })
      }))
      .sort((left, right) => right.score - left.score);

    const imageOption = ranked.find((item) => item.candidate.kind !== 'video');
    const best = ranked[0];
    const preferred =
      best &&
      imageOption &&
      shouldPreferImageOverVideo({
        bestCandidate: best.candidate,
        imageCandidate: imageOption.candidate,
        targetDuration,
        strategy,
        description
      })
        ? imageOption
        : best;
    if (preferred && preferred.score >= 4.4) {
      const selected = preferred.candidate;
      const extension = selected.kind === 'video' ? 'mp4' : 'jpg';
      const localPath = await downloadToFile({
        url: selected.url,
        outputDir: sceneDir,
        label: `${scene.sceneNumber}-${selected.kind}`,
        extension
      });

      return {
        ...selected,
        localPath,
        selectionScore: preferred.score,
        selectionReason: buildSelectionReason({
          candidate: selected,
          score: preferred.score,
          targetDuration
        })
      } satisfies MediaCandidate;
    }

    if (productImagePaths.length === 0 && best) {
      const selected = best.candidate;
      const extension = selected.kind === 'video' ? 'mp4' : 'jpg';
      const localPath = await downloadToFile({
        url: selected.url,
        outputDir: sceneDir,
        label: `${scene.sceneNumber}-${selected.kind}`,
        extension
      });

      return {
        ...selected,
        localPath,
        selectionScore: best.score,
        selectionReason:
          best.score >= 0
            ? 'Used the strongest stock match because no product image was uploaded for this scene.'
            : 'Used the least-wrong stock match because no product image was uploaded for this scene.'
      } satisfies MediaCandidate;
    }
  }

  if (allowStyleTransfer && productImagePaths.length > 0 && candidates.length === 0) {
    const productImagePath = productImagePaths[0];
    const replicate = await createReplicateStyledImages({
      productImagePath,
      prompt: scene.imagePrompt,
      style,
      outputDir: sceneDir
    });

    if (replicate[0]) {
      return {
        ...replicate[0],
        selectionReason:
          'Used experimental style-transfer fallback because no stock media matched this scene.'
      };
    }

    const stability = await createStabilityFallbackImage({
      prompt: scene.imagePrompt,
      outputDir: sceneDir
    });

    if (stability) {
      return {
        ...stability,
        selectionReason:
          'Used experimental image fallback because no stock media matched this scene.'
      };
    }
  }

  if (productImagePaths.length === 0) {
    const stability = await createStabilityFallbackImage({
      prompt: scene.imagePrompt,
      outputDir: sceneDir
    });

    if (stability) {
      return {
        ...stability,
        selectionReason:
          'Used generated fallback imagery because no product image was uploaded and stock matches were weak.'
      };
    }
    throw new Error(
      'No usable media was found for this scene. Add a product image or refine the description with more visual detail.'
    );
  }

  return createUploadFallback(productImagePaths[sceneIndex % productImagePaths.length]);
};

export const processVideoJob = async (jobId: string) => {
  const videoJob = await VideoJob.findById(jobId);
  if (!videoJob) {
    console.error(`[VideoOrchestrator] Job ${jobId} not found.`);
    return;
  }

  const jobDir = path.join(config.workingDir, String(videoJob._id));
  await ensureDir(jobDir);

  try {
    await publishJobProgress(String(videoJob._id), {
      status: 'processing',
      stage: 'writing-script',
      progress: 10,
      message: 'Writing a conversion-focused script...'
    });

  const script = await generateScriptPackage(
    videoJob.description,
    videoJob.style,
    videoJob.productCategory || 'general-product'
  );
  videoJob.script = script;
  videoJob.audience = script.audience;
  videoJob.offer = script.offer;
  videoJob.proof = script.proof;
  videoJob.metadata = {
    ...(videoJob.metadata || {}),
    jobFolder: jobDir,
    sceneCount: script.scenes.length,
    startedAt: new Date()
  };
  await videoJob.save();

  await publishJobProgress(String(videoJob._id), {
    status: 'processing',
    stage: 'generating-voice',
    progress: 34,
    message: 'Generating Deepgram voiceover and timings...'
  });

  const voiceSegments = await generateVoiceSegments({
    texts: script.scenes.map((scene) => scene.voiceover),
    workingDir: path.join(jobDir, 'voice')
  });

  await publishJobProgress(String(videoJob._id), {
    status: 'processing',
    stage: 'finding-media',
    progress: 58,
    message: 'Selecting stronger media for each scene...'
  });

  const plans: SceneRenderPlan[] = [];
  const usedMediaKeys = new Set<string>();
  for (const [index, scene] of script.scenes.entries()) {
    const sceneDir = path.join(jobDir, `scene-${scene.sceneNumber}`);
    const media = await chooseMedia({
      scene,
      productImagePaths: videoJob.imagePaths && videoJob.imagePaths.length > 0 ? videoJob.imagePaths : videoJob.imagePath ? [videoJob.imagePath] : [],
      style: videoJob.style,
      productCategory: videoJob.productCategory || 'general-product',
      description: videoJob.description,
      sceneDir,
      allowStyleTransfer: videoJob.enableStyleTransfer,
      targetDuration: voiceSegments[index].duration,
      sceneIndex: index,
      sceneCount: script.scenes.length,
      usedMediaKeys
    });

    if (media.externalId || media.url) {
      usedMediaKeys.add(media.externalId || media.url);
    }

    plans.push({
      index,
      scene,
      media,
      voice: voiceSegments[index],
      totalDuration: voiceSegments[index].duration
    });
  }

  videoJob.script = {
    ...script,
    scenes: script.scenes.map((scene, index) => ({
      ...scene,
      media: plans[index].media,
      voicePath: plans[index].voice.path,
      voiceDuration: plans[index].voice.duration,
      alignment: plans[index].voice.alignment,
      captions: plans[index].voice.captions
    }))
  };
  await videoJob.save();

  await publishJobProgress(String(videoJob._id), {
    status: 'processing',
    stage: 'rendering-video',
    progress: 78,
    message: 'Rendering scenes, transitions, and audio mix...'
  });

  const music = await selectBackgroundMusic();
  const rendered = await renderMarketingVideo({
    plans,
    jobDir,
    musicPath: music.path
  });

  await publishJobProgress(String(videoJob._id), {
    status: 'processing',
    stage: 'uploading-assets',
    progress: 92,
    message: 'Uploading final assets...'
  });

  const videoAsset = await uploadAsset(
    rendered.outputPath,
    `${videoJob._id}/final/${path.basename(rendered.outputPath)}`
  );
  const videoAssetWithLocalPath = {
    ...videoAsset,
    localPath: videoAsset.localPath || rendered.outputPath
  };
  const voiceAsset = await uploadAsset(
    rendered.voicePath,
    `${videoJob._id}/audio/${path.basename(rendered.voicePath)}`
  );

  const sceneAssets = await Promise.all(
    rendered.scenePaths.map((scenePath, index) =>
      uploadAsset(scenePath, `${videoJob._id}/scenes/scene-${index + 1}.mp4`)
    )
  );

  videoJob.output = {
    video: videoAssetWithLocalPath,
    preview: videoAssetWithLocalPath,
    voiceover: voiceAsset,
    sceneFiles: sceneAssets,
    trim: videoJob.output?.trim
  };
  videoJob.metadata = {
    ...(videoJob.metadata || {}),
    durationSeconds: rendered.durationSeconds,
    musicSource: music.source,
    completedAt: new Date()
  };
  videoJob.status = 'completed';
  videoJob.stage = 'completed';
  videoJob.progress = 100;
  videoJob.message = 'Video ready to preview and export.';
  await videoJob.save();

  await publishJobProgress(String(videoJob._id), {
    status: 'completed',
    stage: 'completed',
    progress: 100,
    message: 'Video ready to preview and export.',
    videoUrl: videoAsset.url,
    previewUrl: videoAsset.url
  });

  const manifestPath = path.join(jobDir, 'manifest.json');
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        videoUrl: videoAsset.url,
        voiceUrl: voiceAsset.url,
        localVideoPath: relativeFrom(config.rootDir, rendered.outputPath)
      },
      null,
      2
    )
  );

    return videoJob;
  } catch (error: any) {
    console.error(`[VideoOrchestrator] Job ${jobId} failed:`, error.message);
    videoJob.status = 'failed';
    videoJob.stage = 'failed';
    videoJob.error = error.message;
    await videoJob.save();

    await publishJobProgress(String(videoJob._id), {
      status: 'failed',
      stage: 'failed',
      progress: 0,
      message: `Error: ${error.message}`
    });
    
    throw error; // Re-throw for background handlers, but caught by our wrapper now
  }
};
