import waifu2x from "./waifu2x"

(async () => {
    const progress = (current: number, total: number) => {
        console.log(`Current: ${current} Total: ${total}`)
    }
    waifu2x.upscaleVideo("./images/videos/gab1.mp4", "./images/videos/gab2x.mp4", {scale: 1, framerate: 3}, progress)
    waifu2x.upscaleVideo("./images/videos/gab1.mp4", "./images/videos/gab2x.mp4", {scale: 1, framerate: 3}, progress)
})()
