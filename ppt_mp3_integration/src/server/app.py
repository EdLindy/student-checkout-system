#!/usr/bin/env python3
"""
Server Application for PowerPoint and MP3 Integration

This module provides a Flask-based web server that:
1. Handles file uploads (PowerPoint and MP3)
2. Processes files using the integration, segmentation, and transcription modules
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
from ppt_audio_integration import PPTAudioIntegrator
from audio_segmentation import AudioSegmenter
from speech_transcription import SpeechTranscriber

app = Flask(__name__, 
            static_folder='../frontend/static',
            template_folder='../frontend/templates')

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../uploads')
PROCESSED_FOLDER = os.path.join(os.path.dirname(__file__), '../processed')
ALLOWED_EXTENSIONS_PPT = {'ppt', 'pptx'}
ALLOWED_EXTENSIONS_AUDIO = {'mp3'}

# Create directories if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PROCESSED_FOLDER'] = PROCESSED_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB limit

def allowed_file_ppt(filename):
    """Check if the file is an allowed PowerPoint file."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS_PPT

def allowed_file_audio(filename):
    """Check if the file is an allowed audio file."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS_AUDIO

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
    - MP3 file in 'mp3_file'
    - Transcription service in 'transcription_service' (optional)
    
    Returns:
    - JSON with processing status and job ID
    """
    # Check if both files are present
    if 'ppt_file' not in request.files or 'mp3_file' not in request.files:
        return jsonify({
            'success': False,
            'message': 'Both PowerPoint and MP3 files are required'
        }), 400
    
    ppt_file = request.files['ppt_file']
    mp3_file = request.files['mp3_file']
    
    # Check if files are selected
    if ppt_file.filename == '' or mp3_file.filename == '':
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
    
    if not allowed_file_audio(mp3_file.filename):
        return jsonify({
            'success': False,
            'message': 'Invalid audio file format. Allowed formats: .mp3'
        }), 400
    
    # Generate a unique job ID
    job_id = str(uuid.uuid4())
    job_folder = os.path.join(app.config['UPLOAD_FOLDER'], job_id)
    os.makedirs(job_folder, exist_ok=True)
    
    # Save the files
    ppt_filename = secure_filename(ppt_file.filename)
    mp3_filename = secure_filename(mp3_file.filename)
    
    ppt_path = os.path.join(job_folder, ppt_filename)
    mp3_path = os.path.join(job_folder, mp3_filename)
    
    ppt_file.save(ppt_path)
    mp3_file.save(mp3_path)
    
    # Get optional parameters
    transcription_service = request.form.get('transcription_service', 'google')
    
    # Create the output directory
    output_folder = os.path.join(app.config['PROCESSED_FOLDER'], job_id)
    os.makedirs(output_folder, exist_ok=True)
    
    # Generate output filename (preserve original extension)
    output_filename = f"enhanced_{ppt_filename}"
    output_path = os.path.join(output_folder, output_filename)
    
    # Start processing in a background thread (in production, use Celery or similar)
    # For simplicity, we'll do it synchronously here
    try:
        # Step 1: Segment the audio file
        segmenter = AudioSegmenter()
        success, message, segmentation_details = segmenter.process_audio_file(mp3_path)
        
        if not success:
            return jsonify({
                'success': False,
                'message': message,
                'details': segmentation_details
            }), 500
        
        # Step 2: Transcribe the audio segments
        transcriber = SpeechTranscriber(service_type=transcription_service)
        transcriptions = transcriber.batch_transcribe(segmentation_details['audio_segments'])
        
        # Format the transcriptions
        formatted_transcriptions = {}
        for slide_idx, transcription in transcriptions.items():
            formatted_transcriptions[slide_idx] = transcriber.format_transcription(transcription)
        
        # Step 3: Integrate audio and transcriptions into PowerPoint
        integrator = PPTAudioIntegrator()
        if not integrator.load_powerpoint(ppt_path):
            return jsonify({
                'success': False,
                'message': 'Failed to load PowerPoint file',
                'details': {}
            }), 500
        
        success, message, integration_details = integrator.integrate_audio_and_notes(
            segmentation_details['audio_segments'], 
            formatted_transcriptions, 
            output_path
        )
        
        if not success:
            return jsonify({
                'success': False,
                'message': message,
                'details': integration_details
            }), 500
        
        # Clean up temporary files
        segmenter.cleanup()
        
        # Combine details from all steps
        combined_details = {
            'markers_detected': segmentation_details['markers_detected'],
            'segments_created': segmentation_details['segments_created'],
            'transcriptions_created': len(transcriptions),
            'slides_total': integration_details['slides_total'],
            'audio_added': integration_details['audio_added'],
            'notes_added': integration_details['notes_added'],
            'failed_slides': integration_details['failed_slides']
        }
        
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

@app.route('/api/transcription-services', methods=['GET'])
def get_transcription_services():
    """
    Get available transcription service options.
    
    Returns:
        JSON with available transcription service options
    """
    services = [
        {
            'id': 'google',
            'name': 'Google Cloud Speech-to-Text',
            'description': 'High-accuracy speech recognition with punctuation'
        },
        {
            'id': 'amazon',
            'name': 'Amazon Transcribe',
            'description': 'Accurate transcription with speaker identification'
        },
        {
            'id': 'azure',
            'name': 'Microsoft Azure Speech Service',
            'description': 'Advanced transcription with punctuation and formatting'
        },
        {
            'id': 'whisper',
            'name': 'OpenAI Whisper',
            'description': 'State-of-the-art speech recognition model'
        }
    ]
    
    return jsonify({
        'success': True,
        'services': services
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
