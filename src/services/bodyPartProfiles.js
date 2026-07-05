'use strict';

/**
 * Body-part-specific analysis profiles.
 *
 * Different body areas need different skin metrics — a face radar (pores, acne,
 * wrinkles) is not meaningful for a heel (calluses, cracking) or a back (bacne,
 * folliculitis). Each profile defines the metric set the analyzer scores and
 * the radar chart renders. `face: true` enables the in-browser ML
 * cross-validation (BlazeFace), which only works on faces.
 */

const PROFILES = {
  face: {
    label: 'Face', face: true,
    metrics: [
      ['dryness', 'Dryness'], ['dehydration', 'Dehydration'], ['wrinkles', 'Wrinkles'],
      ['sagging', 'Sagging'], ['sensitivity', 'Sensitivity'], ['redness', 'Redness'],
      ['blockedPores', 'Blocked Pores'], ['enlargedPores', 'Enlarged Pores'],
      ['acne', 'Acne'], ['pigmentation', 'Pigmentation'],
    ],
  },
  neck: {
    label: 'Neck', face: false,
    metrics: [
      ['dryness', 'Dryness'], ['dehydration', 'Dehydration'], ['wrinkles', 'Wrinkles'],
      ['sagging', 'Sagging'], ['sensitivity', 'Sensitivity'], ['redness', 'Redness'],
      ['pigmentation', 'Pigmentation'], ['crepiness', 'Crepiness'],
    ],
  },
  hand: {
    label: 'Hand', face: false,
    metrics: [
      ['dryness', 'Dryness'], ['dehydration', 'Dehydration'], ['roughness', 'Roughness'],
      ['redness', 'Redness'], ['pigmentation', 'Age Spots'], ['crepiness', 'Crepiness'],
      ['sensitivity', 'Sensitivity'], ['irritation', 'Irritation'],
    ],
  },
  arm: {
    label: 'Arm', face: false,
    metrics: [
      ['dryness', 'Dryness'], ['roughness', 'Roughness'], ['redness', 'Redness'],
      ['pigmentation', 'Pigmentation'], ['sensitivity', 'Sensitivity'], ['irritation', 'Irritation'],
      ['bumps', 'Keratosis / Bumps'], ['sunDamage', 'Sun Damage'],
    ],
  },
  leg: {
    label: 'Leg', face: false,
    metrics: [
      ['dryness', 'Dryness'], ['roughness', 'Roughness'], ['redness', 'Redness'],
      ['pigmentation', 'Pigmentation'], ['sensitivity', 'Sensitivity'], ['irritation', 'Irritation'],
      ['bumps', 'Folliculitis / Bumps'], ['dehydration', 'Dehydration'],
    ],
  },
  foot: {
    label: 'Foot', face: false,
    metrics: [
      ['dryness', 'Dryness'], ['roughness', 'Roughness'], ['calluses', 'Calluses'],
      ['cracking', 'Cracking / Fissures'], ['redness', 'Redness'], ['pigmentation', 'Pigmentation'],
      ['irritation', 'Irritation'], ['nailHealth', 'Nail Health'],
    ],
  },
  back: {
    label: 'Back', face: false,
    metrics: [
      ['acne', 'Acne (bacne)'], ['blackheads', 'Blackheads'], ['oiliness', 'Oiliness'],
      ['folliculitis', 'Folliculitis'], ['pigmentation', 'Marks / Pigmentation'],
      ['scarring', 'Scarring'], ['dryness', 'Dryness'], ['redness', 'Redness'],
    ],
  },
  chest: {
    label: 'Chest', face: false,
    metrics: [
      ['acne', 'Acne'], ['oiliness', 'Oiliness'], ['pigmentation', 'Pigmentation'],
      ['dryness', 'Dryness'], ['redness', 'Redness'], ['sensitivity', 'Sensitivity'],
      ['sunDamage', 'Sun Damage'], ['scarring', 'Scarring'],
    ],
  },
  other: {
    label: 'Skin', face: false,
    metrics: [
      ['dryness', 'Dryness'], ['dehydration', 'Dehydration'], ['roughness', 'Roughness'],
      ['redness', 'Redness'], ['pigmentation', 'Pigmentation'], ['sensitivity', 'Sensitivity'],
      ['irritation', 'Irritation'], ['texture', 'Texture'],
    ],
  },
};

// Map a free-text body part to a profile category.
const ALIASES = [
  [/(^|\b)(face|facial|cheek|forehead|chin|nose|jaw)/i, 'face'],
  [/(neck|throat|nape|décolle|decolle)/i, 'neck'],
  [/(hand|palm|finger|knuckle|wrist)/i, 'hand'],
  [/(arm|forearm|elbow|shoulder|bicep|tricep)/i, 'arm'],
  [/(leg|thigh|knee|shin|calf|ankle)/i, 'leg'],
  [/(foot|feet|heel|toe|sole)/i, 'foot'],
  [/(back|spine|lumbar|lower back|upper back)/i, 'back'],
  [/(chest|torso|stomach|abdomen|belly|breast)/i, 'chest'],
];

function categoryFor(bodyPartRaw = '') {
  const s = String(bodyPartRaw).toLowerCase();
  for (const [rx, cat] of ALIASES) if (rx.test(s)) return cat;
  return 'other';
}

function profileFor(bodyPartRaw) {
  return PROFILES[categoryFor(bodyPartRaw)] || PROFILES.other;
}

module.exports = { PROFILES, categoryFor, profileFor };
