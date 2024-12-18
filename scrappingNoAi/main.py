import requests
from bs4 import BeautifulSoup
import re
import time
from selenium import webdriver
import firebase_admin
from firebase_admin import firestore, credentials
from google.cloud.firestore_v1.base_query import FieldFilter
from thefuzz import fuzz
from thefuzz import process

driver = webdriver.Firefox()

class Universitetas:
   def __init__(self, fakultetas, universitetas, url, salis, kodas, sritis, bakalauroT, magistroT, doktoranturosT, kalbos):
      self.fakultetas = fakultetas
      self.universitetas = universitetas
      self.url = url
      self.salis = salis
      self.kodas = kodas
      self.sritis = sritis
      self.bakalauroT = bakalauroT
      self.magistroT = magistroT
      self.doktoranturosT = doktoranturosT
      self.kalbos = kalbos

#class Semestras:
#   def __init__(self, privalomi, pasirenkami, kreditai, kreditaiModulis):
#      self.privalomi = privalomi
#      self.pasirenkami = pasirenkami
#      self.kreditai = kreditai
#      self.kreditaiModulis = kreditaiModulis

class Semestras:
   def __init__(self, privalomi, pasirenkami):
      self.privalomi = privalomi
      self.pasirenkami = pasirenkami

def getSoupStatic(url):
   try:
      response = requests.get(url)
      response.raise_for_status()
   except requests.exceptions.RequestException as e:
      print(f"Error fetching the webpage: {e}")

   try:
      soup = BeautifulSoup(response.content, "html.parser")
   except Exception as e:
      print(f"Error parsing the HTML: {e}")
   return soup

def getSoupJS(url, delay):
   try:
      #Naudojamas firefox bet galima naudoti ir kitus webdrivers
      driver.get(url)
      time.sleep(delay)
      html = driver.page_source
   except requests.exceptions.RequestException as e:
      print(f"Error fetching the webpage: {e}")

   try:
      soup = BeautifulSoup(html, "html.parser")
   except Exception as e:
      print(f"Error parsing the HTML: {e}")
   return soup

def scrapeVUErasmus():
   soup = getSoupStatic('https://www.erasmus.tprs.vu.lt/partneriai/?fid=11')
   table = soup.find('table')

   universitetai = []

   for row in table.find_all('tr')[2:]:
      TD = row.find_all('td')

      faculty = TD[1].text.strip()

      NC = TD[2].text.strip().split(' (')
      university = NC[0]
      url = TD[2].find('a', href=True)['href']
      country = NC[1].rstrip(')')

      code = TD[3].text.strip()
      field = TD[4].text.strip().split('\n')[0].strip()
      durationB = TD[6].text.strip()
      durationM = TD[8].text.strip()
      durationD = TD[10].text.strip()

      languages = re.split(r'\(.+?\)|, |; ', TD[11].text.strip())
      languages = [language for language in languages if language != '']
      languages = [language.strip() for language in languages if language[0] != '\t' and language[0] != ' ' and ':' not in language]

      universitetai.append(Universitetas(faculty, university, url, country, code, field, durationB, durationM, durationD, languages))

   #semestrai = [universitetas.__dict__ for universitetas in universitetai]
   #return semestrai
   return universitetai

def scrapeVUCourse(url):
   try:
      soup = getSoupJS(url, 1)
      table = soup.find('div', id='vu-program').find('table')

      name = soup.find('header', {'class': "nodate"}).find('h1').text.strip().replace(' ', '_')

      semestrai = []

      #kreditai = 0
      #kreditaiModulio = 0
      privalomi = []
      pasirenkami = []

      isPrivalomas = True
      isFirst = True

      for row in table.find_all('tr')[1:]:
         TD = row.find_all('td')
         match TD[0]['class'][0]:
            case 'semestras':
               if not isFirst:
                  #semestrai.append(Semestras(privalomi.copy(), pasirenkami.copy(), kreditai, kreditaiModulio))
                  semestrai.append(Semestras(privalomi.copy(), pasirenkami.copy()))
               else:
                  isFirst = False
               #kreditai = 0
               #kreditaiModulio = 0
               privalomi.clear()
               pasirenkami.clear()
            case 'grupe':
               match TD[0].text.strip():
                  case 'Privalomieji dalykai':
                     isPrivalomas = True
                     #kreditai += float(TD[1].text.strip())
                  case 'Pasirenkamieji dalykai':
                     isPrivalomas = False
                     #kreditai += float(TD[1].text.strip())
                  #case 'Individualiųjų studijų dalykai (moduliai)':
                     #kreditaiModulio = float(TD[1].text.strip())
                     #kreditai += float(TD[1].text.strip())
            case 'dalykas':
               if isPrivalomas:
                  privalomi.append(TD[0].text.strip())
               else:
                  pasirenkami.append(TD[0].text.strip())

      #semestrai.append(Semestras(privalomi.copy(), pasirenkami.copy(), kreditai, kreditaiModulio))
      semestrai.append(Semestras(privalomi.copy(), pasirenkami.copy()))
      semestrai = [semestras.__dict__ for semestras in semestrai]
      return {name: semestrai}
   except Exception as e:
      print(f"Error parsing the HTML: {e}")
      return None

