import waifu2x from "./waifu2x"

(async () => {
    const progress = (current: number, total: number) => {
        console.log(`Current: ${current} Total: ${total}`)
    }
    // const result = await waifu2x.upscaleVideo("./images/videos/paradise.mp4", "./images/videos/paradise2x.mp4", {scale: 1.1, speed: 2, pitch: false, framerate: 1}, progress)
    const result = await waifu2x.upscaleGIF("./images/gifs/chibi.gif", "./images/gifs/chibi2x.gif", {scale: 1.2, speed: 2}, progress)
    console.log(result)
})()
