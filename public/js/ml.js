/* ===========================================================================
 * Client-side ML skin cross-validation (ported from the original PureGlow app).
 * Runs entirely in the browser via TensorFlow.js BlazeFace + pixel analysis,
 * producing an independent "second opinion" overlaid on the LLM radar chart.
 * ======================================================================== */

let blazefaceModel = null;
let mlModelLoadAttempted = false;
let mlModelLoadFailed = false;

// BlazeFace returns `probability` as a 1-element array (or typed array); reduce
// it to a plain number so it serializes cleanly and the backend can store it.
function toScalar(v, fallback = 0.5) {
  if (Array.isArray(v) || ArrayBuffer.isView(v)) v = v[0];
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function loadMLModels() {
  if (mlModelLoadAttempted) return !mlModelLoadFailed;
  mlModelLoadAttempted = true;
  try {
    if (!blazefaceModel && typeof blazeface !== 'undefined') {
      const loadPromise = blazeface.load();
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Model load timeout')), 10000));
      blazefaceModel = await Promise.race([loadPromise, timeoutPromise]);
      return true;
    }
  } catch (error) {
    console.warn('⚠️ BlazeFace unavailable:', error.message);
    mlModelLoadFailed = true;
  }
  return false;
}

async function analyzeWithMLModels(imageFile) {
  await loadMLModels();
  const img = new Image();
  const imageUrl = URL.createObjectURL(imageFile);

  return new Promise((resolve) => {
    img.onload = async () => {
      try {
        const mlResults = {
          faceDetected: false, bodyPartDetected: 'unknown', skinRegionDetected: false,
          skinQualityScore: 0, confidence: 0.5, analysisMethod: 'pixel-based',
          blazefaceAvailable: !!blazefaceModel,
        };

        if (blazefaceModel) {
          try {
            const predictions = await blazefaceModel.estimateFaces(img, false);
            mlResults.faceDetected = predictions.length > 0;
            mlResults.faceCount = predictions.length;
            mlResults.multipleFaces = predictions.length > 1;
            if (predictions.length > 1) {
              URL.revokeObjectURL(imageUrl);
              return resolve({ faceDetected: true, faceCount: predictions.length, multipleFaces: true, skipAnalysis: true });
            }
            if (predictions.length > 0) { mlResults.confidence = toScalar(predictions[0].probability); mlResults.bodyPartDetected = 'face'; }
          } catch (_) { /* fall back to pixel analysis */ }
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width; canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const skinMask = detectSkinRegions(fullImageData);
        mlResults.skinRegionDetected = skinMask.skinPixelCount > (fullImageData.data.length / 4) * 0.1;
        mlResults.skinCoverage = skinMask.skinPercentage;

        if (mlResults.skinRegionDetected && !mlResults.faceDetected) {
          mlResults.bodyPartDetected = 'hand/arm/leg';
          mlResults.confidence = Math.min(0.8, skinMask.skinPercentage / 50);
        }

        let analysisRegion;
        if (skinMask.largestRegion) {
          analysisRegion = ctx.getImageData(skinMask.largestRegion.x, skinMask.largestRegion.y, skinMask.largestRegion.width, skinMask.largestRegion.height);
          mlResults.analysisMethod = 'skin-region-based';
        } else {
          const size = Math.min(canvas.width, canvas.height) * 0.4;
          analysisRegion = ctx.getImageData(canvas.width * 0.5 - size / 2, canvas.height * 0.5 - size / 2, size, size);
          mlResults.analysisMethod = 'center-region-based';
        }

        const edge = detectEdges(analysisRegion);
        mlResults.wrinkleScore = Math.min(10, edge.edgeDensity * 15);
        const analysis = analyzeSkinPixels(analysisRegion, edge, mlResults.faceDetected);
        mlResults.colorAnalysis = analysis.color;
        mlResults.textureAnalysis = analysis.texture;
        mlResults.skinQualityScore = analysis.qualityScore;
        mlResults.mlConcerns = analysis.mlConcerns;

        URL.revokeObjectURL(imageUrl);
        resolve(mlResults);
      } catch (error) {
        URL.revokeObjectURL(imageUrl);
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(imageUrl); resolve(null); };
    img.src = imageUrl;
  });
}

async function preValidateSkinImage(imageFile) {
  return new Promise((resolve) => {
    const img = new Image();
    const imageUrl = URL.createObjectURL(imageFile);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxSize = 300;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const skinResult = detectSkinRegions(ctx.getImageData(0, 0, canvas.width, canvas.height));
        URL.revokeObjectURL(imageUrl);
        if (skinResult.skinPercentage >= 8) {
          resolve({ valid: true, skinPercentage: skinResult.skinPercentage });
        } else if (skinResult.skinPercentage >= 3) {
          resolve({ valid: false, skinPercentage: skinResult.skinPercentage, message: 'The image shows very little visible skin. Please upload a clearer photo of your face or skin area.' });
        } else {
          resolve({ valid: false, skinPercentage: skinResult.skinPercentage, message: 'No human skin was detected. Please upload a clear photo of your face, hand, arm, or other skin area.' });
        }
      } catch (error) {
        URL.revokeObjectURL(imageUrl);
        resolve({ valid: true, error: error.message });
      }
    };
    img.onerror = () => { URL.revokeObjectURL(imageUrl); resolve({ valid: false, message: 'Could not load the image. Please try a different photo.' }); };
    img.src = imageUrl;
  });
}

function detectSkinRegions(imageData) {
  const pixels = imageData.data;
  let skinPixelCount = 0;
  const skinPixels = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    const isSkin = (y > 80 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) ||
      (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15);
    if (isSkin) { skinPixelCount++; skinPixels.push(i / 4); }
  }
  const totalPixels = pixels.length / 4;
  const skinPercentage = (skinPixelCount / totalPixels) * 100;
  let largestRegion = null;
  if (skinPixels.length > 0) {
    const width = imageData.width, height = imageData.height;
    const sample = skinPixels[Math.floor(skinPixels.length / 2)];
    const sx = sample % width, sy = Math.floor(sample / width);
    largestRegion = { x: Math.max(0, sx - 100), y: Math.max(0, sy - 100), width: Math.min(200, width), height: Math.min(200, height) };
  }
  return { skinPixelCount, skinPercentage, largestRegion };
}

