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
from dotenv import load_dotenv

# Firebase imports
import firebase_admin
from firebase_admin import firestore, credentials
from google.cloud.firestore_v1.base_query import FieldFilter

# Load environment variables
load_dotenv()

# Set up logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)
logger = logging.getLogger(__name__)

# Set up Anthropic client
client = anthropic.Anthropic(
    api_key=os.getenv('API_KEY')
)

# Set up Firebase client
cred = credentials.Certificate('key.json')
app = firebase_admin.initialize_app(cred)
db = firestore.client()

# Constants
SUBJECT = "Information systems testing and maintenance"
CONFIDENCE_THRESHOLD = 40  # Lowered from 70
MAX_SEARCH_ATTEMPTS = 4
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
MAX_CONTENT_LENGTH = 5000

def get_unique_universities():
    """Get unique universities from Firestore."""
    docs = (
        db.collection("universities")
        .where(filter=FieldFilter("salis", "==", "Latvija"))
        .stream()
    )
    
    # Use dictionary comprehension to ensure uniqueness
    universities_dict = {
        doc['universitetas']: {
            "name": doc['universitetas'],
            "country": doc['salis'],
            "language": doc['kalbos'][0]
        } for doc in [doc.to_dict() for doc in docs]
    }
    
    return list(universities_dict.values())

def extract_url(href):
    """Extract clean URL from Google search result."""
    if href.startswith("/url?q="):
        return unquote(href.split("/url?q=")[1].split("&")[0])
    return href

