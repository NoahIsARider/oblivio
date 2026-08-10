from __future__ import annotations

import json
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote

import pypandoc
import win32com.client as win32


ROOT = Path(__file__).resolve().parents[1]
WORKS_DIR = ROOT / "content" / "works"
ASSETS_DIR = ROOT / "assets" / "works"
MANIFEST_PATH = ROOT / "content" / "works-manifest.json"
TMP_DIR = ROOT / "temp_doc_import"

SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
SENSITIVE_LINE_PATTERNS = [
    r"学号",
    r"学生姓名",
    r"学生签名",
    r"课程名称",
    r"课程报告",
    r"课程论文",
    r"课\s*程\s*论\s*文",
    r"课程实验",
    r"最终报告",
    r"任课教师",
    r"提交日期",
    r"开课学期",
    r"学\s*院",
    r"软件学院",
    r"专业班级",
    r"学生专业",
    r"班级名单序号",
    r"座位编号",
    r"成绩评定",
    r"通识教育课程作业",
    r"202330\d+",
    r"2023\d{8,}",
    r"华南理工",
    r"禁止chatgpt代写",
    r"提交至邮箱",
]
SENSITIVE_LINE_RE = re.compile("|".join(SENSITIVE_LINE_PATTERNS))
TOC_LINE_RE = re.compile(r"^\[.*\]\(#.*\)$")
IMAGE_RE = re.compile(r"!\[(?P<alt>[^\]]*)\]\((?P<path>[^)]+)\)(?P<attrs>\{[^}]*\})?")
HTML_IMAGE_RE = re.compile(r'<img\b(?P<before>[^>]*?)src="(?P<src>[^"]+)"(?P<after>[^>]*)>', re.IGNORECASE)


@dataclass(frozen=True)
class WorkConfig:
    source: str
    slug: str
    title: str
    category: str
    year: str
    start_regex: str | None = None
    start_after_line: int = 1
    exclude: bool = False
    note: str = ""


