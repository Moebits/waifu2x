import * as fs from "fs"
import waifu2x from "./waifu2x"

// waifu2x.upScaleImages("./images", "./images/upscale", {recursion: 0})
(async () => {
    const output = await waifu2x.upscaleImage("./images/jimp.png", "./images/upscale")
    console.log(output)
    // await waifu2x.upscaleGIF("./images/gifs/fbi.gif", "./images/gifs", 3)
    return
})()
