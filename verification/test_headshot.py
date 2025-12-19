from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # Go to the app
            page.goto("http://localhost:3001")

            # Wait for the app to load
            page.wait_for_selector("text=程序员百宝箱")

            # Search for the tool
            page.get_by_placeholder("搜索工具...").fill("大头照")

            # Click the tool
            page.get_by_role("button", name="大头照提取").click()

            # Verify the tool is active
            expect(page.get_by_text("大头照提取 (Headshot Extraction)")).to_be_visible()

            # Take a screenshot of the initial state
            page.screenshot(path="verification/headshot_tool.png")
            print("Screenshot saved to verification/headshot_tool.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
