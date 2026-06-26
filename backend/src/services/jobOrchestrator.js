"use strict";

// Importojmë modulet bazë të Node.js
const fs = require("node:fs/promises");
const path = require("node:path");

// Importojmë modelin e databazës dhe të gjitha shërbimet (Services) e nevojshme
const { VideoJob } = require("../models/VideoJob");
const { publishJobProgress } = require("./jobProgressService");
const { generateScriptPackage } = require("./openAiService");
const { findSceneMedia } = require("./pexelsService");
const { createReplicateStyledImages, createStabilityFallbackImage } = require("./imageFallbackService");
const { downloadToFile } = require("./downloadService");
const { generateVoiceSegments } = require("./voiceService");
const { renderMarketingVideo } = require("./renderService");
const { uploadAsset } = require("./storageService");
const { selectBackgroundMusic } = require("./musicService");
const { config } = require("../config");
const { ensureDir, relativeFrom } = require("../utils/files");

// Përcaktojmë formatin e videos 9:16 (Vertikale)
const TARGET_ASPECT_RATIO = 9 / 16;

// Setet me fjalë kyçe: Përdoren për të filtruar dhe shmangur pamjet e gabuara ose shumë gjenerike
const genericQueryTokens = new Set([
    'abstract', 'background', 'branding', 'business', 'corporate', 
    'digital', 'generic', 'innovation', 'marketing', 'media', 
    'office', 'success', 'technology'
]);

// Fjalët që duhen shmangur për kategori specifike që mos të ketë mospërputhje vizuale
const foodMismatchTokens = new Set(['cake', 'cream', 'cupcake', 'frosting', 'icing', 'whipped']);
const fitnessMismatchTokens = new Set(['conversation', 'desk', 'interview', 'meeting', 'office', 'podcast', 'talking']);
const footballMismatchTokens = new Set(['nfl', 'touchdown', 'quarterback', 'superbowl', 'helmet', 'american']);
const esportsMismatchTokens = new Set([
    'business', 'coding', 'conference', 'console', 'controller', 
    'office', 'phone', 'programming', 'smartphone', 'vr'
]);

// Fjalët që identifikojnë nëse kërkesa ka lidhje me lojëra elektronike
const esportsBriefTokens = [
    'counter strike', 'counter-strike', 'cs2', 'esports', 
    'e sports', 'gaming tournament', 'major finals'
];

// Funksioni ndihmës për të kontrolluar nëse skenari ka lidhje me lojëra elektronike
const isEsportsBrief = (description, productCategory) => {
    const normalized = `${productCategory} ${description}`.toLowerCase();
    return productCategory === 'gaming-esports' || esportsBriefTokens.some((token) => normalized.includes(token));
};

// Pastron tekstin duke hequr simbole dhe e ndan në fjalë të veçanta
const tokenize = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);

