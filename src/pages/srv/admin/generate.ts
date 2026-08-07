export const prerender = false;

import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { getCollection } from 'astro:content';
import {
  buildSystemPrompt,
  STRUCTURE_RULES,
  type PurchaseType,
} from '../../../../scripts/lib/style-rules';
import {
  suggestForDraft,
  type PostMeta,
} from '../../../../scripts/lib/related-posts';

interface GenerateBody {
  category: string;
  purchaseType: PurchaseType;
  topic?: string;
  mainKeyword?: string;
  subKeywords?: string[];
  notes?: string;
  productUrl?: string;
  sponsor?: string;
  clientGuide?: string;
  intent?: 'review' | 'compare' | 'info' | 'location' | 'diary';
  target?: 'search' | 'homefeed' | 'both';
  imageUrls: string[];
  model?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body: GenerateBody = await request.json();
    const {
      category,
      purchaseType = 'self-purchased',
      topic,
      mainKeyword,
      subKeywords = [],
      notes,
      productUrl,
      sponsor,
      clientGuide,
      intent = 'review',
      target = 'search',
      imageUrls = [],
      model = 'claude-opus-4-7',
    } = body;

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = buildSystemPrompt({
      category,
      purchaseType,
      intent,
      target,
      productName: topic,
      mainKeyword,
      subKeywords,
      notes,
      clientGuide,
    });

    // 내부 링크 후보 — 발행된 글 중 연관도 높은 순.
    // (룰은 2~3개를 요구하는데 실제 글엔 0개였다 → 후보를 프롬프트로 직접 넘긴다)
    let relatedBlock = '';
    try {
      const published = await getCollection('posts', ({ data }) => !data.draft);
      const all: PostMeta[] = published.map((p) => ({
        slug: p.id,
        title: p.data.title,
        category: p.data.category,
        tags: p.data.tags,
        mainKeyword: p.data.mainKeyword,
        date: p.data.date.toISOString().slice(0, 10),
      }));
      const related = suggestForDraft(
        { title: topic, category, mainKeyword, tags: subKeywords },
        all,
        STRUCTURE_RULES.internal_links.max,
      );
      if (related.length > 0) {
        relatedBlock = [
          `## 내부 링크 후보 (${STRUCTURE_RULES.internal_links.min}~${STRUCTURE_RULES.internal_links.max}개를 본문 문맥 안에 자연스럽게 넣기)`,
          ...related.map((r) => `- ${r.markdown}`),
          '문장 흐름에 녹여서 넣기. "관련 글 모음" 같은 별도 목록 섹션은 만들지 않는다.',
          '',
        ].join('\n');
      }
    } catch (err) {
      console.warn('[generate] related posts skipped', err);
    }

    const userText = [
      `다음 정보로 "지나의 휴일" 블로그 글 한 편을 작성해주세요. 시스템 프롬프트의 모든 룰을 정확히 따라주세요.`,
      ``,
      `## 주제`,
      topic || '(미지정 — 사진과 메모를 보고 적절한 제목 만들기)',
      ``,
      `## 메인 키워드`,
      mainKeyword || '(미지정)',
      ``,
      `## 서브 키워드`,
      subKeywords.length ? subKeywords.join(', ') : '(없음)',
      ``,
      `## 사용자가 적어준 메모 (가장 중요)`,
      notes || '(없음 — 사진과 주제를 보고 추정해서 작성)',
      ``,
      productUrl ? `## 제품 링크\n${productUrl}\n` : '',
      relatedBlock,
      `## 제공된 사진 ${imageUrls.length}장 (아래 멀티모달 입력)`,
      `사진은 본문에 모두 포함시켜야 하며, 원본 순서대로 1~2장씩 배치 후 1~2줄 짧은 텍스트로 설명하세요. 사진 3장 이상 연속 절대 금지. 무엇이 찍혀있는지 시각적으로 파악해서 캡션을 써주세요.`,
      ``,
      `## 출력 형식`,
      '아래 정확한 마크다운 형식으로만 출력. ```markdown 코드블록 안에 frontmatter + 본문. 다른 설명 일체 금지.',
      ``,
      '```markdown',
      '---',
      'title: "글 제목 (25자 이내, 메인 키워드를 앞쪽에)"',
      'description: "메타 설명 (120~160자)"',
      `date: ${today}`,
      `category: ${category}`,
      'tags: ["태그1", "태그2", "..."]  # 5~7개',
      `mainKeyword: "${mainKeyword || ''}"`,
      `purchaseType: ${purchaseType}`,
      `intent: ${intent}`,
      `target: ${target}`,
      `thumbnail: "${imageUrls[0] || ''}"`,
      'images:',
      ...imageUrls.map((u) => `  - "${u}"`),
      sponsor ? `sponsorInfo: "${sponsor.replace(/"/g, "'")}"` : '',
      productUrl ? `productLink: "${productUrl}"` : '',
      'sponsored: ' + (purchaseType === 'sponsored' ? 'true' : 'false'),
      'draft: false',
      '---',
      '',
      '안녕하세요!',
      '지나의 휴일입니다 :)',
      '',
      '(여기서부터 본문)',
      '...',
      '',
      '오늘 포스팅은 여기서 마무리!',
      '궁금한 점은 댓글로 남겨주세요 😊',
      '그럼 안녕! 👋',
      '```',
    ]
      .filter(Boolean)
      .join('\n');

    const content: Anthropic.ContentBlockParam[] = [{ type: 'text', text: userText }];
    for (const [idx, url] of imageUrls.entries()) {
      content.push({
        type: 'text',
        text: `\n[사진 ${String(idx + 1).padStart(2, '0')}] URL: ${url}`,
      });
      content.push({ type: 'image', source: { type: 'url', url } });
    }

    const client = new Anthropic();
    const stream = client.messages.stream({
      model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content }],
    });

    const finalMessage = await stream.finalMessage();

    let draft = '';
    for (const block of finalMessage.content) {
      if (block.type === 'text') draft += block.text;
    }
    const fenceMatch = draft.match(/```(?:markdown|md)?\n([\s\S]*?)```/);
    if (fenceMatch) draft = fenceMatch[1].trim();
    else draft = draft.trim();

    return new Response(
      JSON.stringify({
        markdown: draft,
        usage: {
          input: finalMessage.usage.input_tokens,
          cache_create: finalMessage.usage.cache_creation_input_tokens || 0,
          cache_read: finalMessage.usage.cache_read_input_tokens || 0,
          output: finalMessage.usage.output_tokens,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[generate] error', err);
    if (err instanceof Anthropic.AuthenticationError) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY 설정 필요' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Generation failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
