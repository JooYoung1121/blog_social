import sharp from 'sharp';

/**
 * 사진 보정 설정 (iPhone 편집 기준 -100 ~ +100 스케일)
 * 레퍼런스: @haedal_home — 밝고 화사하고 따뜻한 육아 감성톤
 */
export interface ToneSettings {
  exposure: number;     // 노출: +15 ~ +20
  brilliance: number;   // 휘도: +30 ~ +40
  highlights: number;   // 하이라이트: -20 ~ -30
  shadows: number;      // 그림자: +30 ~ +40
  contrast: number;     // 대비: -20 ~ -30
  brightness: number;   // 밝기: +10
  warmth: number;       // 따뜻함: +5 ~ +15
  tint: number;         // 색조: +10 ~ +15
}

export const DEFAULT_TONE: ToneSettings = {
  exposure: 17,
  brilliance: 35,
  highlights: -25,
  shadows: 35,
  contrast: -25,
  brightness: 10,
  warmth: 10,
  tint: 12,
};

/**
 * sharp 파이프라인에 톤 보정을 적용한다.
 *
 * iPhone 편집 수치를 sharp 연산으로 근사 변환:
 * - shadows + brilliance → gamma (어두운 영역 끌어올리기, sharp: 1.0~3.0)
 * - exposure + brightness → modulate brightness 승수
 * - contrast + highlights → linear(slope, intercept)
 * - warmth + tint → recomb 3×3 색상 매트릭스
 */
export function applyTone(input: Buffer, settings: ToneSettings = DEFAULT_TONE): sharp.Sharp {
  // --- 1) Shadow lift + Brilliance via gamma ---
  // sharp gamma 1.0~3.0: 값이 클수록 어두운 영역이 밝아짐
  // shadows +35, brilliance +35 → gamma ~1.18
  const shadowGamma = Math.min(3.0, Math.max(1.0,
    1 + (settings.shadows * 0.3 + settings.brilliance * 0.2) / 100
  ));

  // --- 2) Exposure + Brightness → brightness multiplier ---
  // exposure +17 + brightness +10 → ~1.14x
  const brightnessMult = 1 + (settings.exposure + settings.brightness) / 200;

  // --- 3) Contrast + Highlights → linear(slope, intercept) ---
  // contrast -25 → slope 줄여서 부드럽게
  // highlights -25 → intercept로 밝은 영역 살짝 눌러줌
  const slope = 1 + settings.contrast / 120; // -25 → 0.79
  const highlightAdj = settings.highlights / 400; // -25 → -0.0625 (밝은 영역 억제)
  const intercept = (1 - slope) * 128 + highlightAdj * 40; // midpoint 보정 + highlight 억제

  // --- 4) Warmth + Tint → recomb color matrix ---
  // warmth: R↑, B↓ (따뜻한 색온도)
  // tint: R↑ + B↑ slight (핑크빛)
  const w = settings.warmth / 100;
  const t = settings.tint / 100;

  const recombMatrix: [number, number, number][] = [
    [1 + w * 0.08 + t * 0.04, t * 0.02, 0],            // R 채널
    [0, 1, 0],                                            // G 채널 (기준)
    [0, t * 0.02, 1 - w * 0.06],                         // B 채널
  ];

  return sharp(input)
    .gamma(shadowGamma)                          // shadow lift + brilliance
    .modulate({ brightness: brightnessMult })    // exposure + brightness
    .linear(slope, intercept)                    // contrast + highlight 조정
    .recomb(recombMatrix);                       // warmth + tint
}

// --- CLI: 단독 실행 시 사진 보정만 수행 ---
if (process.argv[1]?.includes('edit-photo')) {
  import('fs/promises').then(async (fs) => {
    const { glob } = await import('glob');
    const path = await import('path');

    const inputDir = process.argv[2];
    const outputDir = process.argv[3] || `${inputDir}/edited`;

    if (!inputDir) {
      console.error('Usage: tsx scripts/edit-photo.ts <input-dir> [output-dir]');
      process.exit(1);
    }

    await fs.mkdir(outputDir, { recursive: true });

    const patterns = ['**/*.{heic,HEIC,jpg,jpeg,JPG,JPEG,png,PNG,gif,GIF}'];
    const files = await glob(patterns, { cwd: inputDir, absolute: true });
    files.sort();

    if (files.length === 0) {
      console.log('⚠️  No image files found in', inputDir);
      process.exit(0);
    }

    console.log(`🎨 Found ${files.length} images. Applying tone adjustments...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const baseName = path.basename(file, path.extname(file));
      const outputPath = path.join(outputDir, `${baseName}.jpg`);

      console.log(`  [${i + 1}/${files.length}] ${path.basename(file)}`);

      // HEIC → JPG via sips (macOS)
      let inputPath = file;
      if (path.extname(file).toLowerCase() === '.heic') {
        const tmpPath = `/tmp/blog-edit-${baseName}.jpg`;
        const { execSync } = await import('child_process');
        execSync(`sips -s format jpeg "${file}" --out "${tmpPath}" --setProperty formatOptions 90`, {
          stdio: 'pipe',
        });
        inputPath = tmpPath;
      }

      const buffer = await fs.readFile(inputPath);
      await applyTone(buffer)
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(outputPath);

      // Cleanup temp
      if (inputPath !== file) {
        await fs.unlink(inputPath).catch(() => {});
      }
    }

    console.log(`✅ Edited ${files.length} images → ${outputDir}`);
  });
}
