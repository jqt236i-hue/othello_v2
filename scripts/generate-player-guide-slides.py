from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, JpegImagePlugin  # noqa: F401


ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = ROOT / "artifacts" / "player-guide"
ASSET_DIR = ROOT / "assets" / "images" / "help" / "player-guide"
WORKER_ASSET_DIR = ROOT / "worker-public" / "assets" / "images" / "help" / "player-guide"
PDF_PATH = ARTIFACT_DIR / "card-reversi-player-guide.pdf"
W, H = 1920, 1080

FONT_REGULAR = Path("C:/Windows/Fonts/meiryo.ttc")
FONT_BOLD = Path("C:/Windows/Fonts/meiryob.ttc")


COLORS = {
    "bg": (247, 243, 231),
    "ink": (32, 55, 51),
    "muted": (86, 104, 99),
    "teal": (27, 104, 86),
    "gold": (199, 151, 61),
    "red": (180, 74, 65),
    "panel": (255, 251, 239),
    "line": (220, 198, 151),
    "green": (38, 115, 88),
    "dark": (30, 51, 45),
    "white": (238, 236, 226),
    "black": (24, 27, 28),
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size)


def text_width(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> int:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0]


def wrap_text(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for ch in text:
        trial = current + ch
        if current and text_width(draw, trial, fnt) > max_width:
            lines.append(current)
            current = ch
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.FreeTypeFont,
    max_width: int,
    fill=COLORS["ink"],
    line_gap: int = 12,
) -> int:
    x, y = xy
    for line in wrap_text(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + line_gap
    return y


def rounded(draw: ImageDraw.ImageDraw, box, radius=24, fill=None, outline=None, width=3):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def slide_base(page: int, title: str, subtitle: str = ""):
    img = Image.new("RGB", (W, H), COLORS["bg"])
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 18), fill=COLORS["teal"])
    d.text((104, 78), title, font=font(68, True), fill=COLORS["ink"])
    if subtitle:
        draw_wrapped(d, (108, 162), subtitle, font(36), 1320, fill=COLORS["muted"], line_gap=8)
    d.rounded_rectangle((104, 238, 430, 250), radius=5, fill=COLORS["gold"])
    d.text((1680, 988), f"{page} / 8", font=font(32, True), fill=COLORS["muted"])
    return img, d


def bullet_card(draw, box, number, heading, body, accent=COLORS["teal"]):
    x1, y1, x2, y2 = box
    rounded(draw, box, radius=28, fill=COLORS["panel"], outline=COLORS["line"], width=4)
    draw.rounded_rectangle((x1, y1, x1 + 18, y2), radius=9, fill=accent)
    draw.rounded_rectangle((x1 + 38, y1 + 34, x1 + 94, y1 + 90), radius=14, fill=accent)
    draw.text((x1 + 55, y1 + 42), str(number), font=font(28, True), fill=(255, 255, 250))
    draw.text((x1 + 120, y1 + 28), heading, font=font(44, True), fill=COLORS["ink"])
    draw_wrapped(draw, (x1 + 120, y1 + 96), body, font(38), x2 - x1 - 160, fill=COLORS["muted"], line_gap=8)


def big_note(draw, text, y=858):
    rounded(draw, (190, y, 1730, y + 118), radius=24, fill=(255, 248, 221), outline=(214, 171, 82), width=3)
    draw_wrapped(draw, (230, y + 28), text, font(38, True), 1460, fill=COLORS["ink"], line_gap=8)


def draw_board(draw, x, y, size=430, numbers=False, highlights=False):
    cell = size // 8
    draw.rectangle((x - 8, y - 8, x + size + 8, y + size + 8), fill=(92, 61, 30))
    draw.rectangle((x, y, x + size, y + size), fill=(39, 116, 88))
    for i in range(9):
        p = x + i * cell
        q = y + i * cell
        draw.line((p, y, p, y + size), fill=(23, 73, 60), width=3)
        draw.line((x, q, x + size, q), fill=(23, 73, 60), width=3)
    if numbers:
        vals = {(0, 0): "3", (1, 0): "7", (2, 0): "8", (4, 1): "2", (6, 1): "5", (7, 2): "4", (0, 5): "6", (3, 6): "10", (6, 6): "9"}
        for (cx, cy), val in vals.items():
            draw.text((x + cx * cell + 15, y + cy * cell + 9), val, font=font(32, True), fill=(232, 215, 143))
    if highlights:
        for cx, cy in [(2, 3), (3, 2), (4, 5), (5, 4)]:
            draw.rectangle((x + cx * cell + 5, y + cy * cell + 5, x + (cx + 1) * cell - 5, y + (cy + 1) * cell - 5), fill=(88, 162, 122))
    discs = [((3, 3), COLORS["black"]), ((4, 4), COLORS["black"]), ((3, 4), COLORS["white"]), ((4, 3), COLORS["white"])]
    for (cx, cy), color in discs:
        draw.ellipse((x + cx * cell + 11, y + cy * cell + 11, x + (cx + 1) * cell - 11, y + (cy + 1) * cell - 11), fill=color, outline=(6, 20, 18), width=2)


