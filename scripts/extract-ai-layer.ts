/**
 * extract-ai-layer.ts
 *
 * 본문에 이미 쓰여 있는 AI 친화 레이어(TL;DR / FAQ)를 읽어
 * frontmatter의 `tldr` / `faq` 필드로 승격시킨다.
 *
 * 왜 필요한가:
 *   2026-08 작업으로 15편 전부 본문에는 TL;DR·FAQ가 들어갔지만,
 *   frontmatter와 JSON-LD에는 반영되지 않아 기계가 읽는 신호로는 안 나갔다.
 *   (docs/ai-friendly-guide.md §2.1이 제안했으나 미구현 상태였음)
 *
 * 원칙:
 *   본문에 실제로 보이는 내용만 옮긴다. 없는 걸 지어내지 않는다.
 *   시각적 내용과 구조화 데이터가 불일치하면 manual action 위험.
 *
 * 사용:
 *   npm run extract-ai-layer            # 전체 (dry-run, 변경 내역만 출력)
 *   npm run extract-ai-layer -- --write # 실제 파일 수정
 *   npm run extract-ai-layer -- --write <파일경로>
 */
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

interface FaqItem {
  q: string;
  a: string;
}

interface Extracted {
  tldr?: string;
  faq: FaqItem[];
}

/** `> **한 줄 요약**: ...` 의 요약 문장 한 줄 */
function extractTldr(body: string): string | undefined {
  const m = body.match(/^>\s*\*\*한 줄 요약\*\*\s*[::]\s*(.+)$/m);
  return m ? m[1].trim() : undefined;
}

/**
 * FAQ 인용블록을 Q/A 쌍으로.
 *   > **Q. 질문?**
 *   > 답변 (여러 줄 가능)
 */
function extractFaq(body: string): FaqItem[] {
  const items: FaqItem[] = [];
  const lines = body.split('\n');

  let current: FaqItem | null = null;
  for (const line of lines) {
    const qm = line.match(/^>\s*\*\*Q\.\s*(.+?)\*\*\s*$/);
    if (qm) {
      if (current) items.push(current);
      current = { q: qm[1].trim(), a: '' };
      continue;
    }
    if (current) {
      const am = line.match(/^>\s?(.*)$/);
      if (am && am[1].trim()) {
        current.a = current.a ? `${current.a} ${am[1].trim()}` : am[1].trim();
      } else if (!line.trim().startsWith('>')) {
        // 인용블록이 끝남
        items.push(current);
        current = null;
      }
    }
  }
  if (current) items.push(current);

  return items.filter((i) => i.q && i.a);
}

function splitFrontmatter(raw: string): { fm: string; body: string } | null {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  return { fm: m[1], body: m[2] };
}

/** YAML 문자열 안전 인용 (더블쿼트 이스케이프) */
function yq(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildAiLayerYaml(ex: Extracted): string {
  const out: string[] = [];
  if (ex.tldr) out.push(`tldr: ${yq(ex.tldr)}`);
  if (ex.faq.length > 0) {
    out.push('faq:');
    for (const item of ex.faq) {
      out.push(`  - q: ${yq(item.q)}`);
      out.push(`    a: ${yq(item.a)}`);
    }
  }
  return out.join('\n');
}

async function processFile(file: string, write: boolean) {
  const raw = await fs.readFile(file, 'utf-8');
  const parts = splitFrontmatter(raw);
  const rel = path.relative(process.cwd(), file);

  if (!parts) {
    console.log(`⚠️  ${rel} — frontmatter 파싱 실패, 건너뜀`);
    return { changed: false };
  }

  // 이미 처리된 글은 건드리지 않음 (재실행 안전)
  if (/^tldr:/m.test(parts.fm) || /^faq:/m.test(parts.fm)) {
    console.log(`⏭️  ${rel} — 이미 tldr/faq 있음`);
    return { changed: false };
  }

  const ex: Extracted = {
    tldr: extractTldr(parts.body),
    faq: extractFaq(parts.body),
  };

  if (!ex.tldr && ex.faq.length === 0) {
    console.log(`⏭️  ${rel} — 본문에 TL;DR/FAQ 없음`);
    return { changed: false };
  }

  const yaml = buildAiLayerYaml(ex);
  console.log(
    `✅ ${rel} — TL;DR ${ex.tldr ? '있음' : '없음'}, FAQ ${ex.faq.length}개`,
  );

  if (write) {
    // draft: 줄 바로 앞에 삽입 (frontmatter 끝쪽, 순서 안정적)
    let newFm: string;
    if (/^draft:/m.test(parts.fm)) {
      newFm = parts.fm.replace(/^draft:/m, `${yaml}\ndraft:`);
    } else {
      newFm = `${parts.fm}\n${yaml}`;
    }
    await fs.writeFile(file, `---\n${newFm}\n---\n${parts.body}`, 'utf-8');
  }

  return { changed: true };
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const targets = args.filter((a) => !a.startsWith('--'));

  const files =
    targets.length > 0
      ? targets.map((t) => path.resolve(t))
      : await glob('src/content/posts/**/*.md', { absolute: true });

  console.log(
    `📋 ${files.length}개 포스트 — ${write ? '쓰기 모드' : 'DRY RUN (--write 로 실제 반영)'}\n`,
  );

  let changed = 0;
  for (const f of files.sort()) {
    const r = await processFile(f, write);
    if (r.changed) changed++;
  }

  console.log(`\n📊 ${changed}개 파일 ${write ? '수정됨' : '수정 예정'}`);
  if (!write && changed > 0) console.log('   → npm run extract-ai-layer -- --write');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
