const recordButton = document.getElementById('recordButton');
const statusDiv = document.getElementById('status');
const conversationDiv = document.getElementById('conversation');

let mediaRecorder;
let audioChunks = [];

recordButton.addEventListener('mousedown', startRecording);
recordButton.addEventListener('mouseup', stopRecording);
recordButton.addEventListener('touchstart', startRecording);
recordButton.addEventListener('touchend', stopRecording);

function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();
            statusDiv.textContent = 'Recording...';
            recordButton.textContent = 'Release to Send';
            audioChunks = [];

            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener('stop', () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                sendAudioToServer(audioBlob);
                statusDiv.textContent = 'Thinking...';
                recordButton.textContent = 'Hold to Speak';
            });
        })
        .catch(err => {
            console.error('Error accessing microphone:', err);
            statusDiv.textContent = 'Error: Could not access microphone.';
        });
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

async function sendAudioToServer(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob);

    try {
        const response = await fetch('/process-audio', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Server error');
        }

        const data = await response.json();
        
        // Add user's message to conversation
        const userMessage = document.createElement('p');
        userMessage.textContent = `You: ${data.userText}`;
        conversationDiv.appendChild(userMessage);

        // Add AI's message to conversation
        const aiMessage = document.createElement('p');
        aiMessage.textContent = `EchoAid: ${data.aiText}`;
        conversationDiv.appendChild(aiMessage);

        // Play AI's audio response
        const audio = new Audio(data.aiAudio);
        audio.play();

        statusDiv.textContent = '';

    } catch (error) {
        console.error('Error sending audio to server:', error);
        statusDiv.textContent = 'Error: Could not process audio.';
    }
}