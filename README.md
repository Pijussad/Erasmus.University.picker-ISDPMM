# Erasmus Picker (v0.1)

A backend Python script for analyzing course offerings at potential Erasmus exchange universities.

## Description

This script scrapes and analyzes course information for specified universities, focusing on discrete math, literature, and medicine offerings. It uses web scraping and AI-powered analysis (via Anthropic's Claude API) to gather and interpret data.

**Note:** This is version 0.1 and contains backend functionality only. A GUI is planned for future versions.

## Features

- Web scraping of university course information
- AI-powered analysis of course offerings
- Handling of API rate limits and retries
- Results saved to a text file

## Prerequisites

- Python 3.6+
- pip (Python package manager)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/erasmus-picker.git
   cd erasmus-picker
   ```

2. Install required packages:
   ```
   pip install -r requirements.txt
   ```

3. Set up your Anthropic API key:
   - Sign up at https://www.anthropic.com
   - Replace the API key in `Erasmus_picker.py` with your actual key

## Usage

Run the script:

```
python Erasmus_picker.py
```

Results will be saved in `university_analysis_results.txt`.

## Configuration

Modify the `universities` list in `Erasmus_picker.py` to analyze different universities.

## Limitations

- Depends on Google search results and web scraping
- Analysis accuracy relies on scraped data quality and AI model performance
- Subject to API rate limits

## Contributing

Contributions are welcome. Please submit a Pull Request.

## Disclaimer

For educational purposes only. Ensure compliance with all relevant terms of service.
