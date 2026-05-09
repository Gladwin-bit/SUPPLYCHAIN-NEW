from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFont


def _pick_font(candidates: list[str], size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for fp in candidates:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                pass
    return ImageFont.load_default()


def main() -> None:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    icon_path = os.path.join(root, "assets", "icon.png")
    out_path = os.path.join(root, "assets", "splash.png")

    if not os.path.exists(icon_path):
        raise SystemExit(f"Missing icon at {icon_path}")

    # A tall canvas; Expo will scale/crop as needed per device.
    W, H = 1242, 2208
    bg = (10, 10, 15, 255)  # #0a0a0f

    base = Image.new("RGBA", (W, H), bg)
    icon = Image.open(icon_path).convert("RGBA")

    # Fit icon into a reasonable box.
    max_icon = 520
    scale = min(max_icon / icon.width, max_icon / icon.height)
    icon2 = icon.resize((int(icon.width * scale), int(icon.height * scale)), Image.LANCZOS)

    # Position icon slightly above center.
    ix = (W - icon2.width) // 2
    iy = int(H * 0.38) - (icon2.height // 2)
    base.alpha_composite(icon2, (ix, iy))

    draw = ImageDraw.Draw(base)

    title = "Thread Proof"
    subtitle = "Blockchain Verification"

    title_font = _pick_font(
        [
            r"C:\Windows\Fonts\segoeuib.ttf",
            r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arialbd.ttf",
        ],
        92,
    )
    sub_font = _pick_font(
        [
            r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arial.ttf",
        ],
        44,
    )

    white = (240, 240, 240, 255)
    blue_glow = (59, 130, 246, 90)  # subtle glow matching icon vibe
    muted = (160, 160, 176, 210)

    def draw_centered(y: int, s: str, font, fill):
        bb = draw.textbbox((0, 0), s, font=font)
        w = bb[2] - bb[0]
        x = (W - w) // 2
        draw.text((x, y), s, font=font, fill=fill)
        return bb, x

    # Title with subtle glow.
    title_y = iy + icon2.height + 70
    bb = draw.textbbox((0, 0), title, font=title_font)
    tw = bb[2] - bb[0]
    tx = (W - tw) // 2
    for dx, dy in [(-2, 0), (2, 0), (0, -2), (0, 2), (-2, -2), (2, 2), (-2, 2), (2, -2)]:
        draw.text((tx + dx, title_y + dy), title, font=title_font, fill=blue_glow)
    draw.text((tx, title_y), title, font=title_font, fill=white)

    # Subtitle.
    sub_y = title_y + (bb[3] - bb[1]) + 26
    draw_centered(sub_y, subtitle, sub_font, muted)

    base.convert("RGB").save(out_path, "PNG", optimize=True)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()

