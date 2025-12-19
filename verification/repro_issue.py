from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    try:
        page.goto("http://localhost:3000")

        # Click on the Image Compression tool
        # Based on App.tsx, it's called "图片压缩/转换" or "Image Compression" depending on language, but text says "图片压缩/转换"
        page.get_by_text("图片压缩/转换").click()

        # Wait for the upload area to appear
        # The text "Click to upload or drag and drop" is inside the upload area
        upload_text = page.get_by_text("Click to upload or drag and drop")
        upload_text.wait_for()

        # Find the file input
        file_input = page.locator("input[type='file']")

        # Get bounding boxes
        input_box = file_input.bounding_box()
        # Find the container of the upload text.
        # The structure is div > div > p("Click...").
        # The input is sibling to the div wrapping the text (or close to it).
        # Actually structure is:
        # div (upload area)
        #   div (icon)
        #   div (text container)
        #     p ("Click...")
        #   input

        # We can find the upload area by locating the text and going up to the parent div that has the border
        # Or simpler: find the div that contains "Click to upload" text.
        upload_area = page.locator("div.border-dashed")
        upload_area_box = upload_area.bounding_box()

        print(f"Input Box: {input_box}")
        print(f"Upload Area Box: {upload_area_box}")

        # Check if input box is significantly larger than upload area box
        # If input_box is covering the whole page (e.g. height > 600 while upload area is ~200), it's a bug.

        if input_box['height'] > upload_area_box['height'] * 1.5:
            print("FAILURE: Input box is much larger than upload area. Bug reproduced.")
        else:
            print("SUCCESS: Input box is contained within upload area.")

        # Also try to check if it covers the header (which is above upload area)
        # The header contains "Image Compressor & Converter"
        header = page.get_by_text("Image Compressor & Converter")
        header_box = header.bounding_box()

        # Check if input overlaps header
        # Overlap if input_y < header_y + header_height
        if input_box['y'] < header_box['y'] + header_box['height']:
             print("FAILURE: Input box overlaps with Header. Bug reproduced.")

        page.screenshot(path="verification/repro_screenshot.png")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/error_screenshot.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
