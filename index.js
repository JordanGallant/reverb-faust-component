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
let faustInitialized = false;

/** @type {HTMLDivElement} */
const $divFaustUI = document.getElementById("div-faust-ui");

// Message listener: runs when the parent window sends a URL
window.addEventListener("message", async (event) => {
    console.log("Received message in iframe:", event.data);

    const url = event.data;

    // Validate the message
    if (typeof url !== "string" || !url.startsWith("http")) {
        console.warn("Invalid URL received in message:", url);
        return;
    }

    if (faustInitialized) {
        console.warn("Faust already initialized. Skipping duplicate init.");
        return;
    }

    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();

        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const source = audioContext.createBufferSource();
        sourceRef = source;
        source.buffer = audioBuffer;

        // Load Faust and create DSP node
        const { createFaustNode, createFaustUI } = await import("./create-node.js");
        const result = await createFaustNode(audioContext, "osc", FAUST_DSP_VOICES);
        faustNode = result.faustNode;
        if (!faustNode) throw new Error("Faust DSP not compiled");

        // Connect Faust node to destination
        faustNode.connect(audioContext.destination);

        // Create UI
        await createFaustUI($divFaustUI, faustNode);

        // Connect audio source to Faust
        source.connect(faustNode);
        source.start();

        console.log("Audio playback started with Faust processing");
        faustInitialized = true;

    } catch (error) {
        console.error("Error during audio processing:", error);
    }
});

// Service Worker Registration (unchanged)
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(reg => console.log("Service Worker registered", reg))
            .catch(err => console.log("Service Worker registration failed", err));
    });
}

// Optional: track visibility for UX or pause/resume
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        console.log("Page hidden");
        // Optional: handle visibility state
    }
});