function detectEdges(imageData) {
  const width = imageData.width, height = imageData.height, pixels = imageData.data;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < pixels.length; i += 4) gray[i / 4] = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  let edgePixelCount = 0, totalEdgeMagnitude = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) {
        const v = gray[(y + ky) * width + (x + kx)];
        const k = (ky + 1) * 3 + (kx + 1);
        gx += v * sobelX[k]; gy += v * sobelY[k];
      }
      const mag = Math.sqrt(gx * gx + gy * gy);
      totalEdgeMagnitude += mag;
      if (mag > 50) edgePixelCount++;
    }
  }
  const totalPixels = (width - 2) * (height - 2) || 1;
  return { edgePixelCount, edgeDensity: edgePixelCount / totalPixels, avgEdgeMagnitude: totalEdgeMagnitude / totalPixels };
}

function rgbToLab(r, g, b) {
  let R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = (R * 0.2126729 + G * 0.7151522 + B * 0.072175) / 1.0;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116);
  return { L: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) };
}

function analyzeSkinPixels(imageData, edgeDetection, isFace) {
  const pixels = imageData.data, width = imageData.width, height = imageData.height;
  let rSum = 0, gSum = 0, bSum = 0, brightnessSum = 0;
  const pixelCount = pixels.length / 4;
  const intensities = [], aStarValues = [], luminanceValues = [];
  const topHalf = [], bottomHalf = [], midY = height / 2;
  const sampleRate = Math.max(1, Math.floor(pixelCount / 5000));

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const idx = i / 4, y = Math.floor(idx / width);
    rSum += r; gSum += g; bSum += b;
    const brightness = (r + g + b) / 3;
    brightnessSum += brightness; intensities.push(brightness);
    (y < midY ? topHalf : bottomHalf).push(brightness);
    if (idx % sampleRate === 0) { const lab = rgbToLab(r, g, b); aStarValues.push(lab.a); luminanceValues.push(lab.L); }
  }

  const avgR = rSum / pixelCount, avgG = gSum / pixelCount, avgB = bSum / pixelCount;
  const avgBrightness = brightnessSum / pixelCount;
  let varianceSum = 0;
  for (const v of intensities) varianceSum += (v - avgBrightness) ** 2;
  const textureVariance = Math.sqrt(varianceSum / intensities.length);

  const avgAStar = aStarValues.reduce((s, v) => s + v, 0) / (aStarValues.length || 1);
  let aStarVariance = 0;
  for (const a of aStarValues) aStarVariance += (a - avgAStar) ** 2;
  aStarVariance = Math.sqrt(aStarVariance / (aStarValues.length || 1));

  let rednessScore = 0;
  if (avgAStar > 12) rednessScore = Math.min(10, (avgAStar - 12) * 0.8);
  else if (avgAStar > 8) rednessScore = Math.min(3, (avgAStar - 8) * 0.3);
  if (aStarVariance > 5) rednessScore = Math.min(10, rednessScore + (aStarVariance - 5) * 0.3);

  let sensitivityScore = Math.min(4, aStarVariance / 3);
  const avgLum = luminanceValues.reduce((s, v) => s + v, 0) / (luminanceValues.length || 1);
  let lumVar = 0;
  for (const L of luminanceValues) lumVar += (L - avgLum) ** 2;
  lumVar = Math.sqrt(lumVar / (luminanceValues.length || 1));
  if (lumVar > 10 && avgAStar > 10) sensitivityScore += Math.min(3, (lumVar / 10) * (avgAStar / 15));
  if (textureVariance < 20 && avgAStar > 12) sensitivityScore += Math.min(2, (20 - textureVariance) / 10 + (avgAStar - 12) / 5);
  if (edgeDetection && edgeDetection.edgeDensity > 0.05 && avgAStar > 10) sensitivityScore += Math.min(2, edgeDetection.edgeDensity * 10);
  sensitivityScore = Math.min(10, sensitivityScore);

  let wrinkleScore = 0;
  if (edgeDetection) {
    wrinkleScore = Math.min(10, edgeDetection.edgeDensity * 15);
    if (edgeDetection.avgEdgeMagnitude / 100 < 0.8 && edgeDetection.edgeDensity > 0.05) wrinkleScore = Math.min(10, wrinkleScore * 1.3);
  }

  let saggingScore = 0;
  if (isFace && topHalf.length && bottomHalf.length) {
    const at = topHalf.reduce((a, b) => a + b, 0) / topHalf.length;
    const ab = bottomHalf.reduce((a, b) => a + b, 0) / bottomHalf.length;
    let tv = 0, bv = 0;
    for (const b of topHalf) tv += (b - at) ** 2;
    for (const b of bottomHalf) bv += (b - ab) ** 2;
    tv = Math.sqrt(tv / topHalf.length); bv = Math.sqrt(bv / bottomHalf.length);
    saggingScore = Math.min(10, Math.abs(bv - tv) / 10 + Math.abs(ab - at) / 30);
    if (edgeDetection && edgeDetection.edgeDensity > 0.1) saggingScore = Math.min(10, saggingScore * 1.2);
  } else {
    saggingScore = Math.min(10, textureVariance / 25);
  }

  const concerns = {
    redness: rednessScore, sensitivity: sensitivityScore,
    dryness: estimateDryness(avgR, avgG, avgB, textureVariance),
    texture: estimateTextureIssues(textureVariance),
    pigmentation: estimatePigmentation(avgBrightness, textureVariance),
    wrinkles: wrinkleScore, sagging: saggingScore,
  };

  return {
    color: { r: avgR, g: avgG, b: avgB },
    texture: { variance: textureVariance, roughness: textureVariance / 50 },
    qualityScore: calculateQualityScore(concerns),
    mlConcerns: concerns,
  };
}

