#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ctxops Show HN Demo Script
# 
# This script demonstrates the complete ctxops value chain:
#   Code changed → Doctor detects drift → Update docs → Integrity restored
#
# Prerequisites: Node.js >= 22, git
# Usage: bash demo.sh
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CTXOPS="node ${SCRIPT_DIR}/../dist/cli.js"
DEMO_DIR="${SCRIPT_DIR}/demo-workspace"
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

pause() {
  echo ""
  echo -e "${DIM}─── Press Enter to continue ───${NC}"
  read -r
}

header() {
  echo ""
  echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${BLUE}  $1${NC}"
  echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════${NC}"
  echo ""
}

step() {
  echo -e "${YELLOW}▶ $1${NC}"
}

# ── Cleanup ──────────────────────────────────────────────
rm -rf "$DEMO_DIR"

header "ctxops — The Context Integrity Engine for AI Coding Teams"

echo "This demo shows how ctxops detects when your AI coding"
echo "context drifts from code — right in your PR."
echo ""
echo -e "${DIM}Scenario: A Java Spring e-commerce backend with order,"
echo -e "inventory, and payment modules.${NC}"

pause

# ═══════════════════════════════════════════════════════════
# STEP 1: Set up a realistic project
# ═══════════════════════════════════════════════════════════

header "Step 1: Setting up the project"

step "Creating a realistic Spring project structure..."
mkdir -p "$DEMO_DIR"
cd "$DEMO_DIR"
git init -q
git config user.email "demo@ctxops.dev"
git config user.name "Demo"

# Create realistic code structure
mkdir -p services/order services/inventory services/payment shared/models

cat > services/order/OrderHandler.java << 'EOF'
package com.example.services.order;

public class OrderHandler {
    private final InventoryClient inventoryClient;
    
    public Order createOrder(CreateOrderRequest request) {
        // Validate stock via inventory service
        inventoryClient.checkStock(request.getItems());
        
        Order order = new Order();
        order.setStatus(OrderStatus.CREATED);
        order.setItems(request.getItems());
        return orderRepository.save(order);
    }
    
    public Order payOrder(Long orderId) {
        Order order = orderRepository.findById(orderId);
        order.setStatus(OrderStatus.PAID);
        // Deduct inventory on payment
        inventoryClient.deductStock(order.getItems());
        return orderRepository.save(order);
    }
}
EOF

cat > services/order/OrderStateMachine.java << 'EOF'
package com.example.services.order;

public class OrderStateMachine {
    // CREATED → PAID → SHIPPED → COMPLETED
    // Cancel only allowed before PAID
    public void transition(Order order, OrderStatus target) {
        if (!isValidTransition(order.getStatus(), target)) {
            throw new InvalidStateTransitionException();
        }
        order.setStatus(target);
    }
}
EOF

cat > services/inventory/InventoryService.java << 'EOF'
package com.example.services.inventory;

public class InventoryService {
    public void checkStock(List<OrderItem> items) { /* ... */ }
    public void deductStock(List<OrderItem> items) { /* ... */ }
}
EOF

cat > services/payment/PaymentGateway.java << 'EOF'
package com.example.services.payment;

public class PaymentGateway {
    public PaymentResult processPayment(PaymentRequest request) { /* ... */ }
}
EOF

git add . && git commit -q -m "initial: spring e-commerce backend"

echo -e "${GREEN}✔ Created project with order/inventory/payment modules${NC}"

pause

# ═══════════════════════════════════════════════════════════
# STEP 2: Initialize ctxops
# ═══════════════════════════════════════════════════════════

header "Step 2: Initialize ctxops"

step "Running: ctx init"
echo ""
$CTXOPS init

pause

# ═══════════════════════════════════════════════════════════
# STEP 3: Create context documents and link them
# ═══════════════════════════════════════════════════════════

header "Step 3: Create AI context documents"

step "Writing module-level context for the order module..."

cat > docs/ai/modules/order.md << 'EOF'
<!-- ctxops: scope=module, paths=services/order/** -->

# Order Module Context

## Module Responsibility
Handles the complete order lifecycle: creation, payment, shipping, completion.

## State Machine
- CREATED → PAID → SHIPPED → COMPLETED
- Cancel is ONLY allowed before PAID status
- Inventory deduction happens at PAID (not at CREATED)

## Key Constraints
- ❌ NEVER call inventory DB directly — always use InventoryClient gRPC
- ❌ NEVER skip state machine steps — use OrderStateMachine.transition()
- ✅ All monetary calculations must use BigDecimal, not double

## Cross-Module Dependencies
- `services/inventory/` — stock check on create, deduction on pay
- `services/payment/` — payment processing on pay transition
EOF

echo -e "${GREEN}✔ Created docs/ai/modules/order.md${NC}"

step "Linking documents to code paths..."
echo ""
$CTXOPS link docs/ai/modules/order.md "services/order/**"

git add . && git commit -q -m "add ctxops context for order module"

pause

# ═══════════════════════════════════════════════════════════
# STEP 4: Simulate a developer making code changes
# ═══════════════════════════════════════════════════════════

header "Step 4: A developer adds a refund feature (without updating docs)"

step "Creating feature branch..."
git checkout -q -b feature/add-refund

step "Adding refund capability to OrderHandler..."
echo ""

cat > services/order/OrderHandler.java << 'EOF'
package com.example.services.order;

public class OrderHandler {
    private final InventoryClient inventoryClient;
    private final PaymentGateway paymentGateway;   // NEW
    
    public Order createOrder(CreateOrderRequest request) {
        inventoryClient.checkStock(request.getItems());
        Order order = new Order();
        order.setStatus(OrderStatus.CREATED);
        order.setItems(request.getItems());
        return orderRepository.save(order);
    }
    
    public Order payOrder(Long orderId) {
        Order order = orderRepository.findById(orderId);
        order.setStatus(OrderStatus.PAID);
        inventoryClient.deductStock(order.getItems());
        return orderRepository.save(order);
    }
    
    // ★ NEW: Refund feature
    public Order refundOrder(Long orderId) {
        Order order = orderRepository.findById(orderId);
        // Refund payment
        paymentGateway.refund(order.getPaymentId());
        // Restore inventory
        inventoryClient.restoreStock(order.getItems());
        // New state: REFUNDED
        order.setStatus(OrderStatus.REFUNDED);
        return orderRepository.save(order);
    }
}
EOF

git add . && git commit -q -m "feat: add refund capability"

echo -e "${GREEN}✔ Added refundOrder() method${NC}"
echo -e "${DIM}   - New state: REFUNDED (not in current docs!)${NC}"
echo -e "${DIM}   - New dependency: PaymentGateway (not documented!)${NC}"
echo -e "${DIM}   - New method: restoreStock (not documented!)${NC}"
echo ""
echo -e "${RED}   But the developer forgot to update the context docs...${NC}"

pause

# ═══════════════════════════════════════════════════════════
# STEP 5: Run ctx doctor — the magic moment
# ═══════════════════════════════════════════════════════════

header "Step 5: ctx doctor catches the drift!"

step "Running: ctx doctor --base master"
echo ""
$CTXOPS doctor --base master

echo ""
echo -e "${BOLD}${RED}⚡ ctxops caught it!${NC}"
echo ""
echo "The AI context doc says the state machine is:"
echo "  CREATED → PAID → SHIPPED → COMPLETED"
echo ""
echo "But the code now has a REFUNDED state."
echo "Any AI reading this stale context would NOT know about refunds."

pause

# ═══════════════════════════════════════════════════════════
# STEP 6: Fix the drift
# ═══════════════════════════════════════════════════════════

header "Step 6: Update docs → Integrity restored"

step "Updating the order module context..."

cat > docs/ai/modules/order.md << 'EOF'
<!-- ctxops: scope=module, paths=services/order/** -->

# Order Module Context

## Module Responsibility
Handles the complete order lifecycle: creation, payment, shipping, completion, and refund.

## State Machine
- CREATED → PAID → SHIPPED → COMPLETED
- PAID → REFUNDED (new: reverses payment and restores inventory)
- Cancel is ONLY allowed before PAID status

## Key Constraints
- ❌ NEVER call inventory DB directly — always use InventoryClient gRPC
- ❌ NEVER skip state machine steps — use OrderStateMachine.transition()
- ✅ All monetary calculations must use BigDecimal, not double
- ✅ Refund must restore inventory AND reverse payment atomically

## Cross-Module Dependencies
- `services/inventory/` — stock check, deduction, and restore
- `services/payment/` — payment processing and refund
EOF

git add . && git commit -q -m "docs: update order context with refund info"

step "Running: ctx doctor --base master"
echo ""
$CTXOPS doctor --base master

echo ""
echo -e "${GREEN}${BOLD}✅ Context integrity restored!${NC}"
echo "Now any AI tool reading this context will know about refunds."

pause

# ═══════════════════════════════════════════════════════════
# STEP 7: Show strict mode for CI
# ═══════════════════════════════════════════════════════════

header "Step 7: CI Integration (strict mode)"

step "In CI, use --mode strict to block PRs with drifted context:"
echo ""
echo -e "${DIM}  # .github/workflows/context-integrity.yml${NC}"
echo -e "${DIM}  - run: npx ctxops doctor --base main --mode strict${NC}"
echo -e "${DIM}  # Exit code 1 = drift detected → PR blocked${NC}"
echo -e "${DIM}  # Exit code 0 = all synced → PR approved${NC}"
echo ""

step "Running: ctx doctor --base master --mode strict"
echo ""
$CTXOPS doctor --base master --mode strict
echo ""
echo -e "${GREEN}Exit code: 0 — all docs synced, PR can merge ✅${NC}"

pause

# ═══════════════════════════════════════════════════════════
# FINALE
# ═══════════════════════════════════════════════════════════

header "That's ctxops."

echo "  🔗 Link your docs to code paths"
echo "  🔍 Detect drift at PR time — not after AI produces wrong output"
echo "  🛡️ Enforce context integrity in CI"
echo ""
echo -e "${BOLD}  ctxops — The Context Integrity Engine for AI Coding Teams${NC}"
echo ""
echo "  GitHub: https://github.com/ctxops/ctxops"
echo "  License: Apache-2.0"
echo ""

# Cleanup
cd ..
