import cv2
import easyocr

# Load OCR model
reader = easyocr.Reader(['en'])

# Load video
video_path = "/Top 7 Restaurants in Bangalore _ Bangalore Fine Dine Restaurants.mp4"
cap = cv2.VideoCapture(video_path)

frame_count = 0
detected_texts = set()  # Track detected text

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    if frame_count % 10 == 0:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        results = reader.readtext(gray)

        for (bbox, text, prob) in results:
            if text not in detected_texts: #check if the text has already been detected.
                print(f"Detected text: {text} (Confidence: {prob:.2f})")
                detected_texts.add(text) #add the text to the set.

    frame_count += 1

cap.release()
cv2.destroyAllWindows()