def slide1():
    img, d = slide_base(1, "Card Reversi", "リバーシに、布石とカードの判断を足した対戦ゲーム。")
    d.text((116, 340), "まず覚えることは3つだけ", font=font(62, True), fill=COLORS["teal"])
    bullet_card(d, (120, 460, 600, 735), "1", "石を返す", "置けるマスに置き、相手石を自分の色へ")
    bullet_card(d, (720, 460, 1200, 735), "2", "布石を貯める", "反転や数字で増え、カードの燃料に")
    bullet_card(d, (1320, 460, 1800, 735), "3", "カードで動かす", "配置前に使い、守る・動かす・破壊で盤面を変える", COLORS["red"])
    big_note(d, "最初は「置ける場所」「布石の数」「手札」を見るだけで遊べます。")
    return img


def slide2():
    img, d = slide_base(2, "このゲームを一言で", "通常リバーシの直感はそのまま。布石とカードで逆転手段が増えます。")
    draw_board(d, 150, 382, 410, highlights=True)
    d.text((200, 820), "黒先手 / 白後手", font=font(33, True), fill=COLORS["muted"])
    bullet_card(d, (700, 330, 1720, 510), "1", "リバーシで石を増やす", "最後に石が多い側が勝利。読み合いは通常リバーシと同じ。")
    bullet_card(d, (700, 565, 1720, 745), "2", "布石をカードへ変える", "布石を貯めて、強いカードのコストにします。", COLORS["gold"])
    big_note(d, "悩んだら「今どこに置けるか」「次に何のカードを使えるか」を確認します。")
    return img


def slide3():
    img, d = slide_base(3, "盤面と数字マス", "数字マスは布石を増やす重要マス。高い数字ほどカードにつながります。")
    draw_board(d, 150, 330, 500, numbers=True, highlights=True)
    bullet_card(d, (760, 326, 1710, 500), "1", "8x8の盤面", "中央4石から開始。黒が先手です。")
    bullet_card(d, (760, 545, 1710, 720), "2", "数字分だけ布石を獲得", "数字マスに置くと、追加で布石が増えます。", COLORS["gold"])
    bullet_card(d, (760, 764, 1710, 938), "3", "数字は一度だけ", "使った数字は復活しません。危険なら無理に取らない。", COLORS["red"])
    return img


def slide4():
    img, d = slide_base(4, "1ターンの流れ", "カードは石を置く前に使うのが基本です。")
    steps = [
        ("1", "ターン開始", "継続効果や期限を処理"),
        ("2", "1枚ドロー", "山札から手札へ"),
        ("3", "カード使用", "任意。原則1ターン1枚"),
        ("4", "配置 / パス", "置けないときはパス"),
        ("5", "反転・効果", "石とカード効果を解決"),
        ("6", "布石獲得", "反転枚数や数字分を加算"),
    ]
    x0, y0 = 115, 345
    for i, (num, head, body) in enumerate(steps):
        col = i % 3
        row = i // 3
        x = x0 + col * 600
        y = y0 + row * 230
        bullet_card(d, (x, y, x + 500, y + 170), num, head, body, [COLORS["teal"], COLORS["gold"], COLORS["red"]][i % 3])
        if i not in (2, 5):
            d.text((x + 520, y + 60), ">", font=font(56, True), fill=COLORS["line"])
    big_note(d, "手札上限は5枚。使いにくいカードは破壊して手札を回す判断もあります。")
    return img


def slide5():
    img, d = slide_base(5, "布石はカードの燃料", "貯めるほど強いカードが使えます。ただし上限は99です。")
    rounded(d, (130, 355, 690, 765), radius=34, fill=COLORS["dark"], outline=COLORS["line"], width=4)
    d.text((250, 435), "布石", font=font(62, True), fill=(255, 248, 225))
    d.text((245, 535), "0 - 99", font=font(90, True), fill=(255, 214, 103))
    d.text((224, 670), "カード使用時に消費", font=font(38, True), fill=(255, 248, 225))
    bullet_card(d, (800, 325, 1715, 500), "1", "反転で増える", "返した枚数ぶん、すぐ布石を獲得します。")
    bullet_card(d, (800, 545, 1715, 720), "2", "数字マスで増える", "数字マスの値が、そのまま追加布石になります。", COLORS["gold"])
    bullet_card(d, (800, 765, 1715, 940), "3", "10ラウンドごとに加算", "10 / 20 / 30... の開始時にボーナスが入ります。", COLORS["red"])
    return img


