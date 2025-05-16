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
//new code
window.addEventListener("message", async (event) => {
    console.log("Received message in iframe:", event.data);

    const url = event.data;

    // Skip if the message is not a valid URL
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
        sourceRef = source
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();// start te music from iframe
        console.log("Audio playback started");
    } catch (error) {
        console.error("Error during audio processing:", error);
    }
});


/**
 * Registers the service worker.
 */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(reg => console.log("Service Worker registered", reg))
            .catch(err => console.log("Service Worker registration failed", err));
    });
}

/** @type {HTMLDivElement} */
const $divFaustUI = document.getElementById("div-faust-ui");

/** @type {typeof AudioContext} */


//old code
const AudioCtx = window.AudioContext || window.webkitAudioContext; // compatibilty with
const audioContext = new AudioCtx({ latencyHint: 0.00001 });
audioContext.destination.channelInterpretation = "discrete";
audioContext.suspend(); //pauses audio context

// Declare faustNode as a global variable
let faustNode;

// Called at load time
(async () => {

    // creates a faust node
    const { createFaustNode, createFaustUI } = await import("./create-node.js");
    // To test the ScriptProcessorNode mode
    const result = await createFaustNode(sourceRef, "osc", FAUST_DSP_VOICES);
    faustNode = result.faustNode;  // Assign to the global variable
    if (!faustNode) throw new Error("Faust DSP not compiled");

    // Create the Faust UI
    await createFaustUI($divFaustUI, faustNode);

})();


let sensorHandlersBound = false;
let midiHandlersBound = false;


window.addEventListener('visibilitychange', function () {
    if (window.visibilityState === 'hidden') {
    }
});


