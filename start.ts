import waifu2x from "./waifu2x"
import path from "path"
const base = path.join(__dirname, "../");
(async () => {
    const progress = (current: number, total: number) => {
        console.log(`Current: ${current} Total: ${total}`)
    }
    const progress2 = (percent: number) => {
        console.log(`Percent: ${percent}`)
    }
    //const result = await waifu2x.upscaleGIF(path.join(base, "./images/test.gif"), path.join(base, "./images/upscale/test.gif"), { upscaler: 'real-esrgan', parallelFrames: 3}, progress)
    const result2 = await waifu2x.upscaleImage(path.join(base, "./assets/laffey.jpg"), path.join(base, "./images/upscale/laffey3x.jpg"), { upscaler: 'real-esrgan'}, progress2)
    console.log(result2, result2)
})()
