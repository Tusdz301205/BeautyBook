param([string]$DocxPath,[string]$PdfPath)
$ErrorActionPreference = 'Stop'
$word = $null
$document = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.AutomationSecurity = 3
  $document = $word.Documents.Open($DocxPath, $false, $false)
  [void]$document.Fields.Update()
  foreach ($toc in $document.TablesOfContents) { $toc.Update() }
  foreach ($figures in $document.TablesOfFigures) { $figures.Update() }
  $document.Repaginate()
  [void]$document.Fields.Update()
  foreach ($toc in $document.TablesOfContents) { $toc.Update() }
  $document.Save()
  $document.ExportAsFixedFormat($PdfPath, 17)
  Write-Output ('Pages: ' + $document.ComputeStatistics(2))
} finally {
  if ($document) { $document.Close($false); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) }
  if ($word) { $word.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
}
