import cv2
import easyocr
import requests
import json
import os

def extract_text_from_video(video_path, language='en', frame_interval=10):
    """
    Extracts text from a video using EasyOCR.

    Args:
        video_path (str): Path to the video file.
        language (str): Language code for EasyOCR (e.g., 'en', 'es', 'fr').
        frame_interval (int): Process every nth frame.

    Returns:
        str: Concatenated string of extracted text.
    """

    reader = easyocr.Reader([language])
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        print(f"Error: Could not open video file: {video_path}")
        return ""

    frame_count = 0
    detected_texts = set()
    all_extracted_text = ""

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % frame_interval == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            ocr_results = reader.readtext(gray)

            for (bbox, text, prob) in ocr_results:
                if text not in detected_texts:
                    detected_texts.add(text)
                    all_extracted_text += " " + text

        frame_count += 1

    cap.release()
    cv2.destroyAllWindows()
    return all_extracted_text.strip()

def analyze_text_with_ai(extracted_text, llm_url, llm_api_key):
    """
    Analyzes extracted text using a custom LLM, focusing on restaurant details.

    Args:
        extracted_text (str): The text extracted from the video.
        llm_url (str): URL of the custom LLM API.
        llm_api_key (str): API key for the custom LLM.

    Returns:
        dict: Parsed JSON response from the LLM.
    """

    prompt = f"""
    Analyze the transcript and determine the type of content to provide a tailored response based on our business lines:
  1. Cooking Reel:

  Identify the transcript as a cooking reel if it focuses on preparing food at home.
  Extract a list of ingredients mentioned in the transcript.
  Format the response to redirect to Instamart with a list of ingredients.
  2. Restaurant/Food Related Reel:

  Identify the transcript as a restaurant or food-related reel if it discusses dining out or specific restaurants.
  Extract and structure the information as follows:
  - A list of all restaurant names mentioned.
  - A list of all food items mentioned.
  - A mapping showing which food items belong to which restaurants.
  - Format the response as a JSON object with these exact fields:
  restaurants: An array of restaurant names.
  items: An array of food items.
  mapping: An object where keys are restaurant names and values are arrays of food items available at that restaurant.
  If a food item's restaurant isn't specified, include it in a special "unknown" category in the mapping.
  If information isn't available, use empty arrays.
  3. Healthy Content:

  Identify the transcript as healthy-related content if it focuses on health and wellness.
  Provide healthy suggestions based on the content.

    Extracted Text: {extracted_text}
    """

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {llm_api_key}'
    }

    data = {
        "model": "bedrock-claude-3-sonnet",
        "messages": [
            {"role": "user", "content": "You are a restaurant name extractor. Extract a list of restaurant names from the text and format it exactly as requested."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(llm_url + "/chat/completions", headers=headers, json=data)
        response.raise_for_status()
        llm_analysis = json.loads(response.json()['choices'][0]['message']['content'])
        return {
            "restaurants": llm_analysis.get("restaurants", [])
        }
    except requests.exceptions.RequestException as e:
        print(f"Error calling LLM API: {e}")
        try:
            print("Response content:", response.json())
        except:
            pass
        return None
    except json.JSONDecodeError as e:
        print(f"Error parsing LLM response: {e}")
        try:
            print("Response content:", response.text)
        except:
            pass
        return None

def main():
    video_path = "without_audio/videoplayback (1).mp4"  # Replace with your video path
    llm_url = "http://bedrock.llm.in-west.swig.gy"  # Replace with your LLM URL
    llm_api_key = "sk-v-n7IXIpgsSw3zwRDS1mFA"  # Replace with your LLM API key

    extracted_text = extract_text_from_video(video_path)
    if extracted_text:
        print("Extracted Text:", extracted_text)
        analysis = analyze_text_with_ai(extracted_text, llm_url, llm_api_key)
        if analysis:
            print("LLM Analysis:", json.dumps(analysis, indent=2))
        else:
            print("LLM analysis failed.")
    else:
        print("Failed to extract text from video.")

if __name__ == "__main__":
    main()