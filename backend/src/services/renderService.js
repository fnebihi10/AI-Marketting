"use strict";

// Importojmë menaxhuesin e skedarëve, librarinë e shtigjeve dhe fluent-ffmpeg për montim videoje
const fs = require("node:fs/promises");
const path = require("node:path");
const ffmpeg = require("fluent-ffmpeg");

const { config } = require("../config");
const { ensureDir } = require("../utils/files");

// Tregojmë rrugët se ku ndodhen ffmpeg dhe ffprobe në server
ffmpeg.setFfmpegPath(config.ffmpegPath);
ffmpeg.setFfprobePath(config.ffprobePath);

const CAPTION_TEXT_Y = 1418;
const TARGET_ASPECT_RATIO = 9 / 16;
const SCENE_TAIL_SECONDS = 0.45;

/**
 * Gjen zgjatjen në sekonda të një skedari video ose audio.
 */
const probeDuration = (filePath) => new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, data) => {
        if (error) {
            reject(error);
            return;
        }
        resolve(data.format.duration || 0);
    });
});

const getSceneDuration = (plan) => plan.voice.duration + SCENE_TAIL_SECONDS;

/**
 * FUNKSIONI NDIHMËS: runCommand
 * Ekzekuton komandën e FFmpeg dhe pret që videoja të ruhet në disk.
 */
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

// Ndihmon në pastrimin e adresave të skedarëve për t'i përdorur pa gabime brenda filtrave të FFmpeg
const escapeFilterPath = (value) => value.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

/**
 * FUNKSIONI: writeFilterTextFile
 * Shkruan tekstin e titrave në një skedar të përkohshëm .txt që FFmpeg ta lexojë pa pasur probleme.
 */
const writeFilterTextFile = async ({ jobDir, sceneIndex, label, text }) => {
    const textPath = path.join(jobDir, `scene-${sceneIndex + 1}-${label}.txt`);
    await fs.writeFile(textPath, text, 'utf8');
    return escapeFilterPath(textPath);
};

/**
 * FUNKSIONI KRYESOR 1: createSceneClip
 * Ky funksion merr një skenë të vetme dhe krijon një klip të shkurtër MP4 për të.
 * Përfshin efektet vizuale, prerjen e materialit bazë dhe vendosjen e titrave.
 */
const createSceneClip = async ({ plan, jobDir }) => {
    const outputPath = path.join(jobDir, `scene-${plan.index + 1}.mp4`);
    const sceneDuration = getSceneDuration(plan); 
    const command = ffmpeg();
    
    const mediaDuration = plan.media.kind === 'video'
        ? plan.media.duration || (await probeDuration(plan.media.localPath))
        : 0;

    // Nëse është video e fusim normalisht, nëse është foto e vendosim në "loop" (përsëritje)
    if (plan.media.kind === 'video') {
        command.input(plan.media.localPath);
    } else {
        command.input(plan.media.localPath).inputOptions(['-loop 1']);
    }

    // PËRGATITJA E FILTRAVE VIZUALË (sourcePrep)
    const sourcePrep = (() => {
        // RASTI A: Nëse materiali është FOTO statike (p.sh. e ngarkuar nga përdoruesi ose Puter AI)
        if (plan.media.kind !== 'video') {
            const frameCount = Math.ceil(sceneDuration * 30);
            const isUpload = plan.media.source === 'upload';
            
            // Variacionet e lëvizjes panoramike dhe zmadhimit (ZoomPan) që të mos duket statike
            const motionVariants = [
                `zoompan=z='min(zoom+0.0008,1.15)':d=${frameCount}:s=1080x1920:fps=30`,
                `zoompan=z='min(zoom+0.0007,1.12)':x='(iw-iw/zoom)*min(on/${frameCount},1)':y='(ih-ih/zoom)*0.15':d=${frameCount}:s=1080x1920:fps=30`,
                `zoompan=z='min(zoom+0.0007,1.13)':x='(iw-iw/zoom)*0.10':y='(ih-ih/zoom)*min(on/${frameCount},1)':d=${frameCount}:s=1080x1920:fps=30`,
                `zoompan=z='if(lte(on,1),1.05,max(1.05,zoom-0.0003))':d=${frameCount}:s=1080x1920:fps=30`
            ];
            const selectedMotion = motionVariants[plan.index % motionVariants.length];

            // Nëse përdoruesi ka ngarkuar foto, dublohet pamja: Sfondi turbullohet (Blur), kurse fotoja origjinale lëviz butësisht përpara
            if (isUpload) {
                const fgMotion = `zoompan=z='min(zoom+0.0004,1.06)':d=${frameCount}:s=1080x1920:fps=30`;
                return `[0:v]split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase:flags=bicubic,crop=1080:1920,boxblur=40:20,eq=brightness=-0.1:contrast=1.05,${selectedMotion}[bg_moving];[fg]scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1,${fgMotion}[fg_moving];[bg_moving][fg_moving]overlay=(W-w)/2:(H-h)/2[bg0]`;
            }
            return `[0:v]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,${selectedMotion}[bg0]`;
        }

        // RASTI B: Nëse materiali është VIDEO
        const trimStart = mediaDuration > sceneDuration + 1 ? Math.max((mediaDuration - sceneDuration) * 0.35, 0) : 0;
        const playableDuration = mediaDuration > trimStart ? mediaDuration - trimStart : 0;
        const trimmedDuration = playableDuration > 0 ? Math.min(playableDuration, sceneDuration) : sceneDuration;
        const holdDuration = Math.max(sceneDuration - trimmedDuration, 0.05);
        
        const mediaAspect = (plan.media.width || 1080) / Math.max(plan.media.height || 1920, 1);
        const isWideClip = mediaAspect > TARGET_ASPECT_RATIO + 0.12;
        
        const preparedInput = `[0:v]trim=start=${trimStart.toFixed(2)}:duration=${trimmedDuration.toFixed(2)},setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=${holdDuration.toFixed(2)},trim=duration=${sceneDuration.toFixed(2)},setpts=PTS-STARTPTS`;

        // Nëse videoja është horizontale (Wide), krijojmë një sfond të turbullt pas saj për të plotësuar formatin 9:16
        if (isWideClip) {
            return `${preparedInput},split=2[widebg][widefg];[widebg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=18:8,eq=contrast=1.02:saturation=0.90[widebgfill];[widefg]scale=1080:1920:force_original_aspect_ratio=decrease,setsar=1,eq=contrast=1.08:saturation=1.05[widefgfit];[widebgfill][widefgfit]overlay=(W-w)/2:(H-h)/2[bg0]`;
        }
        return `${preparedInput},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=contrast=1.08:saturation=1.08[bg0]`;
    })();

    const filters = [sourcePrep];
    let currentLabel = 'bg0';
    const captionInputLabel = currentLabel;

    // MONTIMI I TITRAVE (Captions) - Shfaqen në fund të ekranit me një animacion të lehtë lëvizjeje
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

        filters.push(`[${previousLabel}]drawtext=fontfile='${escapeFilterPath(config.ffmpegFontPath)}':textfile='${captionFile}':reload=0:fontsize=64:fontcolor=white:line_spacing=12:shadowcolor=black@0.78:shadowx=0:shadowy=10:x=(w-text_w)/2:y=${CAPTION_TEXT_Y}-15*(t-${start}):enable='${enableExpression}'[${textLabel}]`);
    }

    const contentLabel = plan.voice.captions.length ? `captext${plan.voice.captions.length - 1}` : captionInputLabel;
    const finalLabel = `sceneout${plan.index}`;
    const fadeOutStart = Math.max(sceneDuration - 0.3, 0).toFixed(2);
    
    filters.push(`[${contentLabel}]fade=t=in:st=0:d=0.2,fade=t=out:st=${fadeOutStart}:d=0.3[${finalLabel}]`);

    command
        .complexFilter(filters)
        .outputOptions([
            '-map', `[${finalLabel}]`,
            '-an',
            '-t', sceneDuration.toFixed(2),
            '-r', '30',
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            '-preset', 'veryfast',
            '-crf', '23'
        ])
        .videoCodec('libx264');

    return runCommand(command, outputPath);
};

