import os
import re
import requests
import PyPDF2
import io
import anthropic
import logging
import time
import random
import json
from bs4 import BeautifulSoup
from tqdm import tqdm
from urllib.parse import urljoin, unquote, quote_plus
from dotenv import load_dotenv  # Add this import

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Set up Anthropic client
client = anthropic.Anthropic(
    api_key=os.getenv('ANTHROPIC_API_KEY')
)

universities = [
    {"name": "Universidade do Porto", "country": "Portugal", "language": "Portugese"}
]

SUBJECT = "Information systems testing and maintenance"
CONFIDENCE_THRESHOLD = 70
MAX_SEARCH_ATTEMPTS = 4

def extract_url(href):
    if href.startswith("/url?q="):
        return unquote(href.split("/url?q=")[1].split("&")[0])
    return href

def extract_pdf_content(pdf_url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(pdf_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Read PDF content from the response
        pdf_file = io.BytesIO(response.content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        # Extract text from all pages
        text_content = []
        for page in pdf_reader.pages:
            text_content.append(page.extract_text())
        
        # Join all pages and limit the content
        full_text = ' '.join(text_content)
        return ' '.join(full_text.split())[:5000]  # Limit to first 5000 characters
        
    except Exception as e:
        logger.error(f"Error extracting PDF content from {pdf_url}: {e}")
        return None

def fetch_webpage_content(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Check if the URL points to a PDF
        content_type = response.headers.get('content-type', '').lower()
        if 'application/pdf' in content_type:
            return extract_pdf_content(url)
        
        return response.text
    except requests.RequestException as e:
        logger.error(f"Error fetching {url}: {e}")
        return None

def extract_text_content(html_content):
    # If the content is already text (from PDF), return it
    if isinstance(html_content, str) and not html_content.strip().startswith('<'):
        return html_content
    
    # Otherwise, parse HTML
    soup = BeautifulSoup(html_content, 'html.parser')
    for script in soup(["script", "style"]):
        script.decompose()
    text = soup.get_text(separator=' ', strip=True)
    return ' '.join(text.split())[:5000]

def search_subject(query):
    search_url = f"https://www.google.com/search?q={quote_plus(query)}"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    logger.info(f"Searching with query: {query}")
    
    try:
        response = requests.get(search_url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        search_results = soup.find_all('div', class_='g')
        subject_info = []

        for result in search_results[:3]:  # Increased to top 3 results
            title_elem = result.find('h3')
            link_elem = result.find('a')

            if title_elem and link_elem:
                title = title_elem.text
                link = extract_url(link_elem['href'])
                
                # Skip if not PDF or HTML
                if not (link.lower().endswith('.pdf') or any(ext in link.lower() for ext in ['.htm', '.html', ''])):
                    continue
                
                webpage_content = fetch_webpage_content(link)
                if webpage_content:
                    extracted_text = extract_text_content(webpage_content)
                    subject_info.append({
                        "title": title,
                        "link": link,
                        "content": extracted_text,
                        "type": "pdf" if link.lower().endswith('.pdf') else "html"
                    })

        return subject_info
    except requests.RequestException as e:
        logger.error(f"Error searching with query '{query}': {e}")
        return []

def analyze_subject(university_name, subject, subject_info, local_language):
    system_prompt = f'''
You are an AI assistant analyzing university course offerings. Your task is to determine if {university_name} offers courses related to {subject} based on the provided information. Consider only courses taught in English.

Consider the following:
1. Direct mentions of subjects closely related to {subject} taught in English.
2. Related courses or topics that might include content on {subject} taught in English.
3. is it bachelor program?

Provide:
1. Whether the subject is likely offered in English (Yes/No/Unclear)
2. Your confidence level in this assessment (0-100%)
3. A brief explanation for your decision (max 200 words)

If there's no clear evidence of English-language offerings, use "Unclear" with a lower confidence.
'''
    user_prompt = f'''
Analyze the following information about {subject} at {university_name}, considering only English-language offerings:
{json.dumps(subject_info, indent=2)}

Does the university likely offer courses related to {subject} in English?
Respond using this format:
Offered in English: [Yes/No/Unclear] + 60 words on what is the decision made also provide link on what decission was made
Confidence: [0-100]%
is it bachelor program?: [Yes/No/Unclear] + 60 words on what is the decision made
Explanation: [Brief reasoning, max 100 words]
'''

    try:
        response = client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=150,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ]
        )
        return response.content[0].text.strip()
    except Exception as e:
        logger.error(f"Error analyzing {subject} for {university_name}: {e}")
        return None

def get_confidence(analysis):
    match = re.search(r'Confidence: (\d+)%', analysis)
    return int(match.group(1)) if match else 0

def generate_additional_search_terms(university, subject, previous_queries):
    system_prompt = f'''
You are an AI assistant tasked with generating search terms to find information about university courses.
Your goal is to create diverse and specific search queries that will uncover course offerings related to the given subject.
The university is in {university['country']}, and the local language is {university['language']}.

Consider the following strategies:
1. Generate queries in both English and {university['language']}.
2. Use synonyms or related terms for the subject in both languages.
3. Include academic terms like "syllabus", "curriculum", "course catalog" in both languages.
4. Add "PDF" to some queries to find course catalogs and syllabi.
5. Include terms related to course registration or degree requirements in both languages.

Analyze the previous queries to avoid repetition and focus on unexplored areas.
'''
    
    user_prompt = f'''
University: {university['name']}
Subject: {subject}
Previous search queries:
{json.dumps(previous_queries, indent=2)}

Generate 4 new, distinct search queries to find specific information about {subject} courses at this university.
Include at least one query specifically targeting PDF documents.
Provide 2 queries in English and 2 in {university['language']}.

Respond with only the four new search queries, one per line.
'''

    try:
        response = client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=400,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ]
        )
        return response.content[0].text.strip().split('\n')
    except Exception as e:
        logger.error(f"Error generating additional search terms: {e}")
        return []

def translate_subject(subject, target_language):
    system_prompt = f"You are a translator. Translate the following academic subject from English to {target_language}."
    user_prompt = f"Translate '{subject}' to {target_language}."

    try:
        response = client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=50,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ]
        )
        return response.content[0].text.strip()
    except Exception as e:
        logger.error(f"Error translating subject to {target_language}: {e}")
        return subject

