#!/usr/bin/env python3
"""
Server Application for PowerPoint and Word Integration

This module provides a Flask-based web server that:
1. Handles file uploads (PowerPoint and Word)
2. Processes files using the integration and TTS modules
3. Serves the processed files for download
"""

import os
import uuid
import json
from flask import Flask, request, jsonify, send_file, render_template
from werkzeug.utils import secure_filename
import sys

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '../backend'))

# Import our custom modules
from ppt_word_integration import PPTWordIntegrator
from text_to_speech import TextToSpeechConverter

app = Flask(__name__, 
            static_folder='../frontend/static',
            template_folder='../frontend/templates')

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../uploads')
PROCESSED_FOLDER = os.path.join(os.path.dirname(__file__), '../processed')
ALLOWED_EXTENSIONS_PPT = {'ppt', 'pptx'}
ALLOWED_EXTENSIONS_DOC = {'doc', 'docx'}

# Create directories if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PROCESSED_FOLDER'] = PROCESSED_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB limit

def allowed_file_ppt(filename):
    """Check if the file is an allowed PowerPoint file."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS_PPT

def allowed_file_doc(filename):
    """Check if the file is an allowed Word document."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS_DOC

@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_files():
    """
    Handle file uploads and process them.
    
    Expects:
    - PowerPoint file in 'ppt_file'
    - Word file in 'word_file'
    - Voice type in 'voice_type' (optional)
    - TTS service in 'tts_service' (optional)
    
    Returns:
    - JSON with processing status and job ID
    """
    # Check if both files are present
    if 'ppt_file' not in request.files or 'word_file' not in request.files:
        return jsonify({
            'success': False,
            'message': 'Both PowerPoint and Word files are required'
        }), 400
    
    ppt_file = request.files['ppt_file']
    word_file = request.files['word_file']
    
    # Check if files are selected
    if ppt_file.filename == '' or word_file.filename == '':
        return jsonify({
            'success': False,
            'message': 'No files selected'
        }), 400
    
    # Check file types
    if not allowed_file_ppt(ppt_file.filename):
        return jsonify({
            'success': False,
            'message': 'Invalid PowerPoint file format. Allowed formats: .ppt, .pptx'
        }), 400
    
    if not allowed_file_doc(word_file.filename):
        return jsonify({
            'success': False,
            'message': 'Invalid Word file format. Allowed formats: .doc, .docx'
        }), 400
    
    # Generate a unique job ID
    job_id = str(uuid.uuid4())
    job_folder = os.path.join(app.config['UPLOAD_FOLDER'], job_id)
    os.makedirs(job_folder, exist_ok=True)
    
    # Save the files
    ppt_filename = secure_filename(ppt_file.filename)
    word_filename = secure_filename(word_file.filename)
    
    ppt_path = os.path.join(job_folder, ppt_filename)
    word_path = os.path.join(job_folder, word_filename)
    
    ppt_file.save(ppt_path)
    word_file.save(word_path)
    
    # Get optional parameters
    voice_type = request.form.get('voice_type', 'middle-aged-american-male')
    tts_service = request.form.get('tts_service', 'google')
    
    # Create the output directory
    output_folder = os.path.join(app.config['PROCESSED_FOLDER'], job_id)
    os.makedirs(output_folder, exist_ok=True)
    
    # Generate output filename (preserve original extension)
    output_filename = f"processed_{ppt_filename}"
    intermediate_filename = f"with_notes_{ppt_filename}"
    
    intermediate_path = os.path.join(output_folder, intermediate_filename)
    output_path = os.path.join(output_folder, output_filename)
    
    # Start processing in a background thread (in production, use Celery or similar)
    # For simplicity, we'll do it synchronously here
    try:
        # Step 1: Integrate Word notes into PowerPoint
        integrator = PPTWordIntegrator()
        success, message, details = integrator.process_files(ppt_path, word_path, intermediate_path)
        
        if not success:
            return jsonify({
                'success': False,
                'message': message,
                'details': details
            }), 500
        
        # Step 2: Convert notes to speech and add to PowerPoint
        converter = TextToSpeechConverter(service_type=tts_service)
        success, message, tts_details = converter.process_presentation(
            intermediate_path, output_path, voice_type=voice_type
        )
        
        if not success:
            return jsonify({
                'success': False,
                'message': message,
                'details': tts_details
            }), 500
        
        # Combine details from both steps
        combined_details = {**details, **tts_details}
        
        # Create a status file for the job
        status = {
            'job_id': job_id,
            'status': 'completed',
            'message': 'Processing completed successfully',
            'details': combined_details,
            'output_file': output_filename
        }
        
        with open(os.path.join(output_folder, 'status.json'), 'w') as f:
            json.dump(status, f)
        
        return jsonify({
            'success': True,
            'message': 'Files processed successfully',
            'job_id': job_id,
            'details': combined_details
        })
        
    except Exception as e:
        # Log the error
        print(f"Error processing files: {e}")
        
        # Create a status file for the job
        status = {
            'job_id': job_id,
            'status': 'failed',
            'message': f'Processing failed: {str(e)}'
        }
        
        with open(os.path.join(output_folder, 'status.json'), 'w') as f:
            json.dump(status, f)
        
        return jsonify({
            'success': False,
            'message': f'Error processing files: {str(e)}'
        }), 500

