#!/usr/bin/env python3
"""
Generate favicon and app icons from SVG source
Requires: pip install cairosvg pillow
"""

import os
from io import BytesIO

try:
    import cairosvg
    from PIL import Image
except ImportError:
    print("Installing required packages...")
    os.system("pip3 install cairosvg pillow")
    import cairosvg
    from PIL import Image

# Icon sizes needed
SIZES = {
    'favicon-16x16.png': 16,
    'favicon-32x32.png': 32,
    'apple-touch-icon.png': 180,
    'android-chrome-192x192.png': 192,
    'android-chrome-512x512.png': 512,
}

def generate_png_from_svg(svg_path, output_path, size):
    """Convert SVG to PNG at specified size"""
    png_data = cairosvg.svg2png(
        url=svg_path,
        output_width=size,
        output_height=size
    )

    with open(output_path, 'wb') as f:
        f.write(png_data)

    print(f"✓ Generated {output_path} ({size}x{size})")

def generate_ico(png_16_path, png_32_path, output_path):
    """Generate .ico file from 16x16 and 32x32 PNGs"""
    img_16 = Image.open(png_16_path)
    img_32 = Image.open(png_32_path)

    img_16.save(
        output_path,
        format='ICO',
        sizes=[(16, 16), (32, 32)],
        append_images=[img_32]
    )

    print(f"✓ Generated {output_path}")

def main():
    svg_path = 'icon.svg'

    if not os.path.exists(svg_path):
        print(f"Error: {svg_path} not found!")
        return

    print("Generating icons...")

    # Generate PNG files
    for filename, size in SIZES.items():
        generate_png_from_svg(svg_path, filename, size)

    # Generate favicon.ico
    generate_ico('favicon-16x16.png', 'favicon-32x32.png', 'favicon.ico')

    print("\n✅ All icons generated successfully!")
    print("\nGenerated files:")
    for filename in SIZES.keys():
        print(f"  - {filename}")
    print("  - favicon.ico")

if __name__ == '__main__':
    main()
