from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

import pypandoc


ROOT = Path(__file__).resolve().parents[1]
AI_PROJECTS_DIR = ROOT.parent / "ai-projects"
MANIFEST_PATH = ROOT / "content" / "works-manifest.json"
WORKS_DIR = ROOT / "content" / "works"

CITATION_RE = re.compile(r"\[\[\d+\]\([^)]+\)\]")
LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")
MARKDOWN_IMAGE_RE = re.compile(r"!\[[^\]]*\]\([^)]+\)")
FRONT_MATTER_RE = re.compile(r"\A---\s*\n.*?\n---\s*\n", re.DOTALL)
STOP_HEADING_RE = re.compile(r"^#{1,6}\s*(参考文献|参考资料|延伸阅读)\s*$")
AI_NOTICE_RE = re.compile(r"本内容由\s*Coze\s*AI\s*生成|人工智能生成合成内容标识办法")
MDX_COMPONENT_START_RE = re.compile(r"^<(LineChart|ResponsiveContainer)\b")
MDX_COMPONENT_END_RE = re.compile(r"^</(LineChart|ResponsiveContainer)>")
MDX_SINGLE_LINE_RE = re.compile(
    r"^<(CartesianGrid|XAxis|YAxis|Tooltip|Legend|Line|ReferenceLine|BarChart|Bar|AreaChart|Area|PieChart|Pie|Cell)\b"
)


@dataclass(frozen=True)
class AIWorkConfig:
    source: str
    slug: str
    title: str
    year: str = "2026"
    category: str = "essay"
    section: str = "essays"


AI_WORKS: list[AIWorkConfig] = [
    AIWorkConfig(
        source="Annahstasia《Tether》专辑研究：身份认同与现代民谣的革新实践-f94ef39919.mdx",
        slug="annahstasia-tether-identity-and-folk-innovation",
        title="Annahstasia《Tether》专辑研究：身份认同与现代民谣的革新实践",
    ),
    AIWorkConfig(
        source="《呼朋引伴》中的孤独叙事与现代性困境研究-56ca98df99.mdx",
        slug="cmon-cmon-loneliness-and-modernity",
        title="《呼朋引伴》中的孤独叙事与现代性困境研究",
    ),
    AIWorkConfig(
        source="印象派音乐的当代回响：Caroline《Caroline 2》中的光影与情绪-7f7ebc58d5.md",
        slug="caroline-2-impressionist-echoes",
        title="印象派音乐的当代回响：Caroline《Caroline 2》中的光影与情绪",
    ),
    AIWorkConfig(
        source="夏日终曲：《珍妮特星球》中的季节情绪与成长仪式-c134461b54.md",
        slug="janet-planet-summer-and-coming-of-age",
        title="夏日终曲：《珍妮特星球》中的季节情绪与成长仪式",
    ),
    AIWorkConfig(
        source="情感与平面性：维也纳分离派艺术研究-d0251e11cc.md",
        slug="vienna-secession-emotion-and-flatness",
        title="情感与平面性：维也纳分离派艺术研究",
    ),
    AIWorkConfig(
        source="索菲亚·科波拉电影中的微妙情绪捕捉：《处女之死》与《迷失东京》研究-e81ac752b9.mdx",
        slug="sofia-coppola-subtle-emotions",
        title="索菲亚·科波拉电影中的微妙情绪捕捉：《处女之死》与《迷失东京》研究",
    ),
]


def remove_front_matter(text: str) -> str:
    return FRONT_MATTER_RE.sub("", text, count=1)


def clean_inline_markup(text: str) -> str:
    text = CITATION_RE.sub("", text)
    text = LINK_RE.sub(r"\1", text)
    text = text.replace("—", "-").replace("–", "-")
    text = re.sub(r"\s{2,}", " ", text)
    return text.rstrip()


def comparable_text(text: str) -> str:
    return re.sub(r"\s+", "", text).strip().lower()


