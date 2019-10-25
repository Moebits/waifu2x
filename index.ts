import * as fs from "fs"
import waifu2x from "./Waifu2x"

// waifu2x.upScaleImages("./images", "./images/upscale", {recursion: 0})
(async () => {
    // const output = waifu2x.upScaleImage("./images/laffey2.jpg", "./images/upscale", {jpgWebpQuality: 0, pngCompression: 0})
    // console.log(output)
    // await waifu2x.upScaleGIF("./images/gifs/chibi.gif", "./images/gifs")
    const files = fs.readdirSync("./images/gifs/chibiFrames/upscaled")
    const fileMap = files.map((f) => `./images/gifs/chibiFrames/upscaled/${f}`)
    await waifu2x.encodeGif(fileMap, "./images/gifs/chibi2x.gif")
})()
