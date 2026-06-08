"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderMarketingVideo = exports.trimVideo = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const config_1 = require("../config");
const files_1 = require("../utils/files");
fluent_ffmpeg_1.default.setFfmpegPath(config_1.config.ffmpegPath);
fluent_ffmpeg_1.default.setFfprobePath(config_1.config.ffprobePath);
const CAPTION_TEXT_Y = 1418;
const TARGET_ASPECT_RATIO = 9 / 16;
const SCENE_TAIL_SECONDS = 0.45;
const probeDuration = (filePath) => new Promise((resolve, reject) => {
    fluent_ffmpeg_1.default.ffprobe(filePath, (error, data) => {
        if (error) {
            reject(error);
            return;
        }
        resolve(data.format.duration || 0);
    });
});
const getSceneDuration = (plan) => plan.voice.duration + SCENE_TAIL_SECONDS;
const runCommand = (command, outputPath) => new Promise((resolve, reject) => {
    const stderr = [];
    command
        .on('stderr', (line) => {
        stderr.push(line);
    })
        .on('end', () => resolve(outputPath))
        .on('error', (error) => {
        const detail = stderr.slice(-12).join('\n').trim();
        reject(new Error(detail ? `${error.message}\n${detail}` : error.message));
    })
        .save(outputPath);
});
const escapeFilterPath = (value) => value.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
const writeFilterTextFile = async ({ jobDir, sceneIndex, label, text }) => {
    const textPath = node_path_1.default.join(jobDir, `scene-${sceneIndex + 1}-${label}.txt`);
    await promises_1.default.writeFile(textPath, text, 'utf8');
    return escapeFilterPath(textPath);
};
const createSceneClip = async ({ plan, jobDir }) => {
    const outputPath = node_path_1.default.join(jobDir, `scene-${plan.index + 1}.mp4`);
    const sceneDuration = getSceneDuration(plan); // breathing room after voiceover ends
    const command = (0, fluent_ffmpeg_1.default)();
    const mediaDuration = plan.media.kind === 'video'
        ? plan.media.duration || (await probeDuration(plan.media.localPath))
        : 0;
    if (plan.media.kind === 'video') {
        command.input(plan.media.localPath);
    }
    else {
        command.input(plan.media.localPath).inputOptions(['-loop 1']);
    }
    const sourcePrep = (() => {
        if (plan.media.kind !== 'video') {
            const frameCount = Math.ceil(sceneDuration * 30);
            const isUpload = plan.media.source === 'upload';
            const motionVariants = [
                `zoompan=z='min(zoom+0.0008,1.15)':d=${frameCount}:s=1080x1920:fps=30`,
                `zoompan=z='min(zoom+0.0007,1.12)':x='(iw-iw/zoom)*min(on/${frameCount},1)':y='(ih-ih/zoom)*0.15':d=${frameCount}:s=1080x1920:fps=30`,
                `zoompan=z='min(zoom+0.0007,1.13)':x='(iw-iw/zoom)*0.10':y='(ih-ih/zoom)*min(on/${frameCount},1)':d=${frameCount}:s=1080x1920:fps=30`,
                `zoompan=z='if(lte(on,1),1.05,max(1.05,zoom-0.0003))':d=${frameCount}:s=1080x1920:fps=30`
            ];
            const selectedMotion = motionVariants[plan.index % motionVariants.length];
            if (isUpload) {
                // APPLY subtle zoompan to the foreground upload to prevent it from being static!
                const fgMotion = `zoompan=z='min(zoom+0.0004,1.06)':d=${frameCount}:s=1080x1920:fps=30`;
                return `[0:v]split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase:flags=bicubic,crop=1080:1920,boxblur=40:20,eq=brightness=-0.1:contrast=1.05,${selectedMotion}[bg_moving];[fg]scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1,${fgMotion}[fg_moving];[bg_moving][fg_moving]overlay=(W-w)/2:(H-h)/2[bg0]`;
            }
            return `[0:v]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,${selectedMotion}[bg0]`;
        }
        const trimStart = mediaDuration > sceneDuration + 1 ? Math.max((mediaDuration - sceneDuration) * 0.35, 0) : 0;
        const playableDuration = mediaDuration > trimStart ? mediaDuration - trimStart : 0;
        const trimmedDuration = playableDuration > 0 ? Math.min(playableDuration, sceneDuration) : sceneDuration;
        const holdDuration = Math.max(sceneDuration - trimmedDuration, 0.05);
        const mediaAspect = (plan.media.width || 1080) / Math.max(plan.media.height || 1920, 1);
        const isWideClip = mediaAspect > TARGET_ASPECT_RATIO + 0.12;
        const preparedInput = `[0:v]trim=start=${trimStart.toFixed(2)}:duration=${trimmedDuration.toFixed(2)},setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=${holdDuration.toFixed(2)},trim=duration=${sceneDuration.toFixed(2)},setpts=PTS-STARTPTS`;
        if (isWideClip) {
            return `${preparedInput},split=2[widebg][widefg];[widebg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=18:8,eq=contrast=1.02:saturation=0.90[widebgfill];[widefg]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1,eq=contrast=1.08:saturation=1.05[widefgfit];[widebgfill][widefgfit]overlay=(W-w)/2:(H-h)/2[bg0]`;
        }
        return `${preparedInput},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=contrast=1.08:saturation=1.08[bg0]`;
    })();
    const filters = [sourcePrep];
    // Render Headline at the top (with a slight upward drift)
    // User requested to remove headlines and onscreen text, leaving only voiceover captions at the bottom.
    let currentLabel = 'bg0';
    const captionInputLabel = currentLabel;
    // Build Caption Filters with movement (drift upwards)
    for (const [index, caption] of plan.voice.captions.entries()) {
        const start = caption.start.toFixed(2);
        const end = caption.end.toFixed(2);
        const enableExpression = `between(t\\,${start}\\,${end})`;
        const textLabel = `captext${index}`;
        const previousLabel = index === 0 ? captionInputLabel : `captext${index - 1}`;
        const captionFile = await writeFilterTextFile({
            jobDir,
            sceneIndex: plan.index,
            label: `caption-${index}`,
            text: caption.text
        });
        filters.push(`[${previousLabel}]drawtext=fontfile='${escapeFilterPath(config_1.config.ffmpegFontPath)}':textfile='${captionFile}':reload=0:fontsize=64:fontcolor=white:line_spacing=12:shadowcolor=black@0.78:shadowx=0:shadowy=10:x=(w-text_w)/2:y=${CAPTION_TEXT_Y}-15*(t-${start}):enable='${enableExpression}'[${textLabel}]`);
    }
    const contentLabel = plan.voice.captions.length ? `captext${plan.voice.captions.length - 1}` : captionInputLabel;
    const finalLabel = `sceneout${plan.index}`;
    const fadeOutStart = Math.max(sceneDuration - 0.3, 0).toFixed(2);
    filters.push(`[${contentLabel}]fade=t=in:st=0:d=0.2,fade=t=out:st=${fadeOutStart}:d=0.3[${finalLabel}]`);
    command
        .complexFilter(filters)
        .outputOptions([
        '-map',
        `[${finalLabel}]`,
        '-an',
        '-t',
        sceneDuration.toFixed(2),
        '-r',
        '30',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-preset',
        'veryfast',
        '-crf',
        '23'
    ])
        .videoCodec('libx264');
    return runCommand(command, outputPath);
};
const concatVoiceSegments = async (voicePaths, jobDir) => {
    const listPath = node_path_1.default.join(jobDir, 'voice-concat.txt');
    const outputPath = node_path_1.default.join(jobDir, 'voiceover.mp3');
    const fileBody = voicePaths.map((voicePath) => `file '${voicePath.replace(/'/g, "'\\''")}'`).join('\n');
    await promises_1.default.writeFile(listPath, fileBody);
    const command = (0, fluent_ffmpeg_1.default)()
        .input(listPath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c copy']);
    return runCommand(command, outputPath);
};
const assembleFinalVideo = async ({ scenePaths, voicePath, musicPath, durationSeconds, outputPath }) => {
    const command = (0, fluent_ffmpeg_1.default)();
    scenePaths.forEach((scenePath) => command.input(scenePath));
    command.input(voicePath);
    if (musicPath) {
        command.input(musicPath).inputOptions(['-stream_loop -1']);
    }
    const filters = [];
    scenePaths.forEach((_, index) => {
        filters.push(`[${index}:v]scale=1080:1920,setsar=1,setpts=PTS-STARTPTS,format=yuv420p[v${index}]`);
    });
    const currentLabel = 'vcat';
    filters.push(`${scenePaths.map((_, index) => `[v${index}]`).join('')}concat=n=${scenePaths.length}:v=1:a=0[${currentLabel}]`);
    const voiceInputIndex = scenePaths.length;
    filters.push(`[${voiceInputIndex}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=1[voice]`);
    if (musicPath) {
        const musicInputIndex = scenePaths.length + 1;
        filters.push(`[${musicInputIndex}:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${durationSeconds.toFixed(2)},volume=0.22,afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(durationSeconds - 1.5, 0).toFixed(2)}:d=1.5[music]`);
        filters.push(`[music][voice]sidechaincompress=threshold=0.015:ratio=10:attack=15:release=320[ducked]`);
        filters.push(`[ducked][voice]amix=inputs=2:weights='1 1':normalize=0[aout]`);
    }
    command
        .complexFilter(filters)
        .outputOptions([
        '-map',
        `[${currentLabel}]`,
        '-map',
        musicPath ? '[aout]' : '[voice]',
        '-movflags',
        '+faststart',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-r',
        '30'
    ])
        .videoCodec('libx264')
        .audioCodec('aac');
    return runCommand(command, outputPath);
};
const trimVideo = async ({ sourcePath, startSeconds, endSeconds, outputPath }) => {
    await (0, files_1.ensureDir)(node_path_1.default.dirname(outputPath));
    const durationSeconds = await probeDuration(sourcePath).catch(() => 0);
    const safeStart = Math.max(0, Number(startSeconds) || 0);
    const rawEnd = Number(endSeconds) || 0;
    const safeEnd = rawEnd > 0 ? rawEnd : durationSeconds;
    const boundedEnd = durationSeconds > 0 && Number.isFinite(durationSeconds)
        ? Math.min(safeEnd, durationSeconds)
        : safeEnd;
    if (!boundedEnd || !Number.isFinite(boundedEnd) || boundedEnd <= safeStart) {
        throw new Error('Invalid trim range.');
    }
    const command = (0, fluent_ffmpeg_1.default)(sourcePath).outputOptions([
        '-ss',
        safeStart.toFixed(2),
        '-to',
        boundedEnd.toFixed(2),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart'
    ]);
    await runCommand(command, outputPath);
    return { outputPath, startSeconds: safeStart, endSeconds: boundedEnd };
};
exports.trimVideo = trimVideo;
const renderMarketingVideo = async ({ plans, jobDir, musicPath }) => {
    await (0, files_1.ensureDir)(jobDir);
    const scenePaths = [];
    for (const plan of plans) {
        scenePaths.push(await createSceneClip({
            plan,
            jobDir
        }));
    }
    const voicePath = await concatVoiceSegments(plans.map((plan) => plan.voice.path), jobDir);
    const durationSeconds = plans.reduce((sum, plan) => sum + getSceneDuration(plan), 0);
    const outputPath = node_path_1.default.join(jobDir, 'final-video.mp4');
    await assembleFinalVideo({
        scenePaths,
        voicePath,
        musicPath,
        durationSeconds,
        outputPath
    });
    const finalDurationSeconds = await probeDuration(outputPath).catch(() => durationSeconds);
    return {
        voicePath,
        outputPath,
        scenePaths,
        durationSeconds: finalDurationSeconds
    };
};
exports.renderMarketingVideo = renderMarketingVideo;
