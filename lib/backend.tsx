export const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export function chiSquareLSBScore(gray: number[]) {
  const n = gray.length
  if (n < 100) return 0 // Need minimum sample size

  // Count LSB pairs (0-1, 2-3, 4-5, etc. should have similar frequencies in clean images)
  const pairCounts: Map<number, [number, number]> = new Map()

  for (let i = 0; i < n; i++) {
    const val = gray[i]
    const pairBase = val & 0xfe // Remove LSB to get pair
    const lsb = val & 1

    if (!pairCounts.has(pairBase)) {
      pairCounts.set(pairBase, [0, 0])
    }
    const counts = pairCounts.get(pairBase)!
    counts[lsb]++
  }

  // Chi-square test on pairs
  let chi = 0
  let pairs = 0

  pairCounts.forEach(([count0, count1]) => {
    const total = count0 + count1
    if (total >= 2) {
      const expected = total / 2
      chi += ((count0 - expected) ** 2 + (count1 - expected) ** 2) / expected
      pairs++
    }
  })

  if (pairs === 0) return 0

  // Normalize chi-square value
  const normalizedChi = chi / pairs

  // Stego images tend to have lower chi-square (more uniform LSB distribution)
  // Clean images have higher chi-square (natural variation in pairs)
  const score = clamp01(1 - Math.exp(-normalizedChi / 2))

  return score
}

export function rsFlipScore(gray: number[], width: number, height: number) {
  if (width < 4 || height < 4) return 0

  let regularM = 0,
    singularM = 0
  let regularMneg = 0,
    singularMneg = 0
  let total = 0

  // Process image in 2x2 blocks
  for (let y = 0; y < height - 1; y += 2) {
    for (let x = 0; x < width - 1; x += 2) {
      const idx = y * width + x
      const block = [gray[idx] || 0, gray[idx + 1] || 0, gray[idx + width] || 0, gray[idx + width + 1] || 0]

      // Calculate discrimination function (variation)
      const f = (arr: number[]) => {
        let sum = 0
        for (let i = 0; i < arr.length - 1; i++) {
          sum += Math.abs(arr[i] - arr[i + 1])
        }
        return sum
      }

      // Apply F1 mask (flip LSB of odd positions)
      const flipF1 = (arr: number[], mask: number[]) => {
        return arr.map((v, i) => {
          if (mask[i] === 1) return v ^ 1
          if (mask[i] === -1) return v ^ 1
          return v
        })
      }

      const maskP = [0, 1, 1, 0]
      const maskN = [0, -1, -1, 0]

      const fOrig = f(block)
      const fP = f(flipF1(block, maskP))
      const fN = f(flipF1(block, maskN))

      // Classify as Regular, Singular, or Unusable
      if (fP > fOrig) regularM++
      if (fP < fOrig) singularM++
      if (fN > fOrig) regularMneg++
      if (fN < fOrig) singularMneg++

      total++
    }
  }

  if (total === 0) return 0

  // RS ratio - in stego images, R-S and R(-1)-S(-1) differ significantly
  const rmSm = (regularM - singularM) / total
  const rmNSmN = (regularMneg - singularMneg) / total

  // The difference indicates embedding
  const rsDiff = Math.abs(rmSm - rmNSmN)

  return clamp01(rsDiff * 5) // Scale to 0-1 range
}

export function correlationDropScore(gray: number[], width: number, height: number) {
  if (width < 10 || height < 10) return 0

  // Calculate horizontal neighbor correlation
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0,
    sumY2 = 0
  let n = 0

  for (let y = 0; y < height; y++) {
    const rowStart = y * width
    for (let x = 0; x < width - 1; x++) {
      const a = gray[rowStart + x]
      const b = gray[rowStart + x + 1]
      sumX += a
      sumY += b
      sumXY += a * b
      sumX2 += a * a
      sumY2 += b * b
      n++
    }
  }

  if (n === 0) return 0

  const meanX = sumX / n
  const meanY = sumY / n
  const cov = sumXY / n - meanX * meanY
  const varX = sumX2 / n - meanX * meanX
  const varY = sumY2 / n - meanY * meanY
  const denom = Math.sqrt(Math.max(varX, 0) * Math.max(varY, 0))

  const correlation = denom > 0 ? cov / denom : 1

  // Natural images have high correlation (>0.9)
  // Stego images have lower correlation due to LSB noise
  // Score based on how much correlation dropped from expected natural level
  const expectedNaturalCorr = 0.92
  const drop = Math.max(0, expectedNaturalCorr - correlation)

  return clamp01(drop / 0.15) // 0.15 drop = full score
}

export function lsbHistogramScore(gray: number[]) {
  const n = gray.length
  if (n < 100) return 0

  // In natural images, adjacent intensity values often appear together
  // In stego images, LSB modification creates uniform LSB distribution

  let evenCount = 0
  let oddCount = 0

  for (let i = 0; i < n; i++) {
    if ((gray[i] & 1) === 0) evenCount++
    else oddCount++
  }

  // Perfect balance suggests stego (message is roughly 50% 0s and 1s)
  const balance = Math.abs(evenCount - oddCount) / n

  // Natural images typically have some imbalance (>5%)
  // Stego images tend toward perfect balance (<2%)
  const suspiciousBalance = balance < 0.02 ? 1 : clamp01((0.05 - balance) / 0.03)

  return suspiciousBalance
}

export function rgbaToGrayscale(data: Uint8ClampedArray, width: number, height: number, sampleStride = 1) {
  const gray: number[] = []
  const total = width * height
  for (let i = 0; i < total; i += sampleStride) {
    const idx = i * 4
    const r = data[idx],
      g = data[idx + 1],
      b = data[idx + 2]
    gray.push(Math.round(0.299 * r + 0.587 * g + 0.114 * b))
  }
  const eff = Math.round(Math.sqrt(gray.length))
  const w = Math.max(2, Math.round(eff))
  const h = Math.max(2, Math.round(gray.length / w))
  return { gray, width: w, height: h }
}

export function escapeHtml(t: string | null) {
  return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""
}

export function handleResizeAndSend(base64: string, sendCallback: Function) {
  const img = new Image()
  img.crossOrigin = "anonymous"
  img.src = base64
  img.onload = () => {
    const MAX_W = 600
    let w = img.width,
      h = img.height
    if (w > MAX_W) {
      h *= MAX_W / w
      w = MAX_W
    }
    const c = document.createElement("canvas")
    c.width = w
    c.height = h
    const ctx = c.getContext("2d")!
    ctx.drawImage(img, 0, 0, w, h)
    sendCallback(null, c.toDataURL("image/png", 0.95))
  }
}