@app.route('/api/status/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """
    Get the status of a processing job.
    
    Args:
        job_id: The unique job ID
        
    Returns:
        JSON with job status
    """
    status_file = os.path.join(app.config['PROCESSED_FOLDER'], job_id, 'status.json')
    
    if not os.path.exists(status_file):
        return jsonify({
            'success': False,
            'message': 'Job not found'
        }), 404
    
    with open(status_file, 'r') as f:
        status = json.load(f)
    
    return jsonify({
        'success': True,
        'status': status
    })

@app.route('/api/download/<job_id>', methods=['GET'])
def download_file(job_id):
    """
    Download the processed PowerPoint file.
    
    Args:
        job_id: The unique job ID
        
    Returns:
        The processed PowerPoint file
    """
    status_file = os.path.join(app.config['PROCESSED_FOLDER'], job_id, 'status.json')
    
    if not os.path.exists(status_file):
        return jsonify({
            'success': False,
            'message': 'Job not found'
        }), 404
    
    with open(status_file, 'r') as f:
        status = json.load(f)
    
    if status['status'] != 'completed':
        return jsonify({
            'success': False,
            'message': 'Processing not completed'
        }), 400
    
    output_file = os.path.join(app.config['PROCESSED_FOLDER'], job_id, status['output_file'])
    
    if not os.path.exists(output_file):
        return jsonify({
            'success': False,
            'message': 'Output file not found'
        }), 404
    
    return send_file(
        output_file,
        as_attachment=True,
        download_name=status['output_file']
    )

@app.route('/api/voice-options', methods=['GET'])
def get_voice_options():
    """
    Get available voice options.
    
    Returns:
        JSON with available voice options
    """
    # In a real implementation, this would query the TTS service for available voices
    # For now, we'll return a static list
    voices = [
        {
            'id': 'middle-aged-american-male',
            'name': 'Middle-aged American Male (Default)',
            'description': 'Engaging, professional male voice with American accent'
        },
        {
            'id': 'young-american-female',
            'name': 'Young American Female',
            'description': 'Clear, energetic female voice with American accent'
        },
        {
            'id': 'senior-british-male',
            'name': 'Senior British Male',
            'description': 'Authoritative male voice with British accent'
        }
    ]
    
    return jsonify({
        'success': True,
        'voices': voices
    })

@app.route('/api/service-options', methods=['GET'])
def get_service_options():
    """
    Get available TTS service options.
    
    Returns:
        JSON with available TTS service options
    """
    services = [
        {
            'id': 'google',
            'name': 'Google Cloud Text-to-Speech',
            'description': 'High-quality, natural-sounding voices'
        },
        {
            'id': 'amazon',
            'name': 'Amazon Polly',
            'description': 'Lifelike speech with customizable voice characteristics'
        },
        {
            'id': 'azure',
            'name': 'Microsoft Azure Speech Service',
            'description': 'Neural voices with natural prosody'
        },
        {
            'id': 'elevenlabs',
            'name': 'ElevenLabs',
            'description': 'Ultra-realistic voices with emotional range'
        }
    ]
    
    return jsonify({
        'success': True,
        'services': services
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
