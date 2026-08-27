from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE = (
    PROJECT_ROOT
    / "assets"
    / "images"
    / "special-cards"
    / "characters"
    / "observer_will_reference"
    / "observer_will_turnaround.png"
)
OUTPUT_DIR = (
    PROJECT_ROOT
    / "assets"
    / "models"
    / "special-cards"
    / "characters"
    / "observer_will_hq"
    / "textures"
)


def connected_background_alpha(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    gray = rgb.convert("L")
    width, height = rgb.size
    pixels = rgb.load()
    values = gray.load()
    outside = bytearray(width * height)
    queue: deque[int] = deque()

    def is_background(x: int, y: int) -> bool:
        red, green, blue = pixels[x, y]
        neutral = max(red, green, blue) - min(red, green, blue) < 28
        return values[x, y] >= 168 and neutral

    def seed(x: int, y: int) -> None:
        index = y * width + x
        if not outside[index] and is_background(x, y):
            outside[index] = 1
            queue.append(index)

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

    while queue:
        index = queue.popleft()
        x = index % width
        y = index // width
        for adjacent in (
            index + 1 if x + 1 < width else -1,
            index - 1 if x > 0 else -1,
            index + width if y + 1 < height else -1,
            index - width if y > 0 else -1,
        ):
            if adjacent < 0 or outside[adjacent]:
                continue
            adjacent_x = adjacent % width
            adjacent_y = adjacent // width
            if is_background(adjacent_x, adjacent_y):
                outside[adjacent] = 1
                queue.append(adjacent)

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        for x in range(width):
            if outside[y * width + x]:
                alpha_pixels[x, y] = 0

    # Preserve interior highlights such as the eye and stones while softening only the silhouette.
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.7))
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    result_pixels = result.load()
    alpha_pixels = alpha.load()
    for y in range(height):
        for x in range(width):
            amount = alpha_pixels[x, y]
            if 0 < amount < 250:
                red, green, blue, _ = result_pixels[x, y]
                factor = amount / 255.0
                result_pixels[x, y] = (
                    int(red * factor),
                    int(green * factor),
                    int(blue * factor),
                    amount,
                )
    return result


def keep_main_silhouette(image: Image.Image) -> Image.Image:
    """Remove pieces of neighboring turnaround views that enter a panel."""
    alpha = image.getchannel("A")
    width, height = image.size
    values = alpha.load()
    visited = bytearray(width * height)
    components: list[list[int]] = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or values[x, y] < 24:
                continue
            visited[index] = 1
            queue: deque[int] = deque([index])
            component: list[int] = []
            while queue:
                current = queue.popleft()
                component.append(current)
                current_x = current % width
                current_y = current // width
                for adjacent in (
                    current + 1 if current_x + 1 < width else -1,
                    current - 1 if current_x > 0 else -1,
                    current + width if current_y + 1 < height else -1,
                    current - width if current_y > 0 else -1,
                ):
                    if adjacent < 0 or visited[adjacent]:
                        continue
                    adjacent_x = adjacent % width
                    adjacent_y = adjacent // width
                    if values[adjacent_x, adjacent_y] >= 24:
                        visited[adjacent] = 1
                        queue.append(adjacent)
            components.append(component)

    if not components:
        return image
    main = set(max(components, key=len))
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            if y * width + x not in main:
                red, green, blue, _ = pixels[x, y]
                pixels[x, y] = (red, green, blue, 0)
    return image


def extract_view(source: Image.Image, x0: int, x1: int, output_name: str) -> Path:
    panel = source.crop((x0, 0, x1, min(source.height, 950)))
    gray = panel.convert("L")
    dark_mask = gray.point(lambda value: 255 if value < 145 else 0)
    bounds = dark_mask.getbbox()
    if bounds is None:
        raise RuntimeError(f"No character pixels found for {output_name}")
    left, top, right, bottom = bounds
    padding = 18
    crop_box = (
        max(0, left - padding),
        max(0, top - padding),
        min(panel.width, right + padding),
        min(panel.height, bottom + padding),
    )
    cutout = keep_main_silhouette(connected_background_alpha(panel.crop(crop_box)))
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    cutout.thumbnail((900, 960), Image.Resampling.LANCZOS)
    position = ((1024 - cutout.width) // 2, 1024 - cutout.height - 24)
    canvas.alpha_composite(cutout, position)
    output_path = OUTPUT_DIR / output_name
    canvas.save(output_path)
    return output_path


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    # The turnaround is laid out as three equal 512 px panels. Keep the
    # neighboring views out of each crop so detached hands and hems are not
    # mistaken for part of the active silhouette.
    panel_width = source.width // 3
    front = extract_view(source, 0, panel_width, "observer_will_front.png")
    side = extract_view(source, panel_width, panel_width * 2, "observer_will_side.png")
    back = extract_view(source, panel_width * 2, source.width, "observer_will_back.png")
    print(f"FRONT={front}")
    print(f"SIDE={side}")
    print(f"BACK={back}")


if __name__ == "__main__":
    main()
