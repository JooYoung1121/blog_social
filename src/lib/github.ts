/**
 * github.ts — /srv/admin/* endpoint가 공유하는 GitHub Contents/Trees API 헬퍼.
 *
 * 왜 필요한가:
 *   글 파일은 `src/content/posts/YYYY/MM/<slug>.md` 에 "발행 시점" 기준으로 저장된다.
 *   기존 글을 수정할 때 "지금 연/월"로 경로를 계산하면 원본은 그대로 둔 채
 *   다른 폴더에 같은 slug의 파일이 하나 더 생겨 글이 중복된다.
 *   → 항상 레포 트리에서 slug로 실제 경로를 먼저 찾는다.
 */

const POSTS_DIR = 'src/content/posts';

export interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
}

export function getRepoRef(): RepoRef {
  const repo = process.env.GITHUB_REPO; // "owner/repo"
  if (repo && repo.includes('/')) {
    const [owner, name] = repo.split('/');
    return { owner, repo: name, branch: process.env.GITHUB_BRANCH || 'main' };
  }
  return {
    owner: 'JooYoung1121',
    repo: 'blog_social',
    branch: process.env.GITHUB_BRANCH || 'main',
  };
}

export function getToken(): string {
  const token = process.env.GITHUB_REPO_TOKEN;
  if (!token) throw new Error('GITHUB_REPO_TOKEN 환경변수 필요');
  return token;
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'jinas-holiday-admin',
  };
}

export interface RepoPost {
  path: string;
  slug: string;
}

/** 레포 전체 트리에서 포스트 마크다운 목록을 가져온다 (경로 = 실제 저장 위치). */
export async function listPosts(): Promise<RepoPost[]> {
  const { owner, repo, branch } = getRepoRef();
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers: headers(getToken()) },
  );
  if (!res.ok) {
    throw new Error(`GitHub tree failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    tree: { path: string; type: string }[];
  };
  return json.tree
    .filter(
      (n) =>
        n.type === 'blob' &&
        n.path.startsWith(`${POSTS_DIR}/`) &&
        n.path.endsWith('.md'),
    )
    .map((n) => ({
      path: n.path,
      slug: n.path.split('/').pop()!.replace(/\.md$/, ''),
    }))
    .sort((a, b) => b.slug.localeCompare(a.slug));
}

/** slug로 실제 저장 경로를 찾는다. 없으면 null (= 신규 글). */
export async function findPostPath(slug: string): Promise<string | null> {
  const posts = await listPosts();
  return posts.find((p) => p.slug === slug)?.path ?? null;
}

/** 신규 글의 저장 경로 (오늘 기준 YYYY/MM). */
export function newPostPath(slug: string, now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${POSTS_DIR}/${year}/${month}/${slug}.md`;
}

export interface FileContent {
  path: string;
  markdown: string;
  sha: string;
}

/** 파일 원문 + sha (수정 시 필요) */
export async function readFile(path: string): Promise<FileContent | null> {
  const { owner, repo, branch } = getRepoRef();
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${branch}`,
    { headers: headers(getToken()) },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub get failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { content: string; sha: string };
  return {
    path,
    markdown: Buffer.from(json.content, 'base64').toString('utf-8'),
    sha: json.sha,
  };
}

export interface CommitResult {
  commitUrl: string;
  fileUrl: string;
  path: string;
  mode: 'create' | 'update';
}

export async function commitFile(
  path: string,
  markdown: string,
  message: string,
  sha?: string,
): Promise<CommitResult> {
  const { owner, repo, branch } = getRepoRef();
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}`,
    {
      method: 'PUT',
      headers: { ...headers(getToken()), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: Buffer.from(markdown, 'utf-8').toString('base64'),
        branch,
        sha,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`GitHub put failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    commit: { html_url: string };
    content: { html_url: string };
  };
  return {
    commitUrl: json.commit.html_url,
    fileUrl: json.content.html_url,
    path,
    mode: sha ? 'update' : 'create',
  };
}

/**
 * 수정 발행 시 frontmatter의 `updated` 를 오늘 날짜로 갱신/추가.
 * (content.config.ts의 updated 필드 → PostLayout JSON-LD dateModified 신선도 신호)
 */
export function stampUpdated(markdown: string, today: string): string {
  const fm = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return markdown;
  const block = fm[1];
  const next = /^updated:\s*.*$/m.test(block)
    ? block.replace(/^updated:\s*.*$/m, `updated: ${today}`)
    : block.replace(/^(date:\s*.*)$/m, `$1\nupdated: ${today}`);
  return markdown.replace(fm[0], `---\n${next}\n---`);
}
