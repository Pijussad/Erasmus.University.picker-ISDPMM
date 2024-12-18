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
SUBJECTS = [
    "Akademinė ir mokslinė anglų kalba C1",
    "Informacinės ir grupinio darbo sistemos",
    "Kompiuterių architektūra",
    "Matematika informacinėms sistemoms",
    "Procedūrinis programavimas",
    "Algoritmai ir duomenų struktūros",
    "Diskrečioji matematika informacinėms sistemoms",
    "Duomenų bazių valdymo sistemos",
    "Objektinis programavimas",
    "Kompiuterių tinklai",
    "Naudotojo sąsajos kūrimas",
    "Verslo procesų modeliavimas",
    "Operacinės sistemos",
    "Optimizavimo metodai",
    "Statistiniai duomenų analizės metodai",
    "Duomenų tyryba ir mašininis mokymasis",
    "Reikalavimų inžinerijos pagrindai",
    "Informacinių sistemų kūrimo projektų valdymo metodikos",
    "Informacinės saugos pagrindai",
    "Kursinis darbas",
    "Programų sistemų kokybė",
    "Bakalauro baigiamasis darbas (kryptis: informatikos inžinerija)",
    "Profesinė praktika (Informacinių sistemų inžinerija)"
]
CONFIDENCE_THRESHOLD = 70
MAX_SEARCH_ATTEMPTS = 4
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
MAX_CONTENT_LENGTH = 1500

def get_unique_universities():
    """Get unique universities from Firestore."""
    docs = (
        db.collection("universities")
        .where(filter=FieldFilter("salis", "in", ["Latvija", "Estija"]))
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
    """Search using Brave Search API with rate limiting"""
    brave_url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": os.getenv('BRAVE_API_KEY')
    }
    params = {
        "q": query,
        "count": 2
    }

    try:
        # Rate limiting - 1 request per second
        time.sleep(1)
        
        logger.info(f"Searching with Brave for query: {query}")
        response = requests.get(brave_url, headers=headers, params=params)
        response.raise_for_status()
        results = response.json()
        
        subject_info = []
        for result in results.get('web', {}).get('results', []):
            title = result.get('title')
            link = result.get('url')
            if title and link:
                webpage_content = fetch_webpage_content(link)
                if webpage_content:
                    extracted_text = extract_text_content(webpage_content)
                    subject_info.append({
                        "title": title,
                        "link": link,
                        "content": extracted_text,
                        "type": "pdf" if link.lower().endswith('.pdf') else "html"
                    })
                    print(f"Found result (Brave): {title} ({link})")
        
        return subject_info
    except Exception as e:
        logger.error(f"Brave search error for query '{query}': {str(e)}")
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
You are an AI assistant analyzing university course offerings. Your task is to determine if {university_name} offers courses related to {subject}(in lithuanian it is called like that) based on the provided information. Consider only courses taught in English.

Consider the following:
1. Direct mentions of subjects closely related to {subject}(it is lithuanian subject name, translate it to english) taught in English.
2. Related courses or topics that might include content on {subject}(it is lithuanian subject name, translate it to english) taught in English.
3. is it bachelor program?

dont put links in descriptions

Provide:
1. Whether the subject is likely offered in English (Yes/No/Unclear)
2. Your confidence level in this assessment (0-100%)
3. A brief explanation for your decision (max 200 words)

If there's no clear evidence of English-language offerings, use "Unclear" with a lower confidence.
'''

    limited_content = json.dumps(subject_info, indent=2)[-3000:]
    user_prompt = f'''
Analyze the following information about {subject} at {university_name}, considering only English-language offerings:
{limited_content}

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
    The subject we're looking in lithuanian is called "{subject}"(translate it in a language of prompt).
    dont put links in descriptions
    Consider these strategies:
    1. Break down the subject into broader component terms
    2. Use alternative names for the subject area
    3. Include related fields and disciplines
    4. Try both full university name and common abbreviations
    5. Include general terms like "curriculum", "courses", "study programs"
    6. Mix English and {university['language']} terms
    '''

    user_prompt = f'''
    Create 4 search queries to find information about {subject}(translate it to apropriate language)-related courses at {university['name']}.
    Make the queries more general but still relevant.
    Include both:
    - One query using oficial university website
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
            f"{university['name']} courses",
            f"{university['name']} programs",
        ]

