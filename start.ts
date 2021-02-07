import waifu2x from "./waifu2x"

(async () => {
    // const result = await waifu2x.upscaleGIF("./images/gifs/fbi.gif", "./images/gifs/fbi2x.gif", {parallelFrames: 3}, progress)
    // console.log(result)
    const output = await waifu2x.upscaleImage("./images/laffey2.jpg", "./images/upscale")
    console.log(output)
})()
