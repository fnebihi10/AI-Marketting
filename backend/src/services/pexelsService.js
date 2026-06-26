"use strict";

// Importojmë konfigurimet e sistemit (ku ndodhet pexelsApiKey)
const { config } = require("../config");

// Përcaktojmë raportin e ekranit të videos që është vertikale (9:16)
const TARGET_ASPECT_RATIO = 9 / 16;

// Terma që duhen shmangur sipas industrive për të mos marrë media jashtë teme
const foodAvoidTerms = new Set(['cake', 'cream', 'cupcake', 'frosting', 'icing', 'shllag', 'torte', 'whipped']);
const fitnessAvoidTerms = new Set(['conversation', 'desk', 'interview', 'meeting', 'office', 'podcast', 'seminar', 'talking']);
const esportsAvoidTerms = new Set(['business', 'coding', 'conference', 'console', 'controller', 'office', 'phone', 'programming', 'smartphone', 'vr']);
const footballAvoidTerms = new Set(['nfl', 'touchdown', 'quarterback', 'superbowl', 'helmet', 'american']);

const esportsBriefTokens = [
    'counter strike', 'counter-strike', 'cs2', 'esports',
    'e sports', 'gaming tournament', 'major finals'
];

/**
 * Kontrollon nëse përshkrimi ka lidhje me lojërat elektronike (eSports)
 */
const isEsportsBrief = (description, productCategory) => {
    const normalized = `${productCategory} ${description}`.toLowerCase();
    return productCategory === 'gaming-esports' || esportsBriefTokens.some((token) => normalized.includes(token));
};

/**
 * Normalizon frazën e kërkimit për API
 */
const normalizeQuery = (value) => value
    .replace(/[-_/]+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 7)
    .join(' ');

/**
 * Lidhet me API-në e Pexels për të kërkuar video të mëdha vertikale
 */
const pexelsVideoSearch = async (query, orientation) => {
    const url = new URL('https://api.pexels.com/videos/search');
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '10');
    url.searchParams.set('orientation', orientation);
    url.searchParams.set('size', 'large');

    const response = await fetch(url, {
        headers: { Authorization: config.pexelsApiKey }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pexels video search failed: ${response.status} ${errorText}`);
    }
    return response.json();
};

/**
 * Kërkon foto në Pexels (Përdoret si plan rezervë nëse nuk gjenden video)
 */
const pexelsPhotoSearch = async (query, orientation = 'portrait') => {
    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '10');
    url.searchParams.set('orientation', orientation);

    const response = await fetch(url, {
        headers: { Authorization: config.pexelsApiKey }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pexels photo search failed: ${response.status} ${errorText}`);
    }
    return response.json();
};

// Rendit mediat sipas rezolucionit (më të lartat të parat)
const sortByResolution = (items) => [...items].sort((a, b) => (b.width * b.height) - (a.width * a.height));

/**
 * jep një pikëzim skedari të videos bazuar në aspektin vertikal dhe rezolucionin HD
 */
const scoreVideoFile = (file) => {
    const aspect = file.width / Math.max(file.height, 1);
    const aspectDelta = Math.abs(aspect - TARGET_ASPECT_RATIO);
    const portraitBonus = file.height >= file.width ? 1.5 : 0;
    
    // Preferojmë Full HD (1080p) ose 2K para skedarëve masivë 4K për të kursyer kohë renderimi
    const isHD = file.width >= 1080 && file.width <= 2560;
    const resolutionBonus = isHD ? 2.0 : 0.5;
    
    return portraitBonus + resolutionBonus - (aspectDelta * 2.5);
};

const sortVideoFiles = (items) => [...items].sort((a, b) => scoreVideoFile(b) - scoreVideoFile(a));

const tokenize = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);

