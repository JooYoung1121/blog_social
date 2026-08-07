/**
 * suggest-links.ts
 *
 * 발행된 글들을 훑어 "이 글에 넣으면 좋은 내부 링크" 를 추천한다.
 * 현재 본문에 내부 링크가 몇 개 있는지도 같이 보여준다.
 *
 * 사용:
 *   npm run suggest-links                 # 내부 링크가 부족한 글만
 *   npm run suggest-links -- --all        # 전체 글
 *   npm run suggest-links -- <파일경로>    # 특정 글만
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { suggestRelated, type PostMeta } from './lib/related-posts.js';
import { STRUCTURE_RULES } from './lib/style-rules.js';

function parseFrontmatter(text: string): Record<string, string> {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) result[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return result;
}

function parseTags(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((t) => t.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function countInternalLinks(body: string): number {
  return [...body.matchAll(/\[[^\]]+\]\((\/[^)\s]+|https?:\/\/[^)\s]*jinas-holiday[^)\s]*)\)/g)]
    .length;
}

async function main() {
  const args = process.argv.slice(2);
  const showAll = args.includes('--all');
  const fileArg = args.find((a) => !a.startsWith('--'));

  const files = await glob('src/content/posts/**/*.md', { absolute: true });
  const entries = await Promise.all(
    files.map(async (file) => {
      const content = await fs.readFile(file, 'utf-8');
      const fm = parseFrontmatter(content);
      const body = content.replace(/^---[\s\S]*?---\s*/m, '');
      // slug = src/content/posts 기준 상대경로 (중첩 폴더 글의 URL과 일치해야 함)
      const rel = path
        .relative(path.resolve('src/content/posts'), file)
        .replace(/\\/g, '/')
        .replace(/\.md$/, '');
      const meta: PostMeta = {
        slug: rel,
        title: fm.title || rel,
        category: fm.category || '',
        tags: parseTags(fm.tags),
        mainKeyword: fm.mainKeyword,
        date: fm.date,
      };
      return { file, meta, internalLinks: countInternalLinks(body) };
    }),
  );

  const all = entries.map((e) => e.meta);
  const targets = fileArg
    ? entries.filter((e) => e.file === path.resolve(fileArg))
    : showAll
      ? entries
      : entries.filter((e) => e.internalLinks < STRUCTURE_RULES.internal_links.min);

  if (targets.length === 0) {
    console.log('✅ 내부 링크가 부족한 글이 없습니다.');
    return;
  }

  console.log(
    `🔗 ${targets.length}개 글에 내부 링크 추천 (권장 ${STRUCTURE_RULES.internal_links.min}~${STRUCTURE_RULES.internal_links.max}개)\n`,
  );

  for (const entry of targets) {
    const rel = path.relative(process.cwd(), entry.file);
    console.log(`\n📄 ${rel}`);
    console.log(`   현재 내부 링크: ${entry.internalLinks}개`);
    const suggestions = suggestRelated(entry.meta, all, STRUCTURE_RULES.internal_links.max);
    if (suggestions.length === 0) {
      console.log('   (연관 글 없음 — 글이 더 쌓이면 다시 확인)');
      continue;
    }
    for (const s of suggestions) {
      console.log(`   • [score ${s.score}] ${s.markdown}`);
      console.log(`     근거: ${s.reasons.join(' / ')}`);
    }
  }

  console.log(
    '\n💡 위 마크다운을 본문 흐름에 맞는 문장 안에 자연스럽게 넣으세요. (별도 링크 목록 섹션보다 문맥 안 링크가 낫습니다)',
  );
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