WORKS: list[WorkConfig] = [
    WorkConfig("pages/content/sources/douban-review-first-name.md", "first-person-with-a-name", "第一个拥有自己名字的人", "essay", "2024"),
    WorkConfig("非学业相关/virgin背后的哲学.docx", "virgin-philosophy", "《Virgin》背后的哲学探究", "essay", "2025"),
    WorkConfig("非学业相关/入党申请.docx", "party-application", "入党申请书", "excluded", "2023", exclude=True, note="private"),
    WorkConfig("非学业相关/多次囚徒博弈游戏思考.docx", "iterated-prisoners-dilemma", "多次囚徒博弈游戏思考", "essay", "2024"),
    WorkConfig("非学业相关/当我们在剖析婚姻的时候我们在剖析什么.docx", "marriage-analysis", "当我们在剖析婚姻的时候，我们在剖析什么", "essay", "2024"),
    WorkConfig("非学业相关/数模论文.docx", "math-modeling-paper", "数模论文", "excluded", "2024", exclude=True, note="unfinished template"),
    WorkConfig("非学业相关/有关时间旅行的故事.docx", "time-travel-letter", "有关时间旅行的故事", "essay", "2024"),
    WorkConfig("非学业相关/风险控制下基于蒙特卡洛模拟与博弈论均衡的比赛顺序决策模型(13).docx", "risk-controlled-match-ordering", "风险控制下的比赛顺序决策模型", "research", "2024", start_regex=r"^\*\*摘要\*\*"),
    WorkConfig("学业相关论文/MatchaFlow：多智能体软件项目管理模拟系统.docx", "matchaflow", "MatchaFlow：多智能体软件项目管理模拟系统", "project", "2025", start_regex=r"^\*\*1\. 项目背景\*\*$", start_after_line=20),
    WorkConfig("学业相关论文/PBL演讲稿.docx", "pbl-presentation-script", "PBL 演讲稿", "talk", "2024"),
    WorkConfig("学业相关论文/Self Introduction Pre.docx", "self-introduction-pre", "Self Introduction Pre", "talk", "2024"),
    WorkConfig("学业相关论文/The Philosophy of 45 Degrees of Life.docx", "philosophy-of-45-degrees-of-life", "The Philosophy of 45 Degrees of Life", "essay", "2024"),
    WorkConfig("学业相关论文/~$之国：1978-1997.docx", "locked-temp-file", "临时锁定文件", "excluded", "2024", exclude=True, note="temp lock file"),
    WorkConfig("学业相关论文/“觅母（文化复制因子）”对人际关系的影响以及一些可行的调适方案.doc", "meme-and-relationships", "“觅母（文化复制因子）”对人际关系的影响及调适方案", "research", "2024", start_regex=r"^\*\*摘要"),
    WorkConfig("学业相关论文/安踏战略分析报告构思.docx", "anta-strategy-bani-era", "世界水深火热，而我们还在买鞋", "research", "2025"),
    WorkConfig("学业相关论文/不要太期待世界末日.doc", "do-not-expect-the-end-of-the-world", "不要太期待世界末日", "essay", "2025", start_regex=r"^\*\*摘要"),
    WorkConfig("学业相关论文/光影之国：1978-1997.docx", "kingdom-of-light-and-shadow", "光影之国：1978-1997", "essay", "2024", start_regex=r"^\*\*摘要"),
    WorkConfig("学业相关论文/利用批判性阅读理解迈克尔·翁达杰的历史观.docx", "ondaatje-and-history", "利用批判性阅读理解迈克尔·翁达杰的历史观", "essay", "2024"),
    WorkConfig("学业相关论文/去中心化投资与对新经济体系的展望.doc", "decentralized-investment", "去中心化投资与对新经济体系的展望", "research", "2024", start_regex=r"^\*\*摘要"),
    WorkConfig("学业相关论文/无知之罪.doc", "sins-of-ignorance", "无知之罪：聚焦字节跳动的商业伦理分析", "research", "2025", start_regex=r"^\*\*摘要"),
    WorkConfig("学业相关论文/爱与孤寂的故事.docx", "love-and-solitude", "爱与孤寂的故事", "essay", "2024"),
    WorkConfig("学业相关论文/第四次科学革命语境下的中国特色社会主义.doc", "fourth-scientific-revolution", "第四次科学革命语境下的中国特色社会主义", "research", "2024", start_regex=r"^\*\*摘要"),
    WorkConfig("学业相关论文/经济学presentation.docx", "economics-presentation", "经济学 Presentation", "talk", "2024"),
    WorkConfig("学业相关论文/机械降神-基于感知、决策和执行的具身智能技术与发展调研报告.docx", "embodied-intelligence-survey", "机械降神：基于感知、决策和执行的具身智能技术与发展调研报告", "research", "2025", start_regex=r"^# 引言$"),
    WorkConfig("学业相关论文/营销学原理期末大作业 .docx", "tesla-marketing-strategy", "特斯拉纯电动车中国市场营销策略研究", "research", "2024", start_regex=r"^\*\*摘要"),
    WorkConfig("学业相关论文/西方戏剧分析-周方亚诺-202330422321.doc", "merchant-of-venice-analysis", "威尼斯商人：社会的去具身化运动", "essay", "2025", start_regex=r"^\*\*威尼斯商人：社会的去具身化运动\*\*$", start_after_line=20),
    WorkConfig("学业相关论文/软件体系架构课程实验-最终报告.docx", "edge-cloud-face-recognition", "端云协同架构下的人脸识别性能优化", "project", "2025", start_regex=r"^\*\*摘要\*\*$"),
    WorkConfig("学业相关论文/远方 远方更远处——从短期和长期看软件工程发展.docx", "software-engineering-farther-horizons", "远方，远方更远处", "essay", "2023", start_regex=r"^\*\*何为西东\*\*$"),
    WorkConfig("学业相关论文/针对科大讯飞股票的分析与投资建议.doc", "iflytek-stock-analysis", "针对科大讯飞股票的分析与投资建议", "research", "2024", start_regex=r"^\*\*摘要"),
]


def normalize(text: str) -> str:
    return re.sub(r"\s+", "", text).strip().lower()


def slug_sort_key(item: dict) -> tuple[str, str]:
    return item["category"], item["title"]


def to_source_path(config: WorkConfig) -> Path:
    return ROOT.parent / config.source


