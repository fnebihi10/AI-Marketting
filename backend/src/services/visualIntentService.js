"use strict";

const normalizePhrase = (value) => String(value || "")
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const unique = (items) => Array.from(new Set(items
    .map((item) => normalizePhrase(item))
    .filter(Boolean)));

const phraseTokens = (value) => normalizePhrase(value).split(/\s+/).filter(Boolean);

const hasPhrase = (text, phrase) => {
    const normalizedText = normalizePhrase(text);
    const normalizedPhrase = normalizePhrase(phrase);
    if (!normalizedText || !normalizedPhrase) return false;

    const tokens = new Set(phraseTokens(normalizedText));
    const wantedTokens = phraseTokens(normalizedPhrase);
    if (wantedTokens.length === 1) {
        return tokens.has(wantedTokens[0]);
    }
    return normalizedText.includes(normalizedPhrase) || wantedTokens.every((token) => tokens.has(token));
};

const hasAnyPhrase = (text, phrases) => phrases.some((phrase) => hasPhrase(text, phrase));

const splitConstraintList = (value) => String(value || "")
    .split(/[,;\n]+/)
    .map(normalizePhrase)
    .filter((item) => item.length > 1);

const subjectRules = [
    {
        key: "male",
        label: "male subject",
        terms: ["man", "men", "mens", "male", "males", "guy", "guys", "bodybuilder", "bodybuilders"],
        queryTerms: ["man", "male athlete", "men", "male bodybuilder"],
        avoidTerms: ["woman", "women", "female", "females", "girl", "girls", "lady", "ladies"]
    },
    {
        key: "female",
        label: "female subject",
        terms: ["woman", "women", "female", "females", "girl", "girls", "lady", "ladies"],
        queryTerms: ["woman", "female athlete", "women"],
        avoidTerms: ["man", "men", "mens", "male", "males", "guy", "guys", "boy", "boys"]
    }
];

const actionRules = [
    {
        key: "deadlift",
        label: "deadlift action",
        terms: ["deadlift", "deadlifting", "deadlifts"],
        queryTerms: ["deadlifting barbell", "deadlift", "barbell deadlift"]
    },
    {
        key: "weightlifting",
        label: "weight training action",
        terms: ["weight", "weights", "weightlifting", "barbell", "dumbbell", "dumbbells", "lifting"],
        queryTerms: ["lifting weights", "barbell training", "weightlifting"]
    },
    {
        key: "bodybuilding",
        label: "bodybuilding action",
        terms: ["bodybuilding", "bodybuilder", "muscle", "muscles", "strength"],
        queryTerms: ["bodybuilding workout", "strength training", "muscle training"]
    },
    {
        key: "training",
        label: "training action",
        terms: ["training", "workout", "exercise", "fitness"],
        queryTerms: ["training workout", "fitness training", "workout action"]
    },
    {
        key: "squat",
        label: "squat action",
        terms: ["squat", "squatting", "squats"],
        queryTerms: ["barbell squat", "squat workout", "squatting"]
    },
    {
        key: "bench",
        label: "bench press action",
        terms: ["bench press", "benchpress", "benching"],
        queryTerms: ["bench press", "barbell bench press"]
    },
    {
        key: "running",
        label: "running action",
        terms: ["running", "runner", "run", "jogging"],
        queryTerms: ["running", "runner workout"]
    },
    {
        key: "yoga",
        label: "yoga action",
        terms: ["yoga", "stretching", "stretch"],
        queryTerms: ["yoga workout", "stretching"]
    }
];

const settingRules = [
    {
        key: "gym",
        label: "gym setting",
        terms: ["gym", "gymnasium", "fitness center", "weight room"],
        queryTerms: ["gym", "fitness gym", "weight room"]
    },
    {
        key: "home",
        label: "home setting",
        terms: ["home", "apartment", "living room"],
        queryTerms: ["home workout", "at home"]
    },
    {
        key: "outdoor",
        label: "outdoor setting",
        terms: ["outdoor", "outside", "park", "street"],
        queryTerms: ["outdoor", "park"]
    }
];

const makeGroup = (label, terms) => ({
    label,
    terms: unique(terms)
});

const detectRule = (text, rules) => rules.find((rule) => hasAnyPhrase(text, rule.terms));

const detectRules = (text, rules) => rules.filter((rule) => hasAnyPhrase(text, rule.terms));

