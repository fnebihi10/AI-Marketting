import { ScriptPackage } from '../types';
import { config } from '../config';
import { getCache, setCache } from './cacheService';
import { sha256 } from '../utils/files';

const blockedKeywordTokens = new Set([
  'abstract',
  'background',
  'branding',
  'business',
  'campaign',
  'corporate',
  'digital',
  'generic',
  'innovation',
  'marketing',
  'media',
  'office',
  'social',
  'strategy',
  'success',
  'template',
  'technology',
  'viral'
]);

const SCRIPT_PROMPT_VERSION = 'v4';
const esportsBriefTokens = [
  'counter strike',
  'counter-strike',
  'cs2',
  'esports',
  'e sports',
  'gaming tournament',
  'major finals'
];

const isEsportsBrief = (description: string, productCategory: string) => {
  const normalized = `${productCategory} ${description}`.toLowerCase();
  return productCategory === 'gaming-esports' || esportsBriefTokens.some((token) => normalized.includes(token));
};

const scriptSchema = {
  name: 'marketing_video_script',
  schema: {
    required: ['title', 'hook', 'cta', 'hashtags', 'musicMood', 'audience', 'offer', 'proof', 'scenes'],
    properties: {
      title: { type: 'string' },
      hook: { type: 'string' },
      cta: { type: 'string' },
      hashtags: {
        type: 'array',
        items: { type: 'string' },
        minItems: 4,
        maxItems: 8,
      },
      musicMood: { type: 'string' },
      audience: { type: 'string' },
      offer: { type: 'string' },
      proof: { type: 'string' },
      scenes: {
        type: 'array',
        minItems: 4,
        maxItems: 6,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'sceneNumber',
            'headline',
            'voiceover',
            'onScreenText',
            'pexelsKeywords',
            'visualBrief',
            'imagePrompt'
          ],
          properties: {
            sceneNumber: { type: 'integer' },
            headline: { type: 'string' },
            voiceover: { type: 'string' },
            onScreenText: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 3
            },
            pexelsKeywords: {
              type: 'array',
              items: { type: 'string' },
              minItems: 2,
              maxItems: 4
            },
            visualBrief: { type: 'string' },
            imagePrompt: { type: 'string' }
          }
        }
      }
    }
  }
} as const;

const parseJson = (content: string) => {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('OpenAI response did not contain JSON.');
  }

  return JSON.parse(content.slice(firstBrace, lastBrace + 1));
};

const normalizeLine = (value: string) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeKeyword = (value: string) =>
  normalizeLine(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !blockedKeywordTokens.has(token))
    .join(' ');

const normalizeScriptPackage = (payload: ScriptPackage) => {
  const scenes = (payload.scenes || [])
    .slice(0, 6)
    .map((scene, index) => ({
      sceneNumber: Number(scene.sceneNumber || index + 1),
      headline: normalizeLine(scene.headline),
      voiceover: normalizeLine(scene.voiceover),
      onScreenText: (scene.onScreenText || [])
        .map(normalizeLine)
        .filter(Boolean)
        .slice(0, 3),
      pexelsKeywords: Array.from(
        new Set(
          (scene.pexelsKeywords || [])
            .map(normalizeKeyword)
            .filter(Boolean)
        )
      ).slice(0, 4),
      visualBrief: normalizeLine(scene.visualBrief),
      imagePrompt: normalizeLine(scene.imagePrompt)
    }))
    .filter((scene) => scene.headline && scene.voiceover)
    .sort((left, right) => left.sceneNumber - right.sceneNumber)
    .map((scene, index) => ({
      ...scene,
      sceneNumber: index + 1,
      pexelsKeywords:
        scene.pexelsKeywords.length >= 2
          ? scene.pexelsKeywords
          : Array.from(
              new Set(
                [scene.headline, scene.visualBrief]
                  .map(normalizeKeyword)
                  .filter(Boolean)
              )
            ).slice(0, 3)
    }));

  if (scenes.length < 4) {
    throw new Error('OpenAI script response did not contain enough usable scenes (minimum 4 required).');
  }

  return {
    title: normalizeLine(payload.title),
    hook: normalizeLine(payload.hook),
    cta: normalizeLine(payload.cta),
    hashtags: Array.from(
      new Set(
        (payload.hashtags || [])
          .map((tag) => normalizeLine(tag).replace(/\s+/g, ''))
          .filter(Boolean)
      )
    ).slice(0, 8),
    musicMood: normalizeLine(payload.musicMood),
    audience: normalizeLine((payload as any).audience || ''),
    offer: normalizeLine((payload as any).offer || ''),
    proof: normalizeLine((payload as any).proof || ''),
    scenes
  } satisfies ScriptPackage & { audience: string; offer: string; proof: string };
};

