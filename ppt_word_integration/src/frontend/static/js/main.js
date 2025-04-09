/**
 * PowerPoint Speaker Notes Enhancer
 * Main JavaScript File
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const uploadForm = document.getElementById('upload-form');
    const pptUploadBox = document.getElementById('ppt-upload-box');
    const wordUploadBox = document.getElementById('word-upload-box');
    const pptFileInput = document.getElementById('ppt-file');
    const wordFileInput = document.getElementById('word-file');
    const pptBrowseBtn = document.getElementById('ppt-browse-btn');
    const wordBrowseBtn = document.getElementById('word-browse-btn');
    const pptFileInfo = document.getElementById('ppt-file-info');
    const wordFileInfo = document.getElementById('word-file-info');
    const processBtn = document.getElementById('process-btn');
    const getStartedBtn = document.getElementById('get-started-btn');
    
    const uploadSection = document.getElementById('upload-section');
    const processingSection = document.getElementById('processing-section');
    const resultSection = document.getElementById('result-section');
    
    const progressBar = document.getElementById('progress-bar');
    const statusMessage = document.getElementById('status-message');
    const progressSteps = {
        uploading: document.getElementById('step-uploading'),
        extracting: document.getElementById('step-extracting'),
        converting: document.getElementById('step-converting'),
        finalizing: document.getElementById('step-finalizing')
    };
    
    const totalSlides = document.getElementById('total-slides');
    const notesAdded = document.getElementById('notes-added');
    const audioFiles = document.getElementById('audio-files');
    const downloadBtn = document.getElementById('download-btn');
    const newProcessBtn = document.getElementById('new-process-btn');
    
    const faqItems = document.querySelectorAll('.faq-item');
    
    let currentJobId = null;
    let pptFile = null;
    let wordFile = null;
    
    // Initialize
    init();
    
    function init() {
        // Set up event listeners
        getStartedBtn.addEventListener('click', scrollToUpload);
        pptBrowseBtn.addEventListener('click', () => pptFileInput.click());
        wordBrowseBtn.addEventListener('click', () => wordFileInput.click());
        
        pptFileInput.addEventListener('change', handlePptFileSelect);
        wordFileInput.addEventListener('change', handleWordFileSelect);
        
        pptUploadBox.addEventListener('dragover', handleDragOver);
        pptUploadBox.addEventListener('dragleave', handleDragLeave);
        pptUploadBox.addEventListener('drop', handlePptFileDrop);
        
        wordUploadBox.addEventListener('dragover', handleDragOver);
        wordUploadBox.addEventListener('dragleave', handleDragLeave);
        wordUploadBox.addEventListener('drop', handleWordFileDrop);
        
        uploadForm.addEventListener('submit', handleFormSubmit);
        
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
    
    function handleWordFileDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        wordUploadBox.classList.remove('active');
        
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            if (isWordFile(file)) {
                wordFile = file;
                updateWordFileInfo();
                checkFilesSelected();
            } else {
                showError('Please select a valid Word file (.doc or .docx)');
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
    
    function handleWordFileSelect(e) {
        if (wordFileInput.files.length) {
            const file = wordFileInput.files[0];
            if (isWordFile(file)) {
                wordFile = file;
                updateWordFileInfo();
                checkFilesSelected();
            } else {
                showError('Please select a valid Word file (.doc or .docx)');
                wordFileInput.value = '';
            }
        }
    }
    
    function isPptFile(file) {
        const validTypes = ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
        return validTypes.includes(file.type) || /\.(ppt|pptx)$/i.test(file.name);
    }
    
    function isWordFile(file) {
        const validTypes = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        return validTypes.includes(file.type) || /\.(doc|docx)$/i.test(file.name);
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
    
    function updateWordFileInfo() {
        if (wordFile) {
            const fileSize = formatFileSize(wordFile.size);
            wordFileInfo.textContent = `${wordFile.name} (${fileSize})`;
            wordFileInfo.style.color = '#27ae60';
        } else {
            wordFileInfo.textContent = '';
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
        if (pptFile && wordFile) {
            processBtn.disabled = false;
        } else {
            processBtn.disabled = true;
        }
    }
    
    function handleFormSubmit(e) {
        e.preventDefault();
        
        if (!pptFile || !wordFile) {
            showError('Please select both PowerPoint and Word files');
            return;
        }
        
        // Show processing section
        uploadSection.classList.add('hidden');
        processingSection.classList.remove('hidden');
        
        // Set initial progress
        updateProgress(0);
        updateProgressStep('uploading');
        
        // Create form data
        const formData = new FormData();
        formData.append('ppt_file', pptFile);
        formData.append('word_file', wordFile);
        formData.append('voice_type', document.getElementById('voice-type').value);
        formData.append('tts_service', document.getElementById('tts-service').value);
        
        // Upload files
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                currentJobId = data.job_id;
                
                // Update progress
                updateProgress(100);
                updateProgressStep('finalizing', true);
                
                // Show results
                showResults(data.details);
            } else {
                showError(data.message || 'An error occurred during processing');
                resetApplication();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError('An error occurred during processing. Please try again.');
            resetApplication();
        });
        
        // Simulate progress updates (in a real app, this would be based on server updates)
        simulateProgress();
    }
    
    function simulateProgress() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            
            if (progress <= 30) {
                updateProgress(progress);
                statusMessage.textContent = 'Uploading your files...';
                updateProgressStep('uploading');
            } else if (progress <= 60) {
                updateProgress(progress);
                statusMessage.textContent = 'Extracting and inserting speaker notes...';
                updateProgressStep('extracting');
            } else if (progress <= 90) {
                updateProgress(progress);
                statusMessage.textContent = 'Converting notes to speech...';
                updateProgressStep('converting');
            } else if (progress < 100) {
                updateProgress(progress);
                statusMessage.textContent = 'Finalizing your presentation...';
                updateProgressStep('finalizing');
            } else {
                clearInterval(interval);
            }
        }, 300);
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
        const steps = ['uploading', 'extracting', 'converting', 'finalizing'];
        const currentIndex = steps.indexOf(step);
        
        for (let i = 0; i < currentIndex; i++) {
            progressSteps[steps[i]].classList.add('completed');
        }
        
        if (completed) {
            progressSteps[step].classList.add('completed');
        }
    }
    
    function showResults(details) {
        // Hide processing section
        processingSection.classList.add('hidden');
        
        // Update result details
        totalSlides.textContent = details.slides_total || 0;
        notesAdded.textContent = details.slides_updated || 0;
        audioFiles.textContent = details.slides_with_audio || 0;
        
        // Show result section
        resultSection.classList.remove('hidden');
    }
    
    function handleDownload() {
        if (currentJobId) {
            window.location.href = `/api/download/${currentJobId}`;
        }
    }
    
    function resetApplication() {
        // Reset file inputs
        pptFileInput.value = '';
        wordFileInput.value = '';
        pptFile = null;
        wordFile = null;
        currentJobId = null;
        
        // Reset file info
        pptFileInfo.textContent = '';
        wordFileInfo.textContent = '';
        
        // Disable process button
        processBtn.disabled = true;
        
        // Hide result and processing sections
        resultSection.classList.add('hidden');
        processingSection.classList.add('hidden');
        
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
