/**
 * PowerPoint Audio Enhancer
 * Main JavaScript File
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const uploadForm = document.getElementById('upload-form');
    const pptUploadBox = document.getElementById('ppt-upload-box');
    const mp3UploadBox = document.getElementById('mp3-upload-box');
    const pptFileInput = document.getElementById('ppt-file');
    const mp3FileInput = document.getElementById('mp3-file');
    const pptBrowseBtn = document.getElementById('ppt-browse-btn');
    const mp3BrowseBtn = document.getElementById('mp3-browse-btn');
    const pptFileInfo = document.getElementById('ppt-file-info');
    const mp3FileInfo = document.getElementById('mp3-file-info');
    const processBtn = document.getElementById('process-btn');
    const getStartedBtn = document.getElementById('get-started-btn');
    
    const uploadSection = document.getElementById('upload-section');
    const audioProcessingSection = document.getElementById('audio-processing-section');
    const transcriptionSection = document.getElementById('transcription-section');
    const processingSection = document.getElementById('processing-section');
    const resultSection = document.getElementById('result-section');
    
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const markersList = document.getElementById('markers-list');
    const continueToTranscriptionBtn = document.getElementById('continue-to-transcription-btn');
    const backToUploadBtn = document.getElementById('back-to-upload-btn');
    
    const slidesNav = document.getElementById('slides-nav');
    const currentSlideTitle = document.getElementById('current-slide-title');
    const segmentPlayer = document.getElementById('segment-player');
    const transcriptionText = document.getElementById('transcription-text');
    const continueToProcessingBtn = document.getElementById('continue-to-processing-btn');
    const backToAudioBtn = document.getElementById('back-to-audio-btn');
    
    const progressBar = document.getElementById('progress-bar');
    const statusMessage = document.getElementById('status-message');
    const progressSteps = {
        uploading: document.getElementById('step-uploading'),
        segmenting: document.getElementById('step-segmenting'),
        transcribing: document.getElementById('step-transcribing'),
        integrating: document.getElementById('step-integrating')
    };
    
    const totalSlides = document.getElementById('total-slides');
    const audioSegments = document.getElementById('audio-segments');
    const speakerNotes = document.getElementById('speaker-notes');
    const downloadBtn = document.getElementById('download-btn');
    const newProcessBtn = document.getElementById('new-process-btn');
    
    const faqItems = document.querySelectorAll('.faq-item');
    
    let currentJobId = null;
    let pptFile = null;
    let mp3File = null;
    let wavesurfer = null;
    let detectedMarkers = [];
    let currentSlideIndex = 0;
    let transcriptions = {};
    
    // Initialize
    init();
    
    function init() {
        // Set up event listeners
        getStartedBtn.addEventListener('click', scrollToUpload);
        pptBrowseBtn.addEventListener('click', () => pptFileInput.click());
        mp3BrowseBtn.addEventListener('click', () => mp3FileInput.click());
        
        pptFileInput.addEventListener('change', handlePptFileSelect);
        mp3FileInput.addEventListener('change', handleMp3FileSelect);
        
        pptUploadBox.addEventListener('dragover', handleDragOver);
        pptUploadBox.addEventListener('dragleave', handleDragLeave);
        pptUploadBox.addEventListener('drop', handlePptFileDrop);
        
        mp3UploadBox.addEventListener('dragover', handleDragOver);
        mp3UploadBox.addEventListener('dragleave', handleDragLeave);
        mp3UploadBox.addEventListener('drop', handleMp3FileDrop);
        
        uploadForm.addEventListener('submit', handleFormSubmit);
        
        playBtn.addEventListener('click', handlePlay);
        pauseBtn.addEventListener('click', handlePause);
        stopBtn.addEventListener('click', handleStop);
        
        continueToTranscriptionBtn.addEventListener('click', showTranscriptionSection);
        backToUploadBtn.addEventListener('click', showUploadSection);
        
        continueToProcessingBtn.addEventListener('click', startProcessing);
        backToAudioBtn.addEventListener('click', showAudioProcessingSection);
        
        downloadBtn.addEventListener('click', handleDownload);
        newProcessBtn.addEventListener('click', resetApplication);
        
        // Set up FAQ toggles
        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            question.addEventListener('click', () => {
                item.classList.toggle('active');
            });
        });
        
        // Check if files are selected to enable/disable process button
        checkFilesSelected();
    }
    
    function scrollToUpload() {
        uploadSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('active');
    }
    
    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('active');
    }
    
    function handlePptFileDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        pptUploadBox.classList.remove('active');
        
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (isPptFile(file)) {
                pptFile = file;
                updatePptFileInfo();
                checkFilesSelected();
            } else {
                showError('Please select a valid PowerPoint file (.ppt or .pptx)');
            }
        }
    }
    
    function handleMp3FileDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        mp3UploadBox.classList.remove('active');
        
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (isMp3File(file)) {
                mp3File = file;
                updateMp3FileInfo();
                checkFilesSelected();
            } else {
                showError('Please select a valid MP3 file');
            }
        }
    }
    
    function handlePptFileSelect(e) {
        if (pptFileInput.files.length) {
            const file = pptFileInput.files[0];
            if (isPptFile(file)) {
                pptFile = file;
                updatePptFileInfo();
                checkFilesSelected();
            } else {
                showError('Please select a valid PowerPoint file (.ppt or .pptx)');
                pptFileInput.value = '';
            }
        }
    }
    
    function handleMp3FileSelect(e) {
        if (mp3FileInput.files.length) {
            const file = mp3FileInput.files[0];
            if (isMp3File(file)) {
                mp3File = file;
                updateMp3FileInfo();
                checkFilesSelected();
            } else {
                showError('Please select a valid MP3 file');
                mp3FileInput.value = '';
            }
        }
    }
    
    function isPptFile(file) {
        const validTypes = ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
        return validTypes.includes(file.type) || /\.(ppt|pptx)$/i.test(file.name);
    }
    
    function isMp3File(file) {
        const validTypes = ['audio/mpeg', 'audio/mp3'];
        return validTypes.includes(file.type) || /\.mp3$/i.test(file.name);
    }
    
    function updatePptFileInfo() {
        if (pptFile) {
            const fileSize = formatFileSize(pptFile.size);
            pptFileInfo.textContent = `${pptFile.name} (${fileSize})`;
            pptFileInfo.style.color = '#27ae60';
        } else {
            pptFileInfo.textContent = '';
        }
    }
    
    function updateMp3FileInfo() {
        if (mp3File) {
            const fileSize = formatFileSize(mp3File.size);
            mp3FileInfo.textContent = `${mp3File.name} (${fileSize})`;
            mp3FileInfo.style.color = '#27ae60';
        } else {
            mp3FileInfo.textContent = '';
        }
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    function checkFilesSelected() {
        if (pptFile && mp3File) {
            processBtn.disabled = false;
        } else {
            processBtn.disabled = true;
        }
    }
    
    function handleFormSubmit(e) {
        e.preventDefault();
        
        if (!pptFile || !mp3File) {
            showError('Please select both PowerPoint and MP3 files');
            return;
        }
        
        // Show audio processing section
        uploadSection.classList.add('hidden');
        audioProcessingSection.classList.remove('hidden');
        
        // Initialize audio waveform
        initWaveform();
    }
    
    function initWaveform() {
        // Create a URL for the audio file
        const audioURL = URL.createObjectURL(mp3File);
        
        // Initialize WaveSurfer
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: '#3498db',
            progressColor: '#2980b9',
            cursorColor: '#e67e22',
            barWidth: 2,
            barRadius: 3,
            cursorWidth: 1,
            height: 100,
            barGap: 2
        });
        
        wavesurfer.load(audioURL);
        
        wavesurfer.on('ready', function() {
            // Simulate detecting markers
            simulateMarkerDetection();
        });
        
        wavesurfer.on('error', function(err) {
            showError('Error loading audio file: ' + err);
        });
    }
    
    function simulateMarkerDetection() {
        // In a real implementation, this would use speech recognition to detect markers
        // For this demo, we'll simulate finding markers at specific timestamps
        
        markersList.innerHTML = '<p>Analyzing audio for slide markers...</p>';
        
        // Simulate processing delay
        setTimeout(() => {
            const duration = wavesurfer.getDuration();
            
            // Create simulated markers
            detectedMarkers = [
                { slideNumber: 1, title: 'Introduction', timestamp: 0 },
                { slideNumber: 2, title: 'Background', timestamp: duration * 0.2 },
                { slideNumber: 3, title: 'Methods', timestamp: duration * 0.4 },
                { slideNumber: 4, title: 'Results', timestamp: duration * 0.6 },
                { slideNumber: 5, title: 'Conclusion', timestamp: duration * 0.8 }
            ];
            
            // Display markers
            displayMarkers();
            
            // Enable continue button
            continueToTranscriptionBtn.disabled = false;
            
            // Simulate transcriptions
            simulateTranscriptions();
        }, 2000);
    }
    
    function displayMarkers() {
        markersList.innerHTML = '';
        
        detectedMarkers.forEach(marker => {
            const markerItem = document.createElement('div');
            markerItem.className = 'marker-item';
            markerItem.innerHTML = `
                <div class="marker-title">Slide ${marker.slideNumber}: ${marker.title}</div>
                <div class="marker-timestamp">${formatTime(marker.timestamp)}</div>
            `;
            
            markerItem.addEventListener('click', () => {
                wavesurfer.seekTo(marker.timestamp / wavesurfer.getDuration());
            });
            
            markersList.appendChild(markerItem);
        });
    }
    
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    function simulateTranscriptions() {
        // In a real implementation, this would use speech recognition to transcribe audio segments
        // For this demo, we'll create simulated transcriptions
        
        transcriptions = {};
        
        for (let i = 0; i < detectedMarkers.length; i++) {
            const marker = detectedMarkers[i];
            const nextMarker = detectedMarkers[i + 1];
            const slideIndex = marker.slideNumber - 1;
            
            let transcription = `Speaker notes for Slide ${marker.slideNumber}: ${marker.title}. `;
            
            // Add some dummy content based on the slide title
            switch (marker.title.toLowerCase()) {
                case 'introduction':
                    transcription += 'Welcome to this presentation. Today we will discuss the key points of our project and its significance in the field.';
                    break;
                case 'background':
                    transcription += 'Let me provide some context for our work. This research builds upon previous studies in the area and addresses several gaps in the literature.';
                    break;
                case 'methods':
                    transcription += 'Our approach involved a mixed-methods design. We collected data through surveys, interviews, and experimental procedures.';
                    break;
                case 'results':
                    transcription += 'Our findings indicate a significant improvement over baseline measures. The data shows a 35% increase in efficiency and a 20% reduction in errors.';
                    break;
                case 'conclusion':
                    transcription += 'To summarize, we have demonstrated the effectiveness of our approach. Future work will focus on scaling the solution and addressing limitations.';
                    break;
                default:
                    transcription += 'This slide contains important information related to our project. Please refer to the visual elements for additional details.';
            }
            
            transcriptions[slideIndex] = transcription;
        }
    }
    
    function handlePlay() {
        wavesurfer.play();
    }
    
    function handlePause() {
        wavesurfer.pause();
    }
    
    function handleStop() {
        wavesurfer.stop();
    }
    
    function showTranscriptionSection() {
        audioProcessingSection.classList.add('hidden');
        transcriptionSection.classList.remove('hidden');
        
        // Populate slides navigation
        populateSlidesNav();
        
        // Set initial slide
        setCurrentSlide(0);
    }
    
    function showUploadSection() {
        audioProcessingSection.classList.add('hidden');
        uploadSection.classList.remove('hidden');
        
        // Clean up wavesurfer
        if (wavesurfer) {
            wavesurfer.destroy();
            wavesurfer = null;
        }
    }
    
    function showAudioProcessingSection() {
        transcriptionSection.classList.add('hidden');
        audioProcessingSection.classList.remove('hidden');
    }
    
    function populateSlidesNav() {
        slidesNav.innerHTML = '';
        
        detectedMarkers.forEach((marker, index) => {
            const li = document.createElement('li');
            li.textContent = `Slide ${marker.slideNumber}`;
            li.dataset.index = index;
            
            if (index === 0) {
                li.classList.add('active');
            }
            
            li.addEventListener('click', () => {
                setCurrentSlide(index);
                
                // Update active state
                document.querySelectorAll('#slides-nav li').forEach(item => {
                    item.classList.remove('active');
                });
                li.classList.add('active');
            });
            
            slidesNav.appendChild(li);
        });
    }
    
    function setCurrentSlide(index) {
        currentSlideIndex = index;
        const marker = detectedMarkers[index];
        const nextMarker = detectedMarkers[index + 1];
        
        // Update slide title
        currentSlideTitle.textContent = `Slide ${marker.slideNumber}: ${marker.title}`;
        
        // Update transcription text
        const slideIndex = marker.slideNumber - 1;
        transcriptionText.value = transcriptions[slideIndex] || '';
        
        // Update audio player
        const audioURL = URL.createObjectURL(mp3File);
        segmentPlayer.src = audioURL;
        
        // Set start time
        segmentPlayer.currentTime = marker.timestamp;
        
        // Set end time if not the last marker
        if (nextMarker) {
            segmentPlayer.addEventListener('timeupdate', function() {
                if (segmentPlayer.currentTime >= nextMarker.timestamp) {
                    segmentPlayer.pause();
                }
            });
        }
    }
    
    function startProcessing() {
        transcriptionSection.classList.add('hidden');
        processingSection.classList.remove('hidden');
        
        // Update transcriptions with edited text
        const slideIndex = detectedMarkers[currentSlideIndex].slideNumber - 1;
        transcriptions[slideIndex] = transcriptionText.value;
        
        // Create form data
        const formData = new FormData();
        formData.append('ppt_file', pptFile);
        formData.append('mp3_file', mp3File);
        formData.append('transcription_service', document.getElementById('transcription-service').value);
        
        // Set initial progress
        updateProgress(0);
        updateProgressStep('uploading');
        
        // Simulate processing (in a real implementation, this would be an actual API call)
        simulateProcessing();
    }
    
    function simulateProcessing() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            
            if (progress <= 25) {
                updateProgress(progress);
                statusMessage.textContent = 'Uploading your files...';
                updateProgressStep('uploading');
            } else if (progress <= 50) {
                updateProgress(progress);
                statusMessage.textContent = 'Segmenting audio...';
                updateProgressStep('segmenting');
            } else if (progress <= 75) {
                updateProgress(progress);
                statusMessage.textContent = 'Transcribing audio segments...';
                updateProgressStep('transcribing');
            } else if (progress < 100) {
                updateProgress(progress);
                statusMessage.textContent = 'Integrating with PowerPoint...';
                updateProgressStep('integrating');
            } else {
                clearInterval(interval);
                updateProgress(100);
                statusMessage.textContent = 'Processing complete!';
                
                // Show results
                setTimeout(() => {
                    showResults();
                }, 1000);
            }
        }, 300);
        
        // Simulate job ID
        currentJobId = 'sim_' + Math.random().toString(36).substr(2, 9);
    }
    
    function updateProgress(percent) {
        progressBar.style.width = `${percent}%`;
    }
    
    function updateProgressStep(step, completed = false) {
        // Reset all steps
        Object.values(progressSteps).forEach(el => {
            el.classList.remove('active', 'completed');
        });
        
        // Set active step
        progressSteps[step].classList.add('active');
        
        // Set completed steps
        const steps = ['uploading', 'segmenting', 'transcribing', 'integrating'];
        const currentIndex = steps.indexOf(step);
        
        for (let i = 0; i < currentIndex; i++) {
            progressSteps[steps[i]].classList.add('completed');
        }
        
        if (completed) {
            progressSteps[step].classList.add('completed');
        }
    }
    
    function showResults() {
        processingSection.classList.add('hidden');
        resultSection.classList.remove('hidden');
        
        // Update result details
        totalSlides.textContent = detectedMarkers.length;
        audioSegments.textContent = detectedMarkers.length;
        speakerNotes.textContent = Object.keys(transcriptions).length;
    }
    
    function handleDownload() {
        // In a real implementation, this would download the processed file
        // For this demo, we'll show a message
        alert('In a real implementation, this would download your enhanced presentation. The file would include audio segments and speaker notes for each slide.');
    }
    
    function resetApplication() {
        // Reset file inputs
        pptFileInput.value = '';
        mp3FileInput.value = '';
        pptFile = null;
        mp3File = null;
        currentJobId = null;
        
        // Reset file info
        pptFileInfo.textContent = '';
        mp3FileInfo.textContent = '';
        
        // Reset wavesurfer
        if (wavesurfer) {
            wavesurfer.destroy();
            wavesurfer = null;
        }
        
        // Reset markers and transcriptions
        detectedMarkers = [];
        transcriptions = {};
        
        // Disable process button
        processBtn.disabled = true;
        
        // Hide all sections except upload
        audioProcessingSection.classList.add('hidden');
        transcriptionSection.classList.add('hidden');
        processingSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        
        // Show upload section
        uploadSection.classList.remove('hidden');
        
        // Scroll to upload section
        uploadSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    function showError(message) {
        // In a real application, this would show a proper error message
        alert(message);
    }
});
