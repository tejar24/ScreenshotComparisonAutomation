import cv2
import pytesseract
from skimage.metrics import structural_similarity as ssim
import sys
import numpy as np
from difflib import SequenceMatcher

# --- Command line arguments ---
if len(sys.argv) != 3:
    print("Usage: python compare_screenshots.py <actual_image> <baseline_image>")
    sys.exit(1)

actual_path = sys.argv[1]
baseline_path = sys.argv[2]

# --- Configure Tesseract path ---
pytesseract.pytesseract.tesseract_cmd = r"C:\Users\tejar\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"

# --- Load images ---
actual_img = cv2.imread(actual_path)
baseline_img = cv2.imread(baseline_path)

if actual_img is None:
    raise FileNotFoundError(f"Actual image not found at: {actual_path}")
if baseline_img is None:
    raise FileNotFoundError(f"Baseline image not found at: {baseline_path}")

# --- Resize baseline to match actual dimensions ---
h_actual, w_actual = actual_img.shape[:2]
h_base, w_base = baseline_img.shape[:2]

if (h_actual != h_base) or (w_actual != w_base):
    print(f"WARNING: Images have different dimensions. Resizing baseline from {w_base}x{h_base} to {w_actual}x{h_actual}.")
    baseline_img = cv2.resize(baseline_img, (w_actual, h_actual), interpolation=cv2.INTER_AREA)

# --- Convert to grayscale for SSIM ---
gray_actual = cv2.cvtColor(actual_img, cv2.COLOR_BGR2GRAY)
gray_baseline = cv2.cvtColor(baseline_img, cv2.COLOR_BGR2GRAY)

# --- Compute SSIM ---
similarity, diff = ssim(gray_actual, gray_baseline, full=True)
print(f"Structural similarity: {similarity * 100:.2f}%")

# --- Save diff image ---
diff_img = (diff * 255).astype("uint8")
cv2.imwrite("diff.png", diff_img)
print("Diff image saved as diff.png")

# --- OCR Text Comparison ---
def preprocess_for_ocr(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.medianBlur(gray, 3)
    thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    return thresh

text_actual = pytesseract.image_to_string(preprocess_for_ocr(actual_img))
text_baseline = pytesseract.image_to_string(preprocess_for_ocr(baseline_img))

# --- Fuzzy Text Comparison ---
def similarity_ratio(a, b):
    return SequenceMatcher(None, a, b).ratio()

text_similarity = similarity_ratio(text_actual, text_baseline)
print(f"OCR text similarity: {text_similarity * 100:.2f}%")

if text_similarity >= 0.95:
    print("OCR text matches!")
else:
    print("OCR text mismatch detected!")
    print("Baseline snippet:", text_baseline[:150])
    print("Actual snippet:", text_actual[:150])

# --- Exit code logic ---
exit_code = 0
if similarity < 0.95:
    print("FAIL: Screenshots do not match (SSIM below threshold).")
    exit_code = 1
if text_similarity < 0.95:
    print("FAIL: OCR text does not match.")
    exit_code = 1

if exit_code == 0:
    print("PASS: Screenshots match!")

sys.exit(exit_code)