def convert_doc_to_docx(word_app, source_path: Path) -> tuple[Path, Path | None]:
    if source_path.suffix.lower() != ".doc":
        return source_path, None

    temp_root = Path(tempfile.mkdtemp(prefix="work-doc-", dir=TMP_DIR))
    temp_docx = temp_root / f"{source_path.stem}.docx"
    doc = word_app.Documents.Open(str(source_path), False, True)
    doc.SaveAs2(str(temp_docx), 16)
    doc.Close()
    return temp_docx, temp_root


def load_source_markdown(word_app, source_path: Path, slug: str) -> tuple[str, Path, Path | None]:
    suffix = source_path.suffix.lower()

    if suffix == ".md":
        return source_path.read_text(encoding="utf-8"), source_path.parent, None

    if suffix in {".doc", ".docx"}:
        media_dir = Path(tempfile.mkdtemp(prefix=f"{slug}-media-", dir=TMP_DIR))
        converted_path, convert_temp_dir = convert_doc_to_docx(word_app, source_path)
        raw_markdown = pypandoc.convert_file(
            str(converted_path),
            "markdown",
            extra_args=["--wrap=none", f"--extract-media={media_dir}"],
        )
        return raw_markdown, media_dir, convert_temp_dir

    raise ValueError(f"Unsupported source type: {source_path}")


def detect_start(lines: list[str], config: WorkConfig) -> int:
    if config.start_regex:
        pattern = re.compile(config.start_regex)
        for index, line in enumerate(lines):
            if index + 1 < config.start_after_line:
                continue
            if pattern.search(line):
                return index
    return 0


def is_sensitive_line(line: str) -> bool:
    return bool(SENSITIVE_LINE_RE.search(line))


def is_noise_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    if stripped in {"目录", "关键词", "标题"}:
        return True
    if stripped.startswith("# **目录**"):
        return True
    if TOC_LINE_RE.match(stripped):
        return True
    if stripped.startswith("> [") or stripped == ">":
        return True
    if stripped.startswith("|") or stripped.startswith("+:") or stripped.startswith("+-"):
        return True
    if stripped.startswith("[]{#") and stripped.endswith("}"):
        return True
    if stripped == "<!-- -->":
        return True
    if re.fullmatch(r"[-\s]+", stripped):
        return True
    return False


def clean_text_line(line: str) -> str:
    line = line.replace("------", " - ")
    line = line.replace("—", "-").replace("–", "-")
    line = re.sub(r"\s{2,}", " ", line)
    return line.strip()


def comparable_text(line: str) -> str:
    text = re.sub(r"^[#>\s]+", "", line).strip()
    text = re.sub(r"^\*\*|\*\*$", "", text)
    return normalize(text)


def resolve_image_path(source: str, media_dir: Path) -> Path | None:
    decoded = unquote(source).strip()
    if not decoded:
        return None

    image_path = Path(decoded)
    if not image_path.is_absolute():
        image_path = media_dir / image_path
    image_path = image_path.resolve()

    if not image_path.exists():
        return None
    if image_path.suffix.lower() not in SUPPORTED_IMAGE_EXTENSIONS:
        return None
    return image_path


def copy_image_asset(image_path: Path, slug: str, target_asset_dir: Path) -> str:
    target_asset_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_asset_dir / image_path.name
    if not target_path.exists():
        shutil.copy2(image_path, target_path)
    return f"../assets/works/{slug}/{target_path.name}"


def rewrite_markdown_images(line: str, slug: str, media_dir: Path, target_asset_dir: Path) -> tuple[str, int]:
    replaced = 0

    def swap(match: re.Match[str]) -> str:
        nonlocal replaced
        image_path = resolve_image_path(match.group("path"), media_dir)
        if not image_path:
            return match.group(0)

        replaced += 1
        alt = match.group("alt").strip()
        rel = copy_image_asset(image_path, slug, target_asset_dir)
        attrs = match.group("attrs") or ""
        return f"![{alt}]({rel}){attrs}"

    return IMAGE_RE.sub(swap, line), replaced


def rewrite_html_images(line: str, slug: str, media_dir: Path, target_asset_dir: Path) -> tuple[str, int]:
    replaced = 0

    def swap(match: re.Match[str]) -> str:
        nonlocal replaced
        image_path = resolve_image_path(match.group("src"), media_dir)
        if not image_path:
            return match.group(0)

        replaced += 1
        rel = copy_image_asset(image_path, slug, target_asset_dir)
        return f'<img{match.group("before")}src="{rel}"{match.group("after")}>'

    return HTML_IMAGE_RE.sub(swap, line), replaced


