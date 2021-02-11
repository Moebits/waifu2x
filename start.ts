import waifu2x from "./waifu2x"

(async () => {
    const progress = (current: number, total: number) => {
        console.log(`Current: ${current} Total: ${total}`)
    }
    const result = await waifu2x.upscaleVideo("./images/videos/paradise.mp4", "./images/videos/paradise2x.mp4", {scale: 1, speed: 2, pitch: true, framerate: 1})
    console.log(result)
})()