const extractNegativeTerms = (description, mustAvoid) => {
    const explicit = splitConstraintList(mustAvoid);
    const normalized = normalizePhrase(description);
    const extracted = [];
    const patterns = [
        /\b(?:no|avoid|exclude|without|not)\s+(women|woman|female|females|girls|girl|men|man|male|males|office|talking|meeting|interview|desk)\b/g,
        /\b(?:do not|dont|don't)\s+(?:show|include|use)?\s*(women|woman|female|females|girls|girl|men|man|male|males|office|talking|meeting|interview|desk)\b/g
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(normalized);
        while (match) {
            extracted.push(match[1]);
            match = pattern.exec(normalized);
        }
    }

    return unique([...explicit, ...extracted]);
};

const buildSearchPhrases = ({ subject, actions, settings, customMustInclude }) => {
    const subjectTerms = subject?.queryTerms || [];
    const actionTerms = actions.flatMap((action) => action.queryTerms).slice(0, 4);
    const settingTerms = settings.flatMap((setting) => setting.queryTerms).slice(0, 3);
    const customTerms = customMustInclude.slice(0, 3);

    const primarySubject = subjectTerms[0] || "";
    const primaryAction = actionTerms[0] || actionTerms[1] || "";
    const primarySetting = settingTerms[0] || "";
    const secondarySubject = subjectTerms[1] || primarySubject;
    const secondaryAction = actionTerms[1] || primaryAction;

    return unique([
        [primarySubject, primaryAction, primarySetting].filter(Boolean).join(" "),
        [secondarySubject, secondaryAction, primarySetting].filter(Boolean).join(" "),
        [primarySubject, actionTerms[2], settingTerms[1]].filter(Boolean).join(" "),
        [primarySubject, primarySetting, customTerms[0]].filter(Boolean).join(" "),
        customTerms.join(" "),
        ...customTerms
    ]).filter((phrase) => phraseTokens(phrase).length >= 2);
};

const buildVisualIntent = (description, visualConstraints = {}) => {
    const mustInclude = String(visualConstraints.mustInclude || visualConstraints.visualMustInclude || "");
    const mustAvoid = String(visualConstraints.mustAvoid || visualConstraints.visualMustAvoid || "");
    const positiveText = normalizePhrase(`${description} ${mustInclude}`);
    const customMustInclude = splitConstraintList(mustInclude);

    const subject = detectRule(positiveText, subjectRules);
    const actions = detectRules(positiveText, actionRules);
    const settings = detectRules(positiveText, settingRules);
    const explicitAvoid = extractNegativeTerms(description, mustAvoid);
    const avoidTerms = unique([
        ...(subject?.avoidTerms || []),
        ...explicitAvoid
    ]);

    const requiredGroups = [
        subject ? makeGroup(subject.label, subject.terms) : null,
        ...actions.slice(0, 2).map((action) => makeGroup(action.label, action.terms)),
        ...settings.slice(0, 1).map((setting) => makeGroup(setting.label, setting.terms))
    ].filter(Boolean);

    const searchPhrases = buildSearchPhrases({ subject, actions, settings, customMustInclude });
    const primarySearchPhrase = searchPhrases[0] || customMustInclude[0] || "";
    const visualBrief = primarySearchPhrase
        ? `${primarySearchPhrase}, specific stock footage, vertical commercial shot`
        : "";

    return {
        strict: requiredGroups.length >= 2 || avoidTerms.length > 0 || customMustInclude.length > 0,
        requiredGroups,
        avoidTerms,
        searchPhrases,
        primarySearchPhrase,
        visualBrief,
        cacheKey: [
            requiredGroups.map((group) => `${group.label}:${group.terms.join("|")}`).join(";"),
            avoidTerms.join("|"),
            searchPhrases.join("|")
        ].join("::")
    };
};

const textSatisfiesRequiredGroups = (value, groups = []) => groups.every((group) =>
    group.terms.some((term) => hasPhrase(value, term)));

const textHasAvoidTerm = (value, avoidTerms = []) => hasAnyPhrase(value, avoidTerms);

const describeVisualIntent = (visualIntent) => {
    if (!visualIntent?.strict) return "";

    const mustShow = visualIntent.requiredGroups
        .map((group) => group.label)
        .filter(Boolean)
        .join(", ");
    const avoid = visualIntent.avoidTerms.join(", ");

    return [
        mustShow ? `Must show: ${mustShow}.` : "",
        avoid ? `Must avoid: ${avoid}.` : "",
        visualIntent.primarySearchPhrase ? `Best stock phrase: ${visualIntent.primarySearchPhrase}.` : ""
    ].filter(Boolean).join(" ");
};

const appendIfMissing = (value, phrase) => {
    const line = String(value || "").trim();
    if (!phrase || hasPhrase(line, phrase)) return line;
    return line ? `${line}. ${phrase}` : phrase;
};

const applyVisualIntentToScene = (scene, visualIntent) => {
    if (!visualIntent?.strict || !visualIntent.primarySearchPhrase) {
        return scene;
    }

    return {
        ...scene,
        pexelsKeywords: unique([
            visualIntent.primarySearchPhrase,
            ...visualIntent.searchPhrases.slice(1, 3),
            ...(scene.pexelsKeywords || [])
        ]).slice(0, 4),
        visualBrief: appendIfMissing(scene.visualBrief, visualIntent.visualBrief),
        imagePrompt: appendIfMissing(scene.imagePrompt, visualIntent.visualBrief)
    };
};

module.exports = {
    applyVisualIntentToScene,
    buildVisualIntent,
    describeVisualIntent,
    normalizePhrase,
    textHasAvoidTerm,
    textSatisfiesRequiredGroups
};
