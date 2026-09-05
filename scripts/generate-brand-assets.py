#!/usr/bin/env python3
"""Generate Pundi V3.2 web, Android, and Windows icon assets.

The only logo input is the owner-approved white logogram. The output icons use
that mark without a wordmark and keep a dark blue/blue-gradient surround.
"""
from base64 import b64encode
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "icons" / "pundi-approved-mark-light.png"
WEB = ROOT / "public" / "icons"
DESKTOP = ROOT / "desktop"
ANDROID = ROOT / "android" / "app" / "src" / "main" / "res"

TOP = (13, 27, 61, 255)
BOTTOM = (16, 146, 255, 255)
LOGO_FRACTION = 0.68


def source_mark() -> Image.Image:
    image = Image.open(SOURCE).convert("RGBA")
    box = image.getchannel("A").getbbox()
    if not box:
        raise RuntimeError(f"Approved mark has no visible alpha: {SOURCE}")
    return image.crop(box)


def logo_layer(size: int, fraction: float = LOGO_FRACTION) -> Image.Image:
    mark = source_mark()
    height = max(1, round(size * fraction))
    width = max(1, round(mark.width * height / mark.height))
    mark = mark.resize((width, height), Image.Resampling.LANCZOS)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    layer.alpha_composite(mark, ((size - width) // 2, (size - height) // 2))
    return layer


def gradient(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), TOP)
    draw = ImageDraw.Draw(image)
    for y in range(size):
        ratio = y / max(1, size - 1)
        color = tuple(round(TOP[i] * (1 - ratio) + BOTTOM[i] * ratio) for i in range(4))
        draw.line((0, y, size, y), fill=color)
    return image


def app_icon(size: int) -> Image.Image:
    return Image.alpha_composite(gradient(size), logo_layer(size))


def transparent_icon(size: int) -> Image.Image:
    return logo_layer(size)


def write_png(path: Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def main() -> None:
    WEB.mkdir(parents=True, exist_ok=True)
    DESKTOP.mkdir(parents=True, exist_ok=True)

    icon_1024 = app_icon(1024)
    write_png(WEB / "pundi-app-icon-1024.png", icon_1024)
    write_png(WEB / "icon-192.png", icon_1024.resize((192, 192), Image.Resampling.LANCZOS))
    icon_512 = icon_1024.resize((512, 512), Image.Resampling.LANCZOS)
    write_png(WEB / "icon-512.png", icon_512)

    # A self-contained favicon SVG avoids old external/wordmark references.
    encoded = b64encode((WEB / "icon-512.png").read_bytes()).decode("ascii")
    (WEB / "icon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Pundi logogram">'
        f'<image width="512" height="512" href="data:image/png;base64,{encoded}"/></svg>\n',
        encoding="utf-8",
    )

    # Transparent adaptive foreground; the adaptive background is the Pundi navy.
    write_png(ANDROID / "drawable" / "pundi_icon.png", transparent_icon(1024))
    density_sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for density, size in density_sizes.items():
        write_png(ANDROID / f"mipmap-{density}" / "ic_launcher.png", app_icon(size))
        write_png(ANDROID / f"mipmap-{density}" / "ic_launcher_round.png", app_icon(size))
        write_png(ANDROID / f"mipmap-{density}" / "ic_launcher_foreground.png", transparent_icon(size))

    icon_1024.save(
        WEB / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    icon_1024.save(
        DESKTOP / "pundi.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print("Generated Pundi V3.2 icon assets from", SOURCE)
    print("Web: icon.svg, icon-192.png, icon-512.png, pundi-app-icon-1024.png")
    print("Android: adaptive drawable/pundi_icon.png plus mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi")
    print("Windows: desktop/pundi.ico (16, 24, 32, 48, 64, 128, 256 px)")


if __name__ == "__main__":
    main()
