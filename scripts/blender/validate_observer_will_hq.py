import json
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = (
    PROJECT_ROOT
    / "assets"
    / "models"
    / "special-cards"
    / "characters"
    / "observer_will_hq"
)
REPORT_PATH = MODEL_DIR / "observer_will_hq-validation.json"


def score_view(view: str) -> dict[str, float]:
    reference = Image.open(MODEL_DIR / "textures" / f"observer_will_{view}.png").convert("RGBA")
    rendered = Image.open(MODEL_DIR / f"observer_will_hq-{view}.png").convert("RGBA")
    reference_mask = reference.getchannel("A").point(lambda value: 255 if value > 24 else 0)
    rendered_mask = rendered.getchannel("A").point(lambda value: 255 if value > 24 else 0)
    intersection = ImageChops.multiply(reference_mask, rendered_mask)
    union = ImageChops.lighter(reference_mask, rendered_mask)
    intersection_area = sum(intersection.histogram()[1:])
    union_area = sum(union.histogram()[1:])
    silhouette = intersection_area / union_area

    difference = ImageChops.difference(reference.convert("RGB"), rendered.convert("RGB"))
    mean_difference = sum(ImageStat.Stat(difference, intersection).mean) / 3
    color_detail = 1.0 - mean_difference / 255.0
    combined = silhouette * 0.55 + color_detail * 0.45
    return {
        "silhouette_percent": round(silhouette * 100, 2),
        "color_detail_percent": round(color_detail * 100, 2),
        "combined_percent": round(combined * 100, 2),
    }


def main() -> dict:
    scores = {view: score_view(view) for view in ("front", "side", "back")}
    minimum = min(score["combined_percent"] for score in scores.values())
    report = {
        "target_percent": 90.0,
        "minimum_combined_percent": minimum,
        "passed": minimum >= 90.0,
        "views": scores,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    return report


if __name__ == "__main__":
    main()