def scrapeVUCourseURLs(url):
   soup = getSoupJS(url, 1)
   programos = soup.find('div', {'class': "kviecia-list-of-programs"})

   fakultetai = []

   for li in programos.findAll('li'):
      fakultetas = li.find('h4').text.strip().replace(' ', '_')
      urls = ['https://www.vu.lt' + url['href'] for url in li.findAll('a', href=True)]
      fakultetai.append({fakultetas: urls})

   return fakultetai

def scrapeQS(db, url):
   docs = (
      db.collection("universities")
      .stream()
   )

   universities = [doc.to_dict()['universitetas'] for doc in docs]

   rq = requests.get(url)
   qs = str(rq.content)
   qs = qs.split(',')[3:]
   qs = [item.strip() for item in qs]
   ratings = {}
   ratings2 = {}

   ratings2[' '.join([x for x in qs[1].split(' ') if 'Uni' not in x])] = qs[0].split("\\n")[1].strip()
   ratings[qs[1]] = qs[0].split("\\n")[1].strip()

   qs = qs[2:]

   for i in range(int(len(qs) / 2)):
      ratings2[' '.join([x for x in qs[i*2+1].split(' ') if 'Uni' not in x])] = qs[i*2].split('\\n')[1].strip()
      ratings[qs[i * 2 + 1]] = qs[i * 2].split('\\n')[1].strip()

   ratings_final = {}

   for uni in universities:
      uni2 = ' '.join([x for x in uni.split(' ') if 'Uni' not in x])
      res = process.extract(uni2, list(ratings2.keys()), scorer=fuzz.token_set_ratio)[0]
      if res[1] >= 80:
         ratings_final[uni] = int(ratings2[res[0]].split('-')[0])
      else:
         ratings_final[uni] = 0

   for key, value in ratings_final.items():
      unis = db.collection("universities").where("universitetas", "==", key).get()
      for uni in unis:
         db.collection("universities").document(uni.id).update({'qs': value})

