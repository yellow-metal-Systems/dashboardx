"""Partner onboarding, end to end in a real browser (plan of 27 Oct 2026, B7).

Walks the whole flow through both apps' screens:
  apply on LeadBridge -> send the BC agreement in LeadDesk (preview first) ->
  take the signing link from Sent emails -> sign on a phone-sized screen
  (a wrong name is refused) -> countersign and approve -> set a password ->
  the partner lands on LeadBridge home.

Needs both apps running with EMAIL_MODE=log (the signing link is read from
Sent emails) and an admin login. Uses a TEST applicant with a random mobile,
so `npm run onboarding:demo -- clean --yes` removes everything it creates.

    pip install playwright && python -m playwright install chromium
    E2E_STAFF_EMAIL=... E2E_STAFF_PASSWORD=... python scripts/e2e-partner-onboarding.py

Optional: LEADBRIDGE_URL (default http://localhost:3200), LEADDESK_URL
(default http://localhost:3000), PREPROD=true to also check the pre-prod
banner, E2E_SHOTS (screenshot folder, default a temp folder).
Exits non-zero at the first failed step.
"""
import os
import random
import re
import secrets
import sys
import tempfile

from playwright.sync_api import expect, sync_playwright

LB = os.environ.get("LEADBRIDGE_URL", "http://localhost:3200").rstrip("/")
LD = os.environ.get("LEADDESK_URL", "http://localhost:3000").rstrip("/")
STAFF_EMAIL = os.environ.get("E2E_STAFF_EMAIL")
STAFF_PASSWORD = os.environ.get("E2E_STAFF_PASSWORD")
PREPROD = os.environ.get("PREPROD") == "true"
OUT = os.environ.get("E2E_SHOTS") or os.path.join(tempfile.gettempdir(), "partner-onboarding-e2e")

if not STAFF_EMAIL or not STAFF_PASSWORD:
    sys.exit("Set E2E_STAFF_EMAIL and E2E_STAFF_PASSWORD to an admin login for LeadDesk.")
os.makedirs(OUT, exist_ok=True)

NAME = "TEST Suresh Gowda"  # the TEST prefix is what the cleanup script removes
MOBILE = "9" + "".join(random.choice("0123456789") for _ in range(9))
EMAIL = f"suresh.{MOBILE}@example.com"
PARTNER_PASSWORD = secrets.token_urlsafe(12)  # throwaway; never printed
console_errors: list[str] = []


def shot(page, name):
    page.screenshot(path=os.path.join(OUT, f"{name}.png"), full_page=True)


def step(title):
    print(f"== {title}", flush=True)


def watch(page, app):
    page.on("console", lambda m: m.type == "error" and console_errors.append(f"{app}: {m.text[:200]}"))
    page.on("pageerror", lambda e: console_errors.append(f"{app} pageerror: {str(e)[:200]}"))


