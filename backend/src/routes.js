"use strict";

// Importimi i moduleve standarde të Node.js
const fsPromises = require("node:fs/promises");
const path = require("node:path");
const { createWriteStream } = require("node:fs");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

// Libraritë e palëve të treta
const express = require("express");
const multer = require("multer");
const Redis = require("ioredis");
const mime = require("mime-types");

// Importimi i Modeleve të Databazës
const { VideoJob } = require("./models/VideoJob");
const { PhotoJob } = require("./models/PhotoJob");
const { PhotoAd } = require("./models/PhotoAd");
const { User } = require("./models/User");

// Importimi i Shërbimeve dhe Konfigurimeve të brendshme
const { config } = require("./config");
const { videoQueue } = require("./queue");
const { ensureDir, uniqueFile, slugify, fileExists, relativeFrom } = require("./utils/files");
const { getJobChannel } = require("./services/jobProgressService");
const { trimVideo } = require("./services/renderService");
const { uploadAsset } = require("./services/storageService");
const { processVideoJob } = require("./services/jobOrchestrator");
const { processPhotoJob, completePhotoJobWithImage } = require("./services/photoOrchestrator");
const { generateMarketingBrief } = require("./services/openAiService");
const { localJobEvents } = require("./services/localEventBus");
const { protect } = require("./middleware/authMiddleware");

// Krijimi i një router-i të Express
const router = express.Router();

// Konfigurimi i Multer për të ruajtur skedarët e ngarkuar përkohësisht në RAM (Buffer)
const upload = multer({ storage: multer.memoryStorage() });

// Regex për të kontrolluar dhe zbërthyer imazhet në formatin Base64 Data URL
const dataUrlPattern = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i;

// Set me formatet e imazheve që lejon aplikacioni
const supportedImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

/**
 * Funksion që kthen një imazh Base64 në një objekt me llojin, prapashtesën dhe buffer-in
 */
const decodeImageDataUrl = (dataUrl) => {
    const match = dataUrlPattern.exec(dataUrl.trim());
    if (!match) return null;
    
    const mimeType = match[1].toLowerCase();
    const base64Payload = match[2];
    const extension = mime.extension(mimeType) || (mimeType === 'image/jpeg' ? 'jpg' : 'png');
    
    return {
        mimeType,
        extension,
        buffer: Buffer.from(base64Payload, 'base64')
    };
};

/**
 * Funksion që shkarkon një imazh nga një URL e jashtme dhe e kthen në buffer
 */