def extract_pdf_content(pdf_url):
    """Extract text content from PDF URL with detailed logging."""
    try:
        logger.info(f"Attempting to extract PDF content from: {pdf_url}")
        headers = {'User-Agent': USER_AGENT}
        response = requests.get(pdf_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        pdf_file = io.BytesIO(response.content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        text_content = []
        for i, page in enumerate(pdf_reader.pages):
            logger.debug(f"Extracting text from PDF page {i+1}")
            text_content.append(page.extract_text())
        
        full_text = ' '.join(text_content)
        truncated_text = ' '.join(full_text.split())[:MAX_CONTENT_LENGTH]
        
        logger.info(f"Successfully extracted {len(truncated_text)} characters from PDF")
        return truncated_text
        
    except Exception as e:
        logger.error(f"Error extracting PDF content from {pdf_url}: {str(e)}")
        return None

def fetch_webpage_content(url):
    """Fetch content from webpage with improved error handling."""
    try:
        logger.info(f"Fetching content from: {url}")
        headers = {'User-Agent': USER_AGENT}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        content_type = response.headers.get('content-type', '').lower()
        
        if 'application/pdf' in content_type:
            return extract_pdf_content(url)
        
        logger.info(f"Successfully fetched HTML content from {url}")
        return response.text
        
    except requests.RequestException as e:
        logger.error(f"Error fetching {url}: {str(e)}")
        return None

def extract_text_content(html_content):
    """Extract readable text from HTML content."""
    if not html_content:
        return None
        
    if isinstance(html_content, str) and not html_content.strip().startswith('<'):
        return html_content[:MAX_CONTENT_LENGTH]
    
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove unwanted elements
        for element in soup(["script", "style", "header", "footer", "nav"]):
            element.decompose()
        
        text = soup.get_text(separator=' ', strip=True)
        cleaned_text = ' '.join(text.split())[:MAX_CONTENT_LENGTH]
        
        logger.info(f"Extracted {len(cleaned_text)} characters of text content")
        return cleaned_text
        
    except Exception as e:
        logger.error(f"Error extracting text content: {str(e)}")
        return None

def search_subject(query):
    """Search for subject information with improved parsing."""
    if not query or query.strip() == "":
        logger.warning("Empty search query received")
        return []
        
    search_url = f"https://www.google.com/search?q={quote_plus(query)}"
    headers = {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
    }
    
    logger.info(f"Performing search with query: {query}")
    
def search_subject(query):
    search_url = f"https://www.google.com/search?q={quote_plus(query)}"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    
    logger.info(f"Searching with query: {query}")
    
    try:
        response = requests.get(search_url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        search_results = soup.find_all('div', class_='g')
        subject_info = []

        for result in search_results[:2]:
            title_elem = result.find('h3')
            link_elem = result.find('a')

            if title_elem and link_elem:
                title = title_elem.text
                link = extract_url(link_elem['href'])
                webpage_content = fetch_webpage_content(link)
                if webpage_content:
                    extracted_text = extract_text_content(webpage_content)
                    subject_info.append({
                        "title": title,
                        "link": link,
                        "content": extracted_text,
                        "type": "pdf" if link.lower().endswith('.pdf') else "html"  # Added this line
                    })
                    print(f"Found result: {title} ({link})")

        return subject_info
        
    except Exception as e:
        logger.error(f"Error searching with query '{query}': {str(e)}")
        return []

def analyze_subject(university_name, subject, subject_info, local_language):
    """Analyze subject information with better handling of empty results."""
    if not subject_info:
        return f"""
Offered in English: Unclear
No course information found in the search results.
Confidence: 10%
is it bachelor program?: Unclear
No program information available.
Explanation: No relevant course information was found in the search results. The university's offerings could not be determined from the available data."""
    
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
        logger.error(f"Error analyzing {subject} for {university_name}: {str(e)}")
        return None

def get_confidence(analysis):
    """Extract confidence score from analysis text."""
    if not analysis:
        return 0
    match = re.search(r'Confidence: (\d+)%', analysis)
    return int(match.group(1)) if match else 0

def generate_additional_search_terms(university, subject, previous_queries):
    """Generate additional search terms using Claude AI."""
    system_prompt = f'''
    You are an AI assistant tasked with generating broad but relevant search terms to find university course information.
    The university is {university['name']} in {university['country']}, and the local language is {university['language']}.
    The subject we're looking for is "{subject}".

    Consider these strategies:
    1. Break down the subject into broader component terms
    2. Use alternative names for the subject area
    3. Include related fields and disciplines
    4. Try both full university name and common abbreviations
    5. Include general terms like "curriculum", "courses", "study programs"
    6. Mix English and {university['language']} terms
    '''

    user_prompt = f'''
    Create 4 search queries to find information about {subject}-related courses at {university['name']}.
    Make the queries more general but still relevant.
    Include both:
    - One query using site:{get_university_domain(university['name'])}
    - One query with filetype:pdf
    - Mix of English and {university['language']} terms
    - Focus on broader related terms like "computer science", "IT", "software", etc.

    Previous queries used:
    {json.dumps(previous_queries, indent=2)}

    Return only 4 new search queries, one per line.
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
        queries = response.content[0].text.strip().split('\n')
        return [q for q in queries if q.strip()]
    except Exception as e:
        logger.error(f"Error generating search terms: {str(e)}")
        # Fallback to basic queries if API fails
        return [
            f"site:{get_university_domain(university['name'])} computer science courses",
            f"{university['name']} information technology filetype:pdf",
            f"{university['name']} IT studies English",
            f"{university['name']} software engineering program"
        ]

def translate_subject(subject, target_language):
    """Translate subject to target language using Claude AI."""
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
        logger.error(f"Error translating subject to {target_language}: {str(e)}")
        return subject

def process_university(university):
    """Process university with improved error handling and output."""
    try:
        logger.info(f"\nProcessing {university['name']}")
        print(f"\nProcessing: {university['name']}")
        print("-" * 50)
        
        all_subject_info = []
        previous_queries = []
        
        # Translate subject
        translated_subject = translate_subject(SUBJECT, university['language'])
        print(f"Translated subject: {translated_subject}\n")
        
        search_attempt = 0
        confidence = 0
        final_analysis = None
        
        while confidence <= CONFIDENCE_THRESHOLD and search_attempt < MAX_SEARCH_ATTEMPTS:
            # Generate search queries
            if search_attempt == 0:
                # Initial queries - more general and targeted
                base_queries = [
                    f"site:{get_university_domain(university['name'])} computer science",
                    f"{university['name']} information systems English",
                    f"{university['name']} IT courses filetype:pdf",
                    f"{university['name']} study programs software testing"
                ]
                queries = [q for q in base_queries if q.strip()]
            else:
                # Generate additional queries
                queries = generate_additional_search_terms(university, SUBJECT, previous_queries)
            
            print(f"\nSearch Attempt {search_attempt + 1}")
            print("Queries:")
            
            for query in queries:
                if not query.strip():
                    continue
                    
                previous_queries.append(query)
                print(f"- {query}")
                
                # Perform search
                new_subject_info = search_subject(query)
                if new_subject_info:
                    print(f"Found {len(new_subject_info)} results:")
                    for info in new_subject_info:
                        print(f"  - {info['title']}")
                        print(f"    URL: {info['link']}")
                        print(f"    Type: {info['type']}")
                        print(f"    Content length: {len(info['content'])} characters")
                        print(f"    Preview: {info['content'][:150]}...")
                    all_subject_info.extend(new_subject_info)
                else:
                    print("  No results found")
            
            # Analyze results
            analysis = analyze_subject(university['name'], SUBJECT, all_subject_info, university['language'])
            confidence = get_confidence(analysis)
            final_analysis = analysis
            
            print(f"\nConfidence: {confidence}%")
            
            search_attempt += 1
            if confidence <= CONFIDENCE_THRESHOLD and search_attempt < MAX_SEARCH_ATTEMPTS:
                print(f"Confidence below threshold. Attempting additional search.")
                time.sleep(random.uniform(1, 2))  # Prevent rate limiting
        
        return {
            "subject_info": all_subject_info,
            "analysis": final_analysis,
            "queries": previous_queries,
            "confidence": confidence,
            "search_attempts": search_attempt
        }
        
    except Exception as e:
        logger.error(f"Error processing university {university['name']}: {str(e)}")
        return {
            "subject_info": [],
            "analysis": "Error occurred during analysis",
            "queries": previous_queries,
            "error": str(e),
            "confidence": 0,
            "search_attempts": search_attempt if 'search_attempt' in locals() else 0
        }

def get_university_domain(university_name):
    """Get university domain name for site-specific searches."""
    # Add common university domains - extend this list as needed
    domain_mapping = {
        "Liepajas Universitate": "liepu.lv",
        "Latvijas Universitate": "lu.lv",
        "Riga Technical University": "rtu.lv",
        "Alberta Koledža": "alberta-koledza.lv"
    }
    return domain_mapping.get(university_name, "")

def main():
    """Main function with improved error handling and output formatting."""
    start_time = time.time()
    
    try:
        # Get unique universities
        universities = get_unique_universities()
        
        # Print input universities from database
        print("\n=== Universities from Database ===")
        print(f"Total universities found: {len(universities)}")
        for uni in universities:
            print(f"\nName: {uni['name']}")
            print(f"Country: {uni['country']}")
            print(f"Language: {uni['language']}")
        print("\n" + "="*40 + "\n")
        
        results = {}
        
        # Process universities with progress bar
        for university in tqdm(universities, desc="Analyzing universities"):
            results[university['name']] = process_university(university)
            time.sleep(random.uniform(1, 2))
        
        # Print detailed analysis results
        print("\n=== Detailed Analysis Results ===\n")
        for university_name, data in results.items():
            print(f"\nUniversity: {university_name}")
            print("-" * 50)
            print(f"Total queries used: {len(data['queries'])}")
            print(f"Search attempts: {data['search_attempts']}")
            print(f"Final confidence: {data['confidence']}%")
            print(f"Total information sources found: {len(data['subject_info'])}")
            
            if data['subject_info']:
                print("\nInformation sources:")
                for info in data['subject_info']:
                    print(f"\n- Title: {info['title']}")
                    print(f"  URL: {info['link']}")
                    print(f"  Type: {info['type']}")
                    print(f"  Content preview: {info['content'][:200]}...")
            
            print("\nAnalysis:")
            if data['analysis']:
                print(data['analysis'])
            else:
                print("No analysis available")
            print("=" * 50)
        
        # Save results
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        
        # Save to Firestore
        collection_name = f'university_analysis_{timestamp}'
        for university_name, data in results.items():
            try:
                doc_ref = db.collection(collection_name).document(university_name)
                doc_ref.set({
                    'timestamp': firestore.SERVER_TIMESTAMP,
                    'subject': SUBJECT,
                    'analysis_data': data
                }, merge=True)
                logger.info(f"Saved analysis for {university_name} to Firestore")
            except Exception as e:
                logger.error(f"Error saving results for {university_name} to Firestore: {str(e)}")
        
        # Save to local file
        filename = f"university_analysis_{timestamp}.json"
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump({
                    'timestamp': time.time(),
                    'subject': SUBJECT,
                    'results': results
                }, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved detailed results to {filename}")
        except Exception as e:
            logger.error(f"Error saving results to file: {str(e)}")
        
        # Print summary
        end_time = time.time()
        duration = end_time - start_time
        print(f"\nAnalysis complete in {duration:.2f} seconds")
        print(f"Results saved to:")
        print(f"- Firestore collection: {collection_name}")
        print(f"- Local file: {filename}")
        
    except Exception as e:
        logger.error(f"Fatal error in main: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Program terminated with error: {str(e)}")
        raise