def sanitize_source(text: str, title: str) -> str:
    text = remove_front_matter(text)
    lines = text.splitlines()
    cleaned: list[str] = []
    in_mdx_component = False

    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()

        if in_mdx_component:
            if MDX_COMPONENT_END_RE.match(stripped):
                in_mdx_component = False
            continue

        if not stripped:
            if cleaned and cleaned[-1] != "":
                cleaned.append("")
            continue

        if STOP_HEADING_RE.match(stripped):
            break

        if MDX_COMPONENT_START_RE.match(stripped):
            in_mdx_component = True
            continue

        if MDX_SINGLE_LINE_RE.match(stripped):
            continue

        if stripped.startswith("<") and stripped.endswith(">"):
            continue

        if AI_NOTICE_RE.search(stripped):
            continue

        if stripped in {"---", "***"}:
            continue

        if stripped.startswith("AIGC:") or stripped.startswith("Label:"):
            continue

        if any(
            stripped.startswith(prefix)
            for prefix in (
                "ContentProducer:",
                "ProduceID:",
                "ReservedCode1:",
                "ContentPropagator:",
                "PropagateID:",
                "ReservedCode2:",
            )
        ):
            continue

        if MARKDOWN_IMAGE_RE.search(stripped):
            continue

        line = clean_inline_markup(line)
        stripped = line.strip()

        if not stripped:
            if cleaned and cleaned[-1] != "":
                cleaned.append("")
            continue

        if comparable_text(stripped.lstrip("# ").strip()) == comparable_text(title):
            continue

        cleaned.append(line)

    body = "\n".join(cleaned).strip()
    body = re.sub(r"\n{3,}", "\n\n", body)
    return f"> 注：本篇文章有 AI 参与创作。\n\n{body}\n"


def build_excerpt(markdown: str) -> str:
    text = markdown
    text = re.sub(r"(?m)^>\s*注：本篇文章有 AI 参与创作。\s*$", "", text)
    text = MARKDOWN_IMAGE_RE.sub("", text)
    text = re.sub(r"(?m)^>\s*", "", text)
    text = re.sub(r"(?m)^#{1,6}\s*", "", text)
    text = re.sub(r"[*_`>-]", " ", text)
    text = re.sub(r"\|", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= 140:
        return text
    return text[:140].rstrip("，。、；：,. ") + "..."


def markdown_to_html(markdown: str) -> str:
    return pypandoc.convert_text(
        markdown,
        "html5",
        format="md",
        extra_args=["--wrap=none", "--mathml"],
    ).strip()


def load_manifest() -> list[dict]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def update_manifest(items: list[dict]) -> None:
    existing = load_manifest()
    managed_slugs = {work.slug for work in AI_WORKS}
    remaining = [item for item in existing if item.get("slug") not in managed_slugs]
    merged = remaining + items
    merged.sort(key=lambda item: (item.get("category", ""), item.get("title", "")))
    MANIFEST_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def import_ai_projects() -> None:
    WORKS_DIR.mkdir(parents=True, exist_ok=True)
    manifest_items: list[dict] = []

    for work in AI_WORKS:
        source_path = AI_PROJECTS_DIR / work.source
        raw_text = source_path.read_text(encoding="utf-8")
        markdown = sanitize_source(raw_text, work.title)
        html = markdown_to_html(markdown)

        target_path = WORKS_DIR / f"{work.slug}.html"
        target_path.write_text(html + "\n", encoding="utf-8")

        manifest_items.append(
            {
                "slug": work.slug,
                "title": work.title,
                "category": work.category,
                "section": work.section,
                "year": work.year,
                "excerpt": build_excerpt(markdown),
                "imageCount": 0,
            }
        )

    update_manifest(manifest_items)
    print(f"Imported {len(manifest_items)} AI-assisted articles.")


if __name__ == "__main__":
    import_ai_projects()
