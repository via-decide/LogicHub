#!/bin/bash
cd /Users/dharamdaxini/Downloads/via/LogicHub

git fetch origin
git checkout main
git pull origin main

# Create the isolated sandbox branch
git checkout -b sandbox/unshipped-features

# Branches to merge
branches=(
  "origin/codex/stabilize-daxini-marketplace-runtime-2026-04-21"
  "origin/codex/fix-deployment-failures-for-logichub-2026-04-21"
  "origin/codex/diagnose-and-fix-deployment-failures-2026-04-20"
)

for branch in "${branches[@]}"; do
  echo "Merging $branch..."
  git merge --no-edit "$branch" || {
    echo "Conflict detected in $branch. Resolving by taking PR changes (theirs)..."
    git checkout --theirs .
    git add .
    git commit -m "Auto-resolved conflict in favor of feature branch $branch"
  }
done

git push origin sandbox/unshipped-features
echo "Features isolated in branch sandbox/unshipped-features and pushed."