// Krijon një strukturë duke përdorur imazhin që e ka ngarkuar vetë përdoruesi
const createUploadFallback = (productImagePath, reason = 'Used the uploaded product image because stock matches were weak or off-brief.') => ({
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

// Ndërton strategjinë e përzgjedhjes së mediave bazuar në kategorinë e produktit
const buildMediaStrategy = (description, productCategory) => {
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
            anchors: descriptionTokens.filter((token) => ['dessert', 'sweet', 'pistachio', 'pastry', 'chocolate', 'cookie', 'baklava', 'bakllava'].includes(token)),
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
            anchors: descriptionTokens.filter((token) => ['fitness', 'home', 'workout', 'training', 'exercise', 'stronger', 'program', 'progress'].includes(token)),
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
        const anchors = Array.from(new Set([
            ...descriptionTokens.filter((token) => [
                'soccer', 'football', 'match', 'stadium', 'fans', 'crowd', 
                'goal', 'celebration', 'highlights', 'kickoff', 'dribble', 
                'tackle', 'referee', 'rivalry'
            ].includes(token)),
            'soccer', 'stadium', 'goal', 'fans'
        ]));
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
            anchors: descriptionTokens.filter((token) => [
                'arena', 'crowd', 'esports', 'gaming', 'headset', 'keyboard', 
                'major', 'mouse', 'player', 'stage', 'tournament', 'trophy'
            ].includes(token)),
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

// Jep pikë për vlerësimin e medias që të përshtatet sa më shumë me skenën
const scoreCandidate = ({ candidate, scene, productCategory, targetDuration, description, strategy }) => {
    const sceneTokens = Array.from(new Set(tokenize([
        scene.headline,
        scene.visualBrief,
        ...(scene.onScreenText || []),
        ...(scene.pexelsKeywords || [])
    ].join(' ')))); 
    
    const categoryTokens = Array.from(new Set(tokenize(productCategory.replace(/-/g, ' '))));
    const queryTokens = Array.from(new Set(tokenize(candidate.query)));
    const descriptionTokens = Array.from(new Set(tokenize(description)));
    const anchorTokens = strategy.anchors.length ? strategy.anchors : descriptionTokens.slice(0, 6);
    
    // Kalkulojmë përputhjet e fjalëve kyçe
    const matchedSceneTokens = sceneTokens.filter((token) => queryTokens.includes(token)).length;
    const matchedCategoryTokens = categoryTokens.filter((token) => queryTokens.includes(token)).length;
    const matchedAnchorTokens = anchorTokens.filter((token) => queryTokens.includes(token)).length;
    
    // Penalizimet nëse pamja ka fjalë shumë të përgjithshme ose fjalë që duhen shmangur
    const genericPenalty = queryTokens.filter((token) => genericQueryTokens.has(token)).length;
    const mismatchPenalty = queryTokens.filter((token) => strategy.avoidTokens.includes(token) && !descriptionTokens.includes(token)).length;
    
    // Vlerësimi i përmasave (Aspect Ratio): Duam video vertikale!
    const aspect = candidate.width / Math.max(candidate.height, 1);
    const aspectScore = Math.max(0, 2.6 - Math.abs(aspect - TARGET_ASPECT_RATIO) * 4.5);
    
    // Vlerësimi i rezolucionit (Preferohet Full HD 1080p ose më lart)
    const resolutionScore = candidate.width * candidate.height >= 1080 * 1920
        ? 1.5
        : candidate.width * candidate.height >= 720 * 1280 ? 1 : 0.4;
        
    // Formula matematike e llogaritjes së pikëve totale
    let score = matchedSceneTokens * 0.9 +
        matchedCategoryTokens * 0.6 +
        matchedAnchorTokens * 1.35 +
        aspectScore +
        resolutionScore;
        
    // Bonuse ose penalizime shtesë për videot dhe kohëzgjatjen e tyre
    if (candidate.kind === 'video') {
        score += 1.8;
        if (candidate.duration) {
            if (candidate.duration >= targetDuration + 1) {
                score += 2.6; // Videoja ka kohëzgjatje të mjaftueshme
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

// Përcakton nëse duhet të zgjedhim një foto në vend të një videoje
const shouldPreferImageOverVideo = ({ bestCandidate, imageCandidate, targetDuration, strategy, description }) => {
    if (bestCandidate.source === 'upload' || bestCandidate.kind !== 'video') {
        return false;
    }
    
    const descriptionTokens = Array.from(new Set(tokenize(description)));
    const queryTokens = Array.from(new Set(tokenize(bestCandidate.query)));
    const matchedAnchorTokens = strategy.anchors.filter((token) => queryTokens.includes(token)).length;
    
    const durationTooShort = typeof bestCandidate.duration === 'number' &&
        bestCandidate.duration < Math.max(targetDuration * strategy.minimumVideoDurationRatio, strategy.minimumVideoSeconds);
        
    const mismatchedSubject = queryTokens.some((token) => strategy.avoidTokens.includes(token) && !descriptionTokens.includes(token));
    
    if (strategy.preferStillImages && (durationTooShort || mismatchedSubject || matchedAnchorTokens === 0)) {
        return Boolean(imageCandidate);
    }
    return false;
};

// Ndërton një tekst logimi se pse u zgjodh ajo media specifike
const buildSelectionReason = ({ candidate, score, targetDuration }) => {
    if (candidate.kind === 'video') {
        if ((candidate.duration || 0) >= targetDuration) {
            return `Selected a video match with better vertical framing and enough duration for the ${targetDuration.toFixed(1)}s scene.`;
        }
        return `Selected the strongest available video match and will hold the ending frame instead of looping it. Score ${score.toFixed(1)}.`;
    }
    return `Selected a still image because it matched the brief better than the available video clips. Score ${score.toFixed(1)}.`;
};

// Vendos se çfarë do të shfaqet në ekran për një skenë të caktuar
const chooseMedia = async ({ scene, productImagePaths, style, productCategory, description, sceneDir, allowStyleTransfer, targetDuration, sceneIndex, sceneCount, usedMediaKeys }) => {
    const strategy = buildMediaStrategy(description, productCategory);
    
    // Rregull strikt: Skena e parë hapet gjithmonë me imazhin e produktit të ngarkuar nga klienti
    if (productImagePaths.length > 0 && sceneIndex === 0) {
        return createUploadFallback(productImagePaths[0], 'Used the first uploaded product image to open with a product-faithful hero scene.');
    }
    
    // Skena e fundit mbyllet me imazhin e produktit për thirrje në aksion (CTA)
    if (productImagePaths.length >= 2 && sceneIndex === sceneCount - 1) {
        return createUploadFallback(productImagePaths[1], 'Used the second uploaded product image to close with a clear product-and-CTA hero shot.');
    }
    if (productImagePaths.length === 1 && sceneIndex === sceneCount - 1) {
        return createUploadFallback(productImagePaths[0], 'Reused the uploaded product image to close with a clear product-and-CTA hero shot.');
    }
    
    // Kërkojmë media të gatshme në Pexels API
    const candidates = await findSceneMedia(scene, productCategory, description);
    if (candidates.length >= 1) {
        const ranked = [...candidates]
            .filter((candidate) => !usedMediaKeys.has(candidate.externalId || candidate.url))
            .map((candidate) => ({
                candidate,
                score: scoreCandidate({ candidate, scene, productCategory, targetDuration, description, strategy })
            }))
            .sort((left, right) => right.score - left.score);
            
        const imageOption = ranked.find((item) => item.candidate.kind !== 'video');
        const best = ranked[0];
        
        const preferred = best && imageOption && shouldPreferImageOverVideo({
            bestCandidate: best.candidate,
            imageCandidate: imageOption.candidate,
            targetDuration,
            strategy,
            description
        }) ? imageOption : best;
        
        // Nëse gjejmë një pamje me cilësi të lartë (pikët >= 4.4), e shkarkojmë dhe e kthejmë atë
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
                selectionReason: buildSelectionReason({ candidate: selected, score: preferred.score, targetDuration })
            };
        }
        
        // Nëse nuk u ngarkua asnjë imazh produkti, marrim pamjen më të mirë nga Pexels edhe nëse pikët janë të ulëta
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
                selectionReason: best.score >= 0
                    ? 'Used the strongest stock match because no product image was uploaded for this scene.'
                    : 'Used the least-wrong stock match because no product image was uploaded for this scene.'
            };
        }
    }
    
    // NËSE NUK GJENDET ASGJË NË PEXELS: Përdorim Inteligjencën Artificiale si plan rezervë (Fallback)
    if (allowStyleTransfer && productImagePaths.length > 0 && candidates.length === 0) {
        const productImagePath = productImagePaths[0];
        
        // Provë 1: Stilim i fotos së produktit me Replicate API (Image-to-Image)
        const replicate = await createReplicateStyledImages({
            productImagePath,
            prompt: scene.imagePrompt,
            style,
            outputDir: sceneDir
        });
        if (replicate[0]) {
            return {
                ...replicate[0],
                selectionReason: 'Used experimental style-transfer fallback because no stock media matched this scene.'
            };
        }
        
        // Provë 2: Gjenerim i plotë i një imazhi të ri me Stability AI (Text-to-Image)
        const stability = await createStabilityFallbackImage({
            prompt: scene.imagePrompt,
            outputDir: sceneDir
        });
        if (stability) {
            return {
                ...stability,
                selectionReason: 'Used experimental image fallback because no stock media matched this scene.'
            };
        }
    }
    
    // Nëse nuk ka foto produkti fare dhe Pexels dështoi, përdorim vetëm Stability AI
    if (productImagePaths.length === 0) {
        const stability = await createStabilityFallbackImage({
            prompt: scene.imagePrompt,
            outputDir: sceneDir
        });
        if (stability) {
            return {
                ...stability,
                selectionReason: 'Used generated fallback imagery because no product image was uploaded and stock matches were weak.'
            };
        }
        throw new Error('No usable media was found for this scene. Add a product image or refine the description with more visual detail.');
    }
    
    // Zgjedhja e fundit ekstreme: Thjesht përsërit njërën nga fotot e ngarkuara të produktit
    return createUploadFallback(productImagePaths[sceneIndex % productImagePaths.length]);
};

// Funksioni kryesor që ekzekuton të gjithë fluksin e gjenerimit të një videoje
const processVideoJob = async (jobId) => {
    const videoJob = await VideoJob.findById(jobId);
    if (!videoJob) {
        console.error(`[VideoOrchestrator] Job ${jobId} not found.`);
        return;
    }
    
    // Krijojmë një dosje të përkohshme pune në server posaçërisht për këtë video punë
    const jobDir = path.join(config.workingDir, String(videoJob._id));
    await ensureDir(jobDir);
    
    try {
        // HAPI 1: Shkrimi i skriptit me inteligjencë artificiale (OpenAI)
        await publishJobProgress(String(videoJob._id), {
            status: 'processing',
            stage: 'writing-script',
            progress: 10,
            message: 'Writing a conversion-focused script...'
        });
        
        // Kontrollojmë punët e vjetra që të mos gjenerojmë të njëjtat ide/skena përsëri
        const previousJobs = await VideoJob.find({
            _id: { $ne: videoJob._id },
            description: videoJob.description,
            productCategory: videoJob.productCategory || 'general-product',
            'script.scenes.0': { $exists: true }
        })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean();
        
        const avoidSceneBriefs = previousJobs.flatMap((job) => (job.script?.scenes || [])
            .slice(0, 6)
            .map((scene) => [
                `Voiceover: ${scene.voiceover}`,
                `Visual: ${scene.visualBrief}`,
                `Keywords: ${(scene.pexelsKeywords || []).join(', ')}`
            ].filter(Boolean).join(' | '))
        );
        
        const script = await generateScriptPackage(videoJob.description, videoJob.style, videoJob.productCategory || 'general-product', {
            bypassCache: true,
            variationSeed: `${videoJob._id}:${Date.now()}`,
            avoidSceneBriefs
        });
        
        // Ruajmë të dhënat e para të skriptit në DB
        videoJob.script = script;
        videoJob.audience = script.audience;
        videoJob.offer = script.offer;
        videoJob.proof = script.proof;
        videoJob.caption = script.caption;
        videoJob.metadata = {
            ...(videoJob.metadata || {}),
            jobFolder: jobDir,
            sceneCount: script.scenes.length,
            startedAt: new Date()
        };
        await videoJob.save();
        
        // HAPI 2: Gjenerimi i zërit (Voiceover) me Deepgram
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
        
        // HAPI 3: Përzgjedhja e pamjeve (Media) për secilën skenë
        await publishJobProgress(String(videoJob._id), {
            status: 'processing',
            stage: 'finding-media',
            progress: 58,
            message: 'Selecting stronger media for each scene...'
        });
        
        const plans = [];
        const usedMediaKeys = new Set();
        
        for (const job of previousJobs) {
            for (const scene of job.script?.scenes || []) {
                if (scene.media) {
                    if (scene.media.externalId) usedMediaKeys.add(scene.media.externalId);
                    if (scene.media.url) usedMediaKeys.add(scene.media.url);
                }
            }
        }
        
        // Cikli që përpunon çdo skenë një nga një dhe gjen median përkatëse
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
        
        // Përditësojmë skriptin në DB me të dhënat e plota të mediave dhe sinkronizimit të zërit/titrave
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
        
        // HAPI 4: Montimi dhe Renderimi final i videos me FFmpeg
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
        
        // HAPI 5: Ngarkimi i skedarëve në Cloud Storage (S3/Cloudinary etj.)
        await publishJobProgress(String(videoJob._id), {
            status: 'processing',
            stage: 'uploading-assets',
            progress: 92,
            message: 'Uploading final assets...'
        });
        
        const videoAsset = await uploadAsset(rendered.outputPath, `${videoJob._id}/final/${path.basename(rendered.outputPath)}`);
        const videoAssetWithLocalPath = {
            ...videoAsset,
            localPath: videoAsset.localPath || rendered.outputPath
        };
        
        const voiceAsset = await uploadAsset(rendered.voicePath, `${videoJob._id}/audio/${path.basename(rendered.voicePath)}`);
        const sceneAssets = await Promise.all(rendered.scenePaths.map((scenePath, index) => 
            uploadAsset(scenePath, `${videoJob._id}/scenes/scene-${index + 1}.mp4`)
        ));
        
        // KONFLUIMI: Shënojmë punën si të përfunduar me sukses (Completed)
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
        
        // Njoftojmë përdoruesin në Frontend (p.sh. nëpërmjet WebSockets/Socket.io)
        await publishJobProgress(String(videoJob._id), {
            status: 'completed',
            stage: 'completed',
            progress: 100,
            message: 'Video ready to preview and export.',
            output: videoJob.output,
            videoUrl: videoAsset.url,
            previewUrl: videoAsset.url
        });
        
        // Krijojmë një skedar manifest.json lokal për historik në server
        const manifestPath = path.join(jobDir, 'manifest.json');
        await fs.writeFile(manifestPath, JSON.stringify({
            videoUrl: videoAsset.url,
            voiceUrl: voiceAsset.url,
            localVideoPath: relativeFrom(config.rootDir, rendered.outputPath)
        }, null, 2));
        
        return videoJob;
    }
    catch (error) {
        // Nëse diçka dështon gjatë rrugës, ndryshojmë statusin në 'failed' që mos të bllokohet serveri
        console.error(`[VideoOrchestrator] Job ${jobId} failed:`, error.message);
        videoJob.status = 'failed';
        videoJob.stage = 'failed';
        videoJob.error = error.message;
        await videoJob.save();
        
        // Njoftojmë Frontend-in për dështimin dhe arsyen e gabimit
        await publishJobProgress(String(videoJob._id), {
            status: 'failed',
            stage: 'failed',
            progress: 0,
            message: `Error: ${error.message}`
        });
        
        throw error;
    }
};

// Eksportojmë funksionin kryesor në mënyrë standarde CommonJS
module.exports = { processVideoJob };