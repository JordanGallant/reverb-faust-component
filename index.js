// Set to > 0 if the DSP is polyphonic
const FAUST_DSP_VOICES = 0;

/**
 * @typedef {import("./faustwasm").FaustAudioWorkletNode} FaustAudioWorkletNode
 * @typedef {import("./faustwasm").FaustDspMeta} FaustDspMeta
 * @typedef {import("./faustwasm").FaustUIDescriptor} FaustUIDescriptor
 * @typedef {import("./faustwasm").FaustUIGroup} FaustUIGroup
 * @typedef {import("./faustwasm").FaustUIItem} FaustUIItem
 */

let sourceRef;
let faustNode;
let audioContext;
let faustInitialized = false;

/** @type {HTMLDivElement} */
const $divFaustUI = document.getElementById("div-faust-ui");

/**
 * Loads a track from a given URL and plays it through Faust.
 * Stops any previous source before playing the new one.
 * @param {string} url - The audio file URL
 */
async function loadAndPlaySong(url) {
    if (sourceRef) {
        try {
            sourceRef.stop();
            sourceRef.disconnect();
            console.log("Previous source stopped and disconnected.");
        } catch (e) {
            console.warn("Error stopping previous source:", e);
        }
    }

    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();

        // Reuse or create the AudioContext
        if (!audioContext) {
            audioContext = new AudioContext();
        }

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        sourceRef = source;

        // Initialize Faust DSP only once
        if (!faustInitialized) {
            const { createFaustNode, createFaustUI } = await import("./create-node.js");
            const result = await createFaustNode(audioContext, "osc", FAUST_DSP_VOICES);
            faustNode = result.faustNode;
            if (!faustNode) throw new Error("Faust DSP not compiled");

            faustNode.connect(audioContext.destination);
            await createFaustUI($divFaustUI, faustNode);

            faustInitialized = true;
            console.log("Faust DSP and UI initialized.");
        }

        // Connect and play
        source.connect(faustNode);
        source.start();
        console.log("New audio playback started.");

    } catch (error) {
        console.error("Error during audio processing:", error);
    }
}

// Listen for messages from parent
window.addEventListener("message", (event) => {
    const url = event.data;
    if (typeof url === "string" && url.startsWith("http")) {
        console.log("Received valid URL in iframe:", url);
        loadAndPlaySong(url);
    } else {
        console.warn("Invalid URL received in message:", url);
    }
});

// Service Worker Registration
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(reg => console.log("Service Worker registered", reg))
            .catch(err => console.log("Service Worker registration failed", err));
    });
}

// Optional: visibility handler
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        console.log("Page hidden");
        // Optional: pause/resume logic here
    }
});
