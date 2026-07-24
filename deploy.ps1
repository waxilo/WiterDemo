<#
.SYNOPSIS
  One-click deploy: deploy the backend to Cloudflare Workers, then commit and
  push the frontend (which triggers the Pages GitHub Actions deploy).

.DESCRIPTION
  Steps:
    1. Backend: apply remote D1 migrations (create/update tables) + wrangler deploy
    2. Frontend: git commit and push -> triggers .github/workflows/deploy-web.yml

.PARAMETER Message
  Frontend commit message. Defaults to a timestamped message.

.PARAMETER SkipBackend
  Skip backend deployment.

.PARAMETER SkipMigrate
  Skip the remote DB migration (still runs wrangler deploy).

.PARAMETER SkipCommit
  Skip the frontend commit/push.

.EXAMPLE
  ./deploy.ps1
  ./deploy.ps1 -Message "feat: add chapter sorting"
  ./deploy.ps1 -SkipBackend
  ./deploy.ps1 -SkipMigrate
#>
param(
  [string]$Message = "chore: deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
  [switch]$SkipBackend,
  [switch]$SkipMigrate,
  [switch]$SkipCommit
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backend = Join-Path $root "back-end"

function Info($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }

# ---------------------------------------------------------------------------
# 1. Backend: remote migration + deploy
# ---------------------------------------------------------------------------
if (-not $SkipBackend) {
  Push-Location $backend
  try {
    if (-not $SkipMigrate) {
      Info "Backend: applying remote D1 migrations (writer-demo)"
      # Pipe input so wrangler auto-confirms in non-interactive mode.
      "y" | npx wrangler d1 migrations apply writer-demo --remote
      if ($LASTEXITCODE -ne 0) { throw "Remote migration failed (exit $LASTEXITCODE)" }
      Ok "Migrations applied"
    }
    else {
      Info "Skipping remote migration (-SkipMigrate)"
    }

    Info "Backend: deploying Worker (wrangler deploy)"
    npx wrangler deploy
    if ($LASTEXITCODE -ne 0) { throw "Worker deploy failed (exit $LASTEXITCODE)" }
    Ok "Backend deployed -> https://api.waxilo2024.workers.dev"
  }
  finally {
    Pop-Location
  }
}
else {
  Info "Skipping backend deploy (-SkipBackend)"
}

# ---------------------------------------------------------------------------
# 2. Frontend: commit and push (push triggers the Pages GitHub Actions deploy)
# ---------------------------------------------------------------------------
if (-not $SkipCommit) {
  Push-Location $root
  try {
    Info "Frontend: staging changes (front-end/)"
    git add front-end

    # If nothing is staged, skip the commit.
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
      Ok "No frontend changes to commit, skipping"
    }
    else {
      Info "Frontend: committing and pushing ($Message)"
      git commit -m $Message
      if ($LASTEXITCODE -ne 0) { throw "git commit failed (exit $LASTEXITCODE)" }
      git push origin main
      if ($LASTEXITCODE -ne 0) { throw "git push failed (exit $LASTEXITCODE)" }
      Ok "Pushed to main -> Pages deploy triggered (see GitHub Actions)"
    }
  }
  finally {
    Pop-Location
  }
}
else {
  Info "Skipping frontend commit (-SkipCommit)"
}

Info "Done"
Write-Host "Backend API : https://api.waxilo2024.workers.dev" -ForegroundColor Yellow
Write-Host "Frontend    : https://writer-demo-web.pages.dev (deployed by GitHub Actions, allow a moment)" -ForegroundColor Yellow
