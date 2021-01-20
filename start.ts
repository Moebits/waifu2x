import * as fs from "fs"
import waifu2x from "./waifu2x"

// waifu2x.upScaleImages("./images", "./images/upscale", {recursion: 0})
(async () => {
    const output = await waifu2x.upscaleImage("./images/laffey2.jpg", "./images/upscale")
    console.log(output)
    const result = await waifu2x.upscaleGIF("./images/gifs/fbi.gif", "./images/gifs", {speed: 1.0})
    console.log(result)
    
    return
})()