const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const buildFoodSignals = (description) => {
    const normalized = description.toLowerCase();
    if (normalized.includes('baklava')) {
        return {
            anchors: unique(['baklava', 'pistachio baklava', 'turkish baklava', 'baklava dessert', 'baklava serving', 'pistachio pastry']),
            avoidTerms: Array.from(foodAvoidTerms)
        };
    }
    return { anchors: [], avoidTerms: [] };
};

const buildFitnessSignals = (description) => {
    const normalized = description.toLowerCase();
    const anchors = unique([
        normalized.includes('home') ? 'home workout' : '',
        normalized.includes('program') ? 'fitness program workout' : '',
        'fitness workout', 'exercise at home', 'personal training workout', 'fitness transformation', 'workout motivation', 'stronger body workout'
    ]);
    return { anchors, avoidTerms: Array.from(fitnessAvoidTerms) };
};

const buildFootballSignals = (description) => {
    const normalized = description.toLowerCase();
    const anchors = unique([
        'soccer match', 'football stadium', 'soccer fans', 'goal celebration', 'soccer highlights',
        normalized.includes('stadium') ? 'soccer stadium crowd' : '',
        normalized.includes('fans') ? 'soccer fans cheering' : ''
    ]);
    return { anchors, avoidTerms: Array.from(footballAvoidTerms) };
};

const buildEsportsSignals = (description) => {
    const normalized = description.toLowerCase();
    const anchors = unique([
        'esports tournament', 'gaming tournament stage', 'pro gamer pc', 'gaming arena crowd', 'esports trophy celebration', 'keyboard mouse close up',
        normalized.includes('crowd') ? 'esports crowd cheering' : '',
        normalized.includes('arena') ? 'gaming arena lights' : '',
        normalized.includes('player') ? 'esports player pc' : '',
        normalized.includes('trophy') ? 'championship trophy celebration' : ''
    ]);
    return { anchors, avoidTerms: Array.from(esportsAvoidTerms) };
};

/**
 * Ndërton një listë me fraza kërkimi inteligjente për API duke eliminuar termat e ndaluar
 */
const buildSearchQueries = ({ scene, productCategory, description }) => {
    const categoryText = productCategory.replace(/-/g, ' ');
    const foodSignals = productCategory === 'food-dessert' ? buildFoodSignals(description) : null;
    const fitnessSignals = productCategory === 'fitness-wellness' ? buildFitnessSignals(description) : null;
    const footballSignals = productCategory === 'sports-football' ? buildFootballSignals(description) : null;
    const esportsSignals = isEsportsBrief(description, productCategory) ? buildEsportsSignals(description) : null;
    
    let actionHint = '';
    if (productCategory === 'fitness-wellness') actionHint = 'person workout movement training';
    else if (productCategory === 'food-dessert') actionHint = 'close up serving texture';
    else if (productCategory === 'sports-football') actionHint = 'soccer match stadium crowd goal celebration';
    else if (esportsSignals) actionHint = 'esports arena crowd player pc headset keyboard mouse trophy';

    const baseQueries = [
        // 1. Kërkime të bazuara në sinjalet kryesore të industrisë (Top 3)
        ...(footballSignals?.anchors || []).slice(0, 3).flatMap((anchor) => [`${anchor} ${scene.visualBrief}`, `${anchor} vertical action`, anchor]),
        ...(foodSignals?.anchors || []).slice(0, 3).flatMap((anchor) => [`${anchor} ${scene.visualBrief}`, `${anchor} close up`, anchor]),
        ...(fitnessSignals?.anchors || []).slice(0, 3).flatMap((anchor) => [`${anchor} ${scene.visualBrief}`, `${anchor} workout action`, anchor]),
        ...(esportsSignals?.anchors || []).slice(0, 3).flatMap((anchor) => [`${anchor} ${scene.visualBrief}`, `${anchor} gaming arena`, anchor]),
        
        // 2. Kërkime direkte nga skenari (Prioritet i lartë)
        scene.visualBrief,
        `${categoryText} ${scene.headline}`,
        
        // 3. Kombinime fjalësh kyçe
        ...scene.pexelsKeywords.slice(0, 2).map((item) => `${categoryText} ${item}`),
        ...scene.pexelsKeywords.slice(0, 2).map((item) => (actionHint ? `${item} ${actionHint}` : item)),
        
        // 4. Fallbacks rezervë
        scene.headline,
        categoryText
    ];

    return unique(baseQueries
        .map(normalizeQuery)
        .filter(Boolean)
        .filter((query) => {
            const queryTokens = tokenize(query);
            const avoidTerms = [
                ...(foodSignals?.avoidTerms || []),
                ...(fitnessSignals?.avoidTerms || []),
                ...(footballSignals?.avoidTerms || []),
                ...(esportsSignals?.avoidTerms || [])
            ];
            return avoidTerms.length ? !queryTokens.some((token) => avoidTerms.includes(token)) : true;
        })).slice(0, 15); // Limitohet në 15 kërkesat më premtuese
};

