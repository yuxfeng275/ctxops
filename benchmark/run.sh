#!/bin/bash
# Benchmark ctxops against real open-source repos.
# Usage: bash benchmark/run.sh
# Results are written to benchmark/results.md

set -euo pipefail

BENCHMARK_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$BENCHMARK_DIR/.." && pwd)"
RESULTS_FILE="$BENCHMARK_DIR/results.md"
TEMP_DIR="$BENCHMARK_DIR/.tmp"
CTX="node $PROJECT_ROOT/dist/cli.js"

# Clean up temp dir
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Test repos: name, url, has_docs
REPOS=(
  "expressjs/express|https://github.com/expressjs/express.git"
  "fastify/fastify|https://github.com/fastify/fastify.git"
  "jestjs/jest|https://github.com/jestjs/jest.git"
)

echo "# ctxops Benchmark Report" > "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$RESULTS_FILE"
echo "ctxops version: $(node -e "console.log(require('$PROJECT_ROOT/package.json').version)")" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "---" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

for repo_entry in "${REPOS[@]}"; do
  IFS='|' read -r name url <<< "$repo_entry"
  repo_dir="$TEMP_DIR/$name"
  short_name=$(basename "$name")
  
  echo "=== Testing: $name ==="
  
  # Shallow clone
  echo "  Cloning $url..."
  git clone --depth=1 "$url" "$repo_dir" 2>/dev/null || {
    echo "  SKIP: clone failed"
    continue
  }
  
  echo "## $name" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  
  # Initialize ctxops
  pushd "$repo_dir" > /dev/null
  $CTX init --force 2>/dev/null || true
  
  # Count context files detected
  echo "### Detected Context Files" >> "$RESULTS_FILE"
  echo '```' >> "$RESULTS_FILE"
  
  # Check for known context files
  for f in CLAUDE.md AGENTS.md GEMINI.md CONVENTIONS.md .cursorrules .clinerules .windsurfrules .github/copilot-instructions.md; do
    if [ -f "$f" ]; then
      echo "  ✔ $f" >> "$RESULTS_FILE"
    fi
  done
  echo '```' >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  
  # Run auto-link
  echo "### Auto-Link Results" >> "$RESULTS_FILE"
  echo '```' >> "$RESULTS_FILE"
  $CTX link --auto 2>&1 | tee -a "$RESULTS_FILE" || true
  echo '```' >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  
  # Run status
  echo "### Status" >> "$RESULTS_FILE"
  echo '```' >> "$RESULTS_FILE"
  $CTX status --coverage 2>&1 | tee -a "$RESULTS_FILE" || true
  echo '```' >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  
  # Count links and code paths
  links_count=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('.ctxops/links.json','utf-8'));console.log(d.links.length)}catch{console.log(0)}")
  echo "**Links created: $links_count**" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  echo "---" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  
  popd > /dev/null
  echo "  Done: $links_count links created"
done

# Clean up
rm -rf "$TEMP_DIR"

echo ""
echo "Benchmark complete. Results in: $RESULTS_FILE"
