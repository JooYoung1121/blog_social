export const prerender = false;

import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import {
  PHOTO_TONE,
  PHOTO_RULES,
} from '../../../../scripts/lib/style-rules';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

interface ToneInput {
  exposure?: number;
  brilliance?: number;
  highlights?: number;
  shadows?: number;
  contrast?: number;
  brightness?: number;
  warmth?: number;
  tint?: number;
}

// scripts/edit-photo.ts와 동일한 톤 보정 알고리즘 (sharp 기반)
async function applyTone(buf: Buffer, tone: ToneInput): Promise<Buffer> {
  const exposure = tone.exposure ?? 0;
  const brilliance = tone.brilliance ?? 0;
  const highlights = tone.highlights ?? 0;
  const shadows = tone.shadows ?? 0;
  const contrast = tone.contrast ?? 0;
  const brightness = tone.brightness ?? 0;
  const warmth = tone.warmth ?? 0;
  const tint = tone.tint ?? 0;

  const exposureGamma = 1 - exposure / 100 / 2;
  const brillianceLinear = 1 + brilliance / 200;
  const contrastLinear = 1 + contrast / 100;
  const brightnessLinear = 1 + brightness / 100;
  const shadowLift = shadows / 100;
  const highlightCompress = highlights / 100;
  const r = 1 + warmth / 200 + tint / 400;
  const g = 1 - tint / 400;
  const b = 1 - warmth / 200;

  return sharp(buf)
    .gamma(Math.max(0.5, Math.min(2.5, exposureGamma)))
    .modulate({
      brightness: brillianceLinear * brightnessLinear,
      saturation: 1 + Math.abs(shadowLift) * 0.05,
    })
    .linear(contrastLinear, -(contrastLinear - 1) * 128)
    .recomb([
      [r, 0, 0],
      [0, g, 0],
      [0, 0, b],
    ])
    .modulate({ brightness: 1 + (shadowLift - highlightCompress) * 0.1 })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const slug = (form.get('slug') as string | null) || 'admin';
    const index = (form.get('index') as string | null) || '01';
    const noTone = form.get('noTone') === 'true';

    if (!file) {
      return new Response(JSON.stringify({ error: '파일이 없습니다.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (file.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: '파일이 너무 큽니다 (10MB 초과).' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return new Response(
        JSON.stringify({
          error: `지원하지 않는 형식: ${file.type}. JPEG/PNG/WebP만 가능합니다.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());

    // 리사이즈 (가로 1600 max)
    let processed = await sharp(buf)
      .rotate() // EXIF 자동 회전
      .resize({ width: 1600, withoutEnlargement: true })
      .toBuffer();

    if (!noTone) {
      processed = await applyTone(processed, PHOTO_TONE);
    } else {
      processed = await sharp(processed)
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    }

    // Cloudinary 업로드
    const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '/');
    const publicId = `blog/${yyyymm}/${slug}/photo_${String(index).padStart(2, '0')}`;
    const uploadResult = await new Promise<{ secure_url: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            overwrite: true,
            resource_type: 'image',
            format: 'jpg',
            transformation: [{ fetch_format: 'auto', quality: 'auto' }],
          },
          (err, result) => {
            if (err || !result) return reject(err);
            resolve(result as { secure_url: string });
          },
        );
        stream.end(processed);
      },
    );

    return new Response(
      JSON.stringify({ url: uploadResult.secure_url, publicId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[upload-image] error', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Upload failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
