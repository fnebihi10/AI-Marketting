import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import express from 'express';
import multer from 'multer';
import IORedis from 'ioredis';
import mime from 'mime-types';
import { VideoJob } from './models/VideoJob';
import { PhotoJob } from './models/PhotoJob';
import { PhotoAd } from './models/PhotoAd';
import { config } from './config';
import { videoQueue } from './queue';
import { ensureDir, fileExists, relativeFrom, uniqueFile, slugify } from './utils/files';
import { getJobChannel } from './services/jobProgressService';
import { trimVideo } from './services/renderService';
import { uploadAsset } from './services/storageService';
import { processVideoJob } from './services/jobOrchestrator';
import { processPhotoJob, completePhotoJobWithImage } from './services/photoOrchestrator';
import { generateMarketingBrief } from './services/openAiService';
import { localJobEvents } from './services/localEventBus';
import { protect } from './middleware/authMiddleware';
import User from './models/User';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const dataUrlPattern = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i;
const supportedImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const decodeImageDataUrl = (dataUrl: string) => {
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

const decodeRemoteImageUrl = async (imageUrl: string) => {
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

const decodeGeneratedImage = async (imageSource: string) =>
  decodeImageDataUrl(imageSource) || decodeRemoteImageUrl(imageSource);

const sanitizeStorageAsset = (asset: any) => {
  if (!asset) return asset;
  const { localPath, ...rest } = asset;
  return rest;
};

const sanitizePhotoAd = (photoAd: any) => {
  if (!photoAd) return photoAd;
  const plainPhotoAd = typeof photoAd.toObject === 'function' ? photoAd.toObject() : { ...photoAd };
  delete plainPhotoAd.owner;
  plainPhotoAd.images = Array.isArray(plainPhotoAd.images)
    ? plainPhotoAd.images.map((asset: any) => sanitizeStorageAsset(asset))
    : [];
  return plainPhotoAd;
};

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', project: 'AI Marketing Studio MVP' });
});

router.get('/jobs', async (_req, res, next) => {
  try {
    const videoJobs = await VideoJob.find().sort({ createdAt: -1 }).limit(10).lean();
    const photoJobs = await PhotoJob.find().sort({ createdAt: -1 }).limit(10).lean();
    res.json({ data: { videoJobs, photoJobs } });
  } catch (error) {
    next(error);
  }
});

