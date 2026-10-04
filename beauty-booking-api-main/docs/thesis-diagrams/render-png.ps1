# Compatibility entry point. Archived renderer is not used.
& node (Join-Path $PSScriptRoot 'scripts/render.cjs')
exit $LASTEXITCODE
