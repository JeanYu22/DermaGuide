'use strict';

/**
 * Realistic (but fictional) EU organic-skincare demo catalogue.
 *
 * Hand-authored to resemble certified organic products sourced from EU brands
 * in a ~€1-€10 wholesale band (retail prices include a typical markup). Used
 * to make the storefront look like a real shop for demos — nothing here is
 * scraped or copied from a real marketplace.
 *
 * `concerns` use the app's concern vocabulary so the AI matcher + filter chips
 * work: acne, dryness, dehydration, redness, sensitivity, pigmentation,
 * wrinkles, large pores, oily.
 */
module.exports = [
  // Cleansers
  { name: 'Calendula Gentle Gel Cleanser', brand: 'Provence Botanics', emoji: '🧴', price: 8.9, supplierPrice: 3.4,
    desc: 'Soap-free organic gel cleanser with calendula & aloe.', concerns: ['sensitivity', 'redness'], types: ['sensitive', 'normal'],
    certs: ['organic', 'vegan', 'cruelty-free'], keyIngredients: ['Calendula', 'Aloe Vera', 'Glycerin'],
    howToUse: 'Massage onto damp skin morning and evening, then rinse with lukewarm water.' },
  { name: 'Charcoal & Tea Tree Foaming Wash', brand: 'Verde Bioskin', emoji: '🧼', price: 9.5, supplierPrice: 3.9,
    desc: 'Purifying foam for oily, blemish-prone skin.', concerns: ['acne', 'oily', 'large pores'], types: ['oily', 'combination'],
    certs: ['organic', 'vegan'], keyIngredients: ['Activated Charcoal', 'Tea Tree', 'Salicylic Willow Bark'],
    howToUse: 'Lather a small amount on wet skin, focus on the T-zone, rinse. Use AM/PM.' },
  { name: 'Oat Milk Cream Cleanser', brand: 'Nordic Bloom', emoji: '🥛', price: 10.9, supplierPrice: 4.5,
    desc: 'Creamy hydrating cleanser for dry, tight skin.', concerns: ['dryness', 'dehydration', 'sensitivity'], types: ['dry', 'sensitive'],
    certs: ['organic', 'cruelty-free'], keyIngredients: ['Colloidal Oat', 'Oat Milk', 'Shea'],
    howToUse: 'Apply to dry or damp skin, massage, then rinse or wipe away with a soft cloth.' },

  // Toners / essences
  { name: 'Rose Water Balancing Toner', brand: 'Lis Blanc', emoji: '🌹', price: 7.9, supplierPrice: 2.8,
    desc: 'Alcohol-free Damask rose toner that soothes and refreshes.', concerns: ['redness', 'sensitivity', 'dehydration'], types: ['all'],
    certs: ['organic', 'vegan', 'cruelty-free'], keyIngredients: ['Damask Rose Water', 'Panthenol'],
    howToUse: 'Sweep over clean skin with a cotton pad or press in with palms before serum.' },
  { name: 'Green Tea Pore Refining Essence', brand: 'TerraVida', emoji: '🍵', price: 11.5, supplierPrice: 4.8,
    desc: 'Lightweight essence that tightens the look of pores.', concerns: ['large pores', 'oily'], types: ['oily', 'combination'],
    certs: ['organic', 'vegan'], keyIngredients: ['Green Tea', 'Niacinamide', 'Zinc PCA'],
    howToUse: 'After cleansing, pat a few drops over the face, avoiding the eye area.' },

  // Serums
  { name: 'Vitamin C 10% Brightening Serum', brand: 'TerraVida', emoji: '🍊', price: 14.9, supplierPrice: 6.5,
    desc: 'Stabilised vitamin C with ferulic acid for radiance.', concerns: ['pigmentation', 'dehydration'], types: ['all'],
    certs: ['vegan', 'cruelty-free'], keyIngredients: ['Vitamin C (SAP)', 'Ferulic Acid', 'Hyaluronic Acid'],
    howToUse: 'Apply 3-4 drops each morning before moisturiser. Always follow with SPF.' },
  { name: 'Hyaluronic Hydra-Plump Serum', brand: 'Nordic Bloom', emoji: '💧', price: 12.9, supplierPrice: 5.2,
    desc: 'Triple-weight hyaluronic acid for deep hydration.', concerns: ['dehydration', 'dryness'], types: ['dry', 'normal', 'combination'],
    certs: ['organic', 'vegan', 'cruelty-free'], keyIngredients: ['Hyaluronic Acid', 'Vitamin B5', 'Birch Sap'],
    howToUse: 'Apply to damp skin morning and night, then seal with moisturiser.' },
  { name: 'Niacinamide 8% Clarifying Serum', brand: 'Verde Bioskin', emoji: '✨', price: 11.9, supplierPrice: 4.9,
    desc: 'Balances oil and refines pores and blemishes.', concerns: ['acne', 'large pores', 'oily', 'pigmentation'], types: ['oily', 'combination'],
    certs: ['vegan', 'cruelty-free'], keyIngredients: ['Niacinamide', 'Zinc', 'Liquorice Root'],
    howToUse: 'Apply a few drops AM and/or PM before heavier creams.' },
  { name: 'Bakuchiol Retinol-Alternative Serum', brand: 'Amber & Sage', emoji: '🌙', price: 16.9, supplierPrice: 7.4,
    desc: 'Gentle plant retinol alternative for fine lines.', concerns: ['wrinkles', 'sensitivity'], types: ['mature', 'sensitive', 'normal'],
    certs: ['organic', 'vegan', 'cruelty-free'], keyIngredients: ['Bakuchiol', 'Squalane', 'Vitamin E'],
    howToUse: 'Apply in the evening after cleansing; suitable for sensitive skin.' },

  // Moisturisers
  { name: 'Aloe & Cucumber Daily Gel-Cream', brand: 'Provence Botanics', emoji: '🥒', price: 10.5, supplierPrice: 4.2,
    desc: 'Oil-free gel-cream for lightweight hydration.', concerns: ['oily', 'dehydration', 'redness'], types: ['oily', 'combination', 'normal'],
    certs: ['organic', 'vegan', 'cruelty-free'], keyIngredients: ['Aloe Vera', 'Cucumber', 'Hyaluronic Acid'],
    howToUse: 'Apply morning and evening as the last step before SPF.' },
  { name: 'Shea & Almond Rich Repair Cream', brand: 'Alpine Pure', emoji: '🌰', price: 13.5, supplierPrice: 5.6,
    desc: 'Nourishing cream for very dry, dehydrated skin.', concerns: ['dryness', 'dehydration'], types: ['dry', 'mature'],
    certs: ['organic', 'cruelty-free'], keyIngredients: ['Shea Butter', 'Sweet Almond Oil', 'Ceramides'],
    howToUse: 'Massage a small amount into clean skin morning and night.' },
  { name: 'Centella Cica Soothing Moisturiser', brand: 'Bjørk & Berry', emoji: '🌿', price: 12.5, supplierPrice: 5.0,
    desc: 'Calms redness and strengthens the skin barrier.', concerns: ['redness', 'sensitivity'], types: ['sensitive', 'normal'],
    certs: ['organic', 'vegan', 'cruelty-free'], keyIngredients: ['Centella Asiatica', 'Madecassoside', 'Panthenol'],
    howToUse: 'Apply to clean skin AM/PM; ideal after exfoliating actives.' },
  { name: 'Peptide Firming Night Cream', brand: 'Amber & Sage', emoji: '🌜', price: 18.9, supplierPrice: 8.2,
    desc: 'Overnight cream with peptides and bakuchiol.', concerns: ['wrinkles', 'dryness'], types: ['mature', 'dry', 'normal'],
    certs: ['vegan', 'cruelty-free'], keyIngredients: ['Peptides', 'Bakuchiol', 'Hyaluronic Acid'],
    howToUse: 'Apply as the final step of your evening routine.' },

  // Eye / lip
  { name: 'Coffee & Caffeine Eye Gel', brand: 'Bjørk & Berry', emoji: '👁️', price: 11.9, supplierPrice: 4.7,
    desc: 'De-puffing eye gel for tired under-eyes.', concerns: ['dehydration', 'wrinkles'], types: ['all'],
    certs: ['vegan', 'cruelty-free'], keyIngredients: ['Caffeine', 'Hyaluronic Acid', 'Green Tea'],
    howToUse: 'Dab a rice-grain amount under each eye morning and night.' },
  { name: 'Organic Shea Lip Balm', brand: 'Provence Botanics', emoji: '💋', price: 4.9, supplierPrice: 1.6,
    desc: 'Rich balm that soothes dry, chapped lips.', concerns: ['dryness'], types: ['all'],
    certs: ['organic', 'vegan', 'cruelty-free'], keyIngredients: ['Shea Butter', 'Candelilla Wax', 'Vitamin E'],
    howToUse: 'Apply to lips as often as needed.' },

  // Masks / exfoliants
  { name: 'French Green Clay Detox Mask', brand: 'Lis Blanc', emoji: '🎭', price: 9.9, supplierPrice: 3.7,
    desc: 'Deep-cleansing clay mask for congested skin.', concerns: ['acne', 'large pores', 'oily'], types: ['oily', 'combination'],
    certs: ['organic', 'vegan', 'cruelty-free'], keyIngredients: ['French Green Clay', 'Kaolin', 'Tea Tree'],
    howToUse: 'Apply an even layer to clean skin, leave 10 min, rinse. 1-2× weekly.' },
  { name: 'Honey & Oat Hydrating Mask', brand: 'Nordic Bloom', emoji: '🍯', price: 10.9, supplierPrice: 4.3,
    desc: 'Comforting wash-off mask for dry, dull skin.', concerns: ['dryness', 'dehydration', 'sensitivity'], types: ['dry', 'sensitive'],
    certs: ['organic', 'cruelty-free'], keyIngredients: ['Honey Extract', 'Colloidal Oat', 'Hyaluronic Acid'],
    howToUse: 'Apply a generous layer, relax 10-15 min, rinse. 2× weekly.' },
  { name: 'AHA 5% Glow Exfoliating Toner', brand: 'TerraVida', emoji: '🍇', price: 12.9, supplierPrice: 5.3,
    desc: 'Gentle fruit-acid exfoliant for smoother, brighter skin.', concerns: ['pigmentation', 'large pores', 'oily'], types: ['oily', 'combination', 'normal'],
    certs: ['vegan', 'cruelty-free'], keyIngredients: ['Glycolic Acid', 'Lactic Acid', 'Aloe'],
    howToUse: 'Apply with a cotton pad in the evening 2-3× weekly. Follow with SPF by day.' },

  // Oils / treatments
  { name: 'Rosehip & Sea Buckthorn Face Oil', brand: 'Olea Mediterranea', emoji: '🌹', price: 13.9, supplierPrice: 5.8,
    desc: 'Regenerating dry oil rich in omegas and vitamin A.', concerns: ['dryness', 'pigmentation', 'wrinkles'], types: ['dry', 'mature', 'normal'],
    certs: ['organic', 'vegan', 'cruelty-free'], keyIngredients: ['Rosehip Oil', 'Sea Buckthorn', 'Vitamin E'],
    howToUse: 'Press 3-4 drops onto skin as the last step, AM or PM.' },
  { name: 'Squalane + Q10 Glow Drops', brand: 'Alpine Pure', emoji: '💎', price: 14.5, supplierPrice: 6.1,
    desc: 'Antioxidant squalane oil for a healthy glow.', concerns: ['dryness', 'wrinkles'], types: ['dry', 'normal', 'mature'],
    certs: ['vegan', 'cruelty-free'], keyIngredients: ['Squalane', 'Coenzyme Q10', 'Vitamin E'],
    howToUse: 'Warm 2-3 drops between palms and press onto skin.' },

  // SPF
  { name: 'Mineral SPF 30 Daily Fluid', brand: 'Olea Mediterranea', emoji: '☀️', price: 15.9, supplierPrice: 6.9,
    desc: 'Lightweight non-greasy mineral sunscreen.', concerns: ['sensitivity', 'pigmentation'], types: ['all'],
    certs: ['vegan', 'cruelty-free'], keyIngredients: ['Zinc Oxide', 'Aloe', 'Vitamin E'],
    howToUse: 'Apply generously as the last skincare step every morning; reapply through the day.' },
  { name: 'Tinted SPF 50 Glow Shield', brand: 'Amber & Sage', emoji: '🧴', price: 17.9, supplierPrice: 7.8,
    desc: 'High-protection tinted mineral SPF with a dewy finish.', concerns: ['pigmentation', 'redness'], types: ['all'],
    certs: ['vegan', 'cruelty-free'], keyIngredients: ['Zinc Oxide', 'Iron Oxides', 'Niacinamide'],
    howToUse: 'Apply an even layer each morning; reapply every 2 hours in sun.' },

  // Body / extras
  { name: 'Lavender Body Butter', brand: 'GreenLeaf Praha', emoji: '🪻', price: 9.9, supplierPrice: 3.9,
    desc: 'Whipped organic body butter with lavender.', concerns: ['dryness'], types: ['dry', 'normal'],
    certs: ['organic', 'vegan', 'cruelty-free'], keyIngredients: ['Shea Butter', 'Lavender Oil', 'Cocoa Butter'],
    howToUse: 'Massage into clean, dry skin after showering.' },
  { name: 'Coffee & Coconut Body Scrub', brand: 'GreenLeaf Praha', emoji: '☕', price: 8.5, supplierPrice: 3.2,
    desc: 'Invigorating exfoliating scrub for smooth skin.', concerns: ['dryness', 'large pores'], types: ['all'],
    certs: ['organic', 'vegan', 'cruelty-free'], keyIngredients: ['Coffee Grounds', 'Coconut Oil', 'Brown Sugar'],
    howToUse: 'Massage onto damp skin in the shower, then rinse. 2-3× weekly.' },
  { name: 'Hand & Nail Repair Cream', brand: 'Alpine Pure', emoji: '🤲', price: 6.9, supplierPrice: 2.4,
    desc: 'Fast-absorbing cream for dry, hardworking hands.', concerns: ['dryness'], types: ['all'],
    certs: ['organic', 'cruelty-free'], keyIngredients: ['Shea Butter', 'Oat Oil', 'Panthenol'],
    howToUse: 'Apply throughout the day, especially after washing hands.' },
  { name: 'Probiotic Barrier Repair Lotion', brand: 'Bjørk & Berry', emoji: '🧫', price: 13.9, supplierPrice: 5.7,
    desc: 'Microbiome-friendly lotion to calm reactive skin.', concerns: ['sensitivity', 'redness', 'dehydration'], types: ['sensitive', 'normal'],
    certs: ['vegan', 'cruelty-free'], keyIngredients: ['Probiotic Ferment', 'Ceramides', 'Panthenol'],
    howToUse: 'Apply morning and night to clean skin.' },
  { name: 'Azelaic 10% Clarifying Cream', brand: 'Verde Bioskin', emoji: '🌼', price: 15.5, supplierPrice: 6.7,
    desc: 'Targets blemishes, redness and post-acne marks.', concerns: ['acne', 'redness', 'pigmentation'], types: ['oily', 'combination', 'sensitive'],
    certs: ['vegan', 'cruelty-free'], keyIngredients: ['Azelaic Acid', 'Niacinamide', 'Allantoin'],
    howToUse: 'Apply a thin layer once or twice daily after cleansing.' },
];
