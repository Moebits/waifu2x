import waifu2x from "./waifu2x"

(async () => {
    // const output = await waifu2x.upscaleImage("./images/laffey2.jpg", "./images/upscale")
    // console.log(output)
    let progress = (current: number, total: number) => {
        console.log(`Current Frame: ${current} Total Frames: ${total}`)
    }
    // const result = await waifu2x.upscaleGIF("./images/gifs/fbi.gif", "./images/gifs/fbi2x.gif", {parallelFrames: 3}, progress)
    // console.log(result)
    const output = await waifu2x.parseResolution("./images/videos/paradise.mp4")
    console.log(output)
    return
})()
