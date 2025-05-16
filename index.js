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

        // Wait until Faust node and UI are ready
        await initializeFaust(sourceRef, audioContext);

        // ✅ Now safe to start after routing is done
        sourceRef.start();
        console.log("Audio playback started");

    } catch (error) {
        console.error("Error during audio processing:", error);
    }
});

async function initializeFaust(source, audioContext) {
    const { createFaustNode, createFaustUI } = await import("./create-node.js");

    const result = await createFaustNode(source, "osc", FAUST_DSP_VOICES, audioContext);
    faustNode = result.faustNode;

    if (!faustNode) {
        throw new Error("Faust DSP not compiled");
    }

    // Connect: source → Faust → destination
    source.connect(faustNode);
    faustNode.connect(audioContext.destination);

    await createFaustUI($divFaustUI, faustNode);
}
