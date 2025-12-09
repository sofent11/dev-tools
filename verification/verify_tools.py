from playwright.sync_api import sync_playwright

def verify_tools():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to the app
            page.goto("http://localhost:3000")

            # Wait for the sidebar to load
            page.wait_for_selector("text=程序员百宝箱")

            # Take a screenshot of the initial state (should show new categories)
            page.screenshot(path="verification/1_initial_state.png")
            print("Screenshot 1 taken: Initial state with categories")

            # Click on 'XML 工具' in the sidebar (under Text/Encoding)
            # Depending on how the categories are rendered, we might need to expand them or just scroll
            # But the sidebar shows all categories initially

            # Search for 'XML' to filter sidebar
            page.fill("input[placeholder='搜索工具...']", "XML")
            page.wait_for_timeout(500) # Wait for filter

            # Click XML Tool
            page.click("text=XML 工具")
            page.wait_for_selector("text=XML 美化、压缩与 JSON 转换")

            # Type some XML
            page.fill("textarea[placeholder='Paste XML here...']", "<root><child>value</child></root>")

            # Click Format
            page.click("button:has-text('Format')")
            page.wait_for_timeout(500)

            # Screenshot XML Tool
            page.screenshot(path="verification/2_xml_tool.png")
            print("Screenshot 2 taken: XML Tool")

            # Click on '文本处理' (Text Manipulation)
            page.fill("input[placeholder='搜索工具...']", "文本处理")
            page.click("text=文本处理")
            page.wait_for_selector("text=去重、排序、全半角转换")

            page.fill("textarea[placeholder='Paste text here...']", "b\na\nc\na")
            page.click("button:has-text('Sort')")
            page.wait_for_timeout(200)
            page.click("button:has-text('Dedup')")
            page.wait_for_timeout(200)

            # Screenshot String Tool
            page.screenshot(path="verification/3_string_tool.png")
            print("Screenshot 3 taken: String Tool")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_tools()
