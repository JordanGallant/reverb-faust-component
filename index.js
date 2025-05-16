// Set to > 0 if the DSP is polyphonic
const FAUST_DSP_VOICES = 0;

/**
 * @typedef {import("./faustwasm").FaustAudioWorkletNode} FaustAudioWorkletNode
 * @typedef {import("./faustwasm").FaustDspMeta} FaustDspMeta
 * @typedef {import("./faustwasm").FaustUIDescriptor} FaustUIDescriptor
 * @typedef {import("./faustwasm").FaustUIGroup} FaustUIGroup
 * @typedef {import("./faustwasm").FaustUIItem} FaustUIItem
 */

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

// Improved message listener with better logging
window.addEventListener("message", (event) => {
    console.log("Received message in iframe:", event.data);
    
    // Add some origin safety check
    if (event.origin !== "https://your-client-domain.com") {
        // You can remove this check during development or set it to your actual domain
        // console.log("Ignoring message from unknown origin:", event.origin);
        // return;
    }
    
    // Respond back to parent to confirm message was received
    if (event.source) {
        event.source.postMessage({
            type: "CONFIRMATION",
            message: "Message received in PWA: " + event.data
        }, "*");
        console.log("Sent confirmation back to parent");
    }
});

const AudioCtx = window.AudioContext || window.webkitAudioContext; // compatibilty with
const audioContext = new AudioCtx({ latencyHint: 0.00001 });
console.log("hello")
audioContext.destination.channelInterpretation = "discrete";
audioContext.suspend(); //pauses audio context

// Declare faustNode as a global variable
let faustNode;

// Called at load time
(async () => {
    try {
        // creates a faust node
        const { createFaustNode, createFaustUI } = await import("./create-node.js");

        // To test the ScriptProcessorNode mode
        // const result = await createFaustNode(audioContext, "osc", FAUST_DSP_VOICES, true, 512);
        const result = await createFaustNode(audioContext, "osc", FAUST_DSP_VOICES);
        faustNode = result.faustNode;  // Assign to the global variable
        if (!faustNode) throw new Error("Faust DSP not compiled");

        // Create the Faust UI
        await createFaustUI($divFaustUI, faustNode);
        
        // Signal to parent that initialization is complete
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: "INIT_COMPLETE",
                message: "Faust PWA initialized successfully"
            }, "*");
            console.log("Sent initialization complete message to parent");
        }
    } catch (error) {
        console.error("Error during initialization:", error);
        // Inform parent about the error
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: "INIT_ERROR",
                message: error.message
            }, "*");
        }
    }
})();

// Synchronous function to resume AudioContext, to be called first in the synchronous event listener
function resumeAudioContext() {
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('AudioContext resumed successfully');
            // Notify parent that audio context is active
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: "AUDIO_RESUMED",
                    message: "AudioContext resumed successfully"
                }, "*");
            }
        }).catch(error => {
            console.error('Error when resuming AudioContext:', error);
        });
    }
}

let sensorHandlersBound = false;
let midiHandlersBound = false;

// Function to activate MIDI and Sensors on user interaction
async function activateMicSensors() {

    // Import the create-node module
    const { connectToAudioInput, requestPermissions } = await import("./create-node.js");

    // Request permission for sensors
    await requestPermissions();

    // Activate sensor listeners
    if (!sensorHandlersBound) {
        await faustNode.startSensors();
        sensorHandlersBound = true;
    }
    
    // Connect the Faust node to the audio output
    faustNode.connect(audioContext.destination);

    // Connect the Faust node to the audio input
    if (faustNode.numberOfInputs > 0) {
        await connectToAudioInput(audioContext, null, faustNode, null);
    }

    // Resume the AudioContext
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
}

// Function to suspend AudioContext, deactivate MIDI and Sensors on user interaction
async function deactivateAudioMicSensors() {

    // Suspend the AudioContext
    if (audioContext.state === 'running') {
        await audioContext.suspend();
    }

    // Deactivate sensor listeners
    if (sensorHandlersBound) {
        faustNode.stopSensors();
        sensorHandlersBound = false;
    }

}

// Event listener to handle user interaction
function handleUserInteraction() {

    // Resume AudioContext synchronously
    resumeAudioContext();

    // Launch the activation of MIDI and Sensors
    activateMicSensors().catch(error => {
        console.error('Error when activating audio, MIDI and sensors:', error);
    });
}

// Activate AudioContext, MIDI and Sensors on user interaction
window.addEventListener('click', handleUserInteraction);
window.addEventListener('touchstart', handleUserInteraction);

// Deactivate AudioContext, MIDI and Sensors on user interaction
window.addEventListener('visibilitychange', function () {
    if (window.visibilityState === 'hidden') {
        deactivateAudioMicSensors();
    }
});

// Function to handle control commands from parent
function handleControlCommand(command, params = {}) {
    console.log(`Executing command: ${command}`, params);
    
    switch (command) {
        case "START_AUDIO":
            resumeAudioContext();
            activateMicSensors();
            break;
        case "STOP_AUDIO":
            deactivateAudioMicSensors();
            break;
        case "SET_PARAMETER":
            if (faustNode && params.path && params.value !== undefined) {
                faustNode.setParamValue(params.path, params.value);
                console.log(`Parameter set: ${params.path} = ${params.value}`);
            }
            break;
        default:
            console.log("Unknown command:", command);
    }
}
Claude