def slide6():
    img, d = slide_base(6, "カードの使い方", "強いカードほど布石コストが重くなります。使うタイミングが勝負です。")
    cards = [
        ("COST 0", "宝箱", "布石を増やす。序盤の燃料づくり。", COLORS["teal"]),
        ("COST 1", "弱い意志", "次に置く石を一時的に守る。", COLORS["gold"]),
        ("COST 14", "自由の意志", "反転0でも1手だけ置ける。", COLORS["red"]),
        ("COST 23", "狙撃の意志", "重いが盤面を大きく崩せる。", (112, 75, 145)),
    ]
    for i, (cost, name, body, accent) in enumerate(cards):
        x = 120 + (i % 2) * 900
        y = 330 + (i // 2) * 265
        rounded(d, (x, y, x + 770, y + 210), radius=30, fill=COLORS["panel"], outline=COLORS["line"], width=4)
        d.rounded_rectangle((x + 36, y + 34, x + 210, y + 88), radius=14, fill=accent)
        d.text((x + 58, y + 44), cost, font=font(29, True), fill=(255, 255, 250))
        d.text((x + 250, y + 36), name, font=font(50, True), fill=COLORS["ink"])
        draw_wrapped(d, (x + 50, y + 112), body, font(42), 680, fill=COLORS["muted"], line_gap=8)
    big_note(d, "共通ルール: カードは配置前に使用。原則1ターン1枚です。")
    return img


def slide7():
    img, d = slide_base(7, "パス・終局・勝敗", "終局は「両者連続パス」。盤面が埋まるだけでは終わりとは限りません。")
    bullet_card(d, (135, 330, 760, 535), "1", "合法手がない", "置けるマスが0なら、カード使用かパスを選びます。")
    bullet_card(d, (135, 600, 760, 805), "2", "カードも使えない", "行動がなければパスになります。", COLORS["gold"])
    rounded(d, (900, 390, 1690, 760), radius=38, fill=COLORS["panel"], outline=COLORS["line"], width=4)
    d.text((1005, 455), "黒: パス", font=font(58, True), fill=COLORS["black"])
    d.text((1270, 455), ">", font=font(58, True), fill=COLORS["line"])
    d.text((1370, 455), "白: パス", font=font(58, True), fill=COLORS["teal"])
    d.text((1080, 595), "2連続パスで終局", font=font(58, True), fill=COLORS["red"])
    big_note(d, "最後に黒白の石数を比較。多い側が勝利、同数なら引き分けです。")
    return img


def slide8():
    img, d = slide_base(8, "はじめての対局で見るポイント", "細かい効果は遊びながら覚え、まずはこの4つで判断します。")
    items = [
        ("1", "角を急いで渡さない", "角の隣は、相手へ角を渡しやすい場所です。"),
        ("2", "数字マスは燃料", "高い数字は強いカードにつながります。"),
        ("3", "カードは置く前に考える", "合法手を増やす、守る、強い石を崩す。"),
        ("4", "手札5枚に注意", "手札が詰まると次のドローを失います。"),
    ]
    for i, (num, head, body) in enumerate(items):
        x = 120 + (i % 2) * 900
        y = 320 + (i // 2) * 245
        bullet_card(d, (x, y, x + 770, y + 185), num, head, body, [COLORS["teal"], COLORS["gold"], COLORS["red"], (112, 75, 145)][i])
    big_note(d, "慣れてきたら、相手の布石量と手札も見ます。次に使われそうなカードを読むと戦略性が増します。", 850)
    return img


SLIDES = [slide1, slide2, slide3, slide4, slide5, slide6, slide7, slide8]


def save_all() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    WORKER_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    rendered = []
    for i, make_slide in enumerate(SLIDES, start=1):
        img = make_slide()
        path = ARTIFACT_DIR / f"card-reversi-player-guide-slide-{i:02d}.png"
        img.save(path, optimize=True)
        shutil.copy2(path, ASSET_DIR / path.name)
        shutil.copy2(path, WORKER_ASSET_DIR / path.name)
        rendered.append(img.convert("RGB"))
    rendered[0].save(PDF_PATH, save_all=True, append_images=rendered[1:], resolution=144.0)
    preview = Image.new("RGB", (W * 2, H * 4), COLORS["bg"])
    for idx, img in enumerate(rendered):
        thumb = img.resize((W, H), Image.Resampling.LANCZOS)
        preview.paste(thumb, ((idx % 2) * W, (idx // 2) * H))
    preview.resize((1920, 2160), Image.Resampling.LANCZOS).save(ARTIFACT_DIR / "card-reversi-player-guide-preview.png", optimize=True)


if __name__ == "__main__":
    save_all()