def sanitize_markdown(raw_markdown: str, config: WorkConfig, media_dir: Path) -> tuple[str, int]:
    lines = [line.rstrip() for line in raw_markdown.splitlines()]
    lines = [line for line in lines if line.strip()]
    start_index = detect_start(lines, config)
    working = lines[start_index:]
    asset_dir = ASSETS_DIR / config.slug
    if asset_dir.exists():
        shutil.rmtree(asset_dir)

    cleaned: list[str] = []
    image_count = 0

    for line in working:
        if is_noise_line(line):
            continue
        if is_sensitive_line(line):
            continue

        rewritten_html, html_image_count = rewrite_html_images(line, config.slug, media_dir, asset_dir)
        if html_image_count:
            cleaned.append(rewritten_html)
            image_count += html_image_count
            continue

        rewritten_markdown, markdown_image_count = rewrite_markdown_images(line, config.slug, media_dir, asset_dir)
        if markdown_image_count:
            normalized_markdown = re.sub(r"^\s*>\s+", "", rewritten_markdown)
            inline_index = normalized_markdown.find("![")
            if inline_index > 0:
                prefix = clean_text_line(normalized_markdown[:inline_index])
                if prefix:
                    cleaned.append(prefix)
                cleaned.append(normalized_markdown[inline_index:].lstrip())
            else:
                cleaned.append(normalized_markdown)
            image_count += markdown_image_count
            continue
        if IMAGE_RE.search(line):
            continue

        text = clean_text_line(line)
        if not text:
            continue
        if comparable_text(text) == normalize(config.title):
            continue
        cleaned.append(text)

    while cleaned and cleaned[0].startswith("**摘要"):
        break
    while cleaned and normalize(cleaned[0]) in {normalize("摘要"), normalize("引言"), normalize("Abstract")}:
        break

    markdown = "\n\n".join(cleaned).strip()
    return markdown, image_count


def markdown_to_html(markdown: str) -> str:
    html = pypandoc.convert_text(
        markdown,
        "html5",
        format="md",
        extra_args=["--wrap=none", "--mathml"],
    ).strip()
    return html.replace("—", "-").replace("–", "-")


def build_excerpt(markdown: str) -> str:
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", markdown)
    text = re.sub(r"<img[^>]*>", "", text)
    text = re.sub(r"(?m)^\s*#+\s*", "", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\[(.*?)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\[\^\d+\]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:140].rstrip("，。、；： ") + ("..." if len(text) > 140 else "")


def run() -> None:
    WORKS_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    manifest: list[dict] = []
    word_app = win32.Dispatch("Word.Application")
    word_app.Visible = False
    word_app.DisplayAlerts = 0

    try:
        for config in WORKS:
            if config.exclude:
                continue

            source_path = to_source_path(config)
            convert_temp_dir: Path | None = None
            asset_source_dir: Path | None = None

            try:
                raw_markdown, asset_source_dir, convert_temp_dir = load_source_markdown(word_app, source_path, config.slug)
                cleaned_markdown, image_count = sanitize_markdown(raw_markdown, config, asset_source_dir)
                html = markdown_to_html(cleaned_markdown)
                excerpt = build_excerpt(cleaned_markdown)

                fragment_path = WORKS_DIR / f"{config.slug}.html"
                fragment_path.write_text(html + "\n", encoding="utf-8")

                manifest.append(
                    {
                        "slug": config.slug,
                        "title": config.title,
                        "category": config.category,
                        "year": config.year,
                        "excerpt": excerpt,
                        "imageCount": image_count,
                    }
                )
            finally:
                if asset_source_dir and asset_source_dir.is_relative_to(TMP_DIR):
                    shutil.rmtree(asset_source_dir, ignore_errors=True)
                if convert_temp_dir:
                    shutil.rmtree(convert_temp_dir, ignore_errors=True)
    finally:
        word_app.Quit()

    manifest.sort(key=slug_sort_key)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(manifest)} works.")


if __name__ == "__main__":
    run()
