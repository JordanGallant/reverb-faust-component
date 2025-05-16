// Set to > 0 if the DSP is polyphonic 
const FAUST_DSP_VOICES = 0;

/**
 * @typedef {import("./faustwasm").FaustAudioWorkletNode} FaustAudioWorkletNode
 * @typedef {import("./faustwasm").FaustDspMeta} FaustDspMeta
 * @typedef {import("./faustwasm").FaustUIDescriptor} FaustUIDescriptor
 * @typedef {import("./faustwasm").FaustUIGroup} FaustUIGroup
 * @typedef {import("./faustwasm").FaustUIItem} FaustUIItem
 */

// We'll create the AudioContext but not initialize it yet
let audioContext = null;
let faustNode = null;

/** @type {HTMLDivElement} */
const $divFaustUI = document.getElementById("div-faust-ui");

// Initialize audio and Faust only after user interaction
async function initAudio() {
    if (audioContext !== null) return; // Already initialized
    
    // Create AudioContext on demand
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx({ latencyHint: 0.00001 });
    audioContext.destination.channelInterpretation = "discrete";
    
    try {
        // creates a faust node
        const { createFaustNode, createFaustUI } = await import("./create-node.js");
        const result = await createFaustNode(audioContext, "osc", FAUST_DSP_VOICES);
        faustNode = result.faustNode;
        
        if (!faustNode) throw new Error("Faust DSP not compiled");
        
        // Create the Faust UI
        await createFaustUI($divFaustUI, faustNode);
        
        console.log("Audio and Faust initialized successfully");
    } catch (error) {
        console.error("Error initializing Faust DSP:", error);
    }
}

// Add a click handler to initialize audio
document.addEventListener('click', initAudio, { once: true });

// Handle incoming audio URLs
window.addEventListener("message", async (event) => {
    console.log("Received message in iframe:", event.data);
    
    const url = event.data;
    
    // Skip if the message is not a valid URL
    if (typeof url !== "string" || !url.startsWith("http")) {
        console.warn("Invalid URL received in message:", url);
        return;
    }
    
    try {
        // Make sure audio is initialized
        if (!audioContext) {
            console.warn("AudioContext not initialized yet. Please interact with the page first.");
            return;
        }
        
        // Ensure the AudioContext is running
        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }
        
        // Fetch and decode the audio file
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Create and connect audio source
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        // Connect to Faust node if available, otherwise directly to output
        if (faustNode) {
            source.connect(faustNode);
            faustNode.connect(audioContext.destination);
        } else {
            // If Faust node isn't available, connect directly to output
            source.connect(audioContext.destination);
        }
        
        source.start();
        console.log("Audio playback started");
    } catch (error) {
        console.error("Error during audio processing:", error);
    }
});

// Register service worker
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(reg => console.log("Service Worker registered", reg))
            .catch(err => console.log("Service Worker registration failed", err));
    });
}

let sensorHandlersBound = false;
let midiHandlersBound = false;

window.addEventListener('visibilitychange', function () {
    if (window.visibilityState === 'hidden') {
        // Handle visibility change if needed
    }
});