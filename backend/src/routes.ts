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
import { config } from './config';
import { videoQueue } from './queue';
import { ensureDir, fileExists, relativeFrom, uniqueFile } from './utils/files';
import { getJobChannel } from './services/jobProgressService';
import { trimVideo } from './services/renderService';
import { uploadAsset } from './services/storageService';
import { processVideoJob } from './services/jobOrchestrator';
import { processPhotoJob, completePhotoJobWithImage } from './services/photoOrchestrator';
import { localJobEvents } from './services/localEventBus';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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

router.post('/photo-jobs', upload.array('images', 2), async (req, res, next) => {
  try {
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

    res.status(201).json({ data: job });
  } catch (error) {
    next(error);
  }
});

router.post('/jobs', upload.array('images', 2), async (req, res, next) => {
  try {
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