with sync_playwright() as p:
    browser = p.chromium.launch()
    phone = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    desk = browser.new_context(viewport={"width": 1366, "height": 900})
    lb, ld = phone.new_page(), desk.new_page()
    lb.set_default_timeout(60000)
    ld.set_default_timeout(60000)
    watch(lb, "LeadBridge")
    watch(ld, "LeadDesk")

    step("Apply on LeadBridge as an individual (shared fields survive a type switch)")
    lb.goto(f"{LB}/join")
    if PREPROD:
        expect(lb.get_by_role("note")).to_contain_text("Test version")
    lb.fill("#join-name", NAME)
    lb.fill("#join-email", EMAIL)
    lb.fill("#join-mobile", MOBILE)
    lb.fill("#join-town", "Hoskote")
    lb.fill("#join-address", "12 Temple Street, Hoskote, Karnataka 562114")
    lb.fill("#join-pan", "ABCPG1234K")
    lb.get_by_text("Company", exact=True).click()
    expect(lb.locator("#join-companyName")).to_be_visible()
    expect(lb.locator("#join-email")).to_have_value(EMAIL)
    lb.get_by_text("Individual", exact=True).click()
    lb.fill("#join-pan", "ABCPG1234K")  # PAN is individual-only, so the switch cleared it
    shot(lb, "01-join")
    lb.get_by_role("button", name="Apply").click()
    expect(lb.get_by_text("Application received")).to_be_visible()

    step("Log in to LeadDesk")
    ld.goto(f"{LD}/login")
    ld.fill('input[name="email"]', STAFF_EMAIL)
    ld.fill('input[name="password"]', STAFF_PASSWORD)
    ld.locator('button[type="submit"]').click()
    ld.wait_for_url(re.compile(r"/dashboard"))

    step("Find the application in the list")
    ld.goto(f"{LD}/dashboard/partners?tab=applications")
    if PREPROD:
        expect(ld.get_by_role("note")).to_contain_text("Pre-production")
    row = ld.locator("tbody tr").filter(has_text=MOBILE)  # this run's applicant, not an earlier TEST one
    expect(row).to_be_visible()
    shot(ld, "02-applications")
    row.get_by_role("link", name=NAME).click()
    ld.wait_for_url(re.compile(r"/dashboard/partners/applications/"))
    app_url = ld.url

    step("Preview, then send the BC agreement")
    rates = {"perVerifiedApplicationRs": "250", "disbursedPercent": "0.5", "perActiveLoanMonthlyRs": "20", "collectedPercent": "1"}
    for name, value in rates.items():
        ld.fill(f'input[name="{name}"]', value)
    preview = ld.request.get(f"{app_url}/agreement/preview?" + "&".join(f"{k}={v}" for k, v in rates.items()))
    assert preview.ok and preview.headers["content-type"].startswith("application/pdf"), f"preview: HTTP {preview.status}"
    ld.check('input[name="checksDone"]')  # "I've called the applicant" is required before sending
    ld.get_by_role("button", name="Send agreement").click()
    expect(ld.get_by_text("Works until")).to_be_visible()
    shot(ld, "03-agreement-sent")

    step("Take the signing link from Sent emails")
    ld.goto(f"{LD}/dashboard/emails")
    ld.locator("tbody tr").filter(has_text=EMAIL).filter(has_text=re.compile("agreement", re.I)).first.get_by_role("link").click()
    ld.wait_for_url(re.compile(r"/dashboard/emails/"))
    links = ld.locator('input[aria-label^="Link "]')
    expect(links.first).to_be_visible()
    sign_url = next(v for v in (links.nth(i).input_value() for i in range(links.count())) if "/agreement/" in v)

    step("Sign on the phone (a wrong name is refused first)")
    lb.goto(sign_url)
    # A fresh `next dev` compiles the pdf.js worker (1.3 MB) on first use, which can take over a minute.
    expect(lb.locator('[aria-label^="Page 1 of"] canvas')).to_be_visible(timeout=180_000)
    expect(lb.get_by_text("Loading the agreement…")).to_have_count(0)
    shot(lb, "04-sign-page")
    lb.fill("#sign-name", "suresh gowda")  # missing the TEST prefix
    lb.check('input[name="agreed"]')
    lb.get_by_role("button", name="Sign agreement").click()
    expect(lb.locator("#sign-error")).to_be_visible()
    lb.fill("#sign-name", NAME.lower())  # case and spacing are ignored
    lb.get_by_role("button", name="Sign agreement").click()
    expect(lb.get_by_text("Signed. Thank you.")).to_be_visible()
    lb.reload()
    expect(lb.get_by_text("This agreement has already been signed.")).to_be_visible()

    step("Countersign and approve")
    ld.goto(app_url)
    expect(ld.get_by_text("Signed from")).to_be_visible()
    ld.fill('input[name="designation"]', "Director")
    ld.check('input[name="confirmed"]')
    ld.get_by_role("button", name="Countersign and approve").click()
    invite = ld.locator('input[aria-label^="Set-password link for"]')
    expect(invite).to_be_visible()
    invite_url = invite.input_value()
    executed = ld.request.get(f"{app_url}/agreement?file=executed")
    assert executed.ok and executed.headers["content-type"].startswith("application/pdf"), f"signed copy: HTTP {executed.status}"
    shot(ld, "05-approved")

    step("The partner sets a password and lands on LeadBridge home")
    lb.goto(invite_url)
    lb.fill('input[name="password"]', PARTNER_PASSWORD)
    lb.fill('input[name="confirm"]', PARTNER_PASSWORD)
    lb.get_by_role("button", name="Set password and continue").click()
    lb.wait_for_url(re.compile(r"/home"))
    shot(lb, "06-partner-home")

    browser.close()

print(f"\nConsole errors: {len(console_errors)}")
for e in console_errors:
    print("  ", e)
print(f"PASSED. Screenshots in {OUT}. Remove the TEST rows with: npm run onboarding:demo -- clean --yes")
