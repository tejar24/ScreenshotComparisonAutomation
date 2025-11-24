import cv2
import sys
import os

def e(msg):
    print("ERROR:", msg, file=sys.stderr)


def main():
    if len(sys.argv) < 3:
        e("Usage: Imagecc1.py <baseline_path> <current_path> [<diff_path>]")
        return 2

    baseline_path = os.path.normpath(sys.argv[1])
    current_path = os.path.normpath(sys.argv[2])
    # Optional third argument: preferred output diff path
    diff_path = os.path.normpath(sys.argv[3]) if len(sys.argv) >= 4 else None

    # Validate files exist
    if not os.path.isfile(baseline_path):
        e(f"Baseline image not found: {baseline_path}")
        return 3
    if not os.path.isfile(current_path):
        e(f"Current image not found: {current_path}")
        return 4

    # Load images
    img1 = cv2.imread(baseline_path)
    img2 = cv2.imread(current_path)
    if img1 is None:
        e(f"Failed to load baseline image (cv2.imread returned None): {baseline_path}")
        return 5
    if img2 is None:
        e(f"Failed to load current image (cv2.imread returned None): {current_path}")
        return 6

    # Ensure same size
    try:
        img2 = cv2.resize(img2, (img1.shape[1], img1.shape[0]))
    except Exception as ex:
        e(f"Failed to resize images: {ex}")
        return 7

    # Compute difference
    try:
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        diff = cv2.absdiff(gray1, gray2)
        _, thresh = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)
    except Exception as ex:
        e(f"Error computing diff: {ex}")
        return 8

    # Dilate to highlight differences
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    thresh = cv2.dilate(thresh, kernel, iterations=2)

    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Draw differences
    result = img2.copy()
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        cv2.rectangle(result, (x, y), (x + w, y + h), (0, 0, 255), 2)

    # (Output directory will be created after we determine the final diff_path)

    # Prepare black-and-white comparison image (use threshold result)
    # thresh is single-channel; keep it as-is for BW output
    bw = thresh.copy()

    # We only produce a single black-and-white diff image (mismatches shown in white)

    # Attempt OCR with pytesseract if available
    ocr_text = None
    try:
        import pytesseract
        # Try to locate the Tesseract executable. Prefer env var `TESSERACT_CMD` if set.
        t_cmd = os.getenv('TESSERACT_CMD') or os.getenv('TESSERACT_PATH')
        if not t_cmd:
            candidates = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                os.path.join(os.environ.get('USERPROFILE', ''), 'AppData', 'Local', 'Programs', 'Tesseract-OCR', 'tesseract.exe')
            ]
            for c in candidates:
                if c and os.path.isfile(c):
                    t_cmd = c
                    break

        if t_cmd:
            pytesseract.pytesseract.tesseract_cmd = t_cmd
            print(f"🔎 Using tesseract executable at: {t_cmd}")
        else:
            print("ℹ️ Tesseract executable not found in PATH or common locations. Set TESSERACT_CMD env var to the tesseract.exe path if installed.")

        try:
            # OCR the whole current image and the BW diff for comparison
            ocr_current = pytesseract.image_to_string(img2)
            ocr_diff = pytesseract.image_to_string(bw)
            ocr_text = {
                'ocr_current_excerpt': ocr_current[:200],
                'ocr_diff_excerpt': ocr_diff[:200]
            }
            print("🔎 OCR performed (excerpts added to report)")
        except Exception as ex:
            e(f"pytesseract failed to OCR images: {ex}")
    except Exception:
        print("ℹ️ pytesseract Python package not installed; skipping OCR")

    # Determine final BW diff path (if not provided, place inside the comparator script folder
    # so outputs are attached to the project alongside the script)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if not diff_path:
        out_dir = script_dir
        cur_base = os.path.splitext(os.path.basename(current_path))[0]
        diff_path = os.path.join(out_dir, f"{cur_base}_bw_diff.png")
    else:
        out_dir = os.path.dirname(diff_path) or '.'
    if out_dir and not os.path.isdir(out_dir):
        try:
            os.makedirs(out_dir, exist_ok=True)
        except Exception as ex:
            e(f"Failed to create output directory {out_dir}: {ex}")
            return 9

    # Write the BW image to the final diff_path
    try:
        saved_bw = cv2.imwrite(diff_path, bw)
        if not saved_bw:
            e(f"cv2.imwrite returned False for BW path: {diff_path}")
            return 10
        print(f"✅ Black-and-white diff image saved at: {diff_path}")
        bw_path = diff_path
    except Exception as ex:
        e(f"Failed to write black-and-white diff image: {ex}")
        return 11

    # Save report next to diff image
    try:
        report_path = os.path.join(out_dir, 'comparison_report.txt')
        with open(report_path, "w", encoding='utf-8') as f:
            f.write(f"Contours detected: {len(contours)}\n")
            f.write(f"BW diff image path: {bw_path}\n")
            if ocr_text:
                f.write("\n--- OCR Excerpts ---\n")
                f.write(f"Current image OCR excerpt:\n{ocr_text['ocr_current_excerpt']}\n")
                f.write(f"BW diff OCR excerpt:\n{ocr_text['ocr_diff_excerpt']}\n")
        print(f"📄 Report saved at: {report_path}")
    except Exception as ex:
        e(f"Failed to write report: {ex}")
        return 12

    return 0


if __name__ == '__main__':
    code = main()
    sys.exit(code)