router.get('/photo-ads', protect, async (req: any, res, next) => {
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

router.post('/photo-ads', protect, async (req: any, res, next) => {
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

    // Generate marketing brief in parallel
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

    // Deduct credit
    user.credits -= 1;
    await user.save();

    const uploadedImages = [];
    for (let i = 0; i < decodedImages.length; i++) {
      const decoded = decodedImages[i];
      const tempFilePath = path.join(tempDir, uniqueFile(`photo-${i + 1}`, decoded.extension));
      await fs.writeFile(tempFilePath, decoded.buffer);

      const assetKey = `${photoAd._id}/images/${String(i + 1).padStart(2, '0')}-${slugify(title)}.${decoded.extension}`;
      const uploadedAsset = await uploadAsset(tempFilePath, assetKey);
      await fs.unlink(tempFilePath).catch(() => undefined);
      uploadedImages.push(uploadedAsset);
    }

    photoAd.images = uploadedImages;
    await photoAd.save();

    res.status(201).json({ data: sanitizePhotoAd(photoAd), credits: user.credits });
  } catch (error) {
    next(error);
  }
});

router.get('/photo-ads/:photoAdId', protect, async (req: any, res, next) => {
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

router.post('/photo-jobs', protect, upload.array('images', 2), async (req: any, res, next) => {
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

    const imagePaths: string[] = [];
    const imageUrls: string[] = [];
    const files = (req.files as Express.Multer.File[]) || [];
    const source = files.length > 0 ? 'upload' : 'prompt';

    if (files.length > 0) {
      await ensureDir(config.uploadsDir);
      for (const file of files) {
        const extension = mime.extension(file.mimetype || '') || 'png';
        const imageFileName = uniqueFile('product-photo', extension);
        const imagePath = path.join(config.uploadsDir, imageFileName);
        await fs.writeFile(imagePath, file.buffer);
        imagePaths.push(imagePath);
        imageUrls.push(`${config.appUrl}/storage/uploads/${imageFileName}`);
      }
    }

    const job = await PhotoJob.create({
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

router.post('/jobs', protect, upload.array('images', 2), async (req: any, res, next) => {
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

    const imagePaths: string[] = [];
    const imageUrls: string[] = [];
    const files = (req.files as Express.Multer.File[]) || [];

    if (files.length > 0) {
      await ensureDir(config.uploadsDir);
      for (const file of files) {
        const extension =
          mime.extension(file.mimetype || '') ||
          path.extname(file.originalname).replace(/^\./, '') ||
          'png';
        const imageFileName = uniqueFile('product-image', extension);
        const imagePath = path.join(config.uploadsDir, imageFileName);
        await fs.writeFile(imagePath, file.buffer);
        imagePaths.push(imagePath);
        imageUrls.push(`${config.appUrl}/storage/uploads/${imageFileName}`);
      }
    }

    const job = await VideoJob.create({
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
      const queueJob = await videoQueue.add(
        'generate-video',
        { jobId: String(job._id) },
        {
          removeOnComplete: 100,
          removeOnFail: 100,
          attempts: 2
        }
      );

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

router.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({ message: 'Invalid Job ID format.' });
      return;
    }

    const isVideo = (await VideoJob.findById(jobId)) !== null;
    const job = isVideo 
      ? await VideoJob.findById(jobId).lean() 
      : await PhotoJob.findById(jobId).lean();

    if (!job) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    res.json({ data: job });
  } catch (error) {
    next(error);
  }
});

router.delete('/jobs/:jobId', protect, async (req: any, res, next) => {
  try {
    const { jobId } = req.params;
    if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({ message: 'Invalid Job ID format.' });
      return;
    }

    // Try to delete from VideoJob, PhotoJob, or PhotoAd
    let deleted = await VideoJob.findByIdAndDelete(jobId);
    if (!deleted) {
      deleted = await PhotoJob.findByIdAndDelete(jobId);
    }
    if (!deleted) {
      // For PhotoAd we should also ensure owner matches, but since we are just deleting by ID and we have the protect middleware, we verify owner.
      const ad = await PhotoAd.findById(jobId);
      if (ad && ad.owner.toString() === req.user.userId.toString()) {
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

router.get('/jobs/:jobId/events', async (req, res, next) => {
  const { jobId } = req.params;
  const subscriber =
    config.queueMode === 'bullmq'
      ? new IORedis(config.redisUrl, {
          maxRetriesPerRequest: null
        })
      : null;

  try {
    if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({ message: 'Invalid Job ID format.' });
      return;
    }

    const isVideo = (await VideoJob.findById(jobId)) !== null;
    const job = isVideo 
      ? await VideoJob.findById(jobId).lean() 
      : await PhotoJob.findById(jobId).lean();

    if (!job) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify(job)}\n\n`);

    const channel = getJobChannel(jobId);
    const localHandler = (payload: unknown) => {
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
    subscriber?.disconnect();
    next(error);
  }
});

router.post('/jobs/:jobId/trim', async (req, res, next) => {
  try {
    const startSeconds = Number(req.body.startSeconds || 0);
    const endSeconds = Number(req.body.endSeconds || 0);
    const job = await VideoJob.findById(req.params.jobId);

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
        res
          .status(502)
          .json({ message: `Unable to download source video for trimming (${response.status}).` });
        return;
      }

      await pipeline(Readable.fromWeb(response.body as any), createWriteStream(downloadPath));
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

    const job = await completePhotoJobWithImage(
      jobId,
      req.file.buffer,
      req.file.mimetype
    );

    res.json({ data: job });
  } catch (error) {
    next(error);
  }
});

export default router;
