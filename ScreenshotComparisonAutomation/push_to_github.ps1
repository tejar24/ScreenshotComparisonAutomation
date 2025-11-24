<#
Helper PowerShell script to prepare the `ScreenshotComparisonAutomation` repo locally,
copy your two existing project folders into it, initialize git, and push to GitHub.

It will:
- Ask for the paths to the two source folders (pre-filled with likely paths from your workspace).
- Copy them (recursively) into this repo folder (won't delete originals).
- `git init`, `git add .`, `git commit -m "Initial import"`.
- Offer to create a remote with `gh repo create` (if `gh` is available and you are authenticated), or ask for a remote URL and push.

Run from PowerShell:
  cd C:\Users\tejar\Demo\ScreenshotComparisonAutomation
  .\push_to_github.ps1

Requires: Git installed. Optional: GitHub CLI `gh` for easier repo creation.
#>

Param()

function Read-Choice($prompt, $default) {
    $val = Read-Host "$prompt [$default]"
    if ([string]::IsNullOrWhiteSpace($val)) { return $default }
    return $val
}

$repoDir = (Get-Location).ProviderPath

Write-Host "Preparing repository folder: $repoDir"


$defaultSrc1 = 'C:\Users\tejar\Downloads\ImageComparator\ImageComparator'
$defaultSrc2 = 'C:\Users\tejar\Demo\ScreenshotComparisonProject\ImageComparison'
$defaultSrc3 = 'C:\Users\tejar\Demo\Demo'

$src1 = Read-Choice "Path to ImageComparator folder" $defaultSrc1
$src2 = Read-Choice "Path to ScreenshotComparisonProject/ImageComparison folder" $defaultSrc2
$src3 = Read-Choice "Path to Demo folder to include (optional)" $defaultSrc3

if (-not (Test-Path $src1)) { Write-Warning "Source1 not found: $src1" }
if (-not (Test-Path $src2)) { Write-Warning "Source2 not found: $src2" }

Write-Host "Copying folders into repo (will overwrite existing files inside repo if present)..."
try {
    Copy-Item -Path $src1 -Destination (Join-Path $repoDir 'ImageComparator') -Recurse -Force -ErrorAction Stop
    Copy-Item -Path $src2 -Destination (Join-Path $repoDir 'ScreenshotComparisonProject\ImageComparison') -Recurse -Force -ErrorAction Stop
    if (-not [string]::IsNullOrWhiteSpace($src3) -and (Test-Path $src3)) {
        Copy-Item -Path $src3 -Destination (Join-Path $repoDir 'Demo') -Recurse -Force -ErrorAction Stop
    } elseif (-not [string]::IsNullOrWhiteSpace($src3)) {
        Write-Warning "Demo path provided but not found: $src3"
    }
} catch {
    Write-Error "Copy failed: $_"
    exit 2
}

Write-Host "Initializing git repository (if not already initialized)"
if (-not (Test-Path (Join-Path $repoDir '.git'))) {
    git init | Out-Null
}

git add .
git commit -m "Initial import: ImageComparator, ScreenshotComparisonProject, and Demo (if provided)" 2>$null

$useGh = $false
try { gh --version > $null; $useGh = $true } catch {}

$repoName = Read-Choice "GitHub repo name (owner/repo or repo name)" 'ScreenshotComparisonAutomation'

if ($useGh) {
    Write-Host "GitHub CLI detected. Creating remote repo with gh..."
    # If user enters owner/repo, gh will use that; otherwise it creates under your account
    try {
        gh repo create $repoName --public --source=. --remote=origin --push
        Write-Host "Created and pushed to GitHub via gh. Done."
        exit 0
    } catch {
        Write-Warning "gh create failed: $_. Falling back to manual remote setup."
    }
}

$remoteUrl = Read-Host "Enter git remote URL (e.g. https://github.com/youruser/ScreenshotComparisonAutomation.git)"
if (-not [string]::IsNullOrWhiteSpace($remoteUrl)) {
    try {
        git remote remove origin 2>$null
    } catch {}
    git remote add origin $remoteUrl
    git branch -M main
    git push -u origin main
    Write-Host "Pushed to $remoteUrl"
} else {
    Write-Host "No remote URL provided. Repository is ready locally at: $repoDir"
}

Write-Host "All done. If you provided a remote URL or used gh, your repo should be on GitHub now."