def scrapeCostOfLiving(url):
   soup = getSoupStatic(url)
   table = soup.find('tbody')
   countries = {}

   nycNoRent = 1617.11
   nycOnlyRent = 3238.40

   translations = {
      "Switzerland": "Šveicarija",
      "Bahamas": "Bahamos",
      "Iceland": "Islandija",
      "Singapore": "Singapūras",
      "Barbados": "Barbadosas",
      "Norway": "Norvegija",
      "Denmark": "Danija",
      "Hong Kong (China)": "Honkongas",
      "United States": "Jungtinės Amerikos Valstijos",
      "Australia": "Australija",
      "Austria": "Austrija",
      "Canada": "Kanada",
      "New Zealand": "Naujoji Zelandija",
      "Ireland": "Airija",
      "France": "Prancūzija",
      "Puerto Rico": "Puerto Rikas",
      "Finland": "Suomija",
      "Netherlands": "Nyderlandai",
      "Israel": "Izraelis",
      "Luxembourg": "Liuksemburgas",
      "Germany": "Vokietija",
      "United Kingdom": "Jungtinė Karalystė",
      "Belgium": "Belgija",
      "South Korea": "Pietų Korėja",
      "Sweden": "Švedija",
      "Italy": "Italija",
      "United Arab Emirates": "Jungtiniai Arabų Emyratai",
      "Cyprus": "Kipras",
      "Uruguay": "Urugvajus",
      "Jamaica": "Jamaika",
      "Malta": "Malta",
      "Trinidad And Tobago": "Trinidadas ir Tobagas",
      "Costa Rica": "Kosta Rika",
      "Bahrain": "Bahreinas",
      "Greece": "Graikija",
      "Estonia": "Estija",
      "Qatar": "Kataras",
      "Slovenia": "Slovėnija",
      "Latvia": "Latvija",
      "Spain": "Ispanija",
      "Lithuania": "Lietuva",
      "Slovakia": "Slovakija",
      "Cuba": "Kuba",
      "Czech Republic": "Čekija",
      "Panama": "Panama",
      "Japan": "Japonija",
      "Croatia": "Kroatija",
      "Saudi Arabia": "Saudo Arabija",
      "Taiwan": "Taivanas",
      "Portugal": "Portugalija",
      "Oman": "Omanas",
      "Kuwait": "Kuveitas",
      "Albania": "Albanija",
      "Lebanon": "Libanas",
      "Hungary": "Vengrija",
      "Palestine": "Palestina",
      "Jordan": "Jordanija",
      "Armenia": "Armėnija",
      "Poland": "Lenkija",
      "Mexico": "Meksika",
      "El Salvador": "Salvadoras",
      "Montenegro": "Juodkalnija",
      "Chile": "Čilė",
      "Guatemala": "Gvatemala",
      "Venezuela": "Venesuela",
      "Bulgaria": "Bulgarija",
      "Dominican Republic": "Dominikos Respublika",
      "Serbia": "Serbija",
      "Romania": "Rumunija",
      "Turkey": "Turkija",
      "Cambodia": "Kambodža",
      "Cameroon": "Kamerūnas",
      "Zimbabwe": "Zimbabvė",
      "Mauritius": "Mauricijus",
      "Fiji": "Fidžis",
      "Bosnia And Herzegovina": "Bosnija ir Hercegovina",
      "Sri Lanka": "Šri Lanka",
      "South Africa": "Pietų Afrika",
      "Thailand": "Tailandas",
      "Moldova": "Moldova",
      "Georgia": "Gruzija",
      "North Macedonia": "Šiaurės Makedonija",
      "Ecuador": "Ekvadoras",
      "Kazakhstan": "Kazachstanas",
      "China": "Kinija",
      "Nigeria": "Nigerija",
      "Azerbaijan": "Azerbaidžanas",
      "Philippines": "Filipinai",
      "Russia": "Rusija",
      "Ghana": "Gana",
      "Brazil": "Brazilija",
      "Kenya": "Kenija",
      "Botswana": "Botsvana",
      "Malaysia": "Malaizija",
      "Peru": "Peru",
      "Morocco": "Marokas",
      "Kosovo (Disputed Territory)": "Kosovas",
      "Argentina": "Argentina",
      "Iraq": "Irakas",
      "Uganda": "Uganda",
      "Algeria": "Alžyras",
      "Colombia": "Kolumbija",
      "Vietnam": "Vietnamas",
      "Tunisia": "Tunisas",
      "Bolivia": "Bolivija",
      "Kyrgyzstan": "Kirgizija",
      "Indonesia": "Indonezija",
      "Iran": "Iranas",
      "Uzbekistan": "Uzbekija",
      "Belarus": "Baltarusija",
      "Ukraine": "Ukraina",
      "Nepal": "Nepalas",
      "Paraguay": "Paragvajus",
      "Madagascar": "Madagaskaras",
      "Syria": "Sirija",
      "Tanzania": "Tanzanija",
      "Bangladesh": "Bangladešas",
      "India": "Indija",
      "Egypt": "Egiptas",
      "Libya": "Libija",
      "Pakistan": "Pakistanas",
   }

   for row in table.find_all('tr'):
      td = row.find_all('td')

      costOfLivingIndex = float(td[2].text)
      rentIndex = float(td[3].text)

      livingCostNoRent = nycNoRent * costOfLivingIndex / 100
      rentCost = nycOnlyRent * rentIndex / 100

      countries[translations[td[1].text]] = {'costOfLiving': float("{:.2f}".format(livingCostNoRent)), 'rentCost': float("{:.2f}".format(rentCost))}

   return countries

def scrapeScholarships(url):
   soup = getSoupJS(url, 1)
   table = soup.find('div', id='finansavimo-salygos').find('table')

   countries = {}

   for row in table.find_all('tr')[1:]:
      td = row.find_all('td')
      price = int(td[2].text)
      for country in td[1].text.strip().split('\n')[0].split(', '):
         countries[country.replace('.', '')] = price

   return countries

if __name__ == '__main__':
   cred = credentials.Certificate('key.json')
   app = firebase_admin.initialize_app(cred)
   db = firestore.client()

   #VU bakalauro programu scrapinimas
   #for fakultetas in scrapeVUCourseURLs('https://www.vu.lt/studijos/stojantiesiems/bakalauro-studiju-sarasas'):
   #   for key in fakultetas:
   #      doc = db.collection('VU_courses').document(key)
   #      for url in fakultetas[key]:
   #         programa = scrapeVUCourse(url)
   #         if programa is not None:
   #            doc.set(programa, merge=True)

   #Nuscrapinami MIF ERASMUS universitetai
   #for universitetas in scrapeVUErasmus():
   #   doc = db.collection('universities').document()
   #   doc.set(universitetas)

   #QS reitingo nuskaitymas
   #scrapeQS(db, 'https://www.universityrankings.ch/results?ranking=QS&region=World&year=2025&q=&mode=csv')

   #Gyvenimo islaidu gavimas
   countries = scrapeCostOfLiving('https://www.numbeo.com/cost-of-living/rankings_by_country.jsp?title=2024-mid&displayColumn=-1')

   #Stipendiju gavimas
   countries2 = scrapeScholarships('https://www.vu.lt/tarptautiniai-rysiai/mainu-galimybes/erasmus-plus/studentams-plus#finansavimo-salygos')

   for key, value in countries2.items():
      if key in list(countries.keys()):
         countries[key]['scholarship'] = value
      else:
         countries[key] = {'scholarship': value}

   for key, value in countries.items():
      doc = db.collection('Countries').document(key)
      doc.set(value, merge=True)

   driver.close()