import waifu2x from "./waifu2x"

(async () => {
    /*const progress = (current: number, total: number) => {
        console.log(`Current: ${current} Total: ${total}`)
    }
    const result = await waifu2x.upscaleVideo("./images/videos/paradise.mp4", "./images/videos/paradise2x.mp4", {scale: 1.1, speed: 2, pitch: false, framerate: 1}, progress)
    const result = await waifu2x.upscaleGIF("./images/gifs/fbi.gif", "./images/gifs/fbi2x.gif", {scale: 1.1, parallelFrames: 2}, progress)*/
    const result = await waifu2x.upscaleImage("./images/laffey2.jpg", "./images/upscale/laffey22x.jpg").catch((e) => console.log(e))
    console.log(result)
})()
