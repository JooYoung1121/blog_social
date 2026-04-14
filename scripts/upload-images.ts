import 'dotenv/config';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { applyTone, DEFAULT_TONE, type ToneSettings } from './edit-photo.js';

export interface UploadResult {
  originalName: string;
  cloudinaryUrl: string;
  width: number;
  height: number;
}

function configureCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      'Missing Cloudinary env vars. Copy .env.example to .env and fill in your credentials.',
    );
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
}

async function convertHeicToJpg(filePath: string): Promise<string> {
  const tmpDir = '/tmp/blog-image-convert';
  await fs.mkdir(tmpDir, { recursive: true });
  const outputPath = path.join(tmpDir, `${path.basename(filePath, path.extname(filePath))}.jpg`);
  execSync(`sips -s format jpeg "${filePath}" --out "${outputPath}" --setProperty formatOptions 90`, {
    stdio: 'pipe',
  });
  return outputPath;
}

async function convertAndResize(filePath: string, tone?: ToneSettings | false): Promise<Buffer> {
  const ext = path.extname(filePath).toLowerCase();
  let inputPath = filePath;

  // HEIC → JPG via macOS sips (sharp doesn't support HEIC natively)
  if (ext === '.heic') {
    inputPath = await convertHeicToJpg(filePath);
  }

  let buffer: Buffer;

  if (tone === false) {
    // 톤 보정 없이 리사이즈만
    buffer = await sharp(inputPath)
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } else {
    // 톤 보정 적용 후 리사이즈
    const rawBuffer = await fs.readFile(inputPath);
    buffer = await applyTone(rawBuffer, tone || DEFAULT_TONE)
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  }

  // Clean up temp file
  if (inputPath !== filePath) {
    await fs.unlink(inputPath).catch(() => {});
  }

  return buffer;
}

async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId: string,
): Promise<{ url: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        overwrite: true,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('No result from Cloudinary'));
        resolve({
          url: result.secure_url,
          width: result.width,
          height: result.height,
        });
      },
    );
    stream.end(buffer);
  });
}

export async function processAndUpload(
  inputDir: string,
  slug: string,
  tone?: ToneSettings | false,
): Promise<UploadResult[]> {
  configureCloudinary();

  const patterns = ['**/*.{heic,HEIC,jpg,jpeg,JPG,JPEG,png,PNG}'];
  const files = await glob(patterns, { cwd: inputDir, absolute: true });
  files.sort();

  if (files.length === 0) {
    console.log('⚠️  No image files found in', inputDir);
    return [];
  }

  console.log(`📸 Found ${files.length} images. Processing...`);

  const results: UploadResult[] = [];
  const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '/'); // "2026/04"
  const folder = `blog/${datePrefix}/${slug}`;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const baseName = `photo_${String(i + 1).padStart(2, '0')}`;
    const originalName = path.basename(file);

    console.log(`  [${i + 1}/${files.length}] ${originalName} → ${baseName}.jpg`);

    const buffer = await convertAndResize(file, tone);
    const { url, width, height } = await uploadToCloudinary(buffer, folder, baseName);

    results.push({ originalName, cloudinaryUrl: url, width, height });
  }

  console.log(`✅ Uploaded ${results.length} images to Cloudinary (${folder})`);
  return results;
}

// CLI entry point
if (process.argv[1]?.includes('upload-images')) {
  const inputDir = process.argv[2];
  const slug = process.argv[3];

  if (!inputDir || !slug) {
    console.error('Usage: tsx scripts/upload-images.ts <input-dir> <slug>');
    process.exit(1);
  }

  processAndUpload(inputDir, slug)
    .then((results) => {
      console.log('\n📋 URLs:');
      results.forEach((r) => console.log(`  ${r.cloudinaryUrl}`));
    })
    .catch((err) => {
      console.error('❌ Error:', err.message);
      process.exit(1);
    });
}
