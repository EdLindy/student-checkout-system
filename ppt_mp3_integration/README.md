# PowerPoint MP3 Integration Project

A web application that enhances PowerPoint presentations with audio speaker notes from MP3 files.

## Overview

This application allows users to:

1. Upload a PowerPoint presentation and an MP3 file containing speaker notes
2. Automatically detect slide markers in the audio (e.g., "Slide 1", "Slide 2")
3. Segment the audio based on these markers
4. Transcribe the audio segments into text
5. Insert both audio segments and transcribed text into the appropriate slides
6. Download the enhanced presentation with audio that plays automatically on slide transition

## Project Structure

```
ppt_mp3_integration/
├── src/
│   ├── backend/
│   │   ├── ppt_audio_integration.py  # PowerPoint integration functionality
│   │   ├── audio_segmentation.py     # Audio segmentation functionality
│   │   └── speech_transcription.py   # Speech recognition and transcription
│   ├── frontend/
│   │   ├── templates/
│   │   │   └── index.html            # Main HTML template
│   │   └── static/
│   │       ├── css/
│   │       │   └── styles.css        # CSS styles
│   │       ├── js/
│   │       │   └── main.js           # Frontend JavaScript
│   │       └── images/               # SVG icons and images
│   └── server/
│       └── app.py                    # Flask server application
└── research/
    ├── technical_requirements.md     # Technical research and requirements
    └── ui_design.md                  # User interface design documentation
```

## Installation

### Prerequisites

- Python 3.8 or higher
- pip (Python package installer)
- Web browser (Chrome, Firefox, Safari, or Edge)

### Setup

1. Clone or extract this repository to your local machine
2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`
4. Install the required packages:
   ```bash
   pip install flask python-pptx pydub SpeechRecognition
   ```
5. Create necessary directories:
   ```bash
   mkdir -p src/server/uploads
   mkdir -p src/server/processed
   ```

## Usage

1. Start the server:
   ```bash
   cd src/server
   python app.py
   ```
2. Open your web browser and navigate to:
   ```
   http://localhost:5000
   ```
3. Follow the on-screen instructions to:
   - Upload your PowerPoint presentation
   - Upload your MP3 file with slide markers
   - Select transcription options
   - Process and download your enhanced presentation

## Audio File Requirements

The MP3 file should be a continuous recording with clear verbal markers like:
- "Slide 1 [title]" followed by the content for that slide
- "Slide 2 [title]" followed by the content for that slide
- And so on...

The application will detect these markers and segment the audio accordingly.

## Transcription Services

The application supports multiple transcription services:
- Google Cloud Speech-to-Text
- Amazon Transcribe
- Microsoft Azure Speech Service
- OpenAI Whisper

To use these services, you'll need to set up API credentials as described in the speech_transcription.py file.

## Deployment Options

### Local Deployment
- Follow the installation and usage instructions above

### Server Deployment
1. Set up a virtual private server (VPS)
2. Install the required dependencies
3. Use Gunicorn as a production WSGI server:
   ```bash
   gunicorn -w 4 -b 0.0.0.0:5000 app:app
   ```
4. Set up Nginx as a reverse proxy
5. Configure HTTPS with Let's Encrypt

## Customization

- Modify the CSS in `src/frontend/static/css/styles.css` to change the appearance
- Adjust the audio segmentation parameters in `src/backend/audio_segmentation.py`
- Configure transcription options in `src/backend/speech_transcription.py`

## Limitations

- The current implementation uses placeholder code for audio processing and transcription
- In a production environment, you would need to implement the actual API calls
- Maximum file size is limited to 100MB for both PowerPoint and MP3 files

## License

This project is provided as-is with no warranty. Use at your own risk.
