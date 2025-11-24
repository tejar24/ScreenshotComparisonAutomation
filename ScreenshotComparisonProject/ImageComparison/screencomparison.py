import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim
import pytesseract
from PIL import Image
import os
from datetime import datetime

# ----------------------------
# CONFIGURATION
# ----------------------------
BASE_PATH = r'C:\Users\tejar\Demo\ScreenshotComparisonProject\ImageComparison'
BASELINE_IMAGE = os.path.join(BASE_PATH, 'baseline.png')
CURRENT_IMAGE = os.path.join(BASE_PATH, 'current.png')
OUTPUT_DIFF_IMAGE = os.path.join(BASE_PATH, 'diff_highlighted_bw.png')
OUTPUT_REPORT_TXT = os.path.join(BASE_PATH, 'comparison_report.txt')

# Logo/image templates (example: put .png logo files here)
TEMPLATE_PATH = os.path.join(BASE_PATH, 'templates')  # Folder containing logos/icons to check

pytesseract.pytesseract.tesseract_cmd = r"C:\Users\tejar\tesseract.exe"

# ----------------------------
# LOAD IMAGES
# ----------------------------
img1 = cv2.imread(BASELINE_IMAGE)
img2 = cv2.imread(CURRENT_IMAGE)

if img1 is None or img2 is None:
    raise FileNotFoundError("Check the screenshot paths. Images not found!")

gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)

# ----------------------------
# COMPUTE SSIM DIFFERENCE
# ----------------------------
score, diff = ssim(gray1, gray2, full=True)
diff = (diff * 255).astype("uint8")
_, bw_diff = cv2.threshold(diff, 200, 255, cv2.THRESH_BINARY_INV)
kernel = np.ones((3, 3), np.uint8)
bw_diff = cv2.dilate(bw_diff, kernel, iterations=1)

# Black & white difference image
highlighted = np.ones_like(gray2) * 255
highlighted[bw_diff == 255] = 0
cv2.imwrite(OUTPUT_DIFF_IMAGE, highlighted)

# Visual match percentage
total_pixels = bw_diff.size
mismatch_pixels = np.count_nonzero(bw_diff)
match_percentage = ((total_pixels - mismatch_pixels) / total_pixels) * 100

# ----------------------------
# OCR TEXT COMPARISON
# ----------------------------
text1 = pytesseract.image_to_string(Image.open(BASELINE_IMAGE))
text2 = pytesseract.image_to_string(Image.open(CURRENT_IMAGE))
text_diff = set(text1.split()) ^ set(text2.split())
text_diff_report = "No text differences detected." if not text_diff else ", ".join(text_diff)

# ----------------------------
# LOGOS/IMAGES MATCH (Template Matching)
# ----------------------------
logo_reports = []
if os.path.exists(TEMPLATE_PATH):
    templates = [f for f in os.listdir(TEMPLATE_PATH) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    for tpl_file in templates:
        tpl_path = os.path.join(TEMPLATE_PATH, tpl_file)
        template = cv2.imread(tpl_path, 0)
        if template is None:
            continue
        w, h = template.shape[::-1]

        # Template matching on baseline and current
        res_baseline = cv2.matchTemplate(gray1, template, cv2.TM_CCOEFF_NORMED)
        res_current = cv2.matchTemplate(gray2, template, cv2.TM_CCOEFF_NORMED)

        threshold = 0.9  # similarity threshold
        match_baseline = np.max(res_baseline) >= threshold
        match_current = np.max(res_current) >= threshold

        percentage = 100 if match_baseline and match_current else 0
        logo_reports.append(f"{tpl_file}: {percentage}% match")
else:
    logo_reports.append("No logo templates provided.")

# ----------------------------
# PLAIN ENGLISH REPORT
# ----------------------------
report_lines = [
    "===== SCREENSHOT COMPARISON REPORT =====",
    f"Generated: {datetime.now()}",
    f"SSIM Score (Visual Similarity): {score:.4f}",
    f"Visual Match Percentage: {match_percentage:.2f}%",
    f"Difference Image Saved At: {OUTPUT_DIFF_IMAGE}",
    f"Text Differences: {text_diff_report}",
    "Logo/Image Template Matches:"
] + logo_reports + [
    "========================================"
]

# Print report in console
for line in report_lines:
    print(line)

# Save report to text file
with open(OUTPUT_REPORT_TXT, "w") as f:
    f.write("\n".join(report_lines))

print(f"Plain English report saved at: {OUTPUT_REPORT_TXT}")
