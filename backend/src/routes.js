"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = require("node:fs");
const node_stream_1 = require("node:stream");
const promises_2 = require("node:stream/promises");
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const ioredis_1 = __importDefault(require("ioredis"));
const mime_types_1 = __importDefault(require("mime-types"));
const VideoJob_1 = require("./models/VideoJob");
const PhotoJob_1 = require("./models/PhotoJob");
const PhotoAd_1 = require("./models/PhotoAd");
const config_1 = require("./config");
const queue_1 = require("./queue");
const files_1 = require("./utils/files");
const jobProgressService_1 = require("./services/jobProgressService");
const renderService_1 = require("./services/renderService");
const storageService_1 = require("./services/storageService");
const jobOrchestrator_1 = require("./services/jobOrchestrator");
const photoOrchestrator_1 = require("./services/photoOrchestrator");
const openAiService_1 = require("./services/openAiService");
const localEventBus_1 = require("./services/localEventBus");
const authMiddleware_1 = require("./middleware/authMiddleware");
const User_1 = __importDefault(require("./models/User"));
const router = express_1.default.Router();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const dataUrlPattern = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i;
const supportedImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const decodeImageDataUrl = (dataUrl) => {
    const match = dataUrlPattern.exec(dataUrl.trim());
    if (!match)
        return null;
    const mimeType = match[1].toLowerCase();
    const base64Payload = match[2];
    const extension = mime_types_1.default.extension(mimeType) || (mimeType === 'image/jpeg' ? 'jpg' : 'png');
    return {
        mimeType,
        extension,
        buffer: Buffer.from(base64Payload, 'base64')
    };
};
const decodeRemoteImageUrl = async (imageUrl) => {
    try {
        const url = new URL(imageUrl);
        if (!['http:', 'https:'].includes(url.protocol))
            return null;
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`Unable to download generated image (${response.status}).`);
        const mimeType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
        if (!supportedImageMimeTypes.has(mimeType)) {
            throw new Error(`Generated image URL returned unsupported content type: ${mimeType || 'unknown'}.`);
        }
        const extension = mime_types_1.default.extension(mimeType) || (mimeType === 'image/jpeg' ? 'jpg' : 'png');
        return {
            mimeType,
            extension,
            buffer: Buffer.from(await response.arrayBuffer())
        };
    }
    catch {
        return null;
    }
};
const decodeGeneratedImage = async (imageSource) => decodeImageDataUrl(imageSource) || decodeRemoteImageUrl(imageSource);
const sanitizeStorageAsset = (asset) => {
    if (!asset)
        return asset;
    const { localPath, ...rest } = asset;
    return rest;
};
const sanitizePhotoAd = (photoAd) => {
    if (!photoAd)
        return photoAd;
    const plainPhotoAd = typeof photoAd.toObject === 'function' ? photoAd.toObject() : { ...photoAd };
    delete plainPhotoAd.owner;
    plainPhotoAd.images = Array.isArray(plainPhotoAd.images)
        ? plainPhotoAd.images.map((asset) => sanitizeStorageAsset(asset))
        : [];
    return plainPhotoAd;
};
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', project: 'AI Marketing Studio MVP' });
});
router.get('/jobs', async (_req, res, next) => {
    try {
        const videoJobs = await VideoJob_1.VideoJob.find().sort({ createdAt: -1 }).limit(10).lean();
        const photoJobs = await PhotoJob_1.PhotoJob.find().sort({ createdAt: -1 }).limit(10).lean();
        res.json({ data: { videoJobs, photoJobs } });
    }
    catch (error) {
        next(error);
    }
});
router.get('/photo-ads', authMiddleware_1.protect, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const photoAds = await PhotoAd_1.PhotoAd.find({ owner: userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        res.json({ data: photoAds.map((ad) => sanitizePhotoAd(ad)) });
    }
    catch (error) {
        next(error);
    }
});
router.post('/photo-ads', authMiddleware_1.protect, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { title, prompt, aspectRatio, productCategory, style, source, imageDataUrls } = req.body;
        if (!title || !prompt || !imageDataUrls?.length) {
            res.status(400).json({ message: 'Title, prompt, and images are required.' });
            return;
        }
        const user = await User_1.default.findById(userId);
        if (!user || user.credits < 1) {
            res.status(403).json({ message: 'Insufficient credits.' });
            return;
        }
        const photoAd = new PhotoAd_1.PhotoAd({
            owner: userId,
            title,
            prompt,
            aspectRatio,
            productCategory,
            style,
            source: source || 'puter',
            images: []
        });
        // Generate marketing brief in parallel
        const brief = await (0, openAiService_1.generateMarketingBrief)(prompt, style, productCategory).catch(() => null);
        if (brief) {
            photoAd.audience = brief.audience;
            photoAd.offer = brief.offer;
            photoAd.proof = brief.proof;
        }
        const tempDir = node_path_1.default.join(config_1.config.workingDir, 'photo-ads', String(photoAd._id));
        await (0, files_1.ensureDir)(tempDir);
        const decodedImages = [];
        for (let i = 0; i < imageDataUrls.length; i++) {
            const decoded = await decodeGeneratedImage(imageDataUrls[i]);
            if (!decoded) {
                res.status(400).json({ message: `Image ${i + 1} is invalid.` });
                return;
            }
            decodedImages.push(decoded);
        }
        // Deduct credit
        user.credits -= 1;
        await user.save();
        const uploadedImages = [];
        for (let i = 0; i < decodedImages.length; i++) {
            const decoded = decodedImages[i];
            const tempFilePath = node_path_1.default.join(tempDir, (0, files_1.uniqueFile)(`photo-${i + 1}`, decoded.extension));
            await promises_1.default.writeFile(tempFilePath, decoded.buffer);
            const assetKey = `${photoAd._id}/images/${String(i + 1).padStart(2, '0')}-${(0, files_1.slugify)(title)}.${decoded.extension}`;
            const uploadedAsset = await (0, storageService_1.uploadAsset)(tempFilePath, assetKey);
            await promises_1.default.unlink(tempFilePath).catch(() => undefined);
            uploadedImages.push(uploadedAsset);
        }
        photoAd.images = uploadedImages;
        await photoAd.save();
        res.status(201).json({ data: sanitizePhotoAd(photoAd), credits: user.credits });
    }
    catch (error) {
        next(error);
    }
});
router.get('/photo-ads/:photoAdId', authMiddleware_1.protect, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const photoAd = await PhotoAd_1.PhotoAd.findOne({ _id: req.params.photoAdId, owner: userId }).lean();
        if (!photoAd) {
            res.status(404).json({ message: 'Photo ad not found.' });
            return;
        }
        res.json({ data: sanitizePhotoAd(photoAd) });
    }
    catch (error) {
        next(error);
    }
});
router.post('/photo-jobs', authMiddleware_1.protect, upload.array('images', 2), async (req, res, next) => {
    try {
        const user = await User_1.default.findById(req.user.userId);
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
            await (0, files_1.ensureDir)(config_1.config.uploadsDir);
            for (const file of files) {
                const extension = mime_types_1.default.extension(file.mimetype || '') || 'png';
                const imageFileName = (0, files_1.uniqueFile)('product-photo', extension);
                const imagePath = node_path_1.default.join(config_1.config.uploadsDir, imageFileName);
                await promises_1.default.writeFile(imagePath, file.buffer);
                imagePaths.push(imagePath);
                imageUrls.push(`${config_1.config.appUrl}/storage/uploads/${imageFileName}`);
            }
        }
        const job = await PhotoJob_1.PhotoJob.create({
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
            (0, photoOrchestrator_1.processPhotoJob)(String(job._id)).catch(async (error) => {
                await PhotoJob_1.PhotoJob.findByIdAndUpdate(job._id, {
                    status: 'failed',
                    stage: 'failed',
                    message: 'Design failed.',
                    error: error.message
                });
                localEventBus_1.localJobEvents.emit((0, jobProgressService_1.getJobChannel)(String(job._id)), {
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
    }
    catch (error) {
        next(error);
    }
});
router.post('/jobs', authMiddleware_1.protect, upload.array('images', 2), async (req, res, next) => {
    try {
        const user = await User_1.default.findById(req.user.userId);
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
            await (0, files_1.ensureDir)(config_1.config.uploadsDir);
            for (const file of files) {
                const extension = mime_types_1.default.extension(file.mimetype || '') ||
                    node_path_1.default.extname(file.originalname).replace(/^\./, '') ||
                    'png';
                const imageFileName = (0, files_1.uniqueFile)('product-image', extension);
                const imagePath = node_path_1.default.join(config_1.config.uploadsDir, imageFileName);
                await promises_1.default.writeFile(imagePath, file.buffer);
                imagePaths.push(imagePath);
                imageUrls.push(`${config_1.config.appUrl}/storage/uploads/${imageFileName}`);
            }
        }
        const job = await VideoJob_1.VideoJob.create({
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
        if (config_1.config.queueMode === 'bullmq' && queue_1.videoQueue) {
            const queueJob = await queue_1.videoQueue.add('generate-video', { jobId: String(job._id) }, {
                removeOnComplete: 100,
                removeOnFail: 100,
                attempts: 2
            });
            job.metadata = {
                ...(job.metadata || {}),
                queueJobId: String(queueJob.id)
            };
        }
        else {
            job.metadata = {
                ...(job.metadata || {}),
                queueJobId: 'inline'
            };
            setImmediate(() => {
                (0, jobOrchestrator_1.processVideoJob)(String(job._id)).catch(async (error) => {
                    await VideoJob_1.VideoJob.findByIdAndUpdate(job._id, {
                        status: 'failed',
                        stage: 'failed',
                        progress: 100,
                        message: 'Generation failed.',
                        error: error.message || 'Unknown inline processing error.'
                    });
                    localEventBus_1.localJobEvents.emit((0, jobProgressService_1.getJobChannel)(String(job._id)), {
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
    }
    catch (error) {
        next(error);
    }
});
router.get('/jobs/:jobId', async (req, res, next) => {
    try {
        const { jobId } = req.params;
        if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({ message: 'Invalid Job ID format.' });
            return;
        }
        const isVideo = (await VideoJob_1.VideoJob.findById(jobId)) !== null;
        const job = isVideo
            ? await VideoJob_1.VideoJob.findById(jobId).lean()
            : await PhotoJob_1.PhotoJob.findById(jobId).lean();
        if (!job) {
            res.status(404).json({ message: 'Job not found.' });
            return;
        }
        res.json({ data: job });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/jobs/:jobId', authMiddleware_1.protect, async (req, res, next) => {
    try {
        const { jobId } = req.params;
        if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({ message: 'Invalid Job ID format.' });
            return;
        }
        // Try to delete from VideoJob, PhotoJob, or PhotoAd
        let deleted = await VideoJob_1.VideoJob.findByIdAndDelete(jobId);
        if (!deleted) {
            deleted = await PhotoJob_1.PhotoJob.findByIdAndDelete(jobId);
        }
        if (!deleted) {
            // For PhotoAd we should also ensure owner matches, but since we are just deleting by ID and we have the protect middleware, we verify owner.
            const ad = await PhotoAd_1.PhotoAd.findById(jobId);
            if (ad && ad.owner.toString() === req.user.userId.toString()) {
                deleted = await PhotoAd_1.PhotoAd.findByIdAndDelete(jobId);
            }
        }
        if (!deleted) {
            res.status(404).json({ message: 'Job not found or unauthorized.' });
            return;
        }
        res.json({ success: true, message: 'Job deleted successfully.' });
    }
    catch (error) {
        next(error);
    }
});
router.get('/jobs/:jobId/events', async (req, res, next) => {
    const { jobId } = req.params;
    const subscriber = config_1.config.queueMode === 'bullmq'
        ? new ioredis_1.default(config_1.config.redisUrl, {
            maxRetriesPerRequest: null
        })
        : null;
    try {
        if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({ message: 'Invalid Job ID format.' });
            return;
        }
        const isVideo = (await VideoJob_1.VideoJob.findById(jobId)) !== null;
        const job = isVideo
            ? await VideoJob_1.VideoJob.findById(jobId).lean()
            : await PhotoJob_1.PhotoJob.findById(jobId).lean();
        if (!job) {
            res.status(404).json({ message: 'Job not found.' });
            return;
        }
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        res.write(`data: ${JSON.stringify(job)}\n\n`);
        const channel = (0, jobProgressService_1.getJobChannel)(jobId);
        const localHandler = (payload) => {
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
        };
        if (subscriber) {
            await subscriber.subscribe(channel);
            subscriber.on('message', (_channel, payload) => {
                res.write(`data: ${payload}\n\n`);
            });
        }
        else {
            localEventBus_1.localJobEvents.on(channel, localHandler);
        }
        const heartbeat = setInterval(() => {
            res.write('event: ping\ndata: {}\n\n');
        }, 15000);
        req.on('close', async () => {
            clearInterval(heartbeat);
            if (subscriber) {
                await subscriber.unsubscribe(channel);
                subscriber.disconnect();
            }
            else {
                localEventBus_1.localJobEvents.off(channel, localHandler);
            }
        });
    }
    catch (error) {
        subscriber?.disconnect();
        next(error);
    }
});
router.post('/jobs/:jobId/trim', async (req, res, next) => {
    try {
        const startSeconds = Number(req.body.startSeconds || 0);
        const endSeconds = Number(req.body.endSeconds || 0);
        const job = await VideoJob_1.VideoJob.findById(req.params.jobId);
        if (!job || (!job.output?.video?.localPath && !job.output?.video?.url)) {
            res.status(404).json({ message: 'Rendered video not found for this job.' });
            return;
        }
        const jobDir = node_path_1.default.join(config_1.config.workingDir, String(job._id));
        await (0, files_1.ensureDir)(jobDir);
        let sourcePath = job.output?.video?.localPath || '';
        if (!sourcePath || !(await (0, files_1.fileExists)(sourcePath))) {
            const sourceUrl = job.output?.video?.url || '';
            if (!sourceUrl) {
                res.status(404).json({ message: 'Rendered video not found for this job.' });
                return;
            }
            const downloadPath = node_path_1.default.join(jobDir, 'source-for-trim.mp4');
            const response = await fetch(sourceUrl);
            if (!response.ok || !response.body) {
                res
                    .status(502)
                    .json({ message: `Unable to download source video for trimming (${response.status}).` });
                return;
            }
            await (0, promises_2.pipeline)(node_stream_1.Readable.fromWeb(response.body), (0, node_fs_1.createWriteStream)(downloadPath));
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
        const trimOutputPath = node_path_1.default.join(jobDir, fileName);
        const trimmed = await (0, renderService_1.trimVideo)({
            sourcePath,
            startSeconds: safeStart,
            endSeconds: safeEnd,
            outputPath: trimOutputPath
        });
        const trimAsset = await (0, storageService_1.uploadAsset)(trimmed.outputPath, `${job._id}/final/${fileName}`);
        job.output.trim = {
            startSeconds: trimmed.startSeconds,
            endSeconds: trimmed.endSeconds,
            asset: trimAsset
        };
        await job.save();
        res.json({
            data: {
                trim: job.output.trim,
                relativePath: (0, files_1.relativeFrom)(config_1.config.rootDir, trimmed.outputPath)
            }
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/photo-jobs/:jobId/complete', upload.single('image'), async (req, res, next) => {
    try {
        const jobId = String(req.params.jobId || '');
        if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({ message: 'Invalid Job ID format.' });
            return;
        }
        if (!req.file) {
            res.status(400).json({ message: 'No image file provided.' });
            return;
        }
        const job = await (0, photoOrchestrator_1.completePhotoJobWithImage)(jobId, req.file.buffer, req.file.mimetype);
        res.json({ data: job });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
