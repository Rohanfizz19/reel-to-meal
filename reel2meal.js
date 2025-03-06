const axios = require('axios');

// Configuration
const SEARCH_API_KEY = 'ju78fscTwNjqQ8jB73XiVrRr';
const CUSTOM_LLM_URL = 'http://bedrock.llm.in-west.swig.gy';
const CUSTOM_LLM_API_KEY = 'sk-v-n7IXIpgsSw3zwRDS1mFA';
const LANGUAGES = ['en', 'hi','te']; // Languages to try

// Extract video ID from YouTube URL
function extractVideoId(url) {
  // Handle regular YouTube watch URLs and embeds
  let regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  let match = url.match(regExp);
  
  if (match && match[7] && match[7].length === 11) {
    return match[7];
  }
  
  // Handle YouTube Shorts URLs
  regExp = /^.*((youtube\.com\/shorts\/)([^#&?]*)).*/;
  match = url.match(regExp);
  
  if (match && match[3] && match[3].length === 11) {
    return match[3];
  }
  
  // If no match found
  return null;
}

// Fetch transcript for a specific language
async function fetchTranscript(videoId, language) {
  try {
    const response = await axios.get('https://www.searchapi.io/api/v1/search', {
      params: {
        engine: 'youtube_transcripts',
        video_id: videoId,
        api_key: SEARCH_API_KEY,
        lang: language
      }
    });
    
    if (response.data.transcripts && response.data.transcripts.length > 0) {
      return {
        language,
        success: true,
        data: response.data
      };
    } else {
      return {
        language,
        success: false,
        error: 'No transcript found'
      };
    }
  } catch (error) {
    return {
      language,
      success: false,
      error: error.message
    };
  }
}

// Try to get transcript in any of the specified languages
async function getTranscriptInAnyLanguage(videoId) {
  for (const lang of LANGUAGES) {
    const result = await fetchTranscript(videoId, lang);
    // console.log(result);
    if (result.success) {
      return result;
    }
  }
  throw new Error('Could not find transcript in any of the specified languages');
}

// Process transcript with custom LLM to extract food and restaurant information
async function analyzeTranscriptWithAI(transcript, videoTitle) {
  // Convert transcript to text
  const fullText = transcript.map(item => item.text).join(' ');
  
  // Create prompt for LLM
  const prompt = `
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

Transcript: ${fullText}
`;

  try {
    // Call custom LLM API
    const response = await axios.post(
      `${CUSTOM_LLM_URL}/chat/completions`, 
      {
        model: "bedrock-claude-3-sonnet",
        messages: [
          { role: "user", content: "You are a food review analyzer. Extract structured information from food video transcripts and format it exactly as requested." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CUSTOM_LLM_API_KEY}`
        }
      }
    );

    // Parse the response
    try {
      // Get the LLM analysis
      const llmAnalysis = JSON.parse(response.data.choices[0].message.content);
      
      // Format to final structure
      return {
        restaurants: llmAnalysis.restaurants || [],
        items: llmAnalysis.items || [],
        mapping: llmAnalysis.mapping || {},
        source_url: null, // This will be added in the main function
        title: videoTitle || null
      };
    } catch (error) {
      console.error("Error parsing LLM response:", error);
      return { 
        raw_response: response.data.choices[0].message.content,
        parse_error: error.message
      };
    }
  } catch (error) {
    console.error("Error calling LLM API:", error.message, error.response?.data);
    throw new Error(`Failed to analyze transcript: ${error.message}`);
  }
}

// Main function that processes a YouTube URL
async function analyzeFoodVideo(youtubeUrl) {
  try {
    // Extract video ID
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    console.log(`Analyzing YouTube video: ${youtubeUrl} (ID: ${videoId})`);
    
    // Get transcript in any available language
    const transcriptResult = await getTranscriptInAnyLanguage(videoId);
    console.log(`Found transcript in ${transcriptResult.language}`);
    
    // Process with custom LLM
    console.log('Analyzing transcript with Bedrock Claude-3...');
    const analysis = await analyzeTranscriptWithAI(transcriptResult.data.transcripts);
    
    // Enhance the result with metadata
    const result = {
      video_id: videoId,
      video_url: youtubeUrl,
      transcript_language: transcriptResult.language,
      analysis_timestamp: new Date().toISOString(),
      food_analysis: analysis
    };
    
    return result;
  } catch (error) {
    console.error('Error in analysis:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Usage example
async function main() {
  const youtubeUrl = "https://youtube.com/shorts/xCtae6inl1M?si=gDokFbaFycMAItPM";
  const result = await analyzeFoodVideo(youtubeUrl);
  
  console.log(JSON.stringify(result, null, 2));
}

// Run the script
main();
