# ScreenshotComparisonAutomation

This repository is a container for your two projects that you asked to push to GitHub:

- `ImageComparator` (extension)
- `ScreenshotComparisonProject/ImageComparison` (Playwright + Python comparator)
 - `Demo` (optional) — your demo/testing folder if you want it included in the repo

This folder contains a helper PowerShell script `push_to_github.ps1` to copy your existing local folders into this repository folder, initialize git, and push the initial commit to GitHub.

See `push_to_github.ps1` for usage. Typical flow:

1. Open PowerShell as the same user that has the folders:
   - `C:\Users\tejar\Downloads\ImageComparator\ImageComparator`
   - `C:\Users\tejar\Demo\ScreenshotComparisonProject\ImageComparison`
2. Run the helper script to copy, init, and push:
   ```powershell
   cd C:\Users\tejar\Demo\ScreenshotComparisonAutomation
   .\push_to_github.ps1
   ```

The script will ask for the GitHub repository name (e.g. `ScreenshotComparisonAutomation`) and whether to create the remote using the GitHub CLI (`gh`) or to provide a remote URL manually. It will not delete your original folders; it copies them into the repo folder.

If you prefer to do everything manually, follow the manual steps in the script comments.