const decodeRemoteImageUrl = async (imageUrl) => {
    try {
        const url = new URL(imageUrl);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Unable to download generated image (${response.status}).`);
        
        const mimeType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
        if (!supportedImageMimeTypes.has(mimeType)) {
            throw new Error(`Generated image URL returned unsupported content type: ${mimeType || 'unknown'}.`);
        }
        
        const extension = mime.extension(mimeType) || (mimeType === 'image/jpeg' ? 'jpg' : 'png');
        return {
            mimeType,
            extension,
            buffer: Buffer.from(await response.arrayBuffer())
        };
    } catch {
        return null;
    }
};

/**
 * Deshifron imazhin fillimisht si Base64, e nëse dështon, si URL të jashtme
 */
const decodeGeneratedImage = async (imageSource) => decodeImageDataUrl(imageSource) || decodeRemoteImageUrl(imageSource);

/**
 * Fshin shtegun lokal (localPath) për të mos ekspozuar strukturën e serverit në API
 */
const sanitizeStorageAsset = (asset) => {
    if (!asset) return asset;
    const { localPath, ...rest } = asset;
    return rest;
};

/**
 * Pastron të dhënat e një reklame përpara se t'ia dërgojë klientit
 */
const sanitizePhotoAd = (photoAd) => {
    if (!photoAd) return photoAd;
    const plainPhotoAd = typeof photoAd.toObject === 'function' ? photoAd.toObject() : { ...photoAd };
    delete plainPhotoAd.owner;
    plainPhotoAd.images = Array.isArray(plainPhotoAd.images)
        ? plainPhotoAd.images.map((asset) => sanitizeStorageAsset(asset))
        : [];
    return plainPhotoAd;
};

/**
 * GET /health
 * Kontrollon nëse serveri është funksional (Health Check)
 */
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', project: 'AI Marketing Studio MVP' });
});

/**
 * GET /jobs
 * Merr 10 punët (jobs) e fundit për video dhe foto nga databaza e përdoruesit të autorizuar
 */
router.get('/jobs', protect, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const videoJobs = await VideoJob.find({ owner: userId }).sort({ createdAt: -1 }).limit(10).lean();
        const photoJobs = await PhotoJob.find({ owner: userId }).sort({ createdAt: -1 }).limit(10).lean();
        res.json({ data: { videoJobs, photoJobs } });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /photo-ads
 * Merr të gjitha reklamat e fotove (PhotoAds) të përdoruesit të autorizuar
 */
router.get('/photo-ads', protect, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const photoAds = await PhotoAd.find({ owner: userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        res.json({ data: photoAds.map((ad) => sanitizePhotoAd(ad)) });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /photo-ads
 * Krijon një reklamë të re fote bazuar në imazhet e gjeneruara nga AI
 */
router.post('/photo-ads', protect, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { title, prompt, aspectRatio, productCategory, style, source, imageDataUrls } = req.body;
        
        if (!title || !prompt || !imageDataUrls?.length) {
            res.status(400).json({ message: 'Title, prompt, and images are required.' });
            return;
        }
        
        const user = await User.findById(userId);
        if (!user || user.credits < 1) {
            res.status(403).json({ message: 'Insufficient credits.' });
            return;
        }
        
        const photoAd = new PhotoAd({
            owner: userId,
            title,
            prompt,
            aspectRatio,
            productCategory,
            style,
            source: source || 'puter',
            images: []
        });
        
        // Gjeneron marketing brief në mënyrë paralele
        const brief = await generateMarketingBrief(prompt, style, productCategory).catch(() => null);
        if (brief) {
            photoAd.audience = brief.audience;
            photoAd.offer = brief.offer;
            photoAd.proof = brief.proof;
        }
        
        const tempDir = path.join(config.workingDir, 'photo-ads', String(photoAd._id));
        await ensureDir(tempDir);
        
        const decodedImages = [];
        for (let i = 0; i < imageDataUrls.length; i++) {
            const decoded = await decodeGeneratedImage(imageDataUrls[i]);
            if (!decoded) {
                res.status(400).json({ message: `Image ${i + 1} is invalid.` });
                return;
            }
            decodedImages.push(decoded);
        }
        
        // Zbritja e kredisë
        user.credits -= 1;
        await user.save();
        
        const uploadedImages = [];
        for (let i = 0; i < decodedImages.length; i++) {
            const decoded = decodedImages[i];
            const tempFilePath = path.join(tempDir, uniqueFile(`photo-${i + 1}`, decoded.extension));
            await fsPromises.writeFile(tempFilePath, decoded.buffer);
            
            const assetKey = `${photoAd._id}/images/${String(i + 1).padStart(2, '0')}-${slugify(title)}.${decoded.extension}`;
            const uploadedAsset = await uploadAsset(tempFilePath, assetKey);
            
            await fsPromises.unlink(tempFilePath).catch(() => undefined);
            uploadedImages.push(uploadedAsset);
        }
        
        photoAd.images = uploadedImages;
        await photoAd.save();
        
        res.status(201).json({ data: sanitizePhotoAd(photoAd), credits: user.credits });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /photo-ads/:photoAdId
 * Merr detajet e një reklame specifike (vetëm për pronarin)
 */
router.get('/photo-ads/:photoAdId', protect, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const photoAd = await PhotoAd.findOne({ _id: req.params.photoAdId, owner: userId }).lean();
        if (!photoAd) {
            res.status(404).json({ message: 'Photo ad not found.' });
            return;
        }
        res.json({ data: sanitizePhotoAd(photoAd) });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /photo-jobs
 * Krijo një proces për gjenerim ose modifikim fotoje duke ngarkuar imazhe fizike
 */
router.post('/photo-jobs', protect, upload.array('images', 2), async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user || user.credits < 1) {
            res.status(403).json({ message: 'Insufficient credits. Please upgrade your plan.' });
            return;
        }
        
        const title = String(req.body.title || '').trim();
        const description = String(req.body.description || '').trim();
        const style = String(req.body.style || '').trim();
        const productCategory = String(req.body.productCategory || 'general-product').trim();
        
        if (!description || !style) {
            res.status(400).json({ message: 'Description and style are required.' });
            return;
        }
        
        const imagePaths = [];
        const imageUrls = [];
        const files = req.files || [];
        const source = files.length > 0 ? 'upload' : 'prompt';
        
        if (files.length > 0) {
            await ensureDir(config.uploadsDir);
            for (const file of files) {
                const extension = mime.extension(file.mimetype || '') || 'png';
                const imageFileName = uniqueFile('product-photo', extension);
                const imagePath = path.join(config.uploadsDir, imageFileName);
                await fsPromises.writeFile(imagePath, file.buffer);
                imagePaths.push(imagePath);
                imageUrls.push(`${config.appUrl}/storage/uploads/${imageFileName}`);
            }
        }
        
        const job = await PhotoJob.create({
            owner: userId,
            title,
            description,
            productCategory,
            style,
            source,
            imagePath: imagePaths[0] || '',
            imageUrl: imageUrls[0] || '',
            imagePaths,
            imageUrls,
            message: files.length > 0 ? 'Design fix queued.' : 'AI Photo Creation queued.'
        });
        
        setImmediate(() => {
            processPhotoJob(String(job._id)).catch(async (error) => {
                await PhotoJob.findByIdAndUpdate(job._id, {
                    status: 'failed',
                    stage: 'failed',
                    message: 'Design failed.',
                    error: error.message
                });
                localJobEvents.emit(getJobChannel(String(job._id)), {
                    status: 'failed',
                    stage: 'failed',
                    message: 'Design failed.',
                    error: error.message
                });
            });
        });
        
        user.credits -= 1;
        await user.save();
        res.status(201).json({ data: job });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /jobs
 * Krijon një proces (job) për gjenerimin e një videoje
 */
router.post('/jobs', protect, upload.array('images', 2), async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user || user.credits < 1) {
            res.status(403).json({ message: 'Insufficient credits. Please upgrade your plan.' });
            return;
        }
        
        const title = String(req.body.title || '').trim();
        const description = String(req.body.description || '').trim();
        const style = String(req.body.style || '').trim();
        const productCategory = String(req.body.productCategory || 'general-product').trim();
        const enableStyleTransfer = String(req.body.enableStyleTransfer || 'false') === 'true';
        
        if (!description || !style) {
            res.status(400).json({ message: 'Description and style are required.' });
            return;
        }
        
        const imagePaths = [];
        const imageUrls = [];
        const files = req.files || [];
        
        if (files.length > 0) {
            await ensureDir(config.uploadsDir);
            for (const file of files) {
                const extension = mime.extension(file.mimetype || '') ||
                    path.extname(file.originalname).replace(/^\./, '') ||
                    'png';
                const imageFileName = uniqueFile('product-image', extension);
                const imagePath = path.join(config.uploadsDir, imageFileName);
                await fsPromises.writeFile(imagePath, file.buffer);
                imagePaths.push(imagePath);
                imageUrls.push(`${config.appUrl}/storage/uploads/${imageFileName}`);
            }
        }
        
        const job = await VideoJob.create({
            owner: user._id,
            title,
            description,
            productCategory,
            style,
            enableStyleTransfer,
            imagePath: imagePaths[0] || '',
            imageUrl: imageUrls[0] || '',
            imagePaths,
            imageUrls,
            message: files.length > 0
                ? 'Queued for generation.'
                : 'Queued for generation from product description only.',
            output: {
                trim: {
                    startSeconds: 0,
                    endSeconds: 0
                }
            }
        });
        
        if (config.queueMode === 'bullmq' && videoQueue) {
            const queueJob = await videoQueue.add('generate-video', { jobId: String(job._id) }, {
                removeOnComplete: 100,
                removeOnFail: 100,
                attempts: 2
            });
            job.metadata = {
                ...(job.metadata || {}),
                queueJobId: String(queueJob.id)
            };
        } else {
            job.metadata = {
                ...(job.metadata || {}),
                queueJobId: 'inline'
            };
            setImmediate(() => {
                processVideoJob(String(job._id)).catch(async (error) => {
                    await VideoJob.findByIdAndUpdate(job._id, {
                        status: 'failed',
                        stage: 'failed',
                        progress: 100,
                        message: 'Generation failed.',
                        error: error.message || 'Unknown inline processing error.'
                    });
                    localJobEvents.emit(getJobChannel(String(job._id)), {
                        status: 'failed',
                        stage: 'failed',
                        progress: 100,
                        message: 'Generation failed.',
                        error: error.message || 'Unknown inline processing error.'
                    });
                });
            });
        }
        
        user.credits -= 1;
        await user.save();
        await job.save();
        res.status(201).json({ data: job });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /jobs/download
 * Shkarkon një skedar (video ose imazh) duke detyruar shfletuesin ta ruajë në disk
 */
router.get('/jobs/download', protect, async (req, res, next) => {
    try {
        const fileUrl = req.query.url;
        const customFilename = req.query.filename;
        if (!fileUrl) {
            res.status(400).json({ message: 'URL query parameter is required.' });

/**
 * GET /jobs/:jobId
 * Kontrollon llojin e punës (Video apo Foto) bazuar në ID dhe kthen detajet (vetëm për pronarin)
 */
router.get('/jobs/:jobId', protect, async (req, res, next) => {
    try {
        const { jobId } = req.params;
        const userId = req.user.userId;
        if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({ message: 'Invalid Job ID format.' });
            return;
        }
        
        let job = await VideoJob.findOne({ _id: jobId, owner: userId }).lean();
        if (!job) {
            job = await PhotoJob.findOne({ _id: jobId, owner: userId }).lean();
        }
            
        if (!job) {
            res.status(404).json({ message: 'Job not found.' });
            return;
        }
        res.json({ data: job });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /jobs/:jobId
 * Fshin një punë ose reklamë nga databaza
 */
router.delete('/jobs/:jobId', protect, async (req, res, next) => {
    try {
        const { jobId } = req.params;
        const userId = req.user.userId;
        if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({ message: 'Invalid Job ID format.' });
            return;
        }
        
        let deleted = await VideoJob.findOneAndDelete({ _id: jobId, owner: userId });
        if (!deleted) {
            deleted = await PhotoJob.findOneAndDelete({ _id: jobId, owner: userId });
        }
        if (!deleted) {
            const ad = await PhotoAd.findById(jobId);
            if (ad && ad.owner.toString() === userId.toString()) {
                deleted = await PhotoAd.findByIdAndDelete(jobId);
            }
        }
        
        if (!deleted) {
            res.status(404).json({ message: 'Job not found or unauthorized.' });
            return;
        }
        res.json({ success: true, message: 'Job deleted successfully.' });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /jobs/:jobId/events
 * SSE (Server-Sent Events) - Përditësimi në kohë reale i progresit në frontend
 */
router.get('/jobs/:jobId/events', protect, async (req, res, next) => {
    const { jobId } = req.params;
    const userId = req.user.userId;
    const subscriber = config.queueMode === 'bullmq'
        ? new Redis(config.redisUrl, { maxRetriesPerRequest: null })
        : null;
        
    try {
        if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({ message: 'Invalid Job ID format.' });
            return;
        }
        
        let job = await VideoJob.findOne({ _id: jobId, owner: userId }).lean();
        if (!job) {
            job = await PhotoJob.findOne({ _id: jobId, owner: userId }).lean();
        }
            
        if (!job) {
            res.status(404).json({ message: 'Job not found.' });
            return;
        }
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        if (typeof res.flushHeaders === 'function') res.flushHeaders();
        
        res.write(`data: ${JSON.stringify(job)}\n\n`);
        
        const channel = getJobChannel(jobId);
        const localHandler = (payload) => {
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
        };
        
        if (subscriber) {
            await subscriber.subscribe(channel);
            subscriber.on('message', (_channel, payload) => {
                res.write(`data: ${payload}\n\n`);
            });
        } else {
            localJobEvents.on(channel, localHandler);
        }
        
        const heartbeat = setInterval(() => {
            res.write('event: ping\ndata: {}\n\n');
        }, 15000);
        
        req.on('close', async () => {
            clearInterval(heartbeat);
            if (subscriber) {
                await subscriber.unsubscribe(channel);
                subscriber.disconnect();
            } else {
                localJobEvents.off(channel, localHandler);
            }
        });
    } catch (error) {
        if (subscriber) subscriber.disconnect();
        next(error);
    }
});

/**
 * POST /jobs/:jobId/trim
 * Pret një video ekzistuese në sekondat e caktuara (vetëm për pronarin)
 */
router.post('/jobs/:jobId/trim', protect, async (req, res, next) => {
    try {
        const startSeconds = Number(req.body.startSeconds || 0);
        const endSeconds = Number(req.body.endSeconds || 0);
        const userId = req.user.userId;
        
        const job = await VideoJob.findOne({ _id: req.params.jobId, owner: userId });
        if (!job || (!job.output?.video?.localPath && !job.output?.video?.url)) {
            res.status(404).json({ message: 'Rendered video not found for this job.' });
            return;
        }
        
        const jobDir = path.join(config.workingDir, String(job._id));
        await ensureDir(jobDir);
        
        let sourcePath = job.output?.video?.localPath || '';
        if (!sourcePath || !(await fileExists(sourcePath))) {
            const sourceUrl = job.output?.video?.url || '';
            if (!sourceUrl) {
                res.status(404).json({ message: 'Rendered video not found for this job.' });
                return;
            }
            
            const downloadPath = path.join(jobDir, 'source-for-trim.mp4');
            const response = await fetch(sourceUrl);
            if (!response.ok || !response.body) {
                res.status(502).json({ message: `Unable to download source video for trimming (${response.status}).` });
                return;
            }
            
            await pipeline(Readable.fromWeb(response.body), createWriteStream(downloadPath));
            job.output.video = {
                ...(job.output.video || {}),
                localPath: downloadPath
            };
            await job.save();
            sourcePath = downloadPath;
        }
        
        const safeStart = Math.max(0, Number.isFinite(startSeconds) ? startSeconds : 0);
        const safeEnd = Math.max(0, Number.isFinite(endSeconds) ? endSeconds : 0);
        
        const fileName = `trim-${Math.round(safeStart * 100)}-${Math.round(safeEnd * 100)}-${Date.now()}.mp4`;
        const trimOutputPath = path.join(jobDir, fileName);
        
        const trimmed = await trimVideo({
            sourcePath,
            startSeconds: safeStart,
            endSeconds: safeEnd,
            outputPath: trimOutputPath
        });
        
        const trimAsset = await uploadAsset(trimmed.outputPath, `${job._id}/final/${fileName}`);
        job.output.trim = {
            startSeconds: trimmed.startSeconds,
            endSeconds: trimmed.endSeconds,
            asset: trimAsset
        };
        
        await job.save();
        res.json({
            data: {
                trim: job.output.trim,
                relativePath: relativeFrom(config.rootDir, trimmed.outputPath)
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /photo-jobs/:jobId/complete
 * Plotëson apo përfundon manualisht një punë fotoje duke ngarkuar imazhin përfundimtar (vetëm për pronarin)
 */
router.post('/photo-jobs/:jobId/complete', protect, upload.single('image'), async (req, res, next) => {
    try {
        const jobId = String(req.params.jobId || '');
        const userId = req.user.userId;
        if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({ message: 'Invalid Job ID format.' });
            return;
        }
        if (!req.file) {
            res.status(400).json({ message: 'No image file provided.' });
            return;
        }
        
        const jobExists = await PhotoJob.findOne({ _id: jobId, owner: userId });
        if (!jobExists) {
            res.status(404).json({ message: 'Photo job not found or unauthorized.' });
            return;
        }
        
        const job = await completePhotoJobWithImage(jobId, req.file.buffer, req.file.mimetype);
        res.json({ data: job });
    } catch (error) {
        next(error);
    }
});

            return;
        }

        const parsedUrl = new URL(fileUrl);
        const filename = customFilename || path.basename(parsedUrl.pathname) || 'download';

        if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
            const isLocalhost = parsedUrl.hostname === 'localhost' || 
                                parsedUrl.hostname === '127.0.0.1' || 
                                parsedUrl.hostname === req.hostname;
                                
            if (isLocalhost) {
                const storagePrefix = '/storage/';
                if (!parsedUrl.pathname.startsWith(storagePrefix)) {
                    res.status(400).json({ message: 'Invalid file URL.' });
                    return;
                }

                const relativePath = parsedUrl.pathname.slice(storagePrefix.length);
                const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\))+/, '');
                
                let absoluteFilePath = '';
                if (safePath.startsWith('uploads/')) {
                    absoluteFilePath = path.join(config.rootDir, 'storage', safePath);
                } else if (safePath.startsWith('work/')) {
                    absoluteFilePath = path.join(config.rootDir, 'storage', safePath);
                } else {
                    absoluteFilePath = path.join(config.rootDir, 'storage/exports', safePath);
                }

                const fs = require('node:fs');
                if (!fs.existsSync(absoluteFilePath)) {
                    res.status(404).json({ message: 'File not found.' });
                    return;
                }

                res.download(absoluteFilePath, filename);
                return;
            } else {
                // Skedar nga një server i jashtëm (p.sh. S3, Supabase)
                const response = await fetch(fileUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch remote file: ${response.statusText}`);
                }
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
                
                const { Readable } = require('node:stream');
                Readable.fromWeb(response.body).pipe(res);
                return;
            }
        } else {
            res.status(400).json({ message: 'Unsupported URL protocol.' });
        }
    } catch (error) {
        next(error);
    }
});

// Eksportojmë router-in si moduli default në stilin standard CommonJS
module.exports = router;