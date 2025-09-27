from google import genai
from dotenv import load_dotenv
import os


# Load environvement variables like API key
load_dotenv()

# The client gets the API key from the environment variable `GEMINI_API_KEY`.
client = genai.Client()



response = client.models.generate_content(
    model="gemini-2.5-flash", contents="Explain how AI works in a few words"
)



print(response.text)