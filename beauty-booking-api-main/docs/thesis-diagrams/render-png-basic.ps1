# Compatibility entry point. Full browser SVG rasterization preserves UML glyphs.
& node (Join-Path $PSScriptRoot 'scripts/render.cjs')
exit $LASTEXITCODE