def process_university_subject(university, subject):
    """Process a single subject for a university."""
    try:
        logger.info(f"\nProcessing {subject} at {university['name']}")
        print(f"\nProcessing: {subject} at {university['name']}")
        print("-" * 50)
        
        all_subject_info = []
        previous_queries = []
        
        search_attempt = 0
        confidence = 0
        final_analysis = None
        
        while confidence <= CONFIDENCE_THRESHOLD and search_attempt < MAX_SEARCH_ATTEMPTS:
            queries = generate_additional_search_terms(university, subject, previous_queries)
            print(f"\nSearch Attempt {search_attempt + 1}")
            print("Queries:")
            
            for query in queries:
                if not query.strip():
                    continue
                    
                previous_queries.append(query)
                print(f"- {query}")
                
                new_subject_info = search_subject(query)
                if new_subject_info:
                    print(f"Found {len(new_subject_info)} results")
                    all_subject_info.extend(new_subject_info)
                
            analysis = analyze_subject(university['name'], subject, all_subject_info, university['language'])
            confidence = get_confidence(analysis)
            final_analysis = analysis
            
            print(f"\nConfidence: {confidence}%")
            
            search_attempt += 1
            if confidence <= CONFIDENCE_THRESHOLD and search_attempt < MAX_SEARCH_ATTEMPTS:
                print(f"Confidence below threshold. Attempting additional search.")
                time.sleep(random.uniform(1, 2))
        
        return {
            "subject": subject,
            "subject_info": all_subject_info,
            "analysis": final_analysis,
            "queries": previous_queries,
            "confidence": confidence,
            "search_attempts": search_attempt
        }
        
    except Exception as e:
        logger.error(f"Error processing {subject} for {university['name']}: {str(e)}")
        return {
            "subject": subject,
            "subject_info": [],
            "analysis": "Error occurred during analysis",
            "queries": previous_queries if 'previous_queries' in locals() else [],
            "error": str(e),
            "confidence": 0,
            "search_attempts": search_attempt if 'search_attempt' in locals() else 0
        }

def save_results(results, timestamp, universities):
    """Save results to both Firestore and local file."""
    collection_name = f'university_analysis_{timestamp}'
    
    # Create lookup dictionary for quick access
    university_lookup = {uni['name']: uni for uni in universities}
    
    for university_name, university_data in results.items():
        university_info = university_lookup.get(university_name)
        for subject, subject_data in university_data.items():
            try:
                university_doc = db.collection(collection_name).document(university_name)
                subject_doc = university_doc.collection('MIF').document(subject)
                
                subject_doc.set({
                    'subject': subject,
                    'analysis': subject_data['analysis'],
                    'confidence': subject_data['confidence'],
                    'salis': university_info['country'] if university_info else None
                })
                
                logger.info(f"Saved analysis for {subject} at {university_name} to Firestore")
            except Exception as e:
                logger.error(f"Error saving results for {subject} at {university_name} to Firestore: {str(e)}")
    
    # Save to local file
    filename = f"university_analysis_{timestamp}.json"
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump({
                'timestamp': time.time(),
                'subjects': SUBJECTS,
                'results': results
            }, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved detailed results to {filename}")
    except Exception as e:
        logger.error(f"Error saving results to file: {str(e)}")
    
    return collection_name, filename

def main():
    """Main function with multi-subject support."""
    start_time = time.time()
    
    try:
        # Get unique universities
        universities = get_unique_universities()
        
        # Print input universities and subjects
        print("\n=== Analysis Configuration ===")
        print(f"Total universities: {len(universities)}")
        print(f"Subjects to analyze: {', '.join(SUBJECTS)}")
        print("\n" + "="*40 + "\n")
        
        results = {}
        
        # Process universities with progress bar
        total_operations = len(universities) * len(SUBJECTS)
        with tqdm(total=total_operations, desc="Analyzing universities") as pbar:
            for university in universities:
                results[university['name']] = {}
                for subject in SUBJECTS:
                    results[university['name']][subject] = process_university_subject(university, subject)
                    pbar.update(1)
                    time.sleep(random.uniform(1, 2))  # Prevent rate limiting
        
        # Save results
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        collection_name, filename = save_results(results, timestamp, universities)
        
        # Print summary
        end_time = time.time()
        duration = end_time - start_time
        print(f"\nAnalysis complete in {duration:.2f} seconds")
        print(f"Results saved to:")
        print(f"- Firestore collection: {collection_name}")
        print(f"- Local file: {filename}")
        
        # Print detailed analysis results
        print("\n=== Detailed Analysis Results ===\n")
        for university_name, subjects_data in results.items():
            print(f"\nUniversity: {university_name}")
            print("=" * 50)
            for subject, data in subjects_data.items():
                print(f"\nSubject: {subject}")
                print("-" * 40)
                print(f"Final confidence: {data['confidence']}%")
                print(f"Search attempts: {data['search_attempts']}")
                print(f"Total information sources: {len(data['subject_info'])}")
                print("\nAnalysis:")
                print(data['analysis'])
                print("-" * 40)
        
    except Exception as e:
        logger.error(f"Fatal error in main: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Program terminated with error: {str(e)}")
        raise
