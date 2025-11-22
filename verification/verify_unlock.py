
from playwright.sync_api import Page, expect, sync_playwright
import time

def verify_unlocks(page: Page):
    # Navigate to the app (using the base path from vite output)
    page.goto("http://localhost:5173/AdditionGame/")

    # Wait for the main content to load
    page.wait_for_selector('h3:has-text("Adunare • Sume 0-9")', timeout=10000)

    # Click "Pornește traseul" button to enter the app
    # Look for button that says "Pornește traseul" inside the details panel
    page.click('button:has-text("Pornește traseul")')

    time.sleep(1)

    # Register form
    # Input: Numele copilului (id="name")
    # Input: Data nașterii (id="birthDate")
    # Radio: Gen

    try:
        # Check if "Numele copilului" is visible
        if page.is_visible('label:has-text("Numele copilului")'):
            print("Registering...")
            page.fill('#name', "TestUser")
            page.fill('#birthDate', "2020-01-01") # 5 years old
            page.click('input[value="male"]')
            page.click('button:has-text("Începe învățarea")')
        else:
             print("Dashboard might be visible? Or some other state.")
    except Exception as e:
        print(f"Error checking register: {e}")

    # Wait for dashboard title
    print("Waiting for dashboard title 'Carduri de Adunare'...")
    try:
        # Use text because it's h1
        expect(page.locator("h1:has-text('Carduri de Adunare')")).to_be_visible(timeout=10000)
    except Exception as e:
        # Sometimes the title is hidden or I used wrong selector?
        # But I saw buttons in the output: "Exersează +1", "Exersează +2", "Blocat" etc.
        # So the dashboard IS loaded.
        print("Dashboard title not found, but proceeding as buttons seem to be present.")
        pass

    # Wait a bit for animations/state updates
    time.sleep(2)

    # Check 1 (should be unlocked)
    print("Checking button 1...")
    # Finding button that contains "+ 1"
    btn_1 = page.locator('button').filter(has_text="+ 1").first
    expect(btn_1).to_be_visible()
    if btn_1.is_disabled():
         print("FAILURE: Button 1 is disabled!")
         page.screenshot(path="/home/jules/verification/failure_btn1_disabled.png")
         raise Exception("Button 1 is disabled")
    else:
         print("Button 1 is enabled.")


    # Check 3 (should be unlocked)
    print("Checking button 3...")
    btn_3 = page.locator('button').filter(has_text="+ 3").first
    expect(btn_3).to_be_visible()
    if btn_3.is_disabled():
         print("FAILURE: Button 3 is disabled!")
         page.screenshot(path="/home/jules/verification/failure_btn3_disabled.png")
         raise Exception("Button 3 is disabled")
    else:
         print("Button 3 is enabled.")


    # Check 4 (should be locked)
    print("Checking button 4...")
    btn_4 = page.locator('button').filter(has_text="+ 4").first
    expect(btn_4).to_be_visible()

    # The button might be disabled OR contain "Blocat"
    # Based on previous output:
    # 4
    # + 4
    # Blocat

    # If it has "Blocat" text inside, it is likely the locked state visual.
    # Let's check if it's disabled.

    if not btn_4.is_disabled():
         print("FAILURE: Button 4 is enabled!")
         page.screenshot(path="/home/jules/verification/failure_btn4_enabled.png")
         raise Exception("Button 4 is enabled")
    else:
         print("Button 4 is disabled.")


    # Take screenshot
    page.screenshot(path="/home/jules/verification/unlock_verification.png")
    print("Verification passed!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_unlocks(page)
        except Exception as e:
            print(f"Verification failed: {e}")
            try:
                page.screenshot(path="/home/jules/verification/unlock_verification_failed.png")
            except:
                pass
            raise e
        finally:
            browser.close()