def process_university(university):
    logger.info(f"Processing {university['name']}")
    all_subject_info = []
    previous_queries = []
    
    translated_subject = translate_subject(SUBJECT, university['language'])
    
    search_attempt = 0
    confidence = 0
    final_analysis = None
    while confidence <= CONFIDENCE_THRESHOLD and search_attempt < MAX_SEARCH_ATTEMPTS:
        if search_attempt == 0:
            queries = [
                f"{university['name']} {SUBJECT} course English language filetype:pdf",
                f"{university['name']} {translated_subject} course pdf",
                f"{university['name']} {SUBJECT} course English language"
            ]
        else:
            queries = generate_additional_search_terms(university, SUBJECT, previous_queries)
        
        for query in queries:
            previous_queries.append(query)
            logger.info(f"Search query: {query}")
            
            new_subject_info = search_subject(query)
            all_subject_info.extend(new_subject_info)
        
        analysis = analyze_subject(university['name'], SUBJECT, all_subject_info, university['language'])
        confidence = get_confidence(analysis)
        final_analysis = analysis
        
        search_attempt += 1
        if confidence <= CONFIDENCE_THRESHOLD:
            logger.info(f"Confidence level {confidence}% below threshold. Performing additional search for {university['name']}")
    
    return {
        "subject_info": all_subject_info,
        "analysis": final_analysis,
        "queries": previous_queries
    }

def main():
    results = {}

    for university in tqdm(universities, desc="Analyzing universities"):
        results[university['name']] = process_university(university)
        time.sleep(random.uniform(1, 2))

    # Save results to a file
    with open('university_subject_analysis_results.txt', 'w', encoding='utf-8') as f:
        f.write(f"Subject: {SUBJECT}\n\n")
        for university_name, data in results.items():
            f.write(f"{university_name}:\n")
            f.write(f"Queries:\n{json.dumps(data['queries'], indent=2)}\n")
            f.write(f"Subject Information:\n{json.dumps(data['subject_info'], indent=2)}\n")
            f.write(f"Analysis:\n{data['analysis']}\n")
            f.write("-" * 50 + "\n")

    logger.info("Analysis complete. Results saved to university_subject_analysis_results.txt")

if __name__ == "__main__":
    main()
