import os
import re
import requests
from bs4 import BeautifulSoup
import anthropic
import logging
import time
import random
import json
from tqdm import tqdm
from urllib.parse import urljoin, unquote

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Set up Anthropic client
client = anthropic.Anthropic(api_key="") # Add your API key here between the quotes

universities = [
    "Maria Curie-Skłodowska University in Lublin",
    "University of Maribor",
    "University of Tartu"
]

def get_initial_search_url(university_name):
    return f"https://www.google.com/search?q={university_name}+courses"

def generate_ai_search_query(university_name, previous_results):
    system_prompt = '''
    You are an AI assistant tasked with generating search queries to find information about university courses.
    Based on the previous search results and the university name, generate a new search query that might yield more specific or relevant results.
    Focus on areas where the previous search didn't provide high confidence results.
    '''
    
    user_prompt = f'''
    University: {university_name}
    Previous search results:
    {json.dumps(previous_results, indent=2)}
    
    Generate a new search query to find more specific information about courses at this university.
    '''
    
    response = client.messages.create(
        model="claude-3-sonnet-20240229",
        max_tokens=100,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_prompt}
        ]
    )
    return response.content[0].text.strip()

def extract_url(href):
    if href.startswith("/url?q="):
        return unquote(href.split("/url?q=")[1].split("&")[0])
    return href

def fetch_webpage_content(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        logger.error(f"Error fetching {url}: {e}")
        return None

def extract_text_content(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    # Remove script and style elements
    for script in soup(["script", "style"]):
        script.decompose()
    # Get text
    text = soup.get_text()
    # Break into lines and remove leading and trailing space on each
    lines = (line.strip() for line in text.splitlines())
    # Break multi-headlines into a line each
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    # Drop blank lines
    text = '\n'.join(chunk for chunk in chunks if chunk)
    return text[:5000]  # Limit to first 5000 characters

def scrape_university_courses(university_name, is_initial_search=True, previous_results=None):
    if is_initial_search:
        search_url = get_initial_search_url(university_name)
    else:
        search_query = generate_ai_search_query(university_name, previous_results)
        search_url = f"https://www.google.com/search?q={search_query}"
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    
    logger.debug(f"Searching for {university_name} courses at URL: {search_url}")
    
    try:
        response = requests.get(search_url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        logger.debug(f"Successfully retrieved search results for {university_name}")
        
        # Extract search results
        search_results = soup.find_all('div', class_='g')
        course_info = []

        logger.debug(f"Found {len(search_results)} search results for {university_name}")

        for index, result in enumerate(search_results[:3], 1):  # Limit to first 3 results
            title_elem = result.find('h3')
            link_elem = result.find('a')

            if title_elem and link_elem:
                title = title_elem.text
                link = extract_url(link_elem['href'])

                # Fetch and extract content from the actual webpage
                webpage_content = fetch_webpage_content(link)
                if webpage_content:
                    extracted_text = extract_text_content(webpage_content)
                    
                    result_info = {
                        "title": title,
                        "link": link,
                        "content": extracted_text
                    }
                    course_info.append(result_info)

                    logger.debug(f"Extracted information for result {index}:\nTitle: {title}\nLink: {link}\nContent length: {len(extracted_text)} characters")
                else:
                    logger.warning(f"Could not fetch content for {link}")
            else:
                logger.warning(f"Incomplete information for result {index} of {university_name}")

        return course_info
    except requests.RequestException as e:
        logger.error(f"Error scraping {university_name}: {e}")
        return []

def analyze_courses(university_name, courses_info):
    system_prompt = '''
You are an AI assistant analyzing university course offerings. Your task is to determine if the university offers courses in discrete math, literature, and medicine based on the provided information.
For each subject (discrete math, literature, and medicine), provide:

Whether the subject is offered (Yes/No)
Your confidence level in this assessment (0-100%)
A brief explanation for your decision

Base your assessment on the following criteria:

Look for specific mentions of courses or departments related to each field.
Consider related terms (e.g., "computational mathematics" for discrete math, "English" for literature, "health sciences" for medicine).
If there's no clear evidence, lean towards "No" but with lower confidence.

Present your analysis in this format:
Discrete Math:
Offered: [Yes/No]
Confidence: [0-100]%
Explanation: [Brief reasoning]
Literature:
Offered: [Yes/No]
Confidence: [0-100]%
Explanation: [Brief reasoning]
Medicine:
Offered: [Yes/No]
Confidence: [0-100]%
Explanation: [Brief reasoning]
'''
    user_prompt = f'''
Analyze the following course information for {university_name}:
{courses_info}
Based on this information, does the university offer courses in discrete math, literature, and medicine?
Respond using the format specified above.
'''

    max_retries = 5
    base_wait_time = 3

    for attempt in range(max_retries):
        try:
            logger.debug(f"Sending analysis request to Anthropic API for {university_name} (Attempt {attempt + 1})")
            response = client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=200,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            analysis_result = response.content[0].text.strip()
            logger.debug(f"Received analysis result for {university_name}: {analysis_result}")
            return analysis_result
        except anthropic.APIError as e:
            if "rate_limit_error" in str(e):
                wait_time = base_wait_time * (2 ** attempt)
                logger.warning(f"Rate limit exceeded. Waiting for {wait_time} seconds before retrying...")
                time.sleep(wait_time)
            else:
                logger.error(f"Anthropic API error: {e}")
                return None
        except Exception as e:
            logger.error(f"Error analyzing courses for {university_name}: {e}")
            return None

    logger.error(f"Failed to analyze courses for {university_name} after {max_retries} attempts")
    return None

def main():
    results = {}

    for university in tqdm(universities, desc="Analyzing universities"):
        logger.info(f"Processing {university}")
        courses_info = scrape_university_courses(university)
        logger.debug(f"Scraped course information for {university}:\n{json.dumps(courses_info, indent=2)}")
        
        analysis = analyze_courses(university, courses_info)
        confidence_levels = re.findall(r'Confidence: (\d+)%', analysis)
        
        # Continue searching until all confidence levels are above 90%
        search_attempt = 1
        while any(int(conf) <= 90 for conf in confidence_levels) and search_attempt < 5:  # Limit to 5 attempts
            logger.info(f"Confidence levels not all above 90%. Performing additional search for {university}")
            additional_courses_info = scrape_university_courses(university, is_initial_search=False, previous_results=courses_info)
            courses_info.extend(additional_courses_info)
            analysis = analyze_courses(university, courses_info)
            confidence_levels = re.findall(r'Confidence: (\d+)%', analysis)
            search_attempt += 1
        
        results[university] = {
            "scraped_info": courses_info,
            "analysis": analysis
        }
        time.sleep(random.uniform(1, 3))  # Random delay to avoid rate limiting

    # Save results to a file
    with open('university_analysis_results.txt', 'w', encoding='utf-8') as f:
        for university, data in results.items():
            f.write(f"\n{university}:\n")
            f.write(f"Scraped Information:\n{json.dumps(data['scraped_info'], indent=2)}\n")
            f.write(f"Analysis:\n{data['analysis']}\n")
            f.write("-" * 50 + "\n")

    logger.info("Analysis complete. Results saved to university_analysis_results.txt")

if __name__ == "__main__":
    main()