/**
 * FUNKSIONI KRYESOR: findSceneMedia
 * Ekzekuton kërkimin fizik për një skenë:
 * 1. Gjeneron frazat e kërkimit.
 * 2. Kërkon fillimisht për Video Vertikale në Pexels.
 * 3. Nëse nuk gjendet asnjë video, përdor fotot vertikale si plan rezervë (Fallback).
 */
const findSceneMedia = async (scene, productCategory, description) => {
    if (!config.pexelsApiKey) {
        return [];
    }

    const queries = buildSearchQueries({ scene, productCategory, description });
    const selected = [];
    const seen = new Set();
    const maxResults = 6;

    // 1. Kërkimi për Video Vertikale (Limitohet në 8 kërkesat e para për shpejtësi)
    for (const query of queries.slice(0, 8)) {
        const payloads = await Promise.all([
            pexelsVideoSearch(query, 'portrait'),
        ]);

        const videos = sortByResolution(payloads
            .flatMap((payload) => payload.videos || [])
            .reduce((items, video) => {
                const bestFile = sortVideoFiles((video.video_files || [])).find((file) => file.file_type === 'video/mp4');
                if (!bestFile?.link) return items;

                items.push({
                    kind: 'video',
                    source: 'pexels',
                    externalId: String(video.id),
                    url: bestFile.link,
                    thumbnailUrl: video.image,
                    width: bestFile.width,
                    height: bestFile.height,
                    duration: video.duration,
                    attribution: `Pexels / ${video.user?.name || 'creator'}`,
                    query
                });
                return items;
            }, []));

        // Sigurohemi që të mos shtohet e njëjta video dy herë
        for (const item of videos) {
            if (!seen.has(item.externalId || item.url)) {
                selected.push(item);
                seen.add(item.externalId || item.url);
            }
            if (selected.length >= maxResults) return selected;
        }
    }

    // 2. Fallback: Nëse nuk u gjet asnjë video, kërkojmë Foto Vertikale (Vetëm për 5 kërkesat e para)
    for (const query of queries.slice(0, 5)) {
        const photoPayload = await pexelsPhotoSearch(query, 'portrait');
        const photos = sortByResolution(photoPayload.photos || []).map((photo) => ({
            kind: 'image',
            source: 'pexels',
            externalId: String(photo.id),
            url: photo.src?.original || photo.src?.large2x || photo.src?.large,
            thumbnailUrl: photo.src?.medium,
            width: photo.width,
            height: photo.height,
            attribution: `Pexels / ${photo.photographer || 'creator'}`,
            query
        }));

        for (const item of photos) {
            if (!seen.has(item.externalId || item.url)) {
                selected.push(item);
                seen.add(item.externalId || item.url);
            }
            if (selected.length >= maxResults) return selected;
        }
    }

    return selected;
};

// Eksportojmë funksionin në mënyrë standarde të Node.js
module.exports = {
    findSceneMedia
};