/**
 * intake.ts — 사진 받아오기
 *
 * 지나님이 직접 해야 하는 유일한 물리 작업이 "사진을 한 폴더에 모으기"다.
 * 그 다음부터는 이 스크립트가 input/<날짜-슬러그>/ 구조를 만들어 준다.
 *
 * Claude 가 자연어 지시를 받아 대신 실행하는 용도다.
 * (지나님이 직접 칠 일은 없지만, 무엇이 일어나는지는 투명해야 한다)
 *
 * 하는 일:
 *   1. input/YYYY-MM-DD-<슬러그>/photos/ 생성
 *   2. 이미지 파일을 **원본 파일명 순서 그대로** 복사 (순서 = 본문 배치 순서)
 *   3. 영상 파일은 복사하지 않고 "어디에 직접 넣어야 하는지" 목록만 보고
 *      (AGENTS.md: MP4 는 조용히 스킵, 네이버에서 직접 주입)
 *   4. 비어 있는 입력 파일 뼈대 생성
 *
 * 사용:
 *   npm run intake -- --from ~/Desktop/클레이유식 --title "클레 실온이유식 후기"
 *   npm run intake -- --from-recent --hours 48 --title "..."
 */
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const IMAGE_EXT = /\.(heic|heif|jpe?g|png|gif|webp)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|avi)$/i;

interface Config {
  from?: string;
  fromRecent: boolean;
  hours: number;
  title?: string;
  slug?: string;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const cfg: Config = { fromRecent: false, hours: 24 };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--from':
        cfg.from = args[++i];
        break;
      case '--from-recent':
        cfg.fromRecent = true;
        break;
      case '--hours':
        cfg.hours = parseInt(args[++i], 10);
        break;
      case '--title':
        cfg.title = args[++i];
        break;
      case '--slug':
        cfg.slug = args[++i];
        break;
    }
  }
  if (!cfg.from && !cfg.fromRecent) {
    console.error(`
사용법:
  npm run intake -- --from <사진폴더> --title "글 제목"
  npm run intake -- --from-recent --hours 48 --title "글 제목"

  --from <경로>       사진이 모여 있는 폴더
  --from-recent       ~/Downloads, ~/Desktop 에서 최근 이미지 수집
  --hours <n>         --from-recent 기준 시간 (기본 24)
  --title "제목"      글 제목 (슬러그 자동 생성)
  --slug "슬러그"     슬러그 직접 지정
`);
    process.exit(1);
  }
  return cfg;
}

function expandHome(p: string): string {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

/** 한글을 살린 슬러그 (기존 글 규칙과 동일) */
function toSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

interface Found {
  images: string[];
  videos: string[];
}

async function collectFrom(dir: string): Promise<Found> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const images: string[] = [];
  const videos: string[] = [];
  for (const e of entries) {
    if (!e.isFile() || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (IMAGE_EXT.test(e.name)) images.push(full);
    else if (VIDEO_EXT.test(e.name)) videos.push(full);
  }
  // 파일명 순서 = 본문 배치 순서 (AGENTS.md). 숫자를 숫자로 비교한다.
  const natural = (a: string, b: string) =>
    path.basename(a).localeCompare(path.basename(b), 'ko', { numeric: true });
  return { images: images.sort(natural), videos: videos.sort(natural) };
}

async function collectRecent(hours: number): Promise<Found> {
  const cutoff = Date.now() - hours * 3600_000;
  const dirs = [
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Desktop'),
  ];
  const images: { p: string; t: number }[] = [];
  const videos: { p: string; t: number }[] = [];

  for (const dir of dirs) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isFile() || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      const st = await fs.stat(full).catch(() => null);
      if (!st || st.mtimeMs < cutoff) continue;
      if (IMAGE_EXT.test(e.name)) images.push({ p: full, t: st.mtimeMs });
      else if (VIDEO_EXT.test(e.name)) videos.push({ p: full, t: st.mtimeMs });
    }
  }
  // 최근 수집은 촬영/저장 시각 순이 자연스럽다
  return {
    images: images.sort((a, b) => a.t - b.t).map((x) => x.p),
    videos: videos.sort((a, b) => a.t - b.t).map((x) => x.p),
  };
}

async function main() {
  const cfg = parseArgs();

  const found = cfg.from
    ? await collectFrom(expandHome(cfg.from))
    : await collectRecent(cfg.hours);

  if (found.images.length === 0) {
    console.log('❌ 이미지를 못 찾았습니다.');
    if (cfg.fromRecent) console.log(`   최근 ${cfg.hours}시간 내 ~/Downloads, ~/Desktop 확인함`);
    process.exit(1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const slug = cfg.slug || (cfg.title ? toSlug(cfg.title) : 'untitled');
  const dir = path.resolve('input', `${date}-${slug}`);
  const photosDir = path.join(dir, 'photos');
  await fs.mkdir(photosDir, { recursive: true });

  // 순서를 파일명에 고정해 둔다. 원본 이름은 정렬이 깨질 수 있어서다.
  const pad = String(found.images.length).length;
  let copied = 0;
  for (const [i, src] of found.images.entries()) {
    const ext = path.extname(src).toLowerCase();
    const name = `photo_${String(i + 1).padStart(Math.max(pad, 2), '0')}${ext}`;
    await fs.copyFile(src, path.join(photosDir, name));
    copied++;
  }

  // 입력 파일 뼈대 — Claude 가 대화 내용으로 채운다
  const stubs: Record<string, string> = {
    'topic.txt': cfg.title ? `${cfg.title}\n` : '',
    'purchase.txt': '',
    'notes.txt': '',
  };
  for (const [name, content] of Object.entries(stubs)) {
    const p = path.join(dir, name);
    try {
      await fs.access(p);
    } catch {
      await fs.writeFile(p, content, 'utf-8');
    }
  }

  const rel = path.relative(process.cwd(), dir);
  console.log(`\n📁 ${rel}`);
  console.log(`   사진 ${copied}장 복사 (photo_01 ~ photo_${String(copied).padStart(Math.max(pad, 2), '0')})`);
  console.log(`   원본 순서 유지: ${path.basename(found.images[0])} → photo_01`);

  if (found.videos.length > 0) {
    console.log(`\n🎬 영상 ${found.videos.length}개 — 복사하지 않음 (네이버에 직접 삽입)`);
    for (const v of found.videos) console.log(`   · ${path.basename(v)}`);
    console.log('   본문에 <!-- video: 설명 --> 마커를 남겨두면 /naver 페이지가 위치를 알려줍니다.');
  }

  console.log(`\n다음: notes.txt / purchase.txt 채우고 → npm run generate-draft -- --input ${rel} --category <카테고리>`);
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
