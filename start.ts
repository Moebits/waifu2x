import waifu2x from "./waifu2x"

(async () => {
    const progress = (current: number, total: number) => {
        console.log(`Current: ${current} Total: ${total}`)
    }
    const progress2 = (percent: number) => {
        console.log(`Percent: ${percent}`)
    }
    //const result = await waifu2x.upscaleImage("./images/laffey2.jpg", "./images/upscale/laffey3x.jpg", {scale: 4, upscaler: "real-esrgan"}, progress2)
    const result = await waifu2x.upscaleGIF("./images/gifs/chibi.gif", "./images/gifs/chibi2x.gif", {scale: 2, upscaler: "real-esrgan"}, progress)
    console.log(result)
})()