export const generateScriptPackage = async (
  description: string,
  style: string,
  productCategory: string
) => {
  const cacheKey = `script:${SCRIPT_PROMPT_VERSION}:${sha256(`${style}:${productCategory}:${description}`)}`;
  const cached = await getCache<ScriptPackage>(cacheKey);
  if (cached) return cached;

  if (!config.openAiApiKey) {
    throw new Error('OPENAI_API_KEY is missing.');
  }

  const esportsBrief = isEsportsBrief(description, productCategory);
  const categoryGuidance =
    productCategory === 'food-dessert'
      ? [
          'For food and dessert ads, prioritize appetite appeal, texture, ingredients, authenticity, and craving.',
          'If the product is a specific named dessert, keep every scene visually and verbally loyal to that exact dessert.',
          'Do not drift into generic cakes, cupcakes, frosting, whipped cream, or unrelated bakery prep unless the brief explicitly describes those.',
          'Usage occasions like gifting, guests, or after-dinner can support the message, but the product itself must stay the visual star.'
        ].join(' ')
      : productCategory === 'fitness-wellness'
        ? [
            'For fitness and wellness ads, prioritize visible movement, training, progress, energy, confidence, and action.',
            'Prefer scenes of people actively working out, training at home, tracking progress, or feeling stronger.',
            'Avoid passive talking-head scenes, generic socializing, meetings, interviews, or equipment-only footage unless the brief explicitly asks for it.',
            'If the offer is a program or membership, the visuals should still show the transformation journey, not abstract community filler.'
          ].join(' ')
        : productCategory === 'sports-football'
          ? [
              'For football/soccer hype videos, prioritize match energy: stadium lights, crowd chants, kickoff, dribbling, tackles, saves, goal celebrations, and fast momentum shifts.',
              'Use Pexels keywords that clearly indicate soccer (e.g., "soccer match", "football stadium", "soccer fans", "goal celebration") to avoid American football footage.',
              'Avoid logos, identifiable players, or team-specific trademarks in visuals; keep it generic match atmosphere and action.'
            ].join(' ')
        : esportsBrief
          ? [
              'For esports and Counter-Strike style promos, prioritize arena-tournament energy: player walkouts, focused gamers at PCs, headset comms, keyboard and mouse closeups, crowd eruptions, stage lights, trophy moments, and big-screen match atmosphere.',
              'Use Pexels keywords that clearly describe visible esports footage such as "esports tournament", "gaming tournament stage", "pro gamer pc", "gaming arena crowd", "keyboard mouse close up", and "trophy celebration".',
              'Avoid drifting into generic tech product shots, coding desks, office work, server rooms, mobile gaming, console controllers, or abstract RGB gadget footage unless the brief explicitly asks for them.',
              'Do not promise official Counter-Strike majors footage, team logos, or branded tournament assets. Keep the visuals generic, premium, and clearly esports-driven.'
            ].join(' ')
        : '';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel,
      max_tokens: 800,
      temperature: 0.55,
      response_format: {
        type: 'json_schema',
        json_schema: scriptSchema
      },
      messages: [
        {
          role: 'system',
          content:
            [
              'You are an elite direct-response creative strategist for short-form ecommerce ads.',
              'Write like a senior performance marketer, not a generic assistant.',
              'Every response is for a real product advertisement designed to convert on TikTok, Reels, or Shorts.',
              'Use buyer psychology: hook, pain/desire, product mechanism, proof, offer, CTA.',
              'Scenes must feel filmable and specific, with visuals that can be searched on stock sites.',
              'Never rely on vague stock concepts like innovation, success, social media, marketing, business meeting, abstract background, or generic lifestyle filler unless the product literally requires them.',
              'Voiceover should sound human, persuasive, concise, and purchase-intent driven.',
              categoryGuidance
            ].join(' ')
        },
        {
          role: 'user',
          content: [
            `Product description: ${description}`,
            `Creative style: ${style}`,
            `Product category: ${productCategory}`,
            'Return a script package for a 30-45 second 9:16 marketing video with exactly 4-6 scenes.',
            'Target a total runtime of 30-45 seconds. Do NOT produce videos shorter than 28 seconds.',
            'This tool is for marketing creatives only. Treat the input as a product advertisement brief.',
            'Always use exactly 4 scenes minimum, preferring 5 scenes for richer storytelling.',
            'Infer the likely buyer, core problem, desired outcome, offer, and CTA from the brief when needed.',
            'Scene 1 should be a hard hook or pattern interrupt — make it impossible to scroll past.',
            'Scene 2 should introduce the product and the core problem it solves.',
            'Scene 3 should show transformation, benefits, or social proof.',
            'Scene 4+ should build desire and land on a clear CTA or offer.',
            'Voiceover must sound natural, persuasive, specific, and purchase-intent driven, not generic.',
            'Each scene voiceover should be 18-28 words — long enough to tell the story but punchy enough to convert. Do not write fewer than 15 words per scene.',
            'On-screen text should highlight claims, benefits, urgency, or offer language that fits a real ad.',
            'Pexels keywords must describe visible subjects, actions, locations, or product-adjacent moments someone could actually search for.',
            'Prefer product-adjacent lifestyle, hands using product, routines, closeups, textures, packaging moments, and outcome visuals.',
            'Avoid abstract stock terms and avoid unrelated objects, animals, scenery, or random tech footage.',
            'Spread the story across all scenes — do not cram everything into scene 1 and phone in the rest.',
            'Treat wrong-product visuals as a failure. If the product is baklava, do not suggest cake, frosting, whipped cream, cupcakes, or unrelated dessert prep.',
            'For food products, prioritize closeups, serving, slicing, plating, ingredients, and authentic product textures before secondary lifestyle context.',
            'For fitness products, favor workout, home training, stretching, sweating, coaching, progress checks, and strong post-workout confidence over talking or standing around.',
            'imagePrompt must stay truthful to the product category and should never invent irrelevant content.',
            'Include an "audience" field describing the primary buyer persona.',
            'Include an "offer" field describing the core deal or promise.',
            'Include a "proof" field describing why the customer should trust the product.'
          ].join('\n')
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[OpenAI] Request failed:', errorText);
    
    // Fallback to a generic script if API fails (e.g. out of credits)
    console.warn('[OpenAI] Falling back to generic script due to API error.');
    return normalizeScriptPackage({
      title: `Campaign for ${description.slice(0, 30)}`,
      hook: `Discover the power of our latest ${productCategory}!`,
      cta: `Get yours today and transform your routine.`,
      hashtags: ['#marketing', '#innovation', '#ai', '#business'],
      musicMood: 'Energetic and Uplifting',
      scenes: [
        {
          sceneNumber: 1,
          headline: 'Innovation redefined',
          voiceover: `Are you ready to take your ${productCategory} to the next level? Meet the all-new solution designed for your success.`,
          onScreenText: ['Innovation Redefined'],
          pexelsKeywords: ['technology', 'modern office'],
          visualBrief: 'Sleek product reveal with cinematic lighting',
          imagePrompt: `Professional marketing shot of ${description}`
        },
        {
          sceneNumber: 2,
          headline: 'Designed for you',
          voiceover: `We understand the challenges you face every day. That's why we built this with your specific needs in mind.`,
          onScreenText: ['Designed For You'],
          pexelsKeywords: ['lifestyle', 'hands working'],
          visualBrief: 'Close up of product details and textures',
          imagePrompt: `Detail shot of ${description}`
        },
        {
          sceneNumber: 3,
          headline: 'Proven results',
          voiceover: `Join thousands of satisfied customers who have already transformed their lives with our proven approach.`,
          onScreenText: ['Proven Results'],
          pexelsKeywords: ['happy person', 'success'],
          visualBrief: 'Person smiling and using the product',
          imagePrompt: `Lifestyle shot of person using ${description}`
        },
        {
          sceneNumber: 4,
          headline: 'Get started now',
          voiceover: `Don't wait for tomorrow. Start your journey today and experience the difference for yourself. Click the link to learn more.`,
          onScreenText: ['Get Started Now', 'Link In Bio'],
          pexelsKeywords: ['city skyline', 'sunrise'],
          visualBrief: 'Final product shot with call to action overlay',
          imagePrompt: `Final commercial shot of ${description}`
        }
      ]
    });
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response did not include any content.');
  }

  const parsed = normalizeScriptPackage(parseJson(content) as ScriptPackage);
  await setCache(cacheKey, parsed);
  return parsed;
};

export const generateMarketingBrief = async (
  description: string,
  style: string,
  productCategory: string
) => {
  const cacheKey = `brief:${sha256(`${style}:${productCategory}:${description}`)}`;
  const cached = await getCache<{ audience: string; offer: string; proof: string }>(cacheKey);
  if (cached) return cached;

  if (!config.openAiApiKey) {
    return {
      audience: `High-intent consumers interested in ${productCategory}`,
      offer: `Premium ${description.slice(0, 20)}... with ${style} aesthetics`,
      proof: `AI-optimized marketing asset for high conversion`
    };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel,
      max_tokens: 400,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a senior marketing strategist. Extract the core marketing strategy from the provided brief.'
        },
        {
          role: 'user',
          content: [
            `Description: ${description}`,
            `Style: ${style}`,
            `Category: ${productCategory}`,
            'Return a JSON object with exactly these keys: "audience", "offer", "proof".',
            'Keep each description concise and punchy (10-15 words max).'
          ].join('\n')
        }
      ]
    })
  });

  if (!response.ok) {
    return {
      audience: `Consumers interested in ${productCategory}`,
      offer: `Exclusive ${style} campaign for this product`,
      proof: `Professional quality visual storytelling`
    };
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const parsed = parseJson(content);
  
  const result = {
    audience: normalizeLine(parsed.audience || ''),
    offer: normalizeLine(parsed.offer || ''),
    proof: normalizeLine(parsed.proof || '')
  };

  await setCache(cacheKey, result);
  return result;
};
