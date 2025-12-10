from playwright.sync_api import sync_playwright

def verify_tools():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app
        page.goto("http://localhost:3000")

        # Wait for the app to load
        page.wait_for_selector("text=程序员百宝箱")

        # 1. Verify JSON to TS Tool
        print("Verifying JSON to TS Tool...")
        # Search for the tool
        page.fill("input[placeholder='搜索工具...']", "JSON 转代码")
        page.click("text=JSON 转代码")
        page.wait_for_selector("text=JSON to Code Converter")
        page.screenshot(path="verification/json_to_ts.png")

        # 2. Verify Image Tool
        print("Verifying Image Tool...")
        page.fill("input[placeholder='搜索工具...']", "图片压缩")
        page.click("text=图片压缩/转换")
        page.wait_for_selector("text=Image Compressor & Converter")
        page.screenshot(path="verification/image_tool.png")

        # 3. Verify PDF Tool
        print("Verifying PDF Tool...")
        page.fill("input[placeholder='搜索工具...']", "PDF 工具箱")
        page.click("text=PDF 工具箱")
        page.wait_for_selector("text=PDF Toolbox")
        page.screenshot(path="verification/pdf_tool.png")

        browser.close()

if __name__ == "__main__":
    try:
        verify_tools()
        print("Verification complete.")
    except Exception as e:
        print(f"Verification failed: {e}")