/**
 * FUNKSIONI: concatVoiceSegments
 * Bashkon të gjitha copat e zërave të AI-së (të çdo skene) në një skedar të vetëm të plotë `voiceover.mp3`.
 */
const concatVoiceSegments = async (voicePaths, jobDir) => {
    const listPath = path.join(jobDir, 'voice-concat.txt');
    const outputPath = path.join(jobDir, 'voiceover.mp3');
    const fileBody = voicePaths.map((voicePath) => `file '${voicePath.replace(/'/g, "'\\''")}'`).join('\n');
    
    await fs.writeFile(listPath, fileBody);

    const command = ffmpeg()
        .input(listPath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c copy']);

    return runCommand(command, outputPath);
};

/**
 * FUNKSIONI: assembleFinalVideo
 * Hapi Final: Bashkon të gjitha klipet e skenave në një video të gjatë, 
 * vendos zërin sipër dhe mikson muzikën e sfondit me efektin Audio Ducking.
 */
const assembleFinalVideo = async ({ scenePaths, voicePath, musicPath, durationSeconds, outputPath }) => {
    const command = ffmpeg();
    scenePaths.forEach((scenePath) => command.input(scenePath));
    command.input(voicePath);

    // Nëse ka muzikë sfondi, aplikohet efekti 'sidechaincompress' (Audio Ducking)
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
            '-map', `[${currentLabel}]`,
            '-map', musicPath ? '[aout]' : '[voice]',
            '-movflags', '+faststart',
            '-preset', 'veryfast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-r', '30'
        ])
        .videoCodec('libx264')
        .audioCodec('aac');

    return runCommand(command, outputPath);
};

/**
 * Pret videot sipas sekondave të dëshiruara.
 */
const trimVideo = async ({ sourcePath, startSeconds, endSeconds, outputPath }) => {
    await ensureDir(path.dirname(outputPath));
    
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

    const command = ffmpeg(sourcePath).outputOptions([
        '-ss', safeStart.toFixed(2),
        '-to', boundedEnd.toFixed(2),
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-movflags', '+faststart'
    ]);

    await runCommand(command, outputPath);
    return { outputPath, startSeconds: safeStart, endSeconds: boundedEnd };
};

/**
 * ORKESTRUESI KRYESOR: renderMarketingVideo
 */
const renderMarketingVideo = async ({ plans, jobDir, musicPath }) => {
    await ensureDir(jobDir);
    const scenePaths = [];

    for (const plan of plans) {
        scenePaths.push(await createSceneClip({ plan, jobDir }));
    }

    const voicePath = await concatVoiceSegments(plans.map((plan) => plan.voice.path), jobDir);
    const durationSeconds = plans.reduce((sum, plan) => sum + getSceneDuration(plan), 0);
    const outputPath = path.join(jobDir, 'final-video.mp4');

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

// Eksportojmë funksionet në stilin standard CommonJS
module.exports = {
    trimVideo,
    renderMarketingVideo
};