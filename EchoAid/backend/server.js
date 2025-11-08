const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const port = 3000;

// Serve the frontend
app.use(express.static(path.join(__dirname, '..')));

// Set up multer for audio file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/process-audio', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    try {
        // 1. Transcribe audio with ElevenLabs
        const userText = await transcribeAudio(req.file.buffer);

        // 2. Get AI response from Gemini
        const aiText = await getGeminiResponse(userText);

        // 3. Convert AI response to audio with ElevenLabs
        const aiAudioUrl = await textToSpeech(aiText);

        // 4. Send response to frontend
        res.json({
            userText: userText,
            aiText: aiText,
            aiAudio: aiAudioUrl
        });

    } catch (error) {
        console.error('Error processing audio:', error);
        res.status(500).json({ error: 'Failed to process audio.' });
    }
});

async function transcribeAudio(audioBuffer) {
    const formData = new FormData();
    formData.append('file', audioBuffer, { filename: 'audio.webm', contentType: 'audio/webm' });
    formData.append('model', 'eleven_multilingual_v2');

    try {
        const response = await axios.post('https://api.elevenlabs.io/v1/speech-to-text', formData, {
            headers: {
                ...formData.getHeaders(),
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
            },
        });
        return response.data.text;
    } catch (error) {
        console.error('Error transcribing audio:', error.response ? error.response.data : error.message);
        throw new Error('Failed to transcribe audio.');
    }
}

async function getGeminiResponse(text) {
    const systemPrompt = "You are EchoAid, a compassionate and empathetic mental health companion. Your purpose is to listen to users, understand their emotional state, and provide supportive and grounding responses. You are not a therapist, so do not offer medical advice. Instead, focus on active listening, validating their feelings, and offering gentle encouragement or simple grounding exercises. Keep your responses concise and use a warm, human-like tone. When appropriate, you can ask open-ended questions to encourage the user to share more.";

    try {
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            contents: [{
                parts: [{
                    text: systemPrompt + "\n\nUser: " + text
                }]
            }]
        });

        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Error getting Gemini response:', error.response ? error.response.data : error.message);
        throw new Error('Failed to get Gemini response.');
    }
}

async function textToSpeech(text) {
    const voiceId = '21m00Tcm4TlvDq8ikWAM'; // A good default voice
    const fileName = `audio_${Date.now()}.mp3`;
    const filePath = path.join(__dirname, '..', fileName);

    try {
        const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            text: text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.5
            }
        }, {
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(`/${fileName}`));
            writer.on('error', reject);
        });

    } catch (error) {
        console.error('Error with ElevenLabs TTS:', error.response ? error.response.data : error.message);
        throw new Error('Failed to convert text to speech.');
    }
}


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});