const FAUST_DSP_VOICES = 0;

let sourceRef;
let faustNode;
const $divFaustUI = document.getElementById("div-faust-ui");

window.addEventListener("message", async (event) => {
    console.log("Received message in iframe:", event.data);

    const url = event.data;

    if (typeof url !== "string" || !url.startsWith("http")) {
        console.warn("Invalid URL received in message:", url);
        return;
    }

    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();

        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        sourceRef = source;

        // Make sure Faust library is properly loaded before initializing
        await loadFaustLibrary();
        
        // Wait until Faust node and UI are ready
        await initializeFaust(sourceRef, audioContext);

        // ✅ Now safe to start after routing is done
        sourceRef.start();
        console.log("Audio playback started");

    } catch (error) {
        console.error("Error during audio processing:", error);
    }
});

// Add function to ensure Faust library is properly loaded
async function loadFaustLibrary() {
    // Check if Faust is already loaded
    if (window.Faust && window.Faust.ready) {
        return window.Faust.ready;
    }
    
    // Load Faust if not already done
    if (!window.Faust) {
        console.log("Loading Faust library...");
        // You might need to adjust the path to match where your Faust library is located
        await import("./path-to-faust-library.js");
    }
    
    // Wait for Faust to be ready
    return new Promise(resolve => {
        if (window.Faust && window.Faust.ready) {
            resolve();
        } else {
            // Set up listener for when Faust is ready
            window.addEventListener("faust-ready", resolve, { once: true });
        }
    });
}

async function initializeFaust(source, audioContext) {
    try {
        const { createFaustNode, createFaustUI } = await import("./create-node.js");

        // Check if Faust is properly initialized before creating node
        if (!window.Faust) {
            throw new Error("Faust library not loaded");
        }

        const result = await createFaustNode(source, "osc", FAUST_DSP_VOICES);
        
        if (!result || !result.faustNode) {
            throw new Error("Failed to create Faust node");
        }
        
        faustNode = result.faustNode;

        // Connect: source → Faust → destination
        source.connect(faustNode);
        faustNode.connect(audioContext.destination);

        await createFaustUI($divFaustUI, faustNode);
    } catch (error) {
        console.error("Error initializing Faust:", error);
        throw error;
    }
}