function estimateDryness(r, g, b, variance) { return Math.min(10, Math.max(0, variance / 30 + (255 - (r + g + b) / 3) / 50)); }
function estimateTextureIssues(variance) { return Math.min(10, variance / 15); }
function estimatePigmentation(brightness, variance) { return Math.min(10, ((Math.abs(brightness - 128) / 128) * 10 + variance / 30) / 2); }
function calculateQualityScore(concerns) {
  const vals = Object.values(concerns);
  return Math.max(0, 10 - vals.reduce((s, v) => s + v, 0) / vals.length);
}

// ---------------------------------------------------------------------------
// Radar chart with optional ML cross-validation overlay
// ---------------------------------------------------------------------------
function drawRadarChart(canvasId, metrics, skinType, mlResults = null) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 200, cy = 200, maxR = 150, n = 10;
  ctx.clearRect(0, 0, 400, 400);

  const labels = ['Dryness', 'Dehydration', 'Wrinkles', 'Sagging', 'Sensitivity', 'Redness', 'Blocked Pores', 'Enlarged Pores', 'Acne', 'Pigmentation'];
  const llm = [metrics.dryness || 0, metrics.dehydration || 0, metrics.wrinkles || 0, metrics.sagging || 0, metrics.sensitivity || 0,
    metrics.redness || 0, metrics.blockedPores || 0, metrics.enlargedPores || 0, metrics.acne || 0, metrics.pigmentation || 0];

  let ml = null;
  if (mlResults && mlResults.mlConcerns) {
    const c = mlResults.mlConcerns;
    ml = [c.dryness || 0, (c.dryness || 0) * 0.8, c.wrinkles || 0, c.sagging || 0, c.sensitivity || 0,
      c.redness || 0, (c.texture || 0) * 0.9, (c.texture || 0) * 0.8, c.texture || 0, c.pigmentation || 0];
  }

  ctx.strokeStyle = '#E8DCC4'; ctx.lineWidth = 1;
  for (let i = 1; i <= 5; i++) { ctx.beginPath(); ctx.arc(cx, cy, (maxR / 5) * i, 0, Math.PI * 2); ctx.stroke(); }

  const dark = document.body.classList.contains('dark');
  ctx.strokeStyle = dark ? '#555' : '#D4D4D4';
  ctx.fillStyle = dark ? '#E8DCC4' : '#2D3142';
  ctx.font = '11px Inter';
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 / n) * i - Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * maxR, cy + Math.sin(ang) * maxR); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], cx + Math.cos(ang) * (maxR + 25), cy + Math.sin(ang) * (maxR + 25));
  }

  if (ml) {
    ctx.beginPath(); ctx.fillStyle = 'rgba(144,238,144,0.15)'; ctx.strokeStyle = '#90EE90'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 / n) * i - Math.PI / 2; const rad = maxR * (ml[i] / 10);
      const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  }

  ctx.beginPath(); ctx.fillStyle = 'rgba(124,148,115,0.3)'; ctx.strokeStyle = '#7C9473'; ctx.lineWidth = 2.5;
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 / n) * i - Math.PI / 2; const rad = maxR * (llm[i] / 10);
    const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#5F6F52';
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 / n) * i - Math.PI / 2; const rad = maxR * (llm[i] / 10);
    ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, 4, 0, Math.PI * 2); ctx.fill();
  }

  if (ml) {
    const ly = 392; ctx.font = '10px Inter';
    const tc = dark ? '#E8DCC4' : '#2D3142';
    ctx.fillStyle = '#7C9473'; ctx.fillRect(70, ly, 20, 3);
    ctx.fillStyle = tc; ctx.textAlign = 'left'; ctx.fillText('LLM Analysis', 95, ly + 3);
    ctx.strokeStyle = '#90EE90'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(200, ly + 1.5); ctx.lineTo(220, ly + 1.5); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = tc; ctx.fillText('ML Cross-Validation', 225, ly + 3);
  }
}

// Preload models (non-blocking).
loadMLModels();
