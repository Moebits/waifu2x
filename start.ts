import waifu2x from "./waifu2x"

(async () => {
    const progress = (current: number, total: number) => {
        console.log(`Current: ${current} Total: ${total}`)
    }
    const result = await waifu2x.upscaleVideo("F:/Downloads/bif.mp4", "F:/Downloads/bif2x.mp4", {scale: 1.1, framerate: 3}, progress)
    .catch(console.log)
    console.log(result)
})()
