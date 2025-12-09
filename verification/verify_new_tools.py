from playwright.sync_api import sync_playwright

def verify_new_tools():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:3001")
            page.wait_for_selector("text=程序员百宝箱")

            # 1. Verify Time Tool (Category 2)
            page.fill("input[placeholder='搜索工具...']", "timestamp")
            page.wait_for_timeout(1000) # Wait for filter
            # Debug: take screenshot if fail
            try:
                page.click("text=时间戳转换")
            except:
                page.screenshot(path="verification/debug_fail.png")
                raise
            page.wait_for_selector("text=Current Unix Timestamp")
            # Convert 1678888888 -> Date
            page.fill("input[placeholder='1678888888']", "1678888888")
            page.click("button:has-text('Convert')")
            page.wait_for_timeout(500)
            page.screenshot(path="verification/4_timestamp.png")
            print("Screenshot 4 taken: Timestamp Tool")

            # 2. Verify HTTP Tool (Category 3)
            page.fill("input[placeholder='搜索工具...']", "HTTP")
            page.click("text=HTTP 请求")
            page.wait_for_selector("text=发送简单的 HTTP 请求")
            page.click("button:has-text('Send')")
            page.wait_for_timeout(1000)
            page.screenshot(path="verification/5_http.png")
            print("Screenshot 5 taken: HTTP Tool")

            # 3. Verify HMAC Tool (Category 4)
            page.fill("input[placeholder='搜索工具...']", "HMAC")
            page.click("text=HMAC 计算")
            page.wait_for_selector("text=Calculate HMAC-SHA256")
            page.fill("input[placeholder='Secret key...']", "secret")
            page.fill("textarea[placeholder='Message to sign...']", "message")
            page.wait_for_timeout(500) # Wait for debounce/effect
            page.screenshot(path="verification/6_hmac.png")
            print("Screenshot 6 taken: HMAC Tool")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_new_tools()
