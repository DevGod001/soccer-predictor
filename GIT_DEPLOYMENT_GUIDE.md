# Git Deployment Guide - Soccer Predictor

## 🔴 Current Issue
- Unrelated git histories (local repo ≠ remote repo)
- You're on `master` branch, but GitHub has `main` branch
- Need to force synchronize

## ✅ Solution - Copy-Paste These Commands

Run these in PowerShell **one by one**:

```powershell
# 1. Navigate to project
cd c:\Users\Omogi\OneDrive\Desktop\soccer-predictor

# 2. Remove existing remote
git remote remove origin

# 3. Add the correct remote
git remote add origin https://github.com/DevGod001/soccer-predictor.git

# 4. Rename your local branch to main
git branch -M main

# 5. Configure git to allow unrelated histories
git config pull.rebase false

# 6. Force pull with allow-unrelated-histories
git pull origin main --allow-unrelated-histories

# 7. Add all your new files
git add .

# 8. Commit with a message
git commit -m "feat: Add improved prediction engine with real-time Football-Data API"

# 9. Push to GitHub (this will overwrite remote with your local version)
git push -u origin main --force
```

---

## 📝 What Each Command Does

| Command | Purpose |
|---------|---------|
| `git remote remove origin` | Remove the old remote connection |
| `git remote add origin https://...` | Add GitHub repo as origin |
| `git branch -M main` | Rename `master` to `main` |
| `git config pull.rebase false` | Allow pulling unrelated histories |
| `git pull origin main --allow-unrelated-histories` | Merge remote changes with yours |
| `git add .` | Stage all new/modified files |
| `git commit -m "..."` | Create a commit snapshot |
| `git push -u origin main --force` | Force push your version to GitHub |

---

## ⚠️ Important Notes

- **`--force` flag**: This will overwrite GitHub with your local version (your files are the source of truth)
- **If you want to keep GitHub's files**: Use `git pull origin main --allow-unrelated-histories` (without force) and manually resolve conflicts
- **After pushing**: GitHub will have your prediction engine code ✅

---

## 🚀 After Successful Push

1. ✅ Check GitHub to verify files are there
2. ✅ Connect to Vercel (if not already)
3. ✅ Add environment variables to Vercel:
   - `FOOTBALL_DATA_API_KEY`
   - `VERCEL_KV_URL`
   - `VERCEL_KV_REST_API_TOKEN`
4. ✅ Vercel auto-deploys!

---

## If You Get Stuck

Error: `Permission denied (publickey)`
→ Need SSH key setup (use Personal Access Token instead)

**Alternative - Use Personal Access Token:**
```powershell
git remote set-url origin https://YOUR_GITHUB_USERNAME:YOUR_PERSONAL_ACCESS_TOKEN@github.com/DevGod001/soccer-predictor.git
git push -u origin main
```

Get token from: https://github.com/settings/tokens
