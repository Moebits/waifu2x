import * as fs from "fs"
import waifu2x from "./waifu2x"

// waifu2x.upScaleImages("./images", "./images/upscale", {recursion: 0})
(async () => {
    const output = waifu2x.upscaleImage("./images/laffey2.jpg", "./images/upscale", {jpgWebpQuality: 0, pngCompression: 0})
    console.log(output)
    // await waifu2x.upscaleGIF("./images/gifs/fbi.gif", "./images/gifs", 3)
})()
