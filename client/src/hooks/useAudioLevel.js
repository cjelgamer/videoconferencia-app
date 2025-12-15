import { useState, useEffect, useRef } from 'react';

export const useAudioLevel = (stream) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        if (!stream) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(stream);

            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.8;
            microphone.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const threshold = 30; // Adjust sensitivity

            const detectAudio = () => {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

                setIsSpeaking(average > threshold);
                animationRef.current = requestAnimationFrame(detectAudio);
            };

            detectAudio();

            return () => {
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                }
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                }
            };
        } catch (error) {
            console.error('Error setting up audio detection:', error);
        }
    }, [stream]);

    return isSpeaking;
};
