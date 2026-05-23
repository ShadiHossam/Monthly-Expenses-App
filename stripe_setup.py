"""
Run once to bootstrap all Stripe products, prices, and webhook endpoint.

Usage:
    pip install stripe python-dotenv
    python stripe_setup.py

It reads STRIPE_SECRET_KEY from your .env, creates everything, then
writes the generated price IDs back into your .env automatically.
You only need to paste your STRIPE_SECRET_KEY and your public domain first.
"""

import os
import sys
import re
import stripe
from dotenv import load_dotenv, set_key

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
if not STRIPE_SECRET_KEY or STRIPE_SECRET_KEY == "sk_live_...":
    print("ERROR: Set STRIPE_SECRET_KEY in your .env first (sk_live_... or sk_test_...)")
    sys.exit(1)

# Your public-facing domain — used to register the webhook endpoint
DOMAIN = os.getenv("APP_DOMAIN", "").rstrip("/")
if not DOMAIN:
    DOMAIN = input("Enter your public domain (e.g. https://expenses.yourdomain.com): ").strip().rstrip("/")

ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")
stripe.api_key = STRIPE_SECRET_KEY

PLANS = [
    {
        "key": "solo",
        "env_var": "STRIPE_PRICE_SOLO",
        "product_name": "Expenses SaaS — Solo",
        "product_description": "75 pages/month, 2 concurrent uploads, AI chat",
        "unit_amount": 499,   # $4.99 in cents
        "currency": "usd",
    },
    {
        "key": "pro",
        "env_var": "STRIPE_PRICE_PRO",
        "product_name": "Expenses SaaS — Pro",
        "product_description": "300 pages/month, 5 concurrent uploads, priority processing",
        "unit_amount": 1499,  # $14.99
        "currency": "usd",
    },
    {
        "key": "business",
        "env_var": "STRIPE_PRICE_BUSINESS",
        "product_name": "Expenses SaaS — Business",
        "product_description": "1,500 pages/month, 10 concurrent uploads, overage billing",
        "unit_amount": 3999,  # $39.99
        "currency": "usd",
    },
]

OVERAGE = {
    "env_var": "STRIPE_PRICE_OVERAGE",
    "product_name": "Expenses SaaS — Page Overage",
    "product_description": "Per-page overage charge for Business plan ($0.10/page)",
    "unit_amount": 10,  # $0.10 in cents
    "currency": "usd",
}

WEBHOOK_EVENTS = [
    "checkout.session.completed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def create_or_get_product(name: str, description: str) -> str:
    """Return an existing product ID by name, or create a new one."""
    for p in stripe.Product.list(limit=100).auto_paging_iter():
        if p["name"] == name and p["active"]:
            print(f"  ✓ Product already exists: {name} ({p['id']})")
            return p["id"]
    product = stripe.Product.create(name=name, description=description)
    print(f"  + Created product: {name} ({product['id']})")
    return product["id"]


def create_or_get_price(product_id: str, unit_amount: int, currency: str,
                         recurring: bool = True, metered: bool = False) -> str:
    """Return existing matching price ID or create a new one."""
    for p in stripe.Price.list(product=product_id, limit=100, active=True).auto_paging_iter():
        interval = (p.get("recurring") or {}).get("interval")
        agg = (p.get("recurring") or {}).get("aggregate_usage")
        if (p["unit_amount"] == unit_amount
                and p["currency"] == currency
                and bool(interval) == recurring
                and (agg == "sum") == metered):
            print(f"  ✓ Price already exists: {unit_amount/100:.2f} {currency.upper()} ({p['id']})")
            return p["id"]

    kwargs = dict(product=product_id, unit_amount=unit_amount, currency=currency)
    if recurring:
        kwargs["recurring"] = {"interval": "month"}
        if metered:
            kwargs["recurring"]["usage_type"] = "metered"
            kwargs["recurring"]["aggregate_usage"] = "sum"
    price = stripe.Price.create(**kwargs)
    print(f"  + Created price: {unit_amount/100:.2f} {currency.upper()} ({price['id']})")
    return price["id"]


def create_or_get_webhook(url: str) -> str:
    """Return existing webhook secret for this URL or create a new one."""
    for wh in stripe.WebhookEndpoint.list(limit=100).auto_paging_iter():
        if wh["url"] == url and wh["status"] == "enabled":
            print(f"  ✓ Webhook already exists: {url}")
            # Can't retrieve secret again — instruct user to check dashboard
            return wh.get("secret", "")
    wh = stripe.WebhookEndpoint.create(
        url=url,
        enabled_events=WEBHOOK_EVENTS,
        description="Expenses SaaS — subscription lifecycle",
    )
    print(f"  + Created webhook: {url} ({wh['id']})")
    return wh["secret"]


def write_env(key: str, value: str):
    """Write or update a key in the .env file."""
    if not os.path.exists(ENV_FILE):
        with open(ENV_FILE, "w") as f:
            f.write("")
    set_key(ENV_FILE, key, value)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n=== Stripe Setup for Expenses SaaS ===\n")

    # 1. Subscription plans
    print("Creating subscription plans…")
    for plan in PLANS:
        product_id = create_or_get_product(plan["product_name"], plan["product_description"])
        price_id = create_or_get_price(product_id, plan["unit_amount"], plan["currency"])
        write_env(plan["env_var"], price_id)

    # 2. Overage (metered)
    print("\nCreating overage metered price…")
    overage_product_id = create_or_get_product(OVERAGE["product_name"], OVERAGE["product_description"])
    overage_price_id = create_or_get_price(
        overage_product_id, OVERAGE["unit_amount"], OVERAGE["currency"],
        recurring=True, metered=True,
    )
    write_env(OVERAGE["env_var"], overage_price_id)

    # 3. Webhook endpoint
    webhook_url = f"{DOMAIN}/api/v1/webhooks/stripe"
    print(f"\nRegistering webhook endpoint: {webhook_url}")
    webhook_secret = create_or_get_webhook(webhook_url)
    if webhook_secret:
        write_env("STRIPE_WEBHOOK_SECRET", webhook_secret)
        print(f"  ✓ Webhook secret written to .env")
    else:
        print("  ⚠ Could not retrieve webhook secret (already existed). Check Stripe Dashboard → Webhooks.")

    # 4. Also write publishable key hint if missing
    pub_key = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    if not pub_key or pub_key == "pk_live_...":
        key_type = "test" if STRIPE_SECRET_KEY.startswith("sk_test") else "live"
        print(f"\n  ⚠ Don't forget to set STRIPE_PUBLISHABLE_KEY=pk_{key_type}_... in your .env")

    print("\n✅ Done! Your .env has been updated with all Stripe price IDs.\n")
    print("Next steps:")
    print("  1. Restart your backend:  docker compose restart backend")
    print("  2. Enable Customer Portal in Stripe Dashboard → Billing → Customer Portal")
    print("     (allow: plan changes, cancellation, payment method updates)")
    print(f"  3. Open {DOMAIN}/pricing — all paid plans show '30 days free, no card required'")
    print(f"  4. Test a trial checkout with a Stripe test card: 4242 4242 4242 4242\n")


if __name__ == "__main__":
    